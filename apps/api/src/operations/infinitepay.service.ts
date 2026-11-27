import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { mutateTenantSetting } from "../prisma/tenant-settings";
import { decryptIntegrationSecret, encryptIntegrationSecret, IntegrationEncryptionError } from "./payment-provider-crypto";
import { amountToCents, firstString, objectOf, paymentProviderAliases, publicAppOrigin } from "./payment-providers";
import { settleProviderPayment } from "./payment-settlement";

type InfinitePaySettings = { enabled?: boolean; handle?: string; apiKeyEncrypted?: string };

const INFINITEPAY_API = "https://api.checkout.infinitepay.io";

class CheckoutRequestRejected extends ServiceUnavailableException {}

/** O webhook não tem assinatura; paid:true só é aceito após /payment_check com valor original conferido. */
export function infinitepayPaymentApproved(check: unknown, expectedAmountCents: number): boolean {
  const result = objectOf(check);
  return result.success === true && result.paid === true
    && result.amount === expectedAmountCents
    && Number.isSafeInteger(expectedAmountCents);
}

@Injectable()
export class InfinitePayService {
  private readonly logger = new Logger(InfinitePayService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async settings(tenantId: string): Promise<InfinitePaySettings> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    const all = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown> : {};
    return all.infinitepay && typeof all.infinitepay === "object" ? all.infinitepay as InfinitePaySettings : {};
  }

  async publicSettings(tenantId: string) {
    const settings = await this.settings(tenantId);
    return {
      enabled: settings.enabled === true,
      configured: Boolean(settings.handle || settings.apiKeyEncrypted),
      handle: settings.handle || "",
      apiKeyConfigured: Boolean(settings.apiKeyEncrypted),
      apiKeyMasked: settings.apiKeyEncrypted ? "••••••••••••" : "",
      environment: "PRODUCTION",
      webhookUrl: publicAppOrigin() + "/api/webhooks/infinitepay/" + tenantId,
      sandboxAvailable: false,
      recurringAvailable: false,
    };
  }

  async saveSettings(tenantId: string, input: { enabled?: unknown; handle?: unknown; apiKey?: unknown }) {
    if (typeof input.enabled !== "boolean") throw new BadRequestException("Informe se a InfinitePay está ativada.");
    const handle = firstString(input.handle).replace(/^\$/, "");
    if (handle && !/^[A-Za-z0-9_.-]{1,64}$/.test(handle)) throw new BadRequestException("A InfiniteTag informada é inválida.");
    const apiKey = firstString(input.apiKey);
    if (apiKey && !/^inchk_[A-Za-z0-9]+$/.test(apiKey)) throw new BadRequestException("A API Key da InfinitePay deve começar com inchk_.");
    const current = await this.settings(tenantId);
    if (input.enabled && !handle && !apiKey && !current.handle && !current.apiKeyEncrypted) {
      throw new BadRequestException("Informe a InfiniteTag ou a API Key antes de ativar.");
    }
    await mutateTenantSetting(this.prisma, tenantId, "infinitepay", (value) => {
      const latest = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
      return {
        enabled: input.enabled as boolean,
        handle: handle || latest.handle || "",
        apiKeyEncrypted: apiKey ? encryptIntegrationSecret(apiKey) : latest.apiKeyEncrypted || null,
      };
    });
    return this.publicSettings(tenantId);
  }

  private async credentials(tenantId: string): Promise<{ handle: string; apiKey: string | null }> {
    const settings = await this.settings(tenantId);
    if (settings.enabled !== true || (!settings.handle && !settings.apiKeyEncrypted)) {
      throw new ServiceUnavailableException("Integração InfinitePay não está configurada para esta empresa.");
    }
    let apiKey: string | null = null;
    if (settings.apiKeyEncrypted) {
      try {
        apiKey = decryptIntegrationSecret(settings.apiKeyEncrypted, "InfinitePay");
      } catch (error) {
        if (error instanceof IntegrationEncryptionError) throw new ServiceUnavailableException(error.message);
        throw error;
      }
    }
    return { handle: settings.handle || "", apiKey };
  }

