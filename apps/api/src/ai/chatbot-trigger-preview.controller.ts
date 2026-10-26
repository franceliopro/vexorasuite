import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type Trigger = {kind:"message"|"dm"|"keyword";keyword?:string};
type Draft = {name?:string;channelIds?:string[];triggers?:Trigger[];welcome?:string};
function normalized(text:string){return text.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").trim().toLowerCase()}
@Controller("chatbot/engine")
@UseGuards(AuthGuard)
export class ChatbotTriggerPreviewController {
 constructor(private readonly prisma:PrismaService){}
 @Post("preview")
 async preview(@Req() req:AuthenticatedRequest,@Body() body:{channelId?:string;eventType?:string;text?:string}){
  if(typeof body?.channelId!=="string" || body.channelId.length>100 || !["message","dm"].includes(body.eventType||"") || typeof body.text!=="string" || body.text.length>4000)throw new BadRequestException("Evento de teste inválido");
  const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
  const root=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
  const draft=root.chatbotDraft as Draft|undefined;
  if(!draft || !Array.isArray(draft.channelIds) || !draft.channelIds.includes(body.channelId))return {matched:false,reason:"channel_not_selected",executed:false,sent:false};
  const triggers=Array.isArray(draft.triggers)&&draft.triggers.length?draft.triggers:[{kind:"message" as const}];
  const matched=triggers.some(t=>t.kind==="message"&&body.eventType==="message" || t.kind==="dm"&&body.eventType==="dm" || t.kind==="keyword"&&typeof t.keyword==="string"&&normalized(body.text).includes(normalized(t.keyword)));
  return {matched,reason:matched?"draft_trigger_match":"trigger_not_matched",flowName:matched?draft.name:null,previewMessage:matched?draft.welcome:null,executed:false,sent:false,published:false,needsApproval:true};
 }
}
