import { BadRequestException, Body, Controller, Get, HttpException, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/auth.guard";
import { readPropertyLists } from "./real-estate";
import { randomBytes } from "node:crypto";
import type { Request } from "express";

const applyRate = new Map<string, { count: number; windowStart: number }>();
const APPLY_WINDOW_MS = 10 * 60e3;
const APPLY_MAX_PER_WINDOW = 5;
const MIN_FORM_MS = 2500;
function rateLimit(key: string) {
  const now = Date.now();
  const entry = applyRate.get(key);
  if (!entry || now - entry.windowStart > APPLY_WINDOW_MS) { applyRate.set(key, { count: 1, windowStart: now }); return true; }
  if (entry.count >= APPLY_MAX_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}
const cleanStr = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
/** Renderizador público do site (sem autenticação) — é o que o visitante abre no domínio/slug. */
@Controller("public/sites")
export class PublicSitesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(":slug")
  async render(@Param("slug") slug: string) {
    const site = await this.prisma.site.findFirst({
      where: { slug: String(slug || "").toLowerCase().slice(0, 80), published: true },
      include: { pages: { where: { hidden: false }, include: { blocks: { where: { hidden: false }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }, forms: { where: { isActive: true } }, items: { where: { published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] } },
    });
    if (!site) throw new NotFoundException("Este site não existe ou não está publicado.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: site.tenantId }, select: { name: true } });
    return { site: { ...site, tenantName: tenant?.name || "Empresa" }, tenantName: tenant?.name || "Empresa" };
  }
  @Get(":slug/host")
  async byHost(@Param("slug") host: string, @Req() req: any) {
    const value = String((req?.headers?.["x-forwarded-host"] || req?.headers?.host || host || "")).toLowerCase().slice(0, 120);
    const site = await this.prisma.site.findFirst({
      where: { domain: { startsWith: value.replace(/:\d+$/, "") }, published: true },
      include: { pages: { where: { hidden: false }, include: { blocks: { where: { hidden: false }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }, forms: { where: { isActive: true } }, items: { where: { published: true } } },
    });
    if (!site) throw new NotFoundException("Nenhuma rota ativa para este domínio.");
    return site;
  }
  @Get(":slug/real-estate-options")
  async realEstateOptions(@Param("slug") slug: string) {
    const site = await this.prisma.site.findFirst({ where: { slug: String(slug || "").toLowerCase().slice(0, 80), published: true }, select: { tenantId: true } });
    if (!site) throw new NotFoundException("Site não publicado.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: site.tenantId }, select: { integrations: true } });
    return readPropertyLists(tenant?.integrations);
  }

  @Post(":slug/property-applications")
  async propertyApplication(@Param("slug") slug: string, @Req() req: Request, @Body() body: any) {
    // Anti-robô: honeypot vazio + formulário preenchido rápido demais = descarte silencioso.
    if (cleanStr(body?._gotcha, 100)) return { received: true };
    const loadedAt = Number(body?.formLoadedAt || 0);
    if (!Number.isFinite(loadedAt) || loadedAt <= 0 || Date.now() - loadedAt < MIN_FORM_MS) {
      throw new HttpException("Aguarde alguns segundos e tente novamente.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const ip = String((req as any)?.ip || (req.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown").slice(0, 60);
    if (!rateLimit(slug + ":" + ip)) throw new HttpException("Muitas tentativas. Tente novamente em alguns minutos.", HttpStatus.TOO_MANY_REQUESTS);

    const site = await this.prisma.site.findFirst({ where: { slug: String(slug || "").toLowerCase().slice(0, 80), published: true }, select: { id: true, tenantId: true, name: true } });
    if (!site) throw new NotFoundException("Site não publicado.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: site.tenantId }, select: { integrations: true } });
    const lists = readPropertyLists(tenant?.integrations);

    const name = cleanStr(body?.name, 120); const email = cleanStr(body?.email, 180).toLowerCase(); const phoneDigits = cleanStr(body?.phone, 40).replace(/\D/g, "");
    if (name.length < 2) throw new BadRequestException("Informe seu nome.");
    if (!emailOk(email)) throw new BadRequestException("Informe um e-mail válido.");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) throw new BadRequestException("Informe um celular válido com DDD.");
    const city = cleanStr(body?.city, 80);
    if (city.length < 2) throw new BadRequestException("Informe a cidade do imóvel.");
    const pretensionRaw = cleanStr(body?.pretension, 40);
    const pretension = lists.pretensions.find(p => p.toLowerCase() === pretensionRaw.toLowerCase()) || "";
    const categoryRaw = cleanStr(body?.category, 20);
    const category = ["Urbano", "Rural"].includes(categoryRaw) ? categoryRaw : "";
    const allowedTypes = [...lists.types.Urbano, ...lists.types.Rural];
    const typeRaw = cleanStr(body?.propertyType, 60);
    const propertyType = allowedTypes.find(t => t.toLowerCase() === typeRaw.toLowerCase()) || "";
    if (!pretension || !category || !propertyType) throw new BadRequestException("Escolha pretensão, categoria e tipo do imóvel.");

    const priceDigits = cleanStr(body?.price, 40).replace(/\D/g, "");
    const price = priceDigits ? "R$ " + (Number(priceDigits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
    const num = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
    await this.prisma.propertyApplication.create({
      data: {
        tenantId: site.tenantId,
        siteId: site.id,
        name, email, phone: phoneDigits,
        city, pretension, category, propertyType,
        region: cleanStr(body?.region, 80), neighborhood: cleanStr(body?.neighborhood, 80),
        bedrooms: num(body?.bedrooms, 40), bathrooms: num(body?.bathrooms, 40), parkingSpaces: num(body?.parkingSpaces, 40),
        areaM2: Math.min(1e7, Math.max(0, Number(body?.areaM2) || 0)),
        price, description: cleanStr(body?.description, 3000),
        honeypot: "", formLoadedAt: BigInt(Date.now()),
        status: "PENDING",
      },
    });
    return { received: true };
  }

  @Post(":slug/forms/:formId")
  async submit(@Param("slug") slug: string, @Param("formId", ParseUUIDPipe) formId: string, @Body() body: any) {
    const site = await this.prisma.site.findFirst({ where: { slug: String(slug || "").toLowerCase().slice(0, 80), published: true }, select: { id: true } });
    if (!site) throw new NotFoundException("Site não publicado.");
    const form = await this.prisma.siteForm.findFirst({ where: { id: formId, siteId: site.id, isActive: true } });
    if (!form) throw new NotFoundException("Formulário indisponível.");
    const values: Record<string, unknown> = {};
    for (const field of (form.fields as Array<{ id: string }>)) {
      const raw = body?.[field.id];
      values[field.id] = typeof raw === "string" ? raw.trim().slice(0, 1000) : raw;
    }
    await this.prisma.siteFormSubmission.create({ data: { formId: form.id, siteId: site.id, pageSlug: typeof body?.page === "string" ? body.page.slice(0, 80) : "", values: values as any } });
    return { received: true };
  }
}
