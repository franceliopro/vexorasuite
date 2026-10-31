import {assignedConversationScope} from "./conversation-visibility";
import {accessiblePipeline,contactPipelineAccess} from './crm-pipelines.controller';
import {administrative} from '../auth/module-policy';
import { contactMetadata, lockedContact, mutateContactMetadata } from "../prisma/contact-metadata";
import { mutateTenantSetting } from "../prisma/tenant-settings";
import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { AsaasService } from "./asaas.service";

const CRM_STAGES = ["new", "qualification", "proposal"] as const;
type CrmStage = (typeof CRM_STAGES)[number];
function readCrmStage(metadata: Prisma.JsonValue): CrmStage | null {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    if (metadata.crmRemoved || ("crmFinalization" in metadata && metadata.crmFinalization)) return null;
    if (metadata.contactType === "CUSTOMER") return null;
    if ("asaas" in metadata && metadata.asaas && typeof metadata.asaas === "object" && !Array.isArray(metadata.asaas) && "customerId" in metadata.asaas) return null;
    if ("crmStage" in metadata) { const stage = metadata.crmStage; if (typeof stage === "string" && CRM_STAGES.includes(stage as CrmStage)) return stage as CrmStage; }
  }
  return "new";
}

@Controller("contacts")
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly asaas: AsaasService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query("q") query?: string, @Query("pipelineId") pipelineId?: string, @Query("customerOnly") customerOnly?: string) {
    const q = query?.trim();
    const onlyCustomers = customerOnly === "1" || customerOnly === "true";
    if (pipelineId) await accessiblePipeline(this.prisma, request, pipelineId);
    else if (!onlyCustomers && !administrative(request.user.role)) throw new ForbiddenException("Selecione um CRM permitido.");
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId: request.user.tenantId,
        ...(pipelineId ? { pipelineId } : {}),
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        } : {}),
      },
      orderBy: { updatedAt: "desc" },
      ...(onlyCustomers ? {} : { take: 100 }),
    });
    const listed = onlyCustomers ? contacts.filter((contact) => {
      const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Record<string, unknown> : {};
      const asaas = metadata.asaas && typeof metadata.asaas === "object" && !Array.isArray(metadata.asaas) ? metadata.asaas as Record<string, unknown> : {};
      return metadata.contactType === "CUSTOMER" || typeof asaas.customerId === "string";
    }) : contacts;
    return listed.map((contact) => { const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata) ? contact.metadata as Prisma.JsonObject : {}; return { ...contact, crmStage: contact.pipelineId ? (metadata.crmFinalization ? null : typeof metadata.crmStage === "string" && ["new", "qualification", "proposal"].includes(metadata.crmStage) ? metadata.crmStage : "new") : readCrmStage(contact.metadata), crmFinalization: metadata.crmFinalization ?? null }; });
  }

  @Patch(':id/pipeline') async movePipeline(@Req() request:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:{pipelineId?:string}){if(!administrative(request.user.role))throw new ForbiddenException('Somente a administração move contatos entre CRMs.');await contactPipelineAccess(this.prisma,request,id);const pipeline=await accessiblePipeline(this.prisma,request,input.pipelineId||'');return this.prisma.contact.update({where:{id},data:{pipelineId:pipeline.id}});}
  @Get("brand-settings")
  async brandSettings(@Req() request: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: request.user.tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, unknown> : {};
    const brand = integrations.brandSettings && typeof integrations.brandSettings === "object" && !Array.isArray(integrations.brandSettings) ? integrations.brandSettings as Record<string, unknown> : {};
    const image = (key: string) => typeof brand[key] === "string" && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(brand[key] as string) ? brand[key] as string : "";
    return {
      primaryColor: typeof brand.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(brand.primaryColor) ? brand.primaryColor : "#6258df",
      logoLight: image("logoLight"),
      logoDark: image("logoDark"),
      favicon: image("favicon"),
      logoShape: brand.logoShape === "square" || brand.logoShape === "round" ? brand.logoShape : "rectangular",
      showCompanyName: typeof brand.showCompanyName === "boolean" ? brand.showCompanyName : true,
      displayName: typeof brand.displayName === "string" ? brand.displayName.slice(0, 100) : "",
    };
  }

  @Patch("brand-settings")
  async updateBrandSettings(@Req() request: AuthenticatedRequest, @Body() input: { primaryColor?: unknown; logoLight?: unknown; logoDark?: unknown; favicon?: unknown; logoShape?: unknown; showCompanyName?: unknown; displayName?: unknown }) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes((request.user.role || "").toUpperCase())) throw new ForbiddenException("Somente administradores podem alterar a identidade visual.");
    const primaryColor = typeof input.primaryColor === "string" ? input.primaryColor.toUpperCase() : "";
    if (!/^#[0-9A-F]{6}$/.test(primaryColor)) throw new BadRequestException("Escolha uma cor hexadecimal válida.");
    const validImage = (value: unknown) => value === "" || (typeof value === "string" && value.length <= 26000 && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value));
    for (const key of ["logoLight", "logoDark", "favicon"] as const) {
      if (input[key] !== undefined && !validImage(input[key])) throw new BadRequestException(`A imagem ${key} é inválida ou muito grande. Use PNG, JPEG, WebP ou SVG de até 19 KB após otimização.`);
    }
    if (input.logoShape !== undefined && !["square", "round", "rectangular"].includes(String(input.logoShape))) throw new BadRequestException("Formato do logo inválido.");
    if (input.showCompanyName !== undefined && typeof input.showCompanyName !== "boolean") throw new BadRequestException("A opção de nome da empresa é inválida.");
    if (input.displayName !== undefined && (typeof input.displayName !== "string" || input.displayName.trim().length > 100)) throw new BadRequestException("O nome exibido deve ter até 100 caracteres.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: request.user.tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, unknown> : {};
    const existing = integrations.brandSettings && typeof integrations.brandSettings === "object" && !Array.isArray(integrations.brandSettings) ? integrations.brandSettings as Record<string, unknown> : {};
    const brandSettings: Record<string, unknown> = { ...existing, primaryColor };
    for (const key of ["logoLight", "logoDark", "favicon", "logoShape", "showCompanyName", "displayName"] as const) if (input[key] !== undefined) (brandSettings as Record<string, unknown>)[key] = key === "displayName" && typeof input[key] === "string" ? input[key].trim() : input[key];
    await mutateTenantSetting(this.prisma, request.user.tenantId, "brandSettings", current => ({ ...(current && typeof current === "object" && !Array.isArray(current) ? current : {}), ...brandSettings }) as any);
    return { primaryColor, logoLight: brandSettings.logoLight || "", logoDark: brandSettings.logoDark || "", favicon: brandSettings.favicon || "", logoShape: brandSettings.logoShape || "rectangular", showCompanyName: brandSettings.showCompanyName !== false };
  }

  @Get("profile-config")
  async profileConfig(@Req() request: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: request.user.tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, unknown> : {};
    const config = integrations.crmProfileConfig && typeof integrations.crmProfileConfig === "object" && !Array.isArray(integrations.crmProfileConfig) ? integrations.crmProfileConfig as Record<string, unknown> : {};
    return { tags: Array.isArray(config.tags) ? config.tags : [], fields: Array.isArray(config.fields) ? config.fields : [] };
  }

  @Post("profile-config/tags")
  async createProfileTag(@Req() request: AuthenticatedRequest, @Body() input: { name?: unknown; color?: unknown }) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const color = typeof input.color === "string" ? input.color : "";
    if (!name || name.length > 40 || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new BadRequestException("Informe nome e cor válida para a etiqueta.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: request.user.tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, unknown> : {};
    const config = integrations.crmProfileConfig && typeof integrations.crmProfileConfig === "object" && !Array.isArray(integrations.crmProfileConfig) ? integrations.crmProfileConfig as Record<string, unknown> : {};
    const tags = Array.isArray(config.tags) ? config.tags as Array<Record<string, unknown>> : [];
    const existing = tags.find(tag => typeof tag.name === "string" && tag.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    if (existing) return existing;
    if (tags.length >= 100) throw new BadRequestException("O limite de etiquetas desta empresa foi atingido.");
    const tag = { id: randomUUID(), name, color, createdBy: request.user.sub, createdAt: new Date().toISOString() };
    const updated=await mutateTenantSetting(this.prisma,request.user.tenantId,"crmProfileConfig",current=>{
      const value=current&&typeof current==="object"&&!Array.isArray(current)?current as Record<string,any>:{};
      const latest=Array.isArray(value.tags)?value.tags:[];
      if(latest.some((t:any)=>typeof t.name==="string"&&t.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR")))return value;
      if(latest.length>=100)throw new BadRequestException("O limite de etiquetas desta empresa foi atingido.");
      return {...value,tags:[...latest,tag]};
    });
    return (updated as any).tags.find((t:any)=>t.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR"))||tag;
  }

  @Post("profile-config/fields")
  async createProfileField(@Req() request: AuthenticatedRequest, @Body() input: { name?: unknown; type?: unknown; options?: unknown }) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const type = typeof input.type === "string" ? input.type.toUpperCase() : "TEXT";
    const allowed = ["TEXT", "NUMBER", "DATE", "SELECT", "CHECKBOX"];
    const options = Array.isArray(input.options) ? input.options.filter((value): value is string => typeof value === "string").map(value => value.trim()).filter(Boolean).slice(0, 30) : [];
    if (!name || name.length > 80 || !allowed.includes(type) || (type === "SELECT" && options.length < 1)) throw new BadRequestException("Informe nome, tipo e opções válidas para o campo.");
    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
    if (!key) throw new BadRequestException("O nome do campo precisa conter letras ou números.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: request.user.tenantId }, select: { integrations: true } });
    const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, unknown> : {};
    const config = integrations.crmProfileConfig && typeof integrations.crmProfileConfig === "object" && !Array.isArray(integrations.crmProfileConfig) ? integrations.crmProfileConfig as Record<string, unknown> : {};
    const fields = Array.isArray(config.fields) ? config.fields as Array<Record<string, unknown>> : [];
    if (fields.some(field => field.key === key)) throw new BadRequestException("Já existe um campo com esse nome. Escolha outro nome.");
    if (fields.length >= 100) throw new BadRequestException("O limite de campos personalizados desta empresa foi atingido.");
    const field = { id: randomUUID(), name, key, type, options: type === "SELECT" ? options : [], createdBy: request.user.sub, createdAt: new Date().toISOString() };
    await mutateTenantSetting(this.prisma,request.user.tenantId,"crmProfileConfig",current=>{
      const value=current&&typeof current==="object"&&!Array.isArray(current)?current as Record<string,any>:{};
      const latest=Array.isArray(value.fields)?value.fields:[];
      if(latest.some((f:any)=>f.key===key))throw new BadRequestException("Já existe um campo com esse nome.");
      if(latest.length>=100)throw new BadRequestException("O limite de campos personalizados desta empresa foi atingido.");
      return {...value,fields:[...latest,field]};
    });
    return field;
  }

  @Get(":id/history")
  async history(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    await contactPipelineAccess(this.prisma,request,id);
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId: request.user.tenantId }, select: { id: true } });
    if (!contact) throw new BadRequestException("Contato não encontrado nesta empresa.");
    return this.prisma.conversation.findMany({ where: { contactId: contact.id, tenantId: request.user.tenantId,...(!administrative(request.user.role)?assignedConversationScope(request.user.tenantId,request.user.sub,request.user.departmentIds||[]):{}) }, select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  @Patch(":id/profile")
  async updateProfile(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: { tags?: unknown; notes?: unknown; customFields?: unknown; leadOrigin?: unknown; novo_nome?: unknown; birthDate?:unknown;partnershipDate?:unknown }) {
    await contactPipelineAccess(this.prisma,request,id);
    if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 50 || input.tags.some((tag) => typeof tag === "string" ? tag.length > 40 : !tag || typeof tag !== "object" || Array.isArray(tag) || typeof (tag as Record<string, unknown>).name !== "string" || ((tag as Record<string, unknown>).name as string).trim().length < 1 || ((tag as Record<string, unknown>).name as string).length > 40 || typeof (tag as Record<string, unknown>).color !== "string" || !/^#[0-9a-fA-F]{6}$/.test((tag as Record<string, unknown>).color as string)))) throw new BadRequestException("Etiquetas inválidas.");
    for(const key of ['birthDate','partnershipDate'] as const){const value=input[key];if(value!==undefined&&(typeof value!=='string'||value!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)))throw new BadRequestException('Data inválida.');}
    if(input.novo_nome!==undefined&&(typeof input.novo_nome!=='string'||input.novo_nome.length>80||input.novo_nome.trim()&&!/^[\p{L}][\p{L} .’'-]{1,79}$/u.test(input.novo_nome.trim())))throw new BadRequestException('Nome de preferência inválido.');
    if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 10000)) throw new BadRequestException("Anotações inválidas.");
    if (input.customFields !== undefined && (!input.customFields || typeof input.customFields !== "object" || Array.isArray(input.customFields))) throw new BadRequestException("Campos personalizados inválidos.");
    const leadOriginRecord = typeof input.leadOrigin === "string"
      ? { source: input.leadOrigin }
      : input.leadOrigin && typeof input.leadOrigin === "object" && !Array.isArray(input.leadOrigin)
        ? input.leadOrigin as Record<string, unknown>
        : null;
    if (input.leadOrigin !== undefined && (!leadOriginRecord
      || typeof leadOriginRecord.source !== "string"
      || leadOriginRecord.source.length > 120
      || (leadOriginRecord.identifier !== undefined && (typeof leadOriginRecord.identifier !== "string" || leadOriginRecord.identifier.length > 120)))) {
      throw new BadRequestException("Origem do lead inválida.");
    }
    const updated = await mutateContactMetadata(this.prisma, request.user.tenantId, id, existing => ({
      ...existing,
      ...(input.tags !== undefined ? { tags: input.tags as Prisma.InputJsonValue } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(typeof input.birthDate==='string'?{birthDate:input.birthDate}:{}),...(typeof input.partnershipDate==='string'?{partnershipDate:input.partnershipDate}:{}),
      ...(typeof input.novo_nome === "string" ? {novo_nome:input.novo_nome.trim()} : {}),
      ...(input.customFields !== undefined ? { customFields: input.customFields as Prisma.InputJsonValue } : {}),
      ...(leadOriginRecord ? {
        leadOrigin: {
          source: (leadOriginRecord.source as string).trim(),
          ...(typeof leadOriginRecord.identifier === "string" && leadOriginRecord.identifier.trim()
            ? { identifier: leadOriginRecord.identifier.trim() }
            : {}),
        },
      } : {}),
    }));
    this.events.publish(request.user.tenantId, "contact.updated", { id: updated.id });
    return { id: updated.id, metadata: updated.metadata };
  }

  @Patch(":id/stage")
  async updateStage(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: { stage?: string }) {
    await contactPipelineAccess(this.prisma,request,id);
    if (!input.stage || !CRM_STAGES.includes(input.stage as CrmStage)) throw new BadRequestException("Etapa de CRM inválida. Para finalizar, registre o resultado comercial.");
    const updated = await mutateContactMetadata(this.prisma, request.user.tenantId, id, metadata => {
      if (metadata.crmFinalization) throw new BadRequestException("Este contato já foi finalizado. Consulte-o em Contatos.");
      return { ...metadata, crmStage: input.stage! };
    });
    this.events.publish(request.user.tenantId, "contact.stage_changed", { id: updated.id, pipelineId: updated.pipelineId, stage: input.stage });
    return { ...updated, crmStage: input.stage };
  }


  @Post(":id/remove-from-pipeline")
  async removeFromPipeline(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: {pipelineId?:string}) {
    if(!input.pipelineId) throw new BadRequestException("Selecione o pipeline.");
    await accessiblePipeline(this.prisma,request,input.pipelineId);
    const result=await this.prisma.$transaction(async tx=>{
      const contact=await lockedContact(tx,request.user.tenantId,id);
      if(contact.pipelineId!==input.pipelineId) throw new BadRequestException("O contato mudou de pipeline. Atualize a tela.");
      const metadata=contactMetadata(contact.metadata);
      return tx.contact.update({where:{id},data:{pipelineId:null,metadata:{...metadata,crmRemoved:{pipelineId:input.pipelineId,removedAt:new Date().toISOString(),removedBy:request.user.sub}}}});
    });
    this.events.publish(request.user.tenantId,"contact.updated",{id});
    return {id:result.id,removed:true};
  }

  @Post(":id/finalize")
  async finalize(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: { outcome?: string; reason?: string }) {
    await contactPipelineAccess(this.prisma,request,id);
    const record=await this.prisma.contact.findFirstOrThrow({where:{id,tenantId:request.user.tenantId},select:{pipeline:{select:{template:true}}}});
    if(record.pipeline&&record.pipeline.template!=='SALES'){if(!['WON','LOST'].includes(input.outcome||''))throw new BadRequestException('Selecione o resultado.');const contact=await mutateContactMetadata(this.prisma,request.user.tenantId,id,m=>({...m,crmFinalization:{outcome:input.outcome,reason:typeof input.reason==='string'?input.reason.slice(0,200):'',finalizedAt:new Date().toISOString(),kind:'DEPARTMENT'}}));this.events.publish(request.user.tenantId,'contact.updated',{id});return {contact,finalizedConversations:0};}
    const tenantId = request.user.tenantId;
    const outcome = typeof input.outcome === "string" ? input.outcome.toUpperCase() : "";
    if (outcome !== "WON" && outcome !== "LOST") throw new BadRequestException("Escolha se o resultado foi ganho ou perda.");
    const allowedReasons = ["Preço/Condição", "Sem interesse", "Sem retorno", "Concorrência", "Inatividade"];
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (outcome === "LOST" && !allowedReasons.includes(reason)) throw new BadRequestException("Selecione um motivo válido para a perda.");
    const result = await this.prisma.$transaction(async (tx) => {
      // Match the runtime's conversation -> contact lock order.
      await tx.$queryRaw`SELECT id FROM conversations WHERE contact_id = ${id}::uuid AND tenant_id = ${tenantId}::uuid ORDER BY id FOR UPDATE`;
      const contact = await lockedContact(tx, tenantId, id);
      const existing = contactMetadata(contact.metadata);
    const previousFinalization = existing.crmFinalization && typeof existing.crmFinalization === "object" && !Array.isArray(existing.crmFinalization) ? existing.crmFinalization as Prisma.JsonObject : {};
    const priorFinalizedIds = Array.isArray(previousFinalization.finalizedConversationIds) ? previousFinalization.finalizedConversationIds.filter((value): value is string => typeof value === "string") : [];
    const priorTags = Array.isArray(existing.tags) ? existing.tags.filter((tag) => typeof tag === "string" || (tag && typeof tag === "object" && !Array.isArray(tag) && typeof (tag as Record<string, unknown>).name === "string")) as Prisma.InputJsonValue[] : [];
    const tags = outcome === "WON" ? priorTags.filter((tag) => (typeof tag === "string" ? tag : String((tag as Record<string, unknown>).name || "")).trim().toLocaleLowerCase("pt-BR") !== "novo lead") : priorTags;
    const rest = Object.fromEntries(Object.entries(existing).filter(([key]) => key !== "crmStage" && key !== "crmFinalization")) as Prisma.JsonObject;
    const finalizedAt = new Date().toISOString();
      const existingConversations = await tx.conversation.findMany({ where: { tenantId, contactId: contact.id }, select: { id: true } });
      const active = await tx.conversation.findMany({ where: { tenantId, contactId: contact.id, status: { in: ["OPEN", "PENDING"] }, archivedAt: null, deletedAt: null }, select: { id: true } });
      const finalizedConversationIds = [...new Set([...priorFinalizedIds, ...existingConversations.map((item) => item.id)])];
      const metadata: Prisma.InputJsonObject = {
        ...rest,
        tags,
        contactType: outcome === "WON" ? "CUSTOMER" : (typeof existing.contactType === "string" ? existing.contactType : "LEAD"),
        crmFinalization: {
          outcome,
          ...(outcome === "LOST" ? { reason } : {}),
          finalizedAt,
          finalizedBy: request.user.sub,
          finalizedConversationIds,
        },
      };
      const updatedContact = await tx.contact.update({ where: { id: contact.id }, data: { metadata } });
      if (active.length) await tx.conversation.updateMany({ where: { tenantId, contactId: contact.id, id: { in: finalizedConversationIds }, status: { in: ["OPEN", "PENDING"] } }, data: { status: "RESOLVED" } });
      return { contact: updatedContact, conversations: active.map((item) => item.id) };
    });
    const asaasSync = outcome === "WON" ? await this.asaas.syncCustomerByContact(tenantId, result.contact.id) : null;
    this.events.publish(tenantId, "contact.finalized", { id: result.contact.id, outcome, ...(outcome === "LOST" ? { reason } : {}), ...(asaasSync ? { asaasSyncStatus: asaasSync.status } : {}) });
    if (asaasSync) this.events.publish(tenantId, "contact.updated", { id: result.contact.id, asaasSyncStatus: asaasSync.status });
    for (const conversationId of result.conversations) this.events.publish(tenantId, "conversation.updated", { id: conversationId, status: "RESOLVED", finalizationOutcome: outcome });
    return { contact: { ...result.contact, crmStage: null, crmFinalization: (result.contact.metadata as Prisma.JsonObject).crmFinalization }, finalizedConversations: result.conversations.length, ...(asaasSync ? { asaasSync } : {}) };
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() input: CreateContactDto,@Query("pipelineId") pipelineId?:string) {
    if(pipelineId)await accessiblePipeline(this.prisma,request,pipelineId);else if(!administrative(request.user.role))throw new ForbiddenException("Selecione um CRM permitido.");
    const contact = await this.prisma.contact.create({
      data: {
        tenantId: request.user.tenantId,
        ...(pipelineId?{pipelineId}:{}),
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        source: input.source?.trim() || null,
        externalId: input.externalId?.trim() || null,
      },
    });
    this.events.publish(request.user.tenantId, "contact.created", {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
    });
    return contact;
  }
}

