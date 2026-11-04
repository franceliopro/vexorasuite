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
    if(this.leases&&!(await this.leases.claim('channel-health',14000)))return;
    try {
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
        let changed=false;
        await this.prisma.$transaction(async tx=>{
          await tx.$queryRaw`SELECT id FROM channel_connections WHERE id=${channel.id}::uuid FOR UPDATE`;
          const row=await tx.channelConnection.findUnique({where:{id:channel.id}});if(!row)return;
          const settings=(row.settings&&typeof row.settings==='object'&&!Array.isArray(row.settings)?row.settings:{}) as Record<string,any>;
          changed=row.status!==result.status||row.lastError!==nextLastError||settings.healthProviderStatus!==providerStatus;
          await tx.channelConnection.update({where:{id:row.id},data:{status:result.status,lastError:nextLastError,settings:{...settings,healthCheckedAt:new Date().toISOString(),healthProviderStatus:providerStatus}}});
        });
        if(changed) this.events.publish(channel.tenantId,'channel.status',{id:channel.id,...result});
      }
    }catch{/* Next interval retries; a stale timestamp remains visible to the operator. */}finally{this.running=false;}
  }
}
