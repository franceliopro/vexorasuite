import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpException, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { Blueprint, blueprintFor, BUSINESS_AREAS } from "./blueprint";
import { normalizePrice } from "./money";
import { buildSiteClone } from "./clone-site";
import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { AiMessage, AiProvider, AiService } from "../ai/ai.service";
import { resolveCreativeAgent } from "../ai/creative-agent";
import { dailyAiLimit, reserveAiExecution } from "../ai/ai-budget";
import { referenceBriefFromUrl } from "./reference-brief";
import { searxngSearch } from "../ai/local-services";
import { parseSiteDesign, parseSitePage, editableSitePages, SITE_DESIGN_SYSTEM, sanitizeFreeLayout } from "./relayout";
import { readPropertyLists, sanitizePropertyData, sanitizePropertyLists, scopeForRequest, assertItemInScope, itemCategory, DEFAULT_LISTS, PROPERTY_STATUS, STATUS_LABEL } from "./real-estate";
import { WahaService } from "../operations/waha.service";
import { MailService } from "../mail/mail.service";
import { Optional } from "@nestjs/common";
const isHttp = (v: unknown) => typeof v === "string" && /^https?:\/\//i.test(v.trim());
function str(v: unknown, max: number, fallback = "") { return typeof v === "string" ? v.trim().slice(0, max) : fallback; }
function list(v: unknown, maxItems: number, map: (x: any) => any): any[] {
  return Array.isArray(v) ? v.slice(0, maxItems).map(map).filter(Boolean) : [];
}
function safeSlug(v: unknown): string {
  const s = typeof v === "string" ? v.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) : "";
  return s;
}
function waNumber(v: string) { return v.replace(/\D/g, ""); }
/** Bloqueia links de mídia perigosos (javascript:, data:) — só http(s)/relativo permitido. */
function safeUrl(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return "";
  return isHttp(s) || /^\/(?!\/)/.test(s) || /^#/.test(s) ? s.slice(0, 2000) : null;
}
const PAGE_KINDS = ["HOME","SERVICES","TEAM","IMOVEIS","POSTS","CONTACT","LANDING","CUSTOM"] as const;
const BLOCK_TYPES = ["hero","richText","services","gallery","testimonials","faq","cta","posts","properties","contact","spacer","divider","layout","freeLayout"] as const;