  private async request<T>(path: string, body: Record<string, unknown>, apiKey: string | null): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "VexoraSuite" };
    if (apiKey) headers["x-api-key"] = apiKey;
    const response = await fetch(INFINITEPAY_API + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.warn(`InfinitePay recusou ${path}: ${response.status}`);
      const message = response.status === 403
        ? "A API Key e a InfiniteTag pertencem a contas diferentes."
        : "A InfinitePay não conseguiu concluir a operação.";
      if (path === "/links" && [400, 401, 403, 422].includes(response.status)) {
        throw new CheckoutRequestRejected(message);
      }
      throw new ServiceUnavailableException(message);
    }
    return objectOf(payload) as T;
  }

  /** Não existe endpoint de teste: nunca afirmar conexão ao vivo a partir desta chamada. */
  async testConnection(tenantId: string) {
    const credentials = await this.credentials(tenantId);
    return {
      connected: false,
      verified: false,
      configured: true,
      handleConfigured: Boolean(credentials.handle),
      apiKeyConfigured: Boolean(credentials.apiKey),
      environment: "PRODUCTION",
      message: "A InfinitePay não oferece sandbox nem endpoint de teste. A validação exige uma compra real de valor baixo e confirmação externa.",
    };
  }

  async createLink(tenantId: string, input: {
    paymentId?: unknown; description?: unknown; customerName?: unknown;
    customerEmail?: unknown; redirectUrl?: unknown;
  }) {
    const paymentId = firstString(input.paymentId);
    if (!paymentId) throw new BadRequestException("Informe o pagamento local vinculado.");
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId, provider: { in: paymentProviderAliases("INFINITEPAY") }, status: "PENDING" },
      select: { id: true, amount: true, externalId: true, invoiceUrl: true },
    });
    if (!payment) throw new BadRequestException("Pagamento local pendente não encontrado para esta empresa.");
    if (payment.externalId === payment.id && payment.invoiceUrl) {
      return { paymentId, url: payment.invoiceUrl, orderNsu: payment.id, slug: null, status: "PENDING", environment: "PRODUCTION" };
    }
    if (payment.externalId) throw new BadRequestException("Esta cobrança já tem uma solicitação de link InfinitePay.");
    const cents = amountToCents(payment.amount);
    if (cents < 100) throw new BadRequestException("O valor mínimo da InfinitePay é R$ 1,00.");
    const credentials = await this.credentials(tenantId);
    const orderNsu = payment.id;
    const payload: Record<string, unknown> = {
      items: [{ quantity: 1, price: cents, description: firstString(input.description).slice(0, 120) || `Pagamento Véxora ${payment.id}` }],
      order_nsu: orderNsu,
      webhook: {
        url: publicAppOrigin() + "/api/webhooks/infinitepay/" + tenantId,
        events: ["paid", "canceled", "refunded", "payment_failed"],
      },
    };
    if (credentials.handle) payload.handle = credentials.handle;
    const redirectUrl = firstString(input.redirectUrl);
    if (redirectUrl) {
      let parsed: URL;
      try { parsed = new URL(redirectUrl); } catch { throw new BadRequestException("URL de retorno inválida."); }
      if (parsed.protocol !== "https:") throw new BadRequestException("A URL de retorno deve usar HTTPS.");
      payload.redirect_url = parsed.toString();
    }
    const customerName = firstString(input.customerName);
    const customerEmail = firstString(input.customerEmail);
    if (customerName || customerEmail) {
      payload.customer = { ...(customerName ? { name: customerName.slice(0, 120) } : {}), ...(customerEmail ? { email: customerEmail.slice(0, 160) } : {}) };
    }
    const reserved = await this.prisma.payment.updateMany({
      where: { id: payment.id, tenantId, status: "PENDING", externalId: null },
      data: { externalId: orderNsu, environment: "PRODUCTION" },
    });
    if (!reserved.count) throw new BadRequestException("Já existe uma solicitação de link para esta cobrança.");

    const result = await this.request<{ url?: string; link?: string; checkout_url?: string; slug?: string }>(
      "/links", payload, credentials.apiKey,
    ).catch(async error => {
      if (error instanceof CheckoutRequestRejected) {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, tenantId, status: "PENDING", externalId: orderNsu, invoiceUrl: null },
          data: { externalId: null },
        });
      }
      throw error;
    });
    let url: string;
    try {
      const parsed = new URL(firstString(result.url || result.link || result.checkout_url));
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Invalid checkout URL");
      url = parsed.href;
    } catch {
      throw new ServiceUnavailableException("A InfinitePay não devolveu um link de pagamento utilizável.");
    }
    const saved = await this.prisma.payment.updateMany({
      where: { id: payment.id, tenantId, status: "PENDING", externalId: orderNsu },
      data: { invoiceUrl: url },
    });
    if (!saved.count) throw new BadRequestException("A cobrança mudou durante a criação do link.");
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: "payment.provider_created",
        entityType: "payment",
        entityId: payment.id,
        details: { provider: "INFINITEPAY", externalId: orderNsu, slug: firstString(result.slug) || null, environment: "PRODUCTION" },
      },
    });
    return {
      paymentId: payment.id,
      url,
      orderNsu,
      slug: firstString(result.slug) || null,
      status: "PENDING",
      environment: "PRODUCTION",
    };
  }

  /** A API InfinitePay não gerencia produtos: publicar significa criar um link de pagamento real. */
  async publishCatalogItem(
    tenantId: string,
    item: { id: string; name: string; publicDescription?: string | null; priceCents: number },
    externalReference: string,
  ) {
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents < 100) {
      throw new BadRequestException("O valor mínimo da InfinitePay é R$ 1,00.");
    }
    const credentials = await this.credentials(tenantId);
    const payload: Record<string, unknown> = {
      items: [{
        quantity: 1,
        price: item.priceCents,
        description: firstString(item.publicDescription).slice(0, 120) || item.name.slice(0, 120),
      }],
      order_nsu: externalReference.slice(0, 120),
    };
    if (credentials.handle) payload.handle = credentials.handle;
    const result = await this.request<{ url?: string; link?: string; checkout_url?: string; slug?: string }>(
      "/links", payload, credentials.apiKey,
    );
    let url: string;
    try {
      const parsed = new URL(firstString(result.url || result.link || result.checkout_url));
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Invalid checkout URL");
      url = parsed.href;
    } catch {
      throw new ServiceUnavailableException("A InfinitePay não devolveu um link de pagamento utilizável.");
    }
    return {
      objectType: "PAYMENT_LINK",
      externalId: externalReference.slice(0, 120),
      externalUrl: url,
      environment: "PRODUCTION",
      slug: firstString(result.slug) || null,
    };
  }

  async paymentCheck(tenantId: string, input: { orderNsu: string; transactionNsu: string; slug: string }) {
    const credentials = await this.credentials(tenantId);
    const body: Record<string, string> = {
      order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu,
      slug: input.slug,
    };
    if (credentials.handle) body.handle = credentials.handle;
    return this.request<{ success?: boolean; paid?: boolean; amount?: number; paid_amount?: number; installments?: number; capture_method?: string }>(
      "/payment_check",
      body,
      credentials.apiKey,
    );
  }

  async settleWebhook(tenantId: string, body: unknown) {
    const envelope = objectOf(body);
    const orderNsu = firstString(envelope.order_nsu);
    const transactionNsu = firstString(envelope.transaction_nsu);
    const slug = firstString(envelope.slug || envelope.invoice_slug);
    if (!orderNsu || !transactionNsu || !slug) return null;
    const local = await this.prisma.payment.findFirst({
      where: { tenantId, provider: { in: paymentProviderAliases("INFINITEPAY") }, externalId: orderNsu },
      select: { id: true, amount: true, status: true },
    });
    if (!local) return null;
    const check = await this.paymentCheck(tenantId, { orderNsu, transactionNsu, slug });
    const expectedCents = amountToCents(local.amount);
    const details = {
      event: firstString(envelope.event) || "webhook",
      transactionNsu,
      slug,
      checkSuccess: check.success === true,
      checkPaid: check.paid === true,
      paidAmount: check.paid_amount ?? null,
    };
    if (infinitepayPaymentApproved(check, expectedCents)) {
      return settleProviderPayment(this.prisma, tenantId, {
        provider: "INFINITEPAY",
        externalId: orderNsu,
        status: "PAID",
        event: details.event,
        environment: "PRODUCTION",
        amountCents: check.amount,
        details,
      });
    }
    if (check.success === true && ["canceled", "refunded", "payment_failed"].includes(details.event)) {
      return settleProviderPayment(this.prisma, tenantId, {
        provider: "INFINITEPAY",
        externalId: orderNsu,
        status: "CANCELLED",
        event: details.event,
        environment: "PRODUCTION",
        details,
      });
    }
    return null;
  }
}
