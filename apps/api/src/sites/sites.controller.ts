import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { blueprintFor, BUSINESS_AREAS } from "./blueprint";
import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
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
const BLOCK_TYPES = ["hero","richText","services","gallery","testimonials","faq","cta","posts","properties","contact","spacer","divider"] as const;

/** Véxora Sites — API do produto Sites (criação, edição, publicação e domínio). */
@Controller("sites")
@UseGuards(AuthGuard)
export class SitesController {
  constructor(private readonly prisma: PrismaService) {}
  private tenantOf(req: AuthenticatedRequest) { return req.user.tenantId; }
  private modules(req: AuthenticatedRequest): string[] {
    // NOTE: role OWNER/ADMIN keep all modules; the enforcement here is per-tenant plan.
    // Membership-level restriction acontece no AuthGuard (effectiveModules).
    return ["SITES"];
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
    const accentColor = /^#[0-9a-f]{6}$/i.test(String(body?.accentColor)) ? String(body.accentColor) : "#6258DF";
    const whatsapps = list(body?.whatsapps, 5, (w: any) => ({ label: str(w?.label, 60), handle: waNumber(str(w?.handle, 30)) })).filter(w => w.handle);
    const socials = list(body?.socials, 6, (s: any) => ({ platform: str(s?.platform, 30).toLowerCase(), handle: str(s?.handle, 80) })).filter(s => s.handle);
    const blueprint = blueprintFor(area, name, { primaryColor, accentColor, whatsapps, socials, dynamic: kind === "DYNAMIC" });
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
    return site;
  }

  @Get(":id") async get(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const site = await this.prisma.site.findFirst({ where: { id, tenantId: this.tenantOf(req) }, include: { pages: { include: { blocks: true }, orderBy: { sortOrder: "asc" } }, forms: true, items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }, _count: { select: { submissions: true } } } });
    if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
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
      data.content = sanitizeContent(body.content);
    }
    if (body?.sortOrder !== undefined) data.sortOrder = Math.max(0, Math.min(999, Number(body.sortOrder) || 0));
    return this.prisma.siteBlock.update({ where: { id: block.id }, data });
  }

  @Post("pages/:pageId/blocks") async createBlock(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Body() body: any) {
    const page = await this.ownPage(req, pageId);
    if (!BLOCK_TYPES.includes(body?.type)) throw new BadRequestException("Tipo de bloco inválido.");
    const count = await this.prisma.siteBlock.count({ where: { pageId: page.id } });
    return this.prisma.siteBlock.create({ data: { pageId: page.id, type: body.type, content: sanitizeContent(body?.content || {}), sortOrder: count } });
  }

  @Delete("pages/:pageId/blocks/:blockId") async deleteBlock(@Req() req: AuthenticatedRequest, @Param("pageId", ParseUUIDPipe) pageId: string, @Param("blockId", ParseUUIDPipe) blockId: string) {
    const page = await this.ownPage(req, pageId);
    const deleted = await this.prisma.siteBlock.deleteMany({ where: { id: blockId, pageId: page.id } });
    if (!deleted.count) throw new NotFoundException("Bloco não encontrado.");
    return { deleted: true };
  }

  @Post(":id/items") async createItem(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) siteId: string, @Body() body: any) {
    const site = await this.ownSite(req, siteId);
    const kind = String(body?.kind) === "property" ? "property" : "post";
    const title = str(body?.title, 160); if (title.length < 2) throw new BadRequestException("Informe o título.");
    const slugBase = safeSlug(str(body?.slug, 80)) || safeSlug(title) || "item";
    let slug = slugBase, attempt = 0;
    while (await this.prisma.siteItem.findFirst({ where: { siteId: site.id, kind, slug } })) { slug = slugBase + "-" + randomBytes(2).toString("hex"); if (++attempt > 20) throw new BadRequestException("Slugs esgotados."); }
    const data = sanitizeContent(body?.data || {});
    return this.prisma.siteItem.create({ data: { siteId: site.id, kind, slug, title, excerpt: str(body?.excerpt, 300) || null, coverUrl: safeUrl(body?.coverUrl), data, sortOrder: Number(body?.sortOrder) || 0, published: body?.published !== false, publishedAt: body?.published === false ? null : new Date() } });
  }

  @Patch("items/:itemId") async updateItem(@Req() req: AuthenticatedRequest, @Param("itemId", ParseUUIDPipe) itemId: string, @Body() body: any) {
    const item = await this.ownItem(req, itemId);
    const data: any = {};
    if (body?.title !== undefined) { const title = str(body.title, 160); if (title.length < 2) throw new BadRequestException("Título inválido."); data.title = title; }
    if (body?.excerpt !== undefined) data.excerpt = str(body.excerpt, 300) || null;
    if (body?.coverUrl !== undefined) data.coverUrl = safeUrl(body.coverUrl);
    if (body?.data !== undefined) data.data = sanitizeContent(body.data);
    if (body?.sortOrder !== undefined) data.sortOrder = Math.max(0, Math.min(999, Number(body.sortOrder) || 0));
    if (body?.published !== undefined) { data.published = body.published === true; data.publishedAt = data.published ? (item.publishedAt || new Date()) : null; }
    return this.prisma.siteItem.update({ where: { id: item.id }, data });
  }

  @Delete("items/:itemId") async deleteItem(@Req() req: AuthenticatedRequest, @Param("itemId", ParseUUIDPipe) itemId: string) {
    const item = await this.ownItem(req, itemId);
    await this.prisma.siteItem.delete({ where: { id: item.id } });
    return { deleted: true };
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
