import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { mutateTenantSetting } from "../prisma/tenant-settings";
import { AsaasService } from "./asaas.service";
import { InfinitePayService } from "./infinitepay.service";
import { StripeService } from "./stripe.service";
import {
  CONFIGURATION_IS_NOT_CONNECTION,
  FINANCE_PROVIDER_DEFINITIONS,
  type FinanceProviderDescriptor,
} from "./finance-provider-capabilities";
import { PAYMENT_PROVIDERS, canonicalPaymentProvider, type PaymentProvider } from "./payment-providers";

type ProviderStatus = Pick<FinanceProviderDescriptor, "enabled" | "configured" | "environment">;

/** Chave isolada dentro de tenants.integrations: nunca replica credenciais entre módulos. */
const CATALOG_FINANCE_KEY = "catalogFinance";
const CATALOG_FINANCE_NOTE =
  "O catálogo é único. Escolha entre os provedores habilitados e configurados deste tenant; salvar a preferência não cria cobrança nem prova conexão ativa.";

@Injectable()
export class FinanceProvidersService {
  constructor(
    private readonly asaas: AsaasService,
    private readonly stripe: StripeService,
    private readonly infinitePay: InfinitePayService,
    private readonly prisma: PrismaService,
  ) {}

  async list(tenantId: string): Promise<FinanceProviderDescriptor[]> {
    const rows = await Promise.all(PAYMENT_PROVIDERS.map((provider) => this.describe(tenantId, provider)));
    return rows;
  }

  async describe(tenantId: string, providerRaw: unknown): Promise<FinanceProviderDescriptor> {
    const provider = canonicalPaymentProvider(providerRaw);
    if (!provider) throw new BadRequestException("Provedor financeiro inválido.");
    return {
      ...FINANCE_PROVIDER_DEFINITIONS[provider],
      ...(await this.status(tenantId, provider)),
      verification: { status: "NOT_VERIFIED", note: CONFIGURATION_IS_NOT_CONNECTION },
    };
  }

  /** Preferência do catálogo: somente provedores configurados aparecem como opção real. */
  async catalogProvider(tenantId: string) {
    const [rows, tenant] = await Promise.all([
      this.list(tenantId),
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } }),
    ]);
    const current = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Prisma.JsonObject
      : {};
    const setting = current[CATALOG_FINANCE_KEY];
    const savedProvider = setting && typeof setting === "object" && !Array.isArray(setting)
      ? canonicalPaymentProvider((setting as Prisma.JsonObject).provider)
      : null;
    const usable = rows.filter((row) => row.enabled && row.configured);
    const selected = savedProvider && usable.some((row) => row.provider === savedProvider) ? savedProvider : "ASAAS";
    return {
      selected,
      options: usable.map((row) => ({
        provider: row.provider,
        label: row.label,
        environment: row.environment,
        verification: row.verification,
      })),
      note: CATALOG_FINANCE_NOTE,
    };
  }

  async selectCatalogProvider(tenantId: string, providerRaw: unknown) {
    const provider = canonicalPaymentProvider(providerRaw);
    if (!provider) throw new BadRequestException("Provedor financeiro inválido.");
    const descriptor = await this.describe(tenantId, provider);
    if (!descriptor.enabled || !descriptor.configured) {
      throw new BadRequestException(`${descriptor.label} não está habilitado e configurado nesta empresa.`);
    }
    await mutateTenantSetting(this.prisma, tenantId, CATALOG_FINANCE_KEY, () => ({
      provider,
      selectedAt: new Date().toISOString(),
    }) as Prisma.InputJsonValue);
    return this.catalogProvider(tenantId);
  }

  private async status(tenantId: string, provider: PaymentProvider): Promise<ProviderStatus> {
    if (provider === "ASAAS") {
      const settings = await this.asaas.publicSettings(tenantId);
      return {
        enabled: settings.enabled === true,
        configured: settings.configured === true,
        environment: settings.sandbox ? "SANDBOX" : "PRODUCTION",
      };
    }
    if (provider === "STRIPE") {
      const settings = await this.stripe.publicSettings(tenantId);
      return {
        enabled: settings.enabled === true,
        configured: settings.configured === true,
        environment: settings.environment || "TEST",
      };
    }
    const settings = await this.infinitePay.publicSettings(tenantId);
    return {
      enabled: settings.enabled === true,
      configured: settings.configured === true,
      environment: "PRODUCTION",
    };
  }
}
