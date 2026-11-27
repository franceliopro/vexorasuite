import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  isStorefrontItemId,
  normalizeStorefrontSiteUrl,
  safePublicHttpsUrl,
  storefrontShareText,
  storefrontUrls,
  STOREFRONT_NOTICE,
} from "./storefront-links";

const TOKEN_PREFIX = "vx_store_";
const TOKEN_PATTERN = /^vx_store_[A-Za-z0-9_-]{43}$/;
const MAX_ITEMS = 200;

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

const cleanName = (value: unknown) => {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80) throw new BadRequestException("Informe um nome para a vitrine.");
  return name;
};

const siteUrlInput = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = normalizeStorefrontSiteUrl(value);
  if (!normalized) throw new BadRequestException("URL da vitrine inválida. Informe a URL HTTPS do site.");
  return normalized;
};

@Injectable()
export class StorefrontCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listTokens(tenantId: string) {
    return this.prisma.storefrontToken.findMany({
      where: { tenantId },
      select: { id: true, name: true, siteUrl: true, lastUsedAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createToken(tenantId: string, input: unknown) {
    const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const name = cleanName(body.name);
    const siteUrl = siteUrlInput(body.siteUrl);
    const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
    const row = await this.prisma.storefrontToken.create({
      data: { tenantId, name, siteUrl, tokenHash: hashToken(token) },
      select: { id: true, name: true, siteUrl: true, createdAt: true },
    });
    return {
      ...row,
      token,
      warning: "Guarde este token agora. Ele não será exibido novamente.",
    };
  }

  async updateToken(tenantId: string, id: string, input: unknown) {
    const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const existing = await this.prisma.storefrontToken.findFirst({
      where: { id, tenantId, revokedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Vitrine não encontrada ou revogada.");
    const data: { name?: string; siteUrl?: string | null } = {};
    if (body.name !== undefined) data.name = cleanName(body.name);
    if (body.siteUrl !== undefined) data.siteUrl = siteUrlInput(body.siteUrl);
    return this.prisma.storefrontToken.update({ where: { id }, data, select: { id: true, name: true, siteUrl: true } });
  }

  async revokeToken(tenantId: string, id: string) {
    const result = await this.prisma.storefrontToken.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new BadRequestException("Token não encontrado ou já revogado.");
    return { revoked: true };
  }

  /** Texto e links prontos para bot, IA e atendente. Nunca inventa URL quando não há site configurado. */
  async share(tenantId: string, rawItemId?: unknown) {
    if (rawItemId !== undefined && rawItemId !== null && rawItemId !== "" && !isStorefrontItemId(rawItemId)) {
      throw new BadRequestException("Item do catálogo inválido.");
    }
    const itemId = typeof rawItemId === "string" && rawItemId ? rawItemId : null;
    let item: { id: string; name: string } | null = null;
    if (itemId) {
      item = await this.prisma.catalogItem.findFirst({
        where: { id: itemId, tenantId, active: true },
        select: { id: true, name: true },
      });
      if (!item) throw new NotFoundException("Item do catálogo não encontrado ou inativo.");
    }

    const token = await this.prisma.storefrontToken.findFirst({
      where: { tenantId, revokedAt: null, siteUrl: { not: null } },
      select: { siteUrl: true },
      orderBy: { createdAt: "desc" },
    });
    const baseUrl = normalizeStorefrontSiteUrl(token?.siteUrl);
    const links = baseUrl ? storefrontUrls(baseUrl, item?.id) : { listUrl: null, itemUrl: null };
    return {
      status: baseUrl ? "CONFIGURED" : "UNCONFIGURED",
      configured: Boolean(baseUrl),
      reason: baseUrl ? null : "SITE_URL_MISSING",
      notice: STOREFRONT_NOTICE,
      itemId: item?.id ?? null,
      itemName: item?.name ?? null,
      listUrl: links.listUrl,
      itemUrl: links.itemUrl,
      text: storefrontShareText(baseUrl, item?.name, item?.id),
    };
  }

  async publicCatalog(rawToken: unknown) {
    const token = typeof rawToken === "string" ? rawToken.trim() : "";
    if (!TOKEN_PATTERN.test(token)) throw new UnauthorizedException("Token da vitrine inválido.");

    const row = await this.prisma.storefrontToken.findFirst({
      where: { tokenHash: hashToken(token), revokedAt: null, tenant: { status: "ACTIVE" } },
      select: { id: true, tenantId: true },
    });
    if (!row) throw new UnauthorizedException("Token da vitrine inválido ou revogado.");

    await this.prisma.storefrontToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    const items = await this.prisma.catalogItem.findMany({
      where: { tenantId: row.tenantId, active: true },
      select: {
        id: true,
        kind: true,
        name: true,
        sku: true,
        priceCents: true,
        currency: true,
        unit: true,
        category: true,
        publicDescription: true,
        publicImageUrl: true,
        publicLink: true,
        updatedAt: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: MAX_ITEMS,
    });

    return {
      source: "VEXORA_CATALOG",
      generatedAt: new Date().toISOString(),
      notice: STOREFRONT_NOTICE,
      count: items.length,
      // Whitelist explícita: description e imageUrl são privados da Véxora e não entram no feed.
      items: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        sku: item.sku,
        priceCents: item.priceCents,
        currency: item.currency,
        unit: item.unit,
        category: item.category,
        publicDescription: item.publicDescription,
        publicImageUrl: safePublicHttpsUrl(item.publicImageUrl),
        publicLink: safePublicHttpsUrl(item.publicLink),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }
}
