import { BadRequestException, Injectable } from "@nestjs/common";
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

@Injectable()
export class FinanceProvidersService {
  constructor(
    private readonly asaas: AsaasService,
    private readonly stripe: StripeService,
    private readonly infinitePay: InfinitePayService,
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