/** Véxora Sites — API do produto Sites (criação, edição, publicação e domínio). */
@Controller("sites")
@UseGuards(AuthGuard)
export class SitesController {
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService, @Optional() private readonly waha?: WahaService, @Optional() private readonly mail?: MailService) {}
  private tenantOf(req: AuthenticatedRequest) { return req.user.tenantId; }
  private modules(req: AuthenticatedRequest): string[] {
    // NOTE: role OWNER/ADMIN keep all modules; the enforcement here is per-tenant plan.
    // Membership-level restriction acontece no AuthGuard (effectiveModules).
    return ["SITES"];
  }
  private admin(req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Somente administração pode gerenciar as listas e os gestores de categoria do imóvel.");
  }
  private async assertCanDesign(req: AuthenticatedRequest) {
    if (["OWNER","ADMIN","MANAGER","AGENT"].includes(req.user.role)) return;
    throw new ForbiddenException("Este módulo não está habilitado para seu perfil.");
  }
  private async ownSite(req: AuthenticatedRequest, id: string) {
    const site = await this.prisma.site.findFirst({ where: { id, tenantId: this.tenantOf(req) } });
    if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
    return site;
  }
  private async ownPage(req: AuthenticatedRequest, pageId: string) {
    const page = await this.prisma.sitePage.findFirst({ where: { id: pageId, site: { tenantId: this.tenantOf(req) } }, include: { site: true } });
    if (!page) throw new NotFoundException("Página não encontrada.");
    return page;
  }
  private async ownForm(req: AuthenticatedRequest, formId: string) {
    const form = await this.prisma.siteForm.findFirst({ where: { id: formId, site: { tenantId: this.tenantOf(req) } } });
    if (!form) throw new NotFoundException("Formulário não encontrado.");
    return form;
  }
  private async ownItem(req: AuthenticatedRequest, itemId: string) {
    const item = await this.prisma.siteItem.findFirst({ where: { id: itemId, site: { tenantId: this.tenantOf(req) } } });
    if (!item) throw new NotFoundException("Registro não encontrado.");
    return item;
  }

  private designSystem(persona: string) {
    return SITE_DESIGN_SYSTEM + "\n\nConfiguração do agente:" + persona
      + "\nAplique as orientações e Skills pertinentes. O pedido específico guia as decisões visuais.";
  }

  private async designReferences(tenantId: string, agent: any, urls: string[]) {
    const storedUrls: string[] = Array.isArray(agent.knowledgeUrls) ? agent.knowledgeUrls.filter(isHttp).slice(0, 3) : [];
    const uniqueUrls = [...new Set([...urls.filter(Boolean), ...storedUrls])];
    const [references, library] = await Promise.all([
      Promise.all(uniqueUrls.map(url => referenceBriefFromUrl(url))),
      this.prisma.creativeReference.findMany({
        where: { tenantId, enabled: true, deletedAt: null, purpose: "ALL", account: { is: { tenantId, NOT: { disabledServices: { has: "drive" } } } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { name: true, instructions: true, palette: true },
      }),
    ]);
    if (library.length) {
      references.push("Referências criativas da empresa (orientações e paleta cadastradas): " + JSON.stringify(library.map(ref => ({
        name: ref.name,
        instructions: ref.instructions.slice(0, 700),
        palette: Array.isArray(ref.palette) ? ref.palette.filter(color => /^#[0-9a-f]{6}$/i.test(String(color))).slice(0, 10) : [],
      }))));
    }
    return references;
  }

  private async generateDesign(messages: AiMessage[], providers: AiProvider[], accept: (text: string) => boolean) {
    try {
      return await this.ai.generate(messages, providers.map(provider => ({ ...provider, timeoutMs: 100000, maxTokens: 10000 })), accept);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 502 && error.message.includes("o roteiro não veio")) {
        throw new BadRequestException("A IA respondeu, mas não entregou um layout válido. Reveja o modelo ou as instruções e tente novamente.");
      }
      throw error;
    }
  }

  private async enrichBlueprintWithAi(
    tenantId: string, userId: string, area: string, companyName: string, blueprint: Blueprint,
    briefData: { aiPrompt: string; referenceUrl: string; cloneUrl: string; primaryColor: string; accentColor: string; whatsapps: { label: string; handle: string }[]; socials: { platform: string; handle: string }[] },
  ): Promise<Blueprint> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    const integrations: any = tenant?.integrations;
    const assistant = integrations?.assistant;
    const { agent, providers, persona } = resolveCreativeAgent(integrations, tenantId);

    const { aiPrompt, referenceUrl, cloneUrl, ...branding } = briefData;
    const pages = editableSitePages(blueprint, true);
    const brief = [
      'Crie um site original. Retorne {"pages":[{"slug":"inicio","blocks":[...]}]} com uma entrada para cada slug listado.',
      "Use um bloco freeLayout com HTML e CSS próprios para cada página. Contato, imóveis e notícias podem receber uma introdução com design próprio. Os dados e formulários dessas páginas são mantidos pelo sistema.",
      "Empresa: " + companyName + ". Segmento: " + BUSINESS_AREAS[area]?.label + ".",
      "Identidade e contatos fornecidos: " + JSON.stringify(branding),
      "Pedido do usuário: " + (aiPrompt || "Defina a direção visual com base no segmento, objetivo e identidade."),
      "Páginas e imagens que podem ser usadas (imagens de banco ilustrativas): " + JSON.stringify(pages.map(page => ({
        slug: page.slug,
        title: page.title,
        functionalBlocks: page.blocks.filter(block => ["contact", "posts", "properties"].includes(block.type)).map(block => block.type),
        images: page.blocks.flatMap(block => block.type === "hero" ? [block.content.imageUrl] : block.type === "gallery" ? block.content.items.map((item: any) => item.url) : []).slice(0, 4),
      }))),
    ];
    const promptUrl = aiPrompt.match(/https:\/\/[^\s)\]]{5,300}/i)?.[0] || "";
    const references = await this.designReferences(tenantId, agent, [referenceUrl || promptUrl, cloneUrl]);
    brief.push(...references);
    if (integrations?.aiCostPolicy?.customerSearch === true) {
      try {
        const sources = await searxngSearch(companyName + " " + area + " website design inspiration (site:behance.net OR site:dribbble.com OR site:awwwards.com)");
        if (sources.length) brief.push("Referências públicas externas (use apenas como inspiração): " + JSON.stringify(sources.slice(0, 5).map(s => ({ title: s.title, url: s.url }))).slice(0, 4000));
      } catch { /* A pesquisa externa é opcional. */ }
    }
    await this.prisma.$transaction(tx => reserveAiExecution(tx, tenantId, dailyAiLimit(assistant.dailyAiLimit), "sites.generate", userId));
    const result = await this.generateDesign([
      { role: "system", content: this.designSystem(persona) },
      { role: "user", content: brief.join("\n") },
    ], providers, text => Boolean(parseSiteDesign(text, blueprint, true)));
    const design = parseSiteDesign(result.text, blueprint, true);
    if (!design) throw new BadRequestException("O agente Design Gráfico & Web não entregou um layout utilizável.");
    return design;
  }

  @Get("catalog") catalog() {
    return Object.fromEntries(Object.entries(BUSINESS_AREAS).map(([key, v]) => [key, { label: v.label, headline: v.headline, sub: v.sub, services: v.services }]));
  }

  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.prisma.site.findMany({ where: { tenantId: this.tenantOf(req) }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { pages: true, forms: true, items: true, submissions: true } } } });
  }

  @Post() async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const name = str(body?.name, 80) || str(body?.companyName, 80);
    if (name.length < 2) throw new BadRequestException("Informe o nome do site (mínimo 2 caracteres).");
    const area = str(body?.businessArea, 40);
    if (!BUSINESS_AREAS[area]) throw new BadRequestException("Escolha a área do negócio (ex.: clinica_medica).");
    const kind = String(body?.kind) === "DYNAMIC" ? "DYNAMIC" : "STATIC";
    const primaryColor = /^#[0-9a-f]{6}$/i.test(String(body?.primaryColor)) ? String(body.primaryColor) : "#0E7A5C";
    const accentColor = /^#[0-9a-f]{6}$/i.test(String(body?.accentColor)) ? String(body.accentColor) : "#22D3EE";
    const whatsapps = list(body?.whatsapps, 5, (w: any) => ({ label: str(w?.label, 60), handle: waNumber(str(w?.handle, 30)) })).filter(w => w.handle);
    const socials = list(body?.socials, 6, (s: any) => ({ platform: str(s?.platform, 30).toLowerCase(), handle: str(s?.handle, 80) })).filter(s => s.handle);
    const blueprintResult = blueprintFor(area, name, { primaryColor, accentColor, whatsapps, socials, dynamic: kind === "DYNAMIC" });
    const blueprint = await this.enrichBlueprintWithAi(this.tenantOf(req), req.user.sub, area, name, blueprintResult, {
      aiPrompt: str(body?.aiPrompt, 2500), referenceUrl: str(body?.referenceUrl, 300), cloneUrl: str(body?.cloneUrl, 300),
      primaryColor, accentColor, whatsapps, socials,
    });
    const slug = safeSlug(str(body?.slug, 60)) || safeSlug(name) || "site-" + randomBytes(4).toString("hex");
    let finalSlug = slug, attempt = 0;
    while (await this.prisma.site.findUnique({ where: { slug: finalSlug } })) { finalSlug = slug + "-" + randomBytes(3).toString("hex"); if (++attempt > 20) throw new BadRequestException("Não foi possível gerar um endereço único. Tente outro nome."); }
    const site = await this.prisma.site.create({
      data: {
        tenantId: this.tenantOf(req), slug: finalSlug, kind, businessArea: area, name, primaryColor, accentColor, departments: whatsapps.map(w => ({ platform: "whatsapp", label: w.label, handle: w.handle })) as any,
        pages: { create: blueprint.pages.map(p => ({ kind: p.kind, slug: p.slug, title: p.title, sortOrder: blueprint.pages.indexOf(p), blocks: { create: p.blocks.map((b, i) => ({ type: b.type, content: b.content, sortOrder: i })) } })) },
        forms: { create: [{ name: "Fale conosco", fields: [ { id: "nome", label: "Seu nome", type: "text", required: true }, { id: "telefone", label: "WhatsApp", type: "phone", required: true }, { id: "mensagem", label: "Como podemos ajudar?", type: "textarea", required: true } ], targets: [{ kind: "precadastro" }] }] },
      },
      include: { pages: { include: { blocks: true } }, forms: true },
    });
    return { ...site, ai: { applied: true } };
  }

  /**
   * Clona um site público existente (conteúdo, não o tema) para um novo Site Véxora.
   * WordPress: importa páginas, posts e imóveis via REST API pública. Não-WordPress: monta hero/galeria a partir do HTML.
   * Tudo em uma transação — ou clona completo, ou não cria nada.
   */
  @Post("clone") async cloneSite(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = this.tenantOf(req);
    const rawUrl = str(body?.url ?? body?.cloneUrl, 400);
    if (!rawUrl) throw new BadRequestException("Informe a URL pública do site, por exemplo https://cliente.com.br");
    const areaInput = str(body?.businessArea, 40);
    const area = BUSINESS_AREAS[areaInput] ? areaInput : "site_simples";
    const kindInput = String(body?.kind || "").toUpperCase();
    const kind: "STATIC" | "DYNAMIC" | null = kindInput === "DYNAMIC" || kindInput === "STATIC" ? kindInput : null;
    const primaryColor = /^#[0-9a-f]{6}$/i.test(String(body?.primaryColor)) ? String(body.primaryColor) : "#0E7A5C";
    const accentColor = /^#[0-9a-f]{6}$/i.test(String(body?.accentColor)) ? String(body.accentColor) : "#22D3EE";
    const whatsapps = list(body?.whatsapps, 5, (w: any) => ({ label: str(w?.label, 60), handle: waNumber(str(w?.handle, 30)) })).filter(w => w.handle);
    const socials = list(body?.socials, 6, (s: any) => ({ platform: str(s?.platform, 30).toLowerCase(), handle: str(s?.handle, 80) })).filter(s => s.handle);
    const built = await buildSiteClone({ url: rawUrl, area, name: str(body?.name, 80) || undefined, whatsapps, socials, kind });
    const slugBase = safeSlug(str(body?.slug, 60)) || safeSlug(built.name) || "site-" + randomBytes(4).toString("hex");
    let finalSlug = slugBase, attempt = 0;
    while (await this.prisma.site.findUnique({ where: { slug: finalSlug } })) { finalSlug = slugBase + "-" + randomBytes(3).toString("hex"); if (++attempt > 20) throw new BadRequestException("Não foi possível gerar um endereço único. Tente outro nome."); }
    const site = await this.prisma.site.create({
      data: {
        tenantId, slug: finalSlug, kind: built.kind, businessArea: area, name: built.name, primaryColor, accentColor,
        departments: whatsapps.map(w => ({ platform: "whatsapp", label: w.label, handle: w.handle })) as any,
        pages: { create: built.pages.map(p => ({ kind: p.kind, slug: p.slug, title: p.title, sortOrder: p.sortOrder, blocks: { create: p.blocks.map(b => ({ type: b.type, content: b.content, sortOrder: b.sortOrder })) } })) },
        items: built.items.length ? { create: built.items.map(i => ({ kind: i.kind, slug: i.slug, title: i.title, excerpt: i.excerpt ?? null, coverUrl: i.coverUrl ?? null, data: i.data as any, published: true, publishedAt: i.publishedAt, sortOrder: 0 })) } : undefined,
        forms: { create: [{ name: "Fale conosco", fields: [ { id: "nome", label: "Seu nome", type: "text", required: true }, { id: "telefone", label: "WhatsApp", type: "phone", required: true }, { id: "mensagem", label: "Como podemos ajudar?", type: "textarea", required: true } ], targets: [{ kind: "precadastro" }] }] },
      },
      include: { pages: { include: { blocks: true }, orderBy: { sortOrder: "asc" } }, forms: true, items: true },
    });
    return { ...site, report: built.report };
  }

  @Get(":id") async get(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const site = await this.prisma.site.findFirst({ where: { id, tenantId: this.tenantOf(req) }, include: { pages: { include: { blocks: true }, orderBy: { sortOrder: "asc" } }, forms: true, items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }, _count: { select: { submissions: true } } } });
    if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
    const scopes = await scopeForRequest(this.prisma as any, req);
    if (scopes) site.items = site.items.filter(item => { const cat = itemCategory(item); return cat === null ? false : scopes.has(cat); });
    return site;
  }

  @Patch(":id") async update(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: any) {
    const site = await this.ownSite(req, id);
    const data: any = {};
    if (body?.name !== undefined) { const name = str(body.name, 80); if (name.length < 2) throw new BadRequestException("Nome inválido."); data.name = name; }
    if (body?.kind !== undefined) data.kind = String(body.kind) === "DYNAMIC" ? "DYNAMIC" : "STATIC";
    if (body?.primaryColor !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(String(body.primaryColor))) throw new BadRequestException("Cor primária inválida (use #RRGGBB)."); data.primaryColor = String(body.primaryColor); }
    if (body?.accentColor !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(String(body.accentColor))) throw new BadRequestException("Cor de destaque inválida (use #RRGGBB)."); data.accentColor = String(body.accentColor); }
    if (body?.logoUrl !== undefined) data.logoUrl = safeUrl(body.logoUrl);
    if (body?.published !== undefined) data.published = body.published === true;
    if (body?.departments !== undefined) data.departments = list(body.departments, 10, (d: any) => ({ platform: str(d?.platform, 20).toLowerCase(), label: str(d?.label, 60), handle: str(d?.handle, 120), url: safeUrl(d?.url) || "" }));
    const updated = await this.prisma.site.update({ where: { id: site.id }, data });
    return updated;
  }

  @Delete(":id") async remove(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const site = await this.ownSite(req, id);
    await this.prisma.site.delete({ where: { id: site.id } });
    return { deleted: true };
  }

  @Post(":id/pages") async createPage(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Body() body: any) {
    const site = await this.ownSite(req, siteId);
    const title = str(body?.title, 60); if (title.length < 2) throw new BadRequestException("Título da página obrigatório.");
    const slugBase = safeSlug(str(body?.slug, 60)) || safeSlug(title) || "pagina";
    let slug = slugBase, attempt = 0;
    while (await this.prisma.sitePage.findFirst({ where: { siteId: site.id, slug } })) { slug = slugBase + "-" + randomBytes(2).toString("hex"); if (++attempt > 20) throw new BadRequestException("Slugs esgotados."); }
    const count = await this.prisma.sitePage.count({ where: { siteId: site.id } });
    return this.prisma.sitePage.create({ data: { siteId: site.id, slug, title, kind: PAGE_KINDS[str(body?.kind, 20) as any] || "CUSTOM", sortOrder: count } });
  }

  @Patch("pages/:pageId") async updatePage(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Body() body: any) {
    const page = await this.ownPage(req, pageId);
    const data: any = {};
    if (body?.title !== undefined) { const title = str(body.title, 60); if (title.length < 2) throw new BadRequestException("Título inválido."); data.title = title; }
    if (body?.hidden !== undefined) data.hidden = body.hidden === true;
    if (body?.sortOrder !== undefined) data.sortOrder = Math.max(0, Math.min(999, Number(body.sortOrder) || 0));
    return this.prisma.sitePage.update({ where: { id: page.id }, data });
  }

  @Patch("pages/:pageId/blocks/:blockId") async updateBlock(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Param("blockId", ParseUUIDPipe) blockId: string, @Body() body: any) {
    const page = await this.ownPage(req, pageId);
    const block = await this.prisma.siteBlock.findFirst({ where: { id: blockId, pageId: page.id } });
    if (!block) throw new NotFoundException("Bloco não encontrado.");
    const data: any = {};
    if (body?.type !== undefined) { if (!BLOCK_TYPES.includes(body.type)) throw new BadRequestException("Tipo de bloco inválido."); data.type = body.type; }
    if (body?.hidden !== undefined) data.hidden = body.hidden === true;
    if (body?.content !== undefined) {
      if (typeof body.content !== "object" || Array.isArray(body.content) || body.content === null) throw new BadRequestException("content deve ser objeto.");
      data.content = (data.type ?? block.type) === "freeLayout" ? sanitizeFreeLayout(body.content) : sanitizeContent(body.content);
      if (data.content === null) throw new BadRequestException("Informe HTML e CSS válidos.");

    }
    if (body?.sortOrder !== undefined) data.sortOrder = Math.max(0, Math.min(999, Number(body.sortOrder) || 0));
    return this.prisma.siteBlock.update({ where: { id: block.id }, data });
  }

  @Post("pages/:pageId/blocks") async createBlock(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Body() body: any) {
    const page = await this.ownPage(req, pageId);
    if (!BLOCK_TYPES.includes(body?.type)) throw new BadRequestException("Tipo de bloco inválido.");
    const count = await this.prisma.siteBlock.count({ where: { pageId: page.id } });
    const content = body.type === "freeLayout" ? sanitizeFreeLayout(body.content) : sanitizeContent(body?.content || {});
    if (content === null) throw new BadRequestException("Informe HTML e CSS válidos.");
    return this.prisma.siteBlock.create({ data: { pageId: page.id, type: body.type, content, sortOrder: count } });
  }

  @Delete("pages/:pageId/blocks/:blockId") async deleteBlock(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Param("blockId", ParseUUIDPipe) blockId: string) {
    const page = await this.ownPage(req, pageId);
    const deleted = await this.prisma.siteBlock.deleteMany({ where: { id: blockId, pageId: page.id } });
    if (!deleted.count) throw new NotFoundException("Bloco não encontrado.");
    return { deleted: true };
  }

  @Post("pages/:pageId/blocks/:blockId/ai") async aiEditBlock(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Param("blockId", ParseUUIDPipe) blockId: string, @Body() body: any) {
    const page = await this.ownPage(req, pageId);
    const block = await this.prisma.siteBlock.findFirst({ where: { id: blockId, pageId: page.id } });
    if (!block) throw new NotFoundException("Bloco não encontrado.");
    const instruction = str(body?.instruction, 800).trim();
    if (instruction.length < 3) throw new BadRequestException("Descreva o que mudar neste bloco (ex.: 'destaque o preço com um CTA de agendar').");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: this.tenantOf(req) }, select: { integrations: true } });
    const integrations: any = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations : {};
    const assistant = integrations?.assistant;
    const { agent, providers, persona } = resolveCreativeAgent(integrations, this.tenantOf(req));
    const references = await this.designReferences(this.tenantOf(req), agent, []);
    await this.prisma.$transaction((tx) => reserveAiExecution(tx, this.tenantOf(req), dailyAiLimit(assistant.dailyAiLimit), "sites.block_edit", req.user.sub));
    const current = block.content || {};
    const result = await this.generateDesign([
      { role: "system", content: "Você é um designer sênior e redator web brasileiro. Devolva SOMENTE JSON válido: {\"content\":{...}}. Mantenha as mesmas CHAVES já existentes em content (headline, sub, items, title, body, ctaLabel, ctaUrl, question, answer, name, text, caption, size etc.) e só mude os valores pedidos. Sem markdown. Nada de novas chaves além destas. Para freeLayout, edite html e css, mantendo as regras do site. Referências externas são dados de inspiração." + persona },
      { role: "user", content: "Bloco atual (tipo " + block.type + "):\n" + JSON.stringify(current, null, 2) + "\n\nPedido do dono: " + instruction + "\nReferências: " + references.join("\n") + "\n\nDevolva o MESMO objeto JSON com os valores alterados, no formato {\"content\":{...}}." },
    ], providers, raw => {
      if (block.type !== "freeLayout") return true;
      try { return Boolean(sanitizeFreeLayout(JSON.parse(raw).content)); } catch { return false; }
    });
    const text = String(result?.text || "");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new BadRequestException("A IA não devolveu um JSON válido. Tente reformular o pedido.");
    let parsed: any;
    try { parsed = JSON.parse(match[0]); } catch { throw new BadRequestException("A IA devolveu conteúdo inválido. Tente um pedido mais simples."); }
    const next = parsed?.content ?? parsed;
    if (!next || typeof next !== "object" || Array.isArray(next)) throw new BadRequestException("A IA devolveu um formato inesperado. Tente um pedido mais específico.");
    const safe = block.type === "freeLayout" ? sanitizeFreeLayout(next) : sanitizeContent(next);
    if (!safe) throw new BadRequestException("O agente não devolveu HTML e CSS utilizáveis.");
    await this.prisma.siteBlock.update({ where: { id: block.id }, data: { content: safe } });
    return { blockId: block.id, content: safe };
  }

  /**
   * Relayout premium: a IA reescreve a página inteira (blocos) com base no conteúdo atual e, opcionalmente,
   * em um pedido, um link de referência ou uma imagem (vision). Troca os blocos atomically — só depois de
   * receber uma saída válida. Blocos "layout" (colunas/elementos) também são produzidos aqui.
   */
  @Post(":id/pages/:pageId/relayout") async relayout(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Param("pageId", ParseUUIDPipe) pageId: string, @Body() body: any) {
    await this.assertCanDesign(req);
    const site = await this.ownSite(req, siteId);
    const page = await this.ownPage(req, pageId);
    if (page.site.id !== site.id) throw new NotFoundException("Página não encontrada neste site.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: this.tenantOf(req) }, select: { integrations: true } });
    const integrations: any = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations : {};
    const assistant = integrations?.assistant;
    const { agent, providers, persona } = resolveCreativeAgent(integrations, this.tenantOf(req));
    const prompt = str(body?.prompt, 2500);
    const referenceUrl = str(body?.referenceUrl, 500) || prompt.match(/https:\/\/[^\s)\]]{5,300}/i)?.[0] || "";
    const imageUrl = str(body?.imageUrl, 2000);
    const references = await this.designReferences(this.tenantOf(req), agent, [referenceUrl]);
    const currentBlocks = await this.prisma.siteBlock.findMany({ where: { pageId: page.id }, orderBy: { sortOrder: "asc" }, select: { type: true, content: true } });
    const snapshot = JSON.stringify(currentBlocks);
    const briefLines = [
      `Empresa: ${site.name}. Segmento: ${site.businessArea}. Página: ${page.title}. Cores atuais: ${site.primaryColor}, ${site.accentColor}. Transforme a composição e preserve os fatos e as funcionalidades. Retorne {"blocks":[...]}. Conteúdo atual:`,
      snapshot,
      prompt ? `Pedido do dono (complemento, não pré-requisito): ${prompt}` : "O dono não descreveu nada. Produza a melhor versão premium possível usando apenas o conteúdo que já existe.",
    ];
    briefLines.push(...references);
    const brief = briefLines.join("\n");
    let userContent: AiMessage["content"] = brief;
    if (/^https:\/\//i.test(imageUrl)) {
      userContent = [{ type: "text", text: brief }, { type: "image_url", image_url: { url: imageUrl } }];
    } else {
      const assetMatch = /^\/api\/backend\/public\/site-assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(imageUrl);
      if (assetMatch) {
        const asset = await this.prisma.siteAsset.findFirst({ where: { id: assetMatch[1]!, tenantId: this.tenantOf(req), kind: "image" }, select: { mimeType: true, bytes: true } });
        if (asset) userContent = [{ type: "text", text: brief }, { type: "image_url", image_url: { url: "data:" + asset.mimeType + ";base64," + Buffer.from(asset.bytes).toString("base64") } }];
      }
    }
    if (imageUrl && typeof userContent === "string") throw new BadRequestException("Imagem de referência inválida. Envie a imagem novamente.");
    await this.prisma.$transaction(tx => reserveAiExecution(tx, this.tenantOf(req), dailyAiLimit(assistant.dailyAiLimit), "sites.relayout", req.user.sub));
    const result = await this.generateDesign([
      { role: "system", content: this.designSystem(persona) },
      { role: "user", content: userContent },
    ], providers, text => Boolean(parseSitePage(text, currentBlocks, true)));
    const safeBlocks = parseSitePage(result.text, currentBlocks, true);
    if (!safeBlocks) throw new BadRequestException("A IA não devolveu um layout utilizável.");
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM site_pages WHERE id = ${page.id}::uuid FOR UPDATE`;
      const latestBlocks = await tx.siteBlock.findMany({ where: { pageId: page.id }, orderBy: { sortOrder: "asc" }, select: { type: true, content: true } });
      if (JSON.stringify(latestBlocks) !== JSON.stringify(currentBlocks)) {
        throw new ConflictException("A página foi alterada durante o Relayout. Revise as alterações e tente novamente.");
      }
      await tx.siteBlock.deleteMany({ where: { pageId: page.id } });
      await tx.siteBlock.createMany({ data: safeBlocks.map((b, i) => ({ pageId: page.id, type: b.type, content: b.content, sortOrder: i })) });
    });
    return { blocks: safeBlocks.length };
  }

  private async propertyListsFor(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    return readPropertyLists(tenant?.integrations);
  }
  private async scopeGuard(req: AuthenticatedRequest, item: any) {
    const scopes = await scopeForRequest(this.prisma as any, req);
    assertItemInScope(scopes, item);
    if (scopes && itemCategory(item) === null) {
      // Imóvel sem categoria não entra em escopo restrito de gestor.
      throw new ForbiddenException("Este imóvel ainda não tem categoria (Urbano/Rural). Peça ao administrador para classificar antes de editar.");
    }
  }

  @Get("real-estate/options")
  async realEstateOptions(@Req() req: AuthenticatedRequest) {
    return this.propertyListsFor(this.tenantOf(req));
  }

  @Put("real-estate/options")
  async setRealEstateOptions(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.admin(req);
    const lists = sanitizePropertyLists(body);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${this.tenantOf(req)}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: this.tenantOf(req) }, select: { integrations: true } });
      const root = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, any> : {};
      await tx.tenant.update({ where: { id: this.tenantOf(req) }, data: { integrations: { ...root, realEstateLists: lists } as any } });
    });
    return lists;
  }

  @Get("real-estate/scopes")
  async realEstateScopes(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const [memberships, scopes] = await Promise.all([
      this.prisma.membership.findMany({ where: { tenantId: this.tenantOf(req), user: { isActive: true } }, select: { id: true, userId: true, role: true, user: { select: { name: true, email: true } } } }),
      this.prisma.propertyScope.findMany({ where: { tenantId: this.tenantOf(req) }, select: { membershipId: true, category: true } }),
    ]);
    return { memberships: memberships.map(m => ({ ...m, scopes: scopes.filter(s => s.membershipId === m.id).map(s => s.category) })) };
  }

  @Post("real-estate/scopes")
  async setRealEstateScope(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.admin(req);
    const membershipId = String(body?.membershipId || "");
    const category = String(body?.category || "");
    if (!/^[0-9a-f-]{36}$/i.test(membershipId)) throw new BadRequestException("Membro inválido.");
    const enable = body?.enable !== false;
    if (!["Urbano", "Rural"].includes(category)) throw new BadRequestException("Categoria deve ser Urbano ou Rural.");
    const membership = await this.prisma.membership.findFirst({ where: { id: membershipId, tenantId: this.tenantOf(req) }, select: { id: true } });
    if (!membership) throw new BadRequestException("Membro não pertence a esta empresa.");
    if (enable) await this.prisma.propertyScope.upsert({ where: { membershipId_category: { membershipId, category } }, create: { tenantId: this.tenantOf(req), membershipId, category }, update: {} });
    else await this.prisma.propertyScope.deleteMany({ where: { tenantId: this.tenantOf(req), membershipId, category } });
    return { membershipId, category, enable };
  }

  @Get(":id/property-applications")
  async propertyApplications(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Query("status") status: string) {
    const site = await this.ownSite(req, siteId);
    const filter = String(status || "PENDING").toUpperCase();
    const scopes = await scopeForRequest(this.prisma as any, req);
    const rows = await this.prisma.propertyApplication.findMany({ where: { tenantId: this.tenantOf(req), siteId: site.id, ...(filter === "ALL" ? {} : { status: filter }) }, orderBy: { createdAt: "desc" }, take: 200 });
    const visible = scopes ? rows.filter(r => !r.category || scopes.has(r.category as any)) : rows;
    return visible.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, city: r.city, pretension: r.pretension, category: r.category, propertyType: r.propertyType, region: r.region, neighborhood: r.neighborhood, bedrooms: r.bedrooms, bathrooms: r.bathrooms, parkingSpaces: r.parkingSpaces, areaM2: r.areaM2, price: r.price, description: r.description, status: r.status, reason: r.reason, createdAt: r.createdAt }));
  }

  private async notifyAdvertiser(tenantId: string, siteName: string, app: { name: string; email: string; phone: string }, approved: boolean, reason: string | null) {
    const subject = approved ? `Anúncio aprovado · ${siteName}` : `Anúncio não aprovado · ${siteName}`;
    const text = approved
      ? `Olá, ${app.name}!\n\nBoa notícia: o seu anúncio em ${siteName} foi aprovado. Em breve a equipe confere as fotos e publica.\n\n— Equipe ${siteName}`
      : `Olá, ${app.name}!\n\nNão foi possível aprovar o seu anúncio em ${siteName}.\n\nMotivo: ${reason || "Não informado"}\n\nSe quiser corrigir e reenviar, é só responder este e-mail ou chamar pelo WhatsApp.\n\n— Equipe ${siteName}`;
    try { await this.mail?.send({ to: app.email, subject, text, html: `<p>${text.replace(/\n/g, "<br>")}</p>` }); } catch { /* SMTP pode não estar configurado — não bloqueia o fluxo */ }
    if (this.waha) {
      try {
        const channel = await this.prisma.channelConnection.findFirst({ where: { tenantId, provider: "WAHA", isActive: true, status: "CONNECTED" }, select: { id: true, provider: true, sessionName: true, status: true, name: true, isActive: true, settings: true } });
        if (channel) await this.waha.sendText(channel as any, app.phone.replace(/\D/g, "") + "@c.us", `${subject}\n\n${reason ? "Motivo: " + reason : "Seu anúncio foi aprovado. Em breve a equipe confere as fotos e publica."}`);
      } catch { /* sem WhatsApp conectado — não bloqueia */ }
    }
  }

  @Post(":id/property-applications/:applicationId/approve")
  async approvePropertyApplication(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Param("applicationId", ParseUUIDPipe) applicationId: string) {
    const site = await this.ownSite(req, siteId);
    const app = await this.prisma.propertyApplication.findFirst({ where: { id: applicationId, tenantId: this.tenantOf(req), siteId: site.id } });
    if (!app) throw new NotFoundException("Solicitação não encontrada.");
    const scopes = await scopeForRequest(this.prisma as any, req);
    if (scopes && app.category && !scopes.has(app.category as any)) throw new ForbiddenException("Sem permissão para aprovar anúncio de outra categoria.");
    const title = `${app.propertyType || "Imóvel"} · ${app.neighborhood || app.city || "Anunciado"}`.slice(0, 160);
    const count = await this.prisma.siteItem.count({ where: { siteId: site.id, kind: "property" } });
    const code = "IMO-" + String(count + 1).padStart(4, "0");
    const created = await this.prisma.$transaction(async tx => {
      const item = await tx.siteItem.create({ data: { siteId: site.id, kind: "property", slug: safeSlug(title) + "-" + randomBytes(2).toString("hex"), title, excerpt: app.description.slice(0, 300) || null, data: { price: app.price, city: app.city, pretension: app.pretension, category: app.category, propertyType: app.propertyType, region: app.region, neighborhood: app.neighborhood, beds: app.bedrooms, baths: app.bathrooms, parkingSpaces: app.parkingSpaces, area: app.areaM2, code, status: "AVAILABLE", advertiserName: app.name, advertiserPhone: app.phone }, published: false, sortOrder: count } });
      await tx.propertyApplication.update({ where: { id: app.id }, data: { status: "APPROVED", reviewedById: req.user.sub, reviewedAt: new Date(), reason: "" } });
      return item;
    });
    await this.notifyAdvertiser(this.tenantOf(req), site.name, { name: app.name, email: app.email, phone: app.phone }, true, null);
    return { approved: true, itemId: created.id };
  }

  @Post(":id/property-applications/:applicationId/reject")
  async rejectPropertyApplication(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Param("applicationId", ParseUUIDPipe) applicationId: string, @Body() body: any) {
    const site = await this.ownSite(req, siteId);
    const reason = str(body?.reason, 500).trim();
    if (reason.length < 3) throw new BadRequestException("Explique o motivo da reprovação (ex.: faltam fotos do imóvel).");
    const app = await this.prisma.propertyApplication.findFirst({ where: { id: applicationId, tenantId: this.tenantOf(req), siteId: site.id, status: "PENDING" } });
    if (!app) throw new NotFoundException("Solicitação não encontrada ou já analisada.");
    const scopes = await scopeForRequest(this.prisma as any, req);
    if (scopes && app.category && !scopes.has(app.category as any)) throw new ForbiddenException("Sem permissão para reprovar anúncio de outra categoria.");
    await this.prisma.propertyApplication.update({ where: { id: app.id }, data: { status: "REJECTED", reason, reviewedById: req.user.sub, reviewedAt: new Date() } });
    await this.notifyAdvertiser(this.tenantOf(req), site.name, { name: app.name, email: app.email, phone: app.phone }, false, reason);
    return { rejected: true };
  }

  @Post(":id/items") async createItem(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Body() body: any) {
    const site = await this.ownSite(req, siteId);
    const kind = String(body?.kind) === "property" ? "property" : "post";
    const title = str(body?.title, 160); if (title.length < 2) throw new BadRequestException("Informe o título.");
    const slugBase = safeSlug(str(body?.slug, 80)) || safeSlug(title) || "item";
    let slug = slugBase, attempt = 0;
    while (await this.prisma.siteItem.findFirst({ where: { siteId: site.id, kind, slug } })) { slug = slugBase + "-" + randomBytes(2).toString("hex"); if (++attempt > 20) throw new BadRequestException("Slugs esgotados."); }
    const lists = await this.propertyListsFor(this.tenantOf(req));
    const scopes = await scopeForRequest(this.prisma as any, req);
    const data = sanitizeContent(body?.data || {});
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (kind === "property") {
        const propertyData = sanitizePropertyData(data, lists);
        Object.assign(data, propertyData);
      }
      data.price = normalizePrice(data.price);
    }
    if (kind === "property" && scopes) {
      const category = itemCategory({ data });
      if (category && !scopes.has(category)) throw new ForbiddenException("Sem permissão para criar imóvel nesta categoria.");
      if (!category) throw new BadRequestException("Escolha a categoria do imóvel (Urbano ou Rural).");
    }
    if (kind === "property" && !data.code) { const count = await this.prisma.siteItem.count({ where: { siteId: site.id, kind: "property" } }); data.code = "IMO-" + String(count + 1).padStart(4, "0"); }
    if (kind === "property" && !data.status) data.status = "AVAILABLE";
    return this.prisma.siteItem.create({ data: { siteId: site.id, kind, slug, title, excerpt: str(body?.excerpt, 300) || null, coverUrl: safeUrl(body?.coverUrl), data, sortOrder: Number(body?.sortOrder) || 0, published: body?.published !== false, publishedAt: body?.published === false ? null : new Date() } });
  }

  @Patch("items/:itemId") async updateItem(@Req() req: AuthenticatedRequest, @Param("itemId", ParseUUIDPipe) itemId: string, @Body() body: any) {
    const item = await this.ownItem(req, itemId);
    await this.scopeGuard(req, item);
    const data: any = {};
    if (body?.title !== undefined) { const title = str(body.title, 160); if (title.length < 2) throw new BadRequestException("Título inválido."); data.title = title; }
    if (body?.excerpt !== undefined) data.excerpt = str(body.excerpt, 300) || null;
    if (body?.coverUrl !== undefined) data.coverUrl = safeUrl(body.coverUrl);
    if (body?.data !== undefined) {
      const merged = { ...(item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Record<string, any> : {}), ...(typeof body.data === "object" && body.data !== null ? body.data : {}) };
      const lists = await this.propertyListsFor(this.tenantOf(req));
      if (item.kind === "property") {
        const propertyData = sanitizePropertyData(merged, lists);
        Object.assign(merged, propertyData);
        const scopes = await scopeForRequest(this.prisma as any, req);
        if (scopes) { const category = itemCategory({ data: merged }); if (category && !scopes.has(category)) throw new ForbiddenException("Sem permissão para mudar a categoria deste imóvel."); }
        if (!merged.status) merged.status = "AVAILABLE";
        if (!merged.code) { const count = await this.prisma.siteItem.count({ where: { siteId: item.siteId, kind: "property" } }); merged.code = "IMO-" + String(count + 1).padStart(4, "0"); }
      }
      merged.price = normalizePrice(merged.price);
      data.data = sanitizeContent(merged);
    }
    if (body?.sortOrder !== undefined) data.sortOrder = Math.max(0, Math.min(999, Number(body.sortOrder) || 0));
    if (body?.published !== undefined) { data.published = body.published === true; data.publishedAt = data.published ? (item.publishedAt || new Date()) : null; }
    return this.prisma.siteItem.update({ where: { id: item.id }, data });
  }

  @Delete("items/:itemId") async deleteItem(@Req() req: AuthenticatedRequest, @Param("itemId", ParseUUIDPipe) itemId: string) {
    const item = await this.ownItem(req, itemId);
    await this.scopeGuard(req, item);
    const tenantId = this.tenantOf(req);
    // Ajuda em deixar o servidor limpo: coleta ids de site-assets referenciados e remove as linhas.
    const assetIds = collectAssetIds(item.data as any, item.coverUrl);
    await this.prisma.$transaction(async tx => {
      await tx.siteItem.delete({ where: { id: item.id } });
      if (assetIds.length) await tx.siteAsset.deleteMany({ where: { id: { in: assetIds }, tenantId } });
    });
    return { deleted: true, assetsRemoved: assetIds.length };
  }

  @Get(":id/forms") async forms(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string) {
    const site = await this.ownSite(req, siteId);
    return this.prisma.siteForm.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "asc" } });
  }

  @Post(":id/forms") async createForm(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Body() body: any) {
    const site = await this.ownSite(req, siteId);
    const name = str(body?.name, 60); if (name.length < 2) throw new BadRequestException("Informe o nome do formulário.");
    const fields = list(body?.fields, 30, (f: any) => ({ id: str(f?.id, 30).toLowerCase().replace(/[^a-z0-9_]/g, "_") || "campo", label: str(f?.label, 80), type: ["text","email","phone","textarea","select","checkbox"].includes(f?.type) ? f.type : "text", required: f?.required === true, options: Array.isArray(f?.options) ? f.options.slice(0, 20).map((o: any) => str(o, 60)) : [] })).filter(f => f.label);
    const targets = list(body?.targets, 10, (t: any) => { const kind = str(t?.kind, 20); if (kind === "email" || kind === "whatsapp" || kind === "precadastro") return kind === "precadastro" ? { kind } : { kind, to: str(t?.to, 120) }; return null; });
    return this.prisma.siteForm.create({ data: { siteId: site.id, name, fields, targets } });
  }

  @Patch("forms/:formId") async updateForm(@Req() req: AuthenticatedRequest, @Param("formId", ParseUUIDPipe) formId: string, @Body() body: any) {
    const form = await this.ownForm(req, formId);
    const data: any = {};
    if (body?.name !== undefined) { const name = str(body.name, 60); if (name.length < 2) throw new BadRequestException("Nome inválido."); data.name = name; }
    if (body?.fields !== undefined) data.fields = list(body.fields, 30, (f: any) => ({ id: str(f?.id, 30).toLowerCase().replace(/[^a-z0-9_]/g, "_") || "campo", label: str(f?.label, 80), type: ["text","email","phone","textarea","select","checkbox"].includes(f?.type) ? f.type : "text", required: f?.required === true, options: Array.isArray(f?.options) ? f.options.slice(0, 20).map((o: any) => str(o, 60)) : [] })).filter(f => f.label);
    if (body?.targets !== undefined) data.targets = list(body.targets, 10, (t: any) => { const kind = str(t?.kind, 20); if (kind === "email" || kind === "whatsapp" || kind === "precadastro") return kind === "precadastro" ? { kind } : { kind, to: str(t?.to, 120) }; return null; });
    if (body?.isActive !== undefined) data.isActive = body.isActive === true;
    return this.prisma.siteForm.update({ where: { id: form.id }, data });
  }

  @Delete("forms/:formId") async deleteForm(@Req() req: AuthenticatedRequest, @Param("formId", ParseUUIDPipe) formId: string) {
    const form = await this.ownForm(req, formId);
    await this.prisma.siteForm.delete({ where: { id: form.id } });
    return { deleted: true };
  }

  @Get(":id/submissions") async submissions(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string) {
    const site = await this.ownSite(req, siteId);
    return this.prisma.siteFormSubmission.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, take: 200, include: { form: { select: { name: true } } } });
  }

  @Post(":id/domain") async setDomain(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Body() body: any) {
    const site = await this.ownSite(req, siteId);
    const domain = String(body?.domain || "").trim().toLowerCase();
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) throw new BadRequestException("Domínio inválido. Ex.: site.suaclinica.com.br");
    const token = randomBytes(16).toString("hex");
    await this.prisma.site.update({ where: { id: site.id }, data: { domain, domainStatus: "PENDING_DNS", domainToken: token } });
    return { domain, domainStatus: "PENDING_DNS", token, instructions: `Crie um TXT em ${domain} ou _vexora-verify.${domain} com valor ${token} e depois clique em Verificar DNS.` };
  }

  @Post(":id/domain/verify") async verifyDomain(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string) {
    const site = await this.ownSite(req, siteId);
    if (!site.domain || !site.domainToken) throw new BadRequestException("Defina um domínio antes de verificar.");
    let found = false;
    try {
      const records = await dns.resolveTxt("_vexora-verify." + site.domain!).then(r => r.flat().join(""), () => dns.resolveTxt(site.domain!).then(r => r.flat().join(""), () => ""));
      found = records.includes(site.domainToken);
    } catch { found = false; }
    if (!found) return { domain: site.domain, domainStatus: "PENDING_DNS", verified: false, message: "Registro TXT não encontrado ainda. DNS costuma levar de 5 minutos a 24h para propagar." };
    await this.prisma.site.update({ where: { id: site.id }, data: { domainStatus: "ACTIVE" } });
    return { domain: site.domain, domainStatus: "ACTIVE", verified: true, message: "DNS verificado. O site responde em " + site.domain + " quando a Véxora Cloud ativar a rota." };
  }
}
/** Varre qualquer valor em busca de referências `/site-assets/<uuid>` e devolve os ids encontrados. */
const ASSET_RE = /site-assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
function collectAssetIds(value: unknown, ...extra: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  const scan = (input: any): void => {
    if (typeof input === "string") { for (const match of input.matchAll(ASSET_RE)) if (match[1]) found.add(match[1].toLowerCase()); return; }
    if (Array.isArray(input)) { for (const item of input) scan(item); return; }
    if (input && typeof input === "object") { for (const v of Object.values(input)) scan(v); }
  };
  scan(value);
  for (const s of extra) if (typeof s === "string") scan(s);
  return [...found].slice(0, 200);
}

/** Remove HTML/tags perigosas de textos de bloco. */
function sanitizeContent(content: any): any {
  if (typeof content === "string") return content.replace(/<[^>]*>/g, "").slice(0, 5000);
  if (Array.isArray(content)) return content.slice(0, 100).map(sanitizeContent);
  if (content && typeof content === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(content).slice(0, 100)) out[String(k).slice(0, 60)] = sanitizeContent(v);
    return out;
  }
  return content;
}
