import {Controller,MessageEvent,Req,Sse,UseGuards} from '@nestjs/common';
import {Observable,mergeMap,filter} from 'rxjs';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {administrative,effectiveModules} from '../auth/module-policy';
import {PrismaService} from '../prisma/prisma.service';
import {EventsService} from './events.service';
@Controller() @UseGuards(AuthGuard)
export class EventsController{
 constructor(private readonly events:EventsService,private readonly prisma:PrismaService){}
 @Sse('events') stream(@Req() req:AuthenticatedRequest):Observable<MessageEvent>{return this.events.stream(req.user.tenantId).pipe(mergeMap(async event=>{const member=await this.prisma.membership.findFirst({where:{tenantId:req.user.tenantId,userId:req.user.sub,user:{isActive:true},tenant:{status:'ACTIVE'}},select:{role:true,modules:true}});if(!member)return null;if(administrative(member.role))return {type:event.type,data:event.data};const rows=await this.prisma.departmentMember.findMany({where:{tenantId:req.user.tenantId,userId:req.user.sub,department:{isActive:true}},select:{department:{select:{id:true,modules:true}}}});if(!effectiveModules(member.role,member.modules,rows.map(r=>r.department)).includes('INBOX'))return null;const ids=rows.filter(r=>r.department.modules.includes('INBOX')).map(r=>r.department.id);const conversationId=typeof event.data.conversationId==='string'?event.data.conversationId:event.type.startsWith('conversation.')&&typeof event.data.id==='string'?event.data.id:null;if(conversationId){const allowed=await this.prisma.conversation.findFirst({where:{id:conversationId,tenantId:req.user.tenantId,OR:[{assigneeId:req.user.sub},{departmentId:{in:ids}},{participants:{some:{tenantId:req.user.tenantId,userId:req.user.sub}}}]},select:{id:true}});if(!allowed)return null;}else if(event.type.startsWith('contact.'))return null;return {type:event.type,data:event.data};}),filter((event):event is {type:string;data:Record<string,unknown>}=>event!==null));}
}
