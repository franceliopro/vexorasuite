import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AsaasService } from "./asaas.service";
import { InfinitePayService } from "./infinitepay.service";
import { StripeService } from "./stripe.service";
import { FinanceProvidersService } from "./finance-providers.service";
import { canonicalPaymentProvider, PAYMENT_PROVIDERS, type PaymentProvider } from "./payment-providers";

type PublicationRow = {
  id: string;
  provider: string;
  status: string;
  source: string;
  objectType: string;
  externalId: string | null;
  externalUrl: string | null;
  environment: string | null;
  lastError: string | null;
  metadata: Prisma.JsonValue;
  publishedAt: Date | null;
  importedAt: Date | null;
  updatedAt: Date;
};

type CatalogRow = {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  priceCents: number;
  currency: string;
  publicDescription: string | null;
  active: boolean;
};

type ProviderResult = {
  objectType: string;
  externalId: string;
  externalUrl: string | null;
  environment: string;
  priceId?: string | null;
  slug?: string | null;
  degraded?: string | null;
};

type ImportCandidate = {
  externalId: string;
  name: string;
  description: string;
  priceCents: number | null;
  currency: string;
  imageUrl: string | null;
};

const PUBLISHABLE = new Set(["NOT_PUBLISHED", "FAILED", "PARTIAL"]);
const STALE_PUBLISHING_MS = 5 * 60 * 1000;

const PUBLICATION_NOTES: Record<PaymentProvider, string> = {
  ASAAS: "O Asaas não expõe catálogo de produtos na API pública; a publicação cria um link de pagamento real com externalReference do item.",
  STRIPE: "A publicação cria Product e Price reais na Stripe; a descrição interna da Véxora nunca é enviada.",
  INFINITEPAY: "A InfinitePay não tem API de produtos; a publicação cria um link de pagamento real e exige valor mínimo de R$ 1,00.",
};

const objectOf = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

const text = (value: unknown, max = 200): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const safeHttps = (value: unknown): string | null => {
  const raw = text(value, 1000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
};

const safeError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : "erro desconhecido";
  return raw.replace(/https?:\/\/\S+/gi, "[url]").replace(/[A-Za-z0-9_-]{32,}/g, "[valor]").slice(0, 300);
};

const asPublication = (row: unknown): PublicationRow => row as PublicationRow;

const compactMetadata = (result: ProviderResult, provider: PaymentProvider): Prisma.InputJsonValue => objectOf({
  objectType: result.objectType,
  ...(result.priceId ? { priceId: result.priceId } : {}),
  ...(result.slug ? { slug: result.slug } : {}),
  ...(provider === "STRIPE" && !result.priceId ? { pricePending: true } : {}),
}) as Prisma.InputJsonValue;

/**
 * Publicação explícita e reversível. O catálogo continua canônico; cada linha destas
 * é apenas o espelho técnico de um objeto criado/importado em uma plataforma.
 */
