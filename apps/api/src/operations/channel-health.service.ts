import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WahaService } from './waha.service';
import { EventsService } from './events.service';
import { JobLeaseService } from '../common/job-lease.service';
import { schedulersEnabled } from '../common/scheduler-mode';

/** One database lease per tenant prevents every API replica polling the same gateway. */
@Injectable()
export class ChannelHealthService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running=false;
  constructor(private readonly prisma:PrismaService,private readonly waha:WahaService,private readonly events:EventsService,@Optional() private readonly leases?:JobLeaseService){}
  onModuleInit(){if(!schedulersEnabled())return;this.timer=setInterval(()=>void this.check(),15000);this.timer.unref();void this.check();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  async check(){
    if(this.running)return;this.running=true;
    try {
      if(this.leases&&!(await this.leases.claim('channel-health',14000)))return;
      const channels=await this.prisma.channelConnection.findMany({where:{provider:'WAHA',isActive:true,tenant:{status:'ACTIVE'}},take:500});
      for(const channel of channels){
        const claimed=await this.prisma.$transaction(async tx=>{
          await tx.$queryRaw`SELECT id FROM channel_connections WHERE id=${channel.id}::uuid FOR UPDATE`;
          const row=await tx.channelConnection.findUnique({where:{id:channel.id}});
          if(!row?.isActive)return false;
          const settings=(row.settings&&typeof row.settings==='object'&&!Array.isArray(row.settings)?row.settings:{}) as Record<string,any>;
          if(Date.parse(settings.healthNextCheckAt||'')>Date.now())return false;
          await tx.channelConnection.update({where:{id:row.id},data:{settings:{...settings,healthNextCheckAt:new Date(Date.now()+30000).toISOString()}}});return true;
        });
        if(!claimed)continue;
        let result:{status:string;providerStatus?:string};
        let nextLastError: string | null = channel.lastError;
        try{result=await this.waha.status(channel);}
        catch{
          result={status:'UNKNOWN',providerStatus:'UNREACHABLE'};
          nextLastError='Não foi possível verificar o WhatsApp. A entrega de mensagens pode estar interrompida.';
        }
        const providerStatus=result.providerStatus||'UNKNOWN';
        if(result.status==='CONNECTED'||result.status==='CONNECTING'||result.status==='QR') nextLastError=null;
        // Histerese: falhas transitórias não derrubam o canal. Mantém o último
        // estado conhecido por até 2 verificações seguidas; só propaga
        // desconexão/erro real a partir da 3ª.
        const healthy=result.status==='CONNECTED';
        const statusWasConnected=channel.status==='CONNECTED';
        let effectiveStatus=channel.status;
        let changed=false;
        let freshCheckedAt: string | null = null;
        await this.prisma.$transaction(async tx=>{
          await tx.$queryRaw`SELECT id FROM channel_connections WHERE id=${channel.id}::uuid FOR UPDATE`;
          const row=await tx.channelConnection.findUnique({where:{id:channel.id}});if(!row)return;
          const settings=(row.settings&&typeof row.settings==='object'&&!Array.isArray(row.settings)?row.settings:{}) as Record<string,any>;
          const failures=healthy?0:(Number(settings.healthFailures)||0)+1;
          const tolerate=!healthy&&statusWasConnected&&failures<3;
          const nextStatus=tolerate?row.status:result.status;
          const nextError=tolerate?null:(healthy?null:nextLastError);
          effectiveStatus=nextStatus;
          changed=row.status!==nextStatus||row.lastError!==nextError||settings.healthProviderStatus!==providerStatus;
          freshCheckedAt=new Date().toISOString();
          await tx.channelConnection.update({where:{id:row.id},data:{status:nextStatus,lastError:nextError,settings:{...settings,healthCheckedAt:freshCheckedAt,healthProviderStatus:providerStatus,healthFailures:failures}}});
        });
        const previousCheckedAt=Date.parse(((channel.settings&&typeof channel.settings==='object'?(channel.settings as Record<string,any>).healthCheckedAt:'')||''));
        const staleRefresh=!Number.isFinite(previousCheckedAt)||Date.now()-previousCheckedAt>60000;
        if(changed||staleRefresh) this.events.publish(channel.tenantId,'channel.status',{id:channel.id,status:effectiveStatus,providerStatus,healthCheckedAt:freshCheckedAt,lastError:healthy?null:nextLastError,checkedAt:Date.now()});
      }
    }catch{/* Next interval retries; a stale timestamp remains visible to the operator. */}finally{this.running=false;}
  }
}
