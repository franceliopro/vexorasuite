import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { randomBytes } from "node:crypto";

type DraftStep = { action?: "asaas.customer.lookup" | "asaas.payment.lookup" | "asaas.payment.pix" | "asaas.payment.boleto" | "human.handoff"; kind?: string; config?: string; id: string; title: string; message: string; options: string[]; transitions?: Record<string,string>; position?: { x:number; y:number } };
type Draft = { name:string; welcome:string; steps:DraftStep[]; channelIds?:string[]; triggers?:{kind:"message"|"dm"|"keyword";keyword?:string}[] };
export function validDraft(value: unknown): value is Draft {
 if (!value || typeof value !== "object" || Array.isArray(value)) return false;
 const v=value as Partial<Draft>;
 if (typeof v.name!=="string" || !v.name.trim() || v.name.length>120 || typeof v.welcome!=="string" || v.welcome.length>4000 || !Array.isArray(v.steps) || v.steps.length>100) return false;
 if(v.channelIds!==undefined && (!Array.isArray(v.channelIds) || v.channelIds.length>30 || v.channelIds.some(id=>typeof id!=="string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) || new Set(v.channelIds).size!==v.channelIds.length))return false;
 if(v.triggers!==undefined && (!Array.isArray(v.triggers) || v.triggers.length>10 || v.triggers.some(t=>!t || !["message","dm","keyword"].includes(t.kind) || (t.kind==="keyword" && (typeof t.keyword!=="string" || !t.keyword.trim() || t.keyword.length>120)))))return false;
 const ids=new Set<string>();
 for(const s of v.steps){
  if(!s || typeof s.id!=="string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || ids.has(s.id) || typeof s.title!=="string" || s.title.length>120 || typeof s.message!=="string" || s.message.length>4000 || !Array.isArray(s.options) || s.options.length>30 || s.options.some(o=>typeof o!=="string" || o.length>160))return false;
  if(s.action!==undefined && !["asaas.customer.lookup","asaas.payment.lookup","asaas.payment.pix","asaas.payment.boleto","human.handoff"].includes(s.action))return false;
  if(s.kind!==undefined && (typeof s.kind!=="string" || s.kind.length>80))return false;
  if(s.config!==undefined && (typeof s.config!=="string" || s.config.length>4000))return false;
  ids.add(s.id);
  if(s.position && (!Number.isFinite(s.position.x) || !Number.isFinite(s.position.y) || s.position.x<0 || s.position.y<0 || s.position.x>Number.MAX_SAFE_INTEGER || s.position.y>Number.MAX_SAFE_INTEGER))return false;
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
  return {draft:data.chatbotDraft??null,published:!!data.intelligencePublished,executionEnabled:(data.intelligencePublished as {active?:boolean}|undefined)?.active===true};
 }
 @Put()
 async save(@Req() req:AuthenticatedRequest,@Body() body:{draft?:unknown}){
  if(!["OWNER","ADMIN","MANAGER"].includes(req.user.role))throw new ForbiddenException("Permissão insuficiente");
  if(!validDraft(body?.draft))throw new BadRequestException("Rascunho inválido");
  const draft=body.draft;
  await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
   const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{id:true,integrations:true}});
   const data=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
   await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...data,chatbotDraft:draft} as Prisma.InputJsonValue}});
  });
  return {saved:true,draftOnly:true};
 }
  private scopeKeyOf(value: unknown): string {
   const key = typeof value === "string" && (value === "default" || /^department:[A-Za-z0-9_-]{1,80}$/.test(value)) ? value : "";
   return key;
  }
  private normalizeTheme(value: unknown) {
   const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
   const backgroundKind = ["default", "solid", "gradient", "image"].includes(String(input.backgroundKind)) ? String(input.backgroundKind) : "default";
   const color = typeof input.color === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : "#101317";
   const color2 = typeof input.color2 === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color2) ? input.color2 : "#0E7A5C";
   const imageUrl = typeof input.imageUrl === "string" && /^https:\/\//.test(input.imageUrl) && input.imageUrl.length <= 2000 ? input.imageUrl : "";
   return { backgroundKind, color, color2, imageUrl };
  }
  @Get("public-page")
  async readPublicPage(@Req() req:AuthenticatedRequest){
   const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
   const root=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
   const pagesRoot=root.publicFlows && typeof root.publicFlows==="object" && !Array.isArray(root.publicFlows)?root.publicFlows as Record<string,unknown>:{};
   const pages=Object.entries(pagesRoot).flatMap(([token,value])=>{
    if(!value || typeof value!=="object" || Array.isArray(value))return [];
    const binding=value as Record<string,unknown>;
    const scopeKey=typeof binding.scopeKey==="string"?binding.scopeKey:"default";
    return [{ token, scopeKey, disabled: binding.disabled===true, theme: this.normalizeTheme(binding.theme) }];
   });
   const publicationRoot:Record<string,unknown> = root.intelligencePublished && typeof root.intelligencePublished==="object" && !Array.isArray(root.intelligencePublished) ? { default: root.intelligencePublished, ...(root.intelligencePublications && typeof root.intelligencePublications==="object" && !Array.isArray(root.intelligencePublications)?root.intelligencePublications as Record<string,unknown>:{}) } : { ...(root.intelligencePublications && typeof root.intelligencePublications==="object" && !Array.isArray(root.intelligencePublications)?root.intelligencePublications as Record<string,unknown>:{}) };
   const publications=Object.entries(publicationRoot).flatMap(([key,value])=>{
    if(!value || typeof value!=="object" || Array.isArray(value))return [];
    const publication=value as Record<string,unknown>;
    const flow=publication.flow && typeof publication.flow==="object" && !Array.isArray(publication.flow)?publication.flow as Record<string,unknown>:null;
    return [{ scopeKey: key, active: publication.active===true, flowName: typeof flow?.name==="string"?String(flow.name).slice(0,120):null }];
   });
   return { pages, publications };
  }
  @Put("public-page")
  async savePublicPage(@Req() req:AuthenticatedRequest,@Body() body:{scopeKey?:unknown;theme?:unknown;enabled?:unknown}){
   if(!["OWNER","ADMIN","MANAGER"].includes(req.user.role))throw new ForbiddenException("Permissão insuficiente");
   const scopeKey=this.scopeKeyOf(body?.scopeKey);
   if(!scopeKey)throw new BadRequestException("Escopo inválido");
   const theme=this.normalizeTheme(body?.theme);
   const enabled=body?.enabled===true;
   const result=await this.prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
    const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{id:true,integrations:true}});
    const root=tenant.integrations && typeof tenant.integrations==="object" && !Array.isArray(tenant.integrations)?tenant.integrations as Record<string,unknown>:{};
    const pages={...(root.publicFlows && typeof root.publicFlows==="object" && !Array.isArray(root.publicFlows)?root.publicFlows as Record<string,unknown>:{})};
    const existingToken=Object.keys(pages).find(token=>{
     const binding=pages[token];
     return binding && typeof binding==="object" && !Array.isArray(binding) && (binding as Record<string,unknown>).scopeKey===scopeKey;
    });
    if(!enabled){
     if(existingToken){ pages[existingToken]={ ...(pages[existingToken] as Record<string,unknown>), disabled:true }; await tx.tenant.update({where:{id:tenant.id},data:{integrations:{...root,publicFlows:pages} as Prisma.InputJsonObject}}); }
     return { enabled:false, token: existingToken ?? null, theme };
    }
    const token=existingToken ?? randomBytes(24).toString("hex");
    const createdAt=existingToken && typeof (pages[existingToken] as Record<string,unknown>).createdAt==="string" ? (pages[existingToken] as Record<string,unknown>).createdAt as string : new Date().toISOString();
    pages[token]={ scopeKey, theme, disabled:false, createdAt };
    await tx.tenant.update({where:{id:tenant.id},data:{integrations:{...root,publicFlows:pages} as Prisma.InputJsonObject}});
    return { enabled:true, token, theme };
   });
   return result;
  }
}


