import {Controller,MessageEvent,Req,Sse,UseGuards} from '@nestjs/common';
import {Observable,mergeMap,filter} from 'rxjs';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {administrative,effectiveModules,patternModules} from '../auth/module-policy';
import {PrismaService} from '../prisma/prisma.service';
import {EventsService} from './events.service';
import {assignedConversationScope} from './conversation-visibility';
@Controller() @UseGuards(AuthGuard)
export class EventsController{
 constructor(private readonly events:EventsService,private readonly prisma:PrismaService){}
 @Sse('events') stream(@Req() req:AuthenticatedRequest):Observable<MessageEvent>{
  return this.events.stream(req.user.tenantId).pipe(mergeMap(async event=>{
   if(typeof (req.user as any).exp==='number'&&(req.user as any).exp*1000<=Date.now())return null;
   const member=await this.prisma.membership.findFirst({where:{tenantId:req.user.tenantId,userId:req.user.sub,user:{isActive:true,mustChangePassword:false},tenant:{status:'ACTIVE'}},select:{role:true,modules:true,deniedModules:true,user:{select:{authVersion:true,isPlatformAdmin:true}},tenant:{select:{kind:true,integrations:true}}}});
   if(!member||(req.user.sessionVersion??0)!==member.user.authVersion||member.tenant.kind==='PLATFORM'&&!member.user.isPlatformAdmin)return null;
   const admin=administrative(member.role),rows=admin?[]:await this.prisma.departmentMember.findMany({where:{tenantId:req.user.tenantId,userId:req.user.sub,department:{isActive:true}},select:{department:{select:{id:true,modules:true}}}});
   const ids=rows.filter(r=>r.department.modules.includes('INBOX')).map(r=>r.department.id);
   const crmIds=rows.filter(r=>r.department.modules.includes('CRM')).map(r=>r.department.id);
   const allowed=effectiveModules(member.role,member.modules,rows.map(r=>r.department),patternModules(member.tenant.integrations,req.user.sub,rows.map(r=>r.department.id)),member.deniedModules);
   if(!member.user.isPlatformAdmin&&!allowed.includes('INBOX')&&!allowed.includes('CRM'))return null;
   if(admin)return {type:event.type,data:event.data};
   const conversationId=typeof event.data.conversationId==='string'?event.data.conversationId:event.type.startsWith('conversation.')&&typeof event.data.id==='string'?event.data.id:null;
   if(conversationId){
    const visible=await this.prisma.conversation.findFirst({where:{id:conversationId,tenantId:req.user.tenantId,...assignedConversationScope(req.user.tenantId,req.user.sub,ids)},select:{id:true}});
    if(!visible)return null;
   }else if(event.type==='contact.stage_changed'){
    if(!allowed.includes('CRM')||typeof event.data.pipelineId!=='string'||!crmIds.length)return null;
    const visible=await this.prisma.crmPipeline.findFirst({where:{id:event.data.pipelineId,tenantId:req.user.tenantId,enabled:true,departmentId:{in:crmIds},department:{isActive:true,modules:{has:'CRM'}}},select:{id:true}});
    if(!visible)return null;
   }else if(!allowed.includes('INBOX')||!['channel.status','channel.created','team.updated'].includes(event.type))return null;
   return {type:event.type,data:event.data};
  }),filter((event):event is {type:string;data:Record<string,unknown>}=>event!==null));
 }
}
