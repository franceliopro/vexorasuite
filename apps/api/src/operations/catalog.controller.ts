import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { requirePublicHttpsUrl } from "./storefront-links";

const trim = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
/** A vitrine exige ASAAS; itens antigos sem categoria também devem aparecer nela. */
const PAYMENT_CATEGORY = "ASAAS";
/** Itens legados foram gravados com NULL ou string vazia antes do default existir. */
const PAYMENT_CATEGORY_FILTER = [{ category: PAYMENT_CATEGORY }, { category: null }, { category: "" }];
const safeImageUrl = (value: unknown): string | undefined => {
  const url = trim(value, 1000);
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/api/")) throw new BadRequestException("URL de imagem inválida. Use um link HTTP(S) ou um arquivo da própria Véxora.");
  return url;
};
const KINDS = new Set(["PRODUCT", "SERVICE"]);
const object = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};

@Controller("catalog")
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  private adminOnly(req: AuthenticatedRequest) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores gerenciam o catálogo.");
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest, @Query("q") qRaw?: string, @Query("kind") kindRaw?: string, @Query("category") categoryRaw?: string, @Query("limit") limitRaw?: string, @Query("includeInactive") includeInactiveRaw?: string) {
    const limit = Math.max(1, Math.min(200, Number.parseInt(limitRaw || "50", 10) || 50));
    const q = trim(qRaw, 120);
    const kind = typeof kindRaw === "string" && KINDS.has(kindRaw) ? kindRaw : undefined;
    const category = categoryRaw ? trim(categoryRaw, 80) : undefined;
    const includeInactive = includeInactiveRaw === "true" && administrative(req.user.role);
    const and: any[] = [];
    if (category) and.push(category === PAYMENT_CATEGORY ? { OR: PAYMENT_CATEGORY_FILTER } : { category });
    if (q) and.push({ OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { publicDescription: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] });
    const items = await this.prisma.catalogItem.findMany({
      where: { tenantId: req.user.tenantId, ...(includeInactive ? {} : { active: true }), ...(kind ? { kind } : {}), ...(and.length ? { AND: and } : {}) },
      select: { id: true, kind: true, name: true, description: true, sku: true, priceCents: true, currency: true, unit: true, imageUrl: true, publicDescription: true, publicImageUrl: true, publicLink: true, category: true, active: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }] ,
      take: limit,
    });
    return { items };
  }

  @Get(":id")
  async detail(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const item = await this.prisma.catalogItem.findFirst({ where: { id, tenantId: req.user.tenantId, active: true } });
    if (!item) throw new NotFoundException("Item não encontrado.");
    return { item };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() input: any) {
    this.adminOnly(req);
    const kind = typeof input?.kind === "string" && KINDS.has(input.kind) ? input.kind : "PRODUCT";
    const name = trim(input?.name, 160);
    if (name.length < 2) throw new BadRequestException("Informe um nome.");
    const description = trim(input?.description, 2000);
    const sku = trim(input?.sku, 80) || undefined;
    const price = Number(input?.priceCents);
    if (!Number.isFinite(price) || price < 0) throw new BadRequestException("Preço inválido.");
    const currency = trim(input?.currency, 3).toUpperCase() || "BRL";
    if (currency.length !== 3) throw new BadRequestException("Moeda inválida.");
    const unit = trim(input?.unit, 10) || "un";
    const imageUrl = safeImageUrl(input?.imageUrl);
    const publicDescription = trim(input?.publicDescription, 2000) || null;
    const publicImageUrl = requirePublicHttpsUrl(input?.publicImageUrl, "Imagem pública");
    const publicLink = requirePublicHttpsUrl(input?.publicLink, "Link público");
    const category = trim(input?.category, 80) || PAYMENT_CATEGORY;
    const item = await this.prisma.catalogItem.create({ data: { tenantId: req.user.tenantId, kind, name, description, sku, priceCents: Math.round(price), currency, unit, imageUrl, publicDescription, publicImageUrl, publicLink, category } });
    return { item };
  }

  @Put(":id")
  async update(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: any) {
    this.adminOnly(req);
    const existing = await this.prisma.catalogItem.findFirst({ where: { id, tenantId: req.user.tenantId }, select: { id: true, category: true } });
    if (!existing) throw new NotFoundException("Item não encontrado.");
    const data: any = {};
    if (input?.kind !== undefined) { const kind = String(input.kind); if (!KINDS.has(kind)) throw new BadRequestException("Tipo inválido."); data.kind = kind; }
    if (input?.name !== undefined) { const name = trim(input.name, 160); if (name.length < 2) throw new BadRequestException("Informe um nome."); data.name = name; }
    if (input?.description !== undefined) data.description = trim(input.description, 2000);
    if (input?.sku !== undefined) data.sku = trim(input.sku, 80) || null;
    if (input?.priceCents !== undefined) { const price = Number(input.priceCents); if (!Number.isFinite(price) || price < 0) throw new BadRequestException("Preço inválido."); data.priceCents = Math.round(price); }
    if (input?.currency !== undefined) { const currency = trim(input.currency, 3).toUpperCase(); if (currency.length !== 3) throw new BadRequestException("Moeda inválida."); data.currency = currency; }
    if (input?.unit !== undefined) data.unit = trim(input.unit, 10) || "un";
    if (input?.imageUrl !== undefined) data.imageUrl = safeImageUrl(input.imageUrl) || null;
    if (input?.publicDescription !== undefined) data.publicDescription = trim(input.publicDescription, 2000) || null;
    if (input?.publicImageUrl !== undefined) data.publicImageUrl = requirePublicHttpsUrl(input.publicImageUrl, "Imagem pública");
    if (input?.publicLink !== undefined) data.publicLink = requirePublicHttpsUrl(input.publicLink, "Link público");
    if (input?.category !== undefined) data.category = trim(input.category, 80) || PAYMENT_CATEGORY;
    // Reativar um item legado (PUT {active:true}) também o traz para a vitrine.
    else if (!existing.category) data.category = PAYMENT_CATEGORY;
    if (input?.active !== undefined) data.active = input.active === true;
    const item = await this.prisma.catalogItem.update({ where: { id }, data, select: { id: true, kind: true, name: true, priceCents: true, unit: true, imageUrl: true, publicDescription: true, publicImageUrl: true, publicLink: true, active: true } });
    return { item };
  }

  @Delete(":id")
  async remove(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.adminOnly(req);
    const result = await this.prisma.catalogItem.updateMany({ where: { id, tenantId: req.user.tenantId }, data: { active: false } });
    if (!result.count) throw new NotFoundException("Item não encontrado.");
    return { deactivated: true };
  }
}
