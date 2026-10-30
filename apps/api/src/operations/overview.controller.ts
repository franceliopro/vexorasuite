import {assignedConversationScope} from "./conversation-visibility";
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
@Controller('overview')
@UseGuards(AuthGuard)
export class OverviewController {
 constructor(private readonly prisma:PrismaService){}
 @Get() async read(@Req() req:AuthenticatedRequest){
  const tenantId=req.user.tenantId;
  const admin=['OWNER','ADMIN'].includes(req.user.role);
  const teams=admin?[]:await this.prisma.departmentMember.findMany({where:{tenantId,userId:req.user.sub,department:{isActive:true,modules:{has:'INBOX'}}},select:{departmentId:true}});
  const scope={tenantId,deletedAt:null,...(!admin?assignedConversationScope(tenantId,req.user.sub,teams.map(t=>t.departmentId)):{})};
  const [openConversations,completedConversations,contacts,tenant,recent]=await Promise.all([
   this.prisma.conversation.count({where:{...scope,archivedAt:null,status:{in:['OPEN','PENDING']}}}),
   this.prisma.conversation.count({where:{...scope,status:{in:['RESOLVED','CLOSED']}}}),
   this.prisma.contact.count({where:{tenantId,conversations:{some:{tenantId,deletedAt:null,...(!admin?assignedConversationScope(tenantId,req.user.sub,teams.map(t=>t.departmentId)):{})}}}}),
   this.prisma.tenant.findUniqueOrThrow({where:{id:tenantId},select:{integrations:true}}),
   this.prisma.conversation.findMany({where:scope,orderBy:{updatedAt:'desc'},take:5,select:{id:true,status:true,updatedAt:true,contact:{select:{name:true}}}}),
  ]);
  const root=tenant.integrations as Record<string,any>;const assistantEnabled=root?.assistant?.enabled===true;const agents=assistantEnabled&&Array.isArray(root?.assistant?.agents)?root.assistant.agents:[];
  return {openConversations,completedConversations,contacts,activeAgents:agents.filter((a:any)=>a.enabled===true).length,recent,scope:admin?'tenant':'assigned_and_team',updatedAt:new Date().toISOString()};
 }
}