@Injectable()
export class CatalogPublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeProviders: FinanceProvidersService,
    private readonly asaas: AsaasService,
    private readonly stripe: StripeService,
    private readonly infinitePay: InfinitePayService,
  ) {}

  private async item(tenantId: string, itemId: string): Promise<CatalogRow> {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: itemId, tenantId },
      select: { id: true, name: true, description: true, sku: true, priceCents: true, currency: true, publicDescription: true, active: true },
    });
    if (!item) throw new NotFoundException("Item do catálogo não encontrado para esta empresa.");
    return item as CatalogRow;
  }

  private async mirror(tenantId: string, itemId: string, provider: PaymentProvider): Promise<PublicationRow | null> {
    const row = await this.prisma.catalogPublication.findUnique({
      where: { tenantId_catalogItemId_provider: { tenantId, catalogItemId: itemId, provider } },
    });
    return row ? asPublication(row) : null;
  }

  private provider(providerRaw: unknown): PaymentProvider {
    const provider = canonicalPaymentProvider(providerRaw);
    if (!provider) throw new BadRequestException("Provedor financeiro inválido.");
    return provider;
  }

  async status(tenantId: string, itemId: string) {
    const [item, rows, descriptors] = await Promise.all([
      this.item(tenantId, itemId),
      this.prisma.catalogPublication.findMany({ where: { tenantId, catalogItemId: itemId } }),
      this.financeProviders.list(tenantId),
    ]);
    const byProvider = new Map((rows as unknown[]).map((row) => [asPublication(row).provider, asPublication(row)]));
    const descriptorByProvider = new Map(descriptors.map((descriptor) => [descriptor.provider, descriptor]));
    return {
      itemId: item.id,
      itemName: item.name,
      notice: "Publicar cria um objeto real na plataforma. Configuração salva, token ou link não provam que a vitrine está no ar.",
      providers: PAYMENT_PROVIDERS.map((provider) => {
        const descriptor = descriptorByProvider.get(provider)!;
        const row = byProvider.get(provider) || null;
        const state = row?.status || "NOT_PUBLISHED";
        const available = descriptor.enabled && descriptor.configured;
        return {
          provider,
          label: descriptor.label,
          environment: descriptor.environment,
          configured: available,
          verification: descriptor.verification,
          capability: provider === "STRIPE" ? "PRODUCT_AND_PRICE" : "PAYMENT_LINK",
          status: state,
          objectType: row?.objectType || (provider === "STRIPE" ? "PRODUCT" : "PAYMENT_LINK"),
          externalId: row?.externalId || null,
          externalUrl: row?.externalUrl ? safeHttps(row.externalUrl) : null,
          lastError: row?.lastError || null,
          publishedAt: row?.publishedAt ? row.publishedAt.toISOString() : null,
          importedAt: row?.importedAt ? row.importedAt.toISOString() : null,
          canPublish: available && PUBLISHABLE.has(state),
          note: PUBLICATION_NOTES[provider],
        };
      }),
    };
  }

  async publish(tenantId: string, itemId: string, providerRaw: unknown, confirm: unknown, actorId: string) {
    if (confirm !== true) throw new BadRequestException("Confirme explicitamente a publicação antes de criar o objeto na plataforma.");
    const provider = this.provider(providerRaw);
    const item = await this.item(tenantId, itemId);
    if (!item.active) throw new BadRequestException("Reative o item no catálogo antes de publicá-lo.");
    const descriptor = await this.financeProviders.describe(tenantId, provider);
    if (!descriptor.enabled || !descriptor.configured) {
      throw new BadRequestException(`${descriptor.label} não está habilitada e configurada nesta empresa. Configure em Conexões antes de publicar.`);
    }
    const existing = await this.mirror(tenantId, itemId, provider);
    if (existing && (existing.status === "PUBLISHED" || existing.status === "IMPORTED") && existing.externalId) {
      return {
        ...this.view(existing),
        alreadyPublished: true,
        notice: "Este item já tem espelho confirmado nesta plataforma. Nenhum objeto duplicado foi criado.",
      };
    }
    if (existing?.status === "PUBLISHING" && existing.updatedAt.getTime() + STALE_PUBLISHING_MS > Date.now()) {
      throw new BadRequestException("Já existe uma publicação em andamento para este item e plataforma.");
    }

    const objectType = provider === "STRIPE" ? "PRODUCT" : "PAYMENT_LINK";
    const base = {
      status: "PUBLISHING",
      source: "VEXORA_TO_PROVIDER",
      objectType,
      lastError: null,
      publishedAt: null,
      importedAt: null,
    };
    let row: PublicationRow;
    try {
      if (existing) {
        row = asPublication(await this.prisma.catalogPublication.update({
          where: { id: existing.id },
          data: base,
        }));
      } else {
        row = asPublication(await this.prisma.catalogPublication.create({
          data: {
            tenantId,
            catalogItemId: itemId,
            provider,
            ...base,
            metadata: {} as Prisma.InputJsonValue,
          },
        }));
      }
    } catch (error) {
      if (objectOf(error).code === "P2002") throw new BadRequestException("Outra publicação foi iniciada para este item. Recarregue antes de tentar novamente.");
      throw error;
    }

    const externalReference = provider === "INFINITEPAY"
      ? `vxcat_${itemId.replace(/-/g, "").slice(0, 40)}`
      : `vexora:catalog:${itemId}`;
    try {
      const result = await this.callProvider(tenantId, provider, item, externalReference, existing);
      const status = result.degraded ? "PARTIAL" : "PUBLISHED";
      const updated = asPublication(await this.prisma.catalogPublication.update({
        where: { id: row.id },
        data: {
          status,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          environment: result.environment,
          objectType: result.objectType,
          lastError: result.degraded || null,
          publishedAt: result.degraded ? null : new Date(),
          metadata: compactMetadata(result, provider),
        },
      }));
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: "catalog.publication_published",
          entityType: "catalog_item",
          entityId: itemId,
          details: { provider, status, objectType: result.objectType, externalId: result.externalId, actorId },
        },
      });
      return {
        ...this.view(updated),
        alreadyPublished: false,
        notice: result.degraded
          ? `${result.degraded} Objeto confirmado na plataforma; nenhum duplicado será criado na nova tentativa.`
          : `Publicação confirmada na ${descriptor.label}. Nenhuma cobrança, pedido ou envio foi executado.`,
      };
    } catch (error) {
      const message = safeError(error);
      const updated = asPublication(await this.prisma.catalogPublication.update({
        where: { id: row.id },
        data: {
          status: existing?.status === "PARTIAL" && existing.externalId ? "PARTIAL" : "FAILED",
          externalId: existing?.externalId || null,
          externalUrl: existing?.externalUrl || null,
          environment: existing?.environment || null,
          objectType: existing?.objectType || objectType,
          lastError: message,
          metadata: existing?.metadata || ({} as Prisma.InputJsonValue),
        },
      }));
      throw new ServiceUnavailableException(`${descriptor.label} não confirmou a publicação: ${message}. Situação registrada como ${updated.status}.`);
    }
  }

  private async callProvider(
    tenantId: string,
    provider: PaymentProvider,
    item: CatalogRow,
    externalReference: string,
    existing: PublicationRow | null,
  ): Promise<ProviderResult> {
    if (provider === "ASAAS") return this.asaas.publishCatalogItem(tenantId, tenantItem(item), externalReference) as Promise<ProviderResult>;
    if (provider === "INFINITEPAY") return this.infinitePay.publishCatalogItem(tenantId, tenantItem(item), externalReference) as Promise<ProviderResult>;
    const metadata = objectOf(existing?.metadata);
    const prior = existing?.externalId ? { externalId: existing.externalId, metadata } : null;
    return this.stripe.publishCatalogItem(tenantId, { ...tenantItem(item), sku: item.sku }, prior) as Promise<ProviderResult>;
  }

  private view(row: PublicationRow) {
    return {
      id: row.id,
      provider: row.provider,
      status: row.status,
      source: row.source,
      objectType: row.objectType,
      externalId: row.externalId,
      externalUrl: row.externalUrl ? safeHttps(row.externalUrl) : null,
      environment: row.environment,
      lastError: row.lastError,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      importedAt: row.importedAt ? row.importedAt.toISOString() : null,
    };
  }

  async importPreview(tenantId: string, providerRaw: unknown, limitRaw?: unknown) {
    const provider = this.provider(providerRaw);
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(limitRaw ?? "50"), 10) || 50));
    if (provider === "INFINITEPAY") {
      return {
        provider,
        source: "UNSUPPORTED",
        candidates: [],
        note: "A InfinitePay não oferece API documentada para listar produtos da conta. Itens criados lá devem ser cadastrados manualmente na Véxora.",
      };
    }
    const descriptor = await this.financeProviders.describe(tenantId, provider);
    if (!descriptor.enabled || !descriptor.configured) {
      throw new BadRequestException(`${descriptor.label} não está habilitada e configurada nesta empresa.`);
    }
    let source: string;
    let environment: string | null;
    let candidates: ImportCandidate[];
    let hasMore = false;
    if (provider === "ASAAS") {
      const data = await this.asaas.listCatalog(tenantId, 0, limit);
      source = data.source === "ASAAS_LIVE" ? "ASAAS_LIVE" : "PROVIDER_LIVE";
      environment = data.environment;
      candidates = data.products.map((product) => ({
        externalId: text(product.id, 200),
        name: text(product.name, 160),
        description: text(product.description, 2000),
        priceCents: Number.isFinite(Number(product.value)) ? Math.round(Number(product.value) * 100) : null,
        currency: "BRL",
        imageUrl: null,
      }));
      hasMore = data.hasMoreProducts === true;
    } else {
      const data = await this.stripe.listFinanceCatalog(tenantId, limit);
      source = data.source;
      environment = data.environment;
      candidates = data.items.map((product) => ({
        externalId: text(product.id, 200),
        name: text(product.name, 160),
        description: text(product.description, 2000),
        priceCents: Number.isSafeInteger(product.priceCents) ? product.priceCents : null,
        currency: product.currency || "BRL",
        imageUrl: safeHttps(product.imageUrl),
      }));
      hasMore = data.hasMore === true;
    }
    const externalIds = candidates.map((candidate) => candidate.externalId).filter(Boolean);
    const imported = externalIds.length
      ? await this.prisma.catalogPublication.findMany({
          where: { tenantId, provider, externalId: { in: externalIds } },
          select: { externalId: true },
        })
      : [];
    const known = new Set((imported as { externalId: string | null }[]).map((row) => row.externalId));
    return {
      provider,
      source,
      environment,
      hasMore,
      note: "Somente dados básicos vêm da plataforma. Descrição pública, imagem pública, link público, SKU, unidade e categoria continuam sendo preenchidos na Véxora.",
      candidates: candidates
        .filter((candidate) => candidate.externalId && candidate.name && candidate.priceCents !== null)
        .map((candidate) => ({ ...candidate, alreadyImported: known.has(candidate.externalId) })),
    };
  }

  async importItem(tenantId: string, providerRaw: unknown, externalIdRaw: unknown, confirm: unknown, actorId: string) {
    if (confirm !== true) throw new BadRequestException("Confirme explicitamente a importação para o catálogo.");
    const provider = this.provider(providerRaw);
    const externalId = text(externalIdRaw, 200);
    if (!externalId) throw new BadRequestException("Informe o identificador do item na plataforma.");
    const preview = await this.importPreview(tenantId, provider, 100);
    const candidate = (preview.candidates as (ImportCandidate & { alreadyImported?: boolean })[])
      .find((entry) => entry.externalId === externalId);
    if (!candidate) throw new NotFoundException("Item não encontrado na listagem da plataforma para esta empresa.");
    if (candidate.alreadyImported) {
      return { imported: false, status: "IMPORTED", externalId, notice: "Este item da plataforma já está catalogado nesta empresa." };
    }
    const priceCents = candidate.priceCents;
    if (priceCents === null || !Number.isSafeInteger(priceCents)) throw new BadRequestException("O item da plataforma não tem preço utilizável para o catálogo.");

    const result = await this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.catalogPublication.findFirst({
        where: { tenantId, provider, externalId },
        select: { id: true },
      });
      if (duplicate) return { imported: false as const, itemId: null as string | null };
      const created = await tx.catalogItem.create({
        data: {
          tenantId,
          kind: "PRODUCT",
          name: candidate.name.slice(0, 160),
          description: candidate.description.slice(0, 2000),
          priceCents,
          currency: (candidate.currency || "BRL").toUpperCase().slice(0, 3),
          unit: "un",
          imageUrl: safeHttps(candidate.imageUrl),
          publicDescription: null,
          publicImageUrl: null,
          publicLink: null,
          category: provider,
          active: true,
        },
        select: { id: true },
      });
      await tx.catalogPublication.create({
        data: {
          tenantId,
          catalogItemId: created.id,
          provider,
          status: "IMPORTED",
          source: "PROVIDER_TO_VEXORA",
          objectType: provider === "STRIPE" ? "PRODUCT" : "CATALOG_ENTRY",
          externalId,
          externalUrl: null,
          environment: preview.environment || null,
          metadata: { objectType: provider === "STRIPE" ? "PRODUCT" : "CATALOG_ENTRY" } as Prisma.InputJsonValue,
          importedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          action: "catalog.publication_imported",
          entityType: "catalog_item",
          entityId: created.id,
          details: { provider, externalId, actorId },
        },
      });
      return { imported: true as const, itemId: created.id };
    });

    return {
      ...result,
      status: result.imported ? "IMPORTED" : "ALREADY_IMPORTED",
      externalId,
      notice: result.imported
        ? "Item catalogado na Véxora. Os campos públicos aprovados continuam vazios e devem ser preenchidos antes de usar a vitrine externa."
        : "Este item da plataforma já está catalogado nesta empresa.",
    };
  }
}

/** O catálogo guarda campos de apresentação; nenhum segredo ou credencial é enviado aos adaptadores. */
function tenantItem(item: CatalogRow) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    publicDescription: item.publicDescription,
    priceCents: item.priceCents,
    currency: item.currency,
  };
}
