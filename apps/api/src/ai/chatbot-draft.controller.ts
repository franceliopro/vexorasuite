import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type DraftStep = { id: string; title: string; message: string; options: string[]; transitions?: Record<string,string>; position?: { x:number; y:number } };
type Draft = { name:string; welcome:string; steps:DraftStep[] };
function validDraft(value: unknown): value is Draft {
 if (!value || typeof value !== "object" || Array.isArray(value)) return false;
 const v=value as Partial<Draft>;
 if (typeof v.name!=="string" || !v.name.trim() || v.name.length>120 || typeof v.welcome!=="string" || v.welcome.length>4000 || !Array.isArray(v.steps) || v.steps.length>100) return false;
 const ids=new Set<string>();
 for(const s of v.steps){
  if(!s || typeof s.id!=="string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || ids.has(s.id) || typeof s.title!=="string" || s.title.length>120 || typeof s.message!=="string" || s.message.length>4000 || !Array.isArray(s.options) || s.options.length>30 || s.options.some(o=>typeof o!=="string" || o.length>160))return false;
  ids.add(s.id);
  if(s.position && (!Number.isFinite(s.position.x) || !Number.isFinite(s.position.y) || s.position.x<0 || s.position.y<0 || s.position.x>900 || s.position.y>520))return false;
 }
 return v.steps.every(s=>!s.transitions || (typeof s.transitions==="object" && !Array.isArray(s.transitions) && Object.entries(s.transitions).every(([option,target])=>s.options.includes(option) && typeof target==="string" && (target==="__start__" || ids.has(target)))));
}
@Controller("chatbot/draft")
@UseGuards(AuthGuard)
export class ChatbotDraftController {
 constructor(private readonly prisma:PrismaService){}
 @Get()
 async read(@Req() req:AuthenticatedRequest){
  const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
  const data=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
  return {draft:data.chatbotDraft??null,published:false,executionEnabled:false};
 }
 @Put()
 async save(@Req() req:AuthenticatedRequest,@Body() body:{draft?:unknown}){
  if(!["OWNER","ADMIN","MANAGER"].includes(req.user.role))throw new ForbiddenException("Permissão insuficiente");
  if(!validDraft(body?.draft))throw new BadRequestException("Rascunho inválido");
  const draft=body.draft;
  await this.prisma.$transaction(async tx=>{
   const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
   const data=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
   await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...data,chatbotDraft:draft} as Prisma.InputJsonValue}});
  });
  return {saved:true,published:false,executionEnabled:false};
 }
}
