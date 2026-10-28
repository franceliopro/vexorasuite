import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WahaService } from './waha.service';
import { EventsService } from './events.service';

/** One database lease per tenant prevents every API replica polling the same gateway. */
@Injectable()
export class ChannelHealthService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running=false;
  constructor(private readonly prisma:PrismaService,private readonly waha:WahaService,private readonly events:EventsService){}
  onModuleInit(){this.timer=setInterval(()=>void this.check(),15000);this.timer.unref();void this.check();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  async check(){
    if(this.running)return;this.running=true;
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
        try{result=await this.waha.status(channel);}catch{
          result={status:'UNKNOWN',providerStatus:'UNREACHABLE'};
          await this.prisma.channelConnection.update({where:{id:channel.id},data:{status:'UNKNOWN',lastError:'Não foi possível verificar o WhatsApp. A entrega de mensagens pode estar interrompida.'}});
        }
        await this.prisma.$transaction(async tx=>{
          await tx.$queryRaw`SELECT id FROM channel_connections WHERE id=${channel.id}::uuid FOR UPDATE`;
          const row=await tx.channelConnection.findUnique({where:{id:channel.id}});if(!row)return;
          const settings=(row.settings&&typeof row.settings==='object'&&!Array.isArray(row.settings)?row.settings:{}) as Record<string,any>;
          await tx.channelConnection.update({where:{id:row.id},data:{settings:{...settings,healthCheckedAt:new Date().toISOString(),healthProviderStatus:result.providerStatus||'UNKNOWN'}}});
        });
        this.events.publish(channel.tenantId,'channel.status',{id:channel.id,...result});
      }
    }catch{/* Next interval retries; a stale timestamp remains visible to the operator. */}finally{this.running=false;}
  }
}
