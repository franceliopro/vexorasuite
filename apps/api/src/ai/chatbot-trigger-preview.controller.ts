import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { validDraft } from "./chatbot-draft.controller";
import { matchesChatbotTrigger, RuntimeFlow } from "./flow-runtime";

type Draft = {name?:string;channelIds?:string[];triggers?:RuntimeFlow["triggers"];welcome?:string};
@Controller("chatbot/engine")
@UseGuards(AuthGuard)
export class ChatbotTriggerPreviewController {
 constructor(private readonly prisma:PrismaService){}
 @Post("preview")
 async preview(@Req() req:AuthenticatedRequest,@Body() body:{channelId?:string;eventType?:string;text?:string;firstMessage?:boolean;draft?:unknown}){
  if(typeof body?.channelId!=="string" || body.channelId.length>100 || !["message","dm"].includes(body.eventType||"") || typeof body.text!=="string" || body.text.length>4000)throw new BadRequestException("Evento de teste inválido");
  let draft:Draft|undefined;
  if(body.draft!==undefined){
   if(!validDraft(body.draft))throw new BadRequestException("Rascunho de teste inválido");
   draft=body.draft;
  }else{
   const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
   const root=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
   draft=root.chatbotDraft as Draft|undefined;
  }
  if(!draft || !Array.isArray(draft.channelIds) || !draft.channelIds.includes(body.channelId as string))return {matched:false,reason:"channel_not_selected",executed:false,sent:false};
  const matched=matchesChatbotTrigger(draft.triggers,body.text,body.eventType==="dm",body.firstMessage===true);
  return {matched,reason:matched?"draft_trigger_match":"trigger_not_matched",flowName:matched?draft.name:null,previewMessage:matched?draft.welcome:null,executed:false,sent:false,published:false,needsApproval:true};
 }
}
