import { BadRequestException, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { mutateTenantSetting } from "../prisma/tenant-settings";
import { decryptIntegrationSecret, encryptIntegrationSecret, IntegrationEncryptionError } from "./payment-provider-crypto";
import { amountToCents, firstString, objectOf, paymentProviderAliases, publicAppOrigin } from "./payment-providers";
import { settleProviderPayment } from "./payment-settlement";

type StripeSettings = {
  enabled?: boolean;
  environment?: "TEST" | "LIVE";
  publishableKey?: string;
  secretKeyEncrypted?: string;
  webhookSecretEncrypted?: string;
};

const STRIPE_API = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 300;
const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
]);

const stripeQuery = (params: Record<string, string | number>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return "?" + search.toString();
};

const normalizeStripeStatus = (status: unknown): "PAID" | "PENDING" | "CANCELLED" | "REFUNDED" => {
  if (status === "succeeded") return "PAID";
  if (status === "canceled") return "CANCELLED";
  if (status === "refunded") return "REFUNDED";
  return "PENDING";
};

/** Verificação manual conforme docs.stripe.com/webhooks: corpo cru, apenas t e v1, tolerância de 5 min. */
export function verifyStripeWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): Record<string, any> {
  if (!signatureHeader) throw new ForbiddenException("Cabeçalho Stripe-Signature ausente.");
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const entry of signatureHeader.split(",")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1") signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) throw new ForbiddenException("Assinatura Stripe inválida.");
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) throw new ForbiddenException("Assinatura Stripe expirada.");
  const expected = createHmac("sha256", secret).update(String(timestamp)).update(".").update(rawBody).digest();
  const accepted = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actual = Buffer.from(signature, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!accepted) throw new ForbiddenException("Assinatura Stripe não conferiu.");
  try {
    const parsed = JSON.parse(typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"));
    return objectOf(parsed);
  } catch {
    throw new BadRequestException("Payload do webhook Stripe inválido.");
  }
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  constructor(private readonly prisma: PrismaService) {}

  private async settings(tenantId: string): Promise<StripeSettings> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    const all = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown> : {};
    return all.stripe && typeof all.stripe === "object" ? all.stripe as StripeSettings : {};
  }

  async publicSettings(tenantId: string) {
    const settings = await this.settings(tenantId);
    return {
      enabled: settings.enabled === true,
      configured: Boolean(settings.secretKeyEncrypted),
      secretKeyMasked: settings.secretKeyEncrypted ? "••••••••••••" : "",
      publishableKey: settings.publishableKey || "",
      environment: settings.environment || "TEST",
      webhookSecretConfigured: Boolean(settings.webhookSecretEncrypted),
      webhookUrl: publicAppOrigin() + "/api/webhooks/stripe/" + tenantId,
    };
  }

  async saveSettings(tenantId: string, input: {
    enabled?: unknown; environment?: unknown; publishableKey?: unknown;
    secretKey?: unknown; webhookSecret?: unknown;
  }) {
    if (typeof input.enabled !== "boolean") throw new BadRequestException("Informe se o Stripe está ativado.");
    const environment = input.environment === undefined ? "TEST" : input.environment;
    if (environment !== "TEST" && environment !== "LIVE") throw new BadRequestException("Ambiente Stripe inválido.");
    const publishableKey = firstString(input.publishableKey);
    if (publishableKey && publishableKey.length > 200) throw new BadRequestException("A chave pública Stripe é inválida.");
    const secretKey = firstString(input.secretKey);
    if (secretKey && !/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(secretKey)) {
      throw new BadRequestException("A chave secreta Stripe deve começar com sk_test_, sk_live_, rk_test_ ou rk_live_.");
    }
    const webhookSecret = firstString(input.webhookSecret);
    if (webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) {
      throw new BadRequestException("O segredo do webhook Stripe deve começar com whsec_.");
    }
    if (secretKey) {
      const keyEnvironment = secretKey.includes("_live_") ? "LIVE" : "TEST";
      if (keyEnvironment !== environment) throw new BadRequestException("O ambiente informado não corresponde à chave secreta Stripe.");
    }
    const current = await this.settings(tenantId);
    if (input.enabled && !secretKey && !current.secretKeyEncrypted) throw new BadRequestException("Informe a chave secreta do Stripe antes de ativar.");
    await mutateTenantSetting(this.prisma, tenantId, "stripe", (value) => {
      const latest = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
      return {
        enabled: input.enabled as boolean,
        environment,
        publishableKey: publishableKey || latest.publishableKey || "",
        secretKeyEncrypted: secretKey ? encryptIntegrationSecret(secretKey) : latest.secretKeyEncrypted || null,
        webhookSecretEncrypted: webhookSecret ? encryptIntegrationSecret(webhookSecret) : latest.webhookSecretEncrypted || null,
      };
    });
    return this.publicSettings(tenantId);
  }

  private async credentials(tenantId: string): Promise<{ key: string; environment: "TEST" | "LIVE" }> {
    const settings = await this.settings(tenantId);
    if (settings.enabled !== true || !settings.secretKeyEncrypted) {
      throw new ServiceUnavailableException("Integração Stripe não está configurada para esta empresa.");
    }
    try {
      return {
        key: decryptIntegrationSecret(settings.secretKeyEncrypted, "Stripe"),
        environment: settings.environment || "TEST",
      };
    } catch (error) {
      if (error instanceof IntegrationEncryptionError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }

  private async request<T>(tenantId: string, path: string, body?: URLSearchParams, method: "GET" | "POST" = "POST", idempotencyKey?: string): Promise<T> {
    const { key } = await this.credentials(tenantId);
    const response = await fetch(STRIPE_API + path, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        "user-agent": "VexoraSuite",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(method === "POST" ? { body: (body || new URLSearchParams()).toString() } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.warn(`Stripe recusou ${path}: ${response.status}`);
      throw new ServiceUnavailableException(response.status === 401 ? "A chave secreta Stripe foi recusada." : "O Stripe não conseguiu concluir a operação.");
    }
    return objectOf(payload) as T;
  }

  async testConnection(tenantId: string) {
    const credentials = await this.credentials(tenantId);
    const account = await this.request<{ id?: string; email?: string; livemode?: boolean }>(tenantId, "/account", undefined, "GET");
    return {
      connected: true,
      accountId: account.id || null,
      email: account.email || null,
      livemode: account.livemode === true,
      environment: credentials.environment,
    };
  }

  /** Gestão financeira: somente leitura, tenant-scoped e com origem declarada. */
  async listFinanceCustomers(tenantId: string, limit = 50) {
    const { environment } = await this.credentials(tenantId);
    const data = await this.request<{ data?: Record<string, any>[]; has_more?: boolean }>(
      tenantId, `/customers${stripeQuery({ limit: Math.min(Math.max(limit, 1), 100) })}`, undefined, "GET",
    );
    const items = (Array.isArray(data.data) ? data.data : []).map((row) => ({
      id: firstString(row.id),
      name: firstString(row.name) || null,
      email: firstString(row.email) || null,
      phone: firstString(row.phone) || null,
      createdAt: typeof row.created === "number" ? new Date(row.created * 1000).toISOString() : null,
    })).filter((row) => Boolean(row.id));
    return { source: "PROVIDER_LIVE", provider: "STRIPE", environment, hasMore: data.has_more === true, limit, items };
  }

  async listFinanceCharges(tenantId: string, limit = 50, from?: Date) {
    const { environment } = await this.credentials(tenantId);
    const params: Record<string, string | number> = { limit: Math.min(Math.max(limit, 1), 100) };
    if (from) params["created[gte]"] = Math.floor(from.getTime() / 1000);
    const data = await this.request<{ data?: Record<string, any>[]; has_more?: boolean }>(
      tenantId, `/payment_intents${stripeQuery(params)}`, undefined, "GET",
    );
    const items = (Array.isArray(data.data) ? data.data : []).map((row) => {
      const metadata = objectOf(row.metadata);
      return {
        id: firstString(row.id),
        amount: Number(row.amount || 0) / 100,
        currency: firstString(row.currency).toUpperCase() || "BRL",
        status: normalizeStripeStatus(row.status),
        rawStatus: firstString(row.status) || null,
        description: firstString(row.description) || null,
        customerId: firstString(row.customer) || null,
        invoiceUrl: firstString(metadata.invoiceUrl || metadata.invoice_url) || null,
        createdAt: typeof row.created === "number" ? new Date(row.created * 1000).toISOString() : null,
      };
    }).filter((row) => Boolean(row.id));
    return { source: "PROVIDER_LIVE", provider: "STRIPE", environment, hasMore: data.has_more === true, limit, items };
  }

  async listFinanceCatalog(tenantId: string, limit = 50) {
    const { environment } = await this.credentials(tenantId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const [products, prices] = await Promise.all([
      this.request<{ data?: Record<string, any>[]; has_more?: boolean }>(tenantId, `/products${stripeQuery({ active: "true", limit: safeLimit })}`, undefined, "GET"),
      this.request<{ data?: Record<string, any>[]; has_more?: boolean }>(tenantId, `/prices${stripeQuery({ active: "true", limit: safeLimit })}`, undefined, "GET"),
    ]);
    const priceByProduct = new Map<string, { amountCents: number; currency: string }>();
    for (const price of Array.isArray(prices.data) ? prices.data : []) {
      const productId = typeof price.product === "string" ? price.product : firstString(objectOf(price.product).id);
      if (!productId || price.unit_amount === null || price.unit_amount === undefined) continue;
      priceByProduct.set(productId, {
        amountCents: Number(price.unit_amount),
        currency: firstString(price.currency).toUpperCase() || "BRL",
      });
    }
    const items = (Array.isArray(products.data) ? products.data : []).map((row) => {
      const id = firstString(row.id);
      const price = priceByProduct.get(id);
      const images = Array.isArray(row.images) ? row.images : [];
      return {
        id,
        name: firstString(row.name) || "Produto Stripe",
        description: firstString(row.description) || null,
        category: "STRIPE",
        priceCents: price?.amountCents ?? null,
        currency: price?.currency || "BRL",
        imageUrl: firstString(images[0]) || null,
        active: row.active !== false,
      };
    }).filter((row) => Boolean(row.id));
    return { source: "PROVIDER_LIVE", provider: "STRIPE", environment, hasMore: products.has_more === true, limit, items };
  }

  /** Publicação real na Stripe: Product + Price. Nunca reenvia a descrição interna da Véxora. */
  async publishCatalogItem(
    tenantId: string,
    item: { id: string; name: string; publicDescription?: string | null; priceCents: number; currency: string; sku?: string | null },
    existing?: { externalId?: string | null; metadata?: Record<string, unknown> } | null,
  ) {
    const { environment } = await this.credentials(tenantId);
    const currency = firstString(item.currency).toUpperCase() || "BRL";
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException("Moeda inválida para publicar na Stripe.");
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents < 0) throw new BadRequestException("Preço inválido para publicar na Stripe.");
    const idempotencyBase = `vexora-catalog-${item.id}`;
    let productId = firstString(existing?.externalId);
    if (!productId) {
      const body = new URLSearchParams({
        name: item.name.slice(0, 120),
        "metadata[vexoraCatalogItemId]": item.id,
      });
      const description = firstString(item.publicDescription).slice(0, 500);
      if (description) body.set("description", description);
      if (item.sku) body.set("metadata[sku]", firstString(item.sku).slice(0, 80));
      const product = await this.request<{ id?: string }>(tenantId, "/products", body, "POST", `${idempotencyBase}-product`);
      productId = firstString(product.id);
      if (!productId) throw new ServiceUnavailableException("A Stripe não devolveu um produto utilizável.");
    }
    const priceBody = new URLSearchParams({
      product: productId,
      unit_amount: String(item.priceCents),
      currency: currency.toLowerCase(),
      "metadata[vexoraCatalogItemId]": item.id,
    });
    let priceId = "";
    let degraded: string | null = null;
    try {
      const price = await this.request<{ id?: string }>(tenantId, "/prices", priceBody, "POST", `${idempotencyBase}-price`);
      priceId = firstString(price.id);
      if (!priceId) degraded = "O produto foi criado na Stripe, mas o preço não foi confirmado.";
    } catch {
      degraded = "O produto foi criado na Stripe, mas o preço não foi confirmado.";
    }
    return {
      objectType: "PRODUCT",
      externalId: productId,
      externalUrl: null,
      environment,
      priceId: priceId || null,
      degraded,
    };
  }

  async listFinanceSubscriptions(tenantId: string, limit = 50) {
    const { environment } = await this.credentials(tenantId);
    const data = await this.request<{ data?: Record<string, any>[]; has_more?: boolean }>(
      tenantId, `/subscriptions${stripeQuery({ status: "all", limit: Math.min(Math.max(limit, 1), 100) })}`, undefined, "GET",
    );
    const items = (Array.isArray(data.data) ? data.data : []).map((row) => ({
      id: firstString(row.id),
      customerId: firstString(row.customer) || null,
      status: firstString(row.status) || null,
      cancelAtPeriodEnd: row.cancel_at_period_end === true,
      currentPeriodEnd: typeof row.current_period_end === "number" ? new Date(row.current_period_end * 1000).toISOString() : null,
      createdAt: typeof row.created === "number" ? new Date(row.created * 1000).toISOString() : null,
    })).filter((row) => Boolean(row.id));
    return { source: "PROVIDER_LIVE", provider: "STRIPE", environment, hasMore: data.has_more === true, limit, items };
  }

  async financeDashboard(tenantId: string, months = 1) {
    const { environment } = await this.credentials(tenantId);
    const period = [1, 2, 3, 6, 12].includes(months) ? months : 1;
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - period + 1, 1));
    const charges = await this.listFinanceCharges(tenantId, 100, from);
    const buckets = Array.from({ length: period }, (_, index) => {
      const bucket = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1));
      return { month: bucket.toISOString().slice(0, 7), billed: 0, paid: 0, open: 0 };
    });
    const totals = { billed: 0, paid: 0, open: 0, count: 0 };
    for (const charge of charges.items) {
      if (charge.status === "CANCELLED" || charge.status === "REFUNDED") continue;
      totals.billed += charge.amount;
      totals.count += 1;
      if (charge.status === "PAID") totals.paid += charge.amount; else totals.open += charge.amount;
      const bucket = buckets.find((candidate) => candidate.month === charge.createdAt?.slice(0, 7));
      if (bucket) {
        bucket.billed += charge.amount;
        if (charge.status === "PAID") bucket.paid += charge.amount; else bucket.open += charge.amount;
      }
    }
    return {
      source: "PROVIDER_LIVE",
      provider: "STRIPE",
      environment,
      partial: charges.hasMore,
      caveat: "Indicadores calculados sobre até 100 PaymentIntents recentes da Stripe. Não incluem saldo, saques ou conciliação contábil.",
      months: period,
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      totals,
      series: buckets,
      collectionRate: totals.billed > 0 ? Math.round((totals.paid / totals.billed) * 1000) / 10 : null,
    };
  }

  async refundFinanceCharge(tenantId: string, paymentIntentId: string, userId?: string) {
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) throw new BadRequestException("Identificador de PaymentIntent inválido.");
    const { environment } = await this.credentials(tenantId);
    const refund = await this.request<{ id?: string; status?: string; amount?: number }>(
      tenantId,
      "/refunds",
      new URLSearchParams({ payment_intent: paymentIntentId }),
      "POST",
      `finance-refund:${paymentIntentId}`,
    );
    const result = {
      source: "PROVIDER_LIVE",
      provider: "STRIPE",
      environment,
      refundId: firstString(refund.id) || null,
      status: firstString(refund.status) || null,
      amountCents: Number(refund.amount || 0),
      executed: true,
    };
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: "finance.refund_executed",
        entityType: "stripe_payment_intent",
        entityId: paymentIntentId,
        details: { environment, refundId: result.refundId, status: result.status, amountCents: result.amountCents, actorId: userId || null },
      },
    });
    return result;
  }

  /** Cria um PaymentIntent vinculado a um Payment local; nunca cria cobrança órfã. */
  async createPayment(tenantId: string, input: { paymentId?: unknown; description?: unknown }) {
    const paymentId = firstString(input.paymentId);
    if (!paymentId) throw new BadRequestException("Informe o pagamento local vinculado.");
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId, provider: { in: paymentProviderAliases("STRIPE") }, status: "PENDING" },
      select: { id: true, amount: true, externalId: true, conversationId: true },
    });
    if (!payment) throw new BadRequestException("Pagamento local pendente não encontrado para esta empresa.");
    if (payment.externalId) throw new BadRequestException("Este pagamento já possui uma cobrança Stripe.");
    const amount = amountToCents(payment.amount);
    if (amount < 50) throw new BadRequestException("O valor mínimo do Stripe é 50 centavos.");
    const { environment } = await this.credentials(tenantId);
    const settings = await this.settings(tenantId);
    const body = new URLSearchParams();
    body.set("amount", String(amount));
    body.set("currency", "brl");
    body.set("payment_method_types[]", "card");
    body.set("description", firstString(input.description).slice(0, 200) || `Pagamento Véxora ${payment.id}`);
    body.set("metadata[tenantId]", tenantId);
    body.set("metadata[paymentId]", payment.id);
    const intent = await this.request<{ id?: string; client_secret?: string; status?: string }>(tenantId, "/payment_intents", body);
    const externalId = firstString(intent.id);
    if (!externalId || !firstString(intent.client_secret)) throw new ServiceUnavailableException("O Stripe não devolveu um PaymentIntent utilizável.");
    await this.prisma.payment.updateMany({
      where: { id: payment.id, tenantId, status: "PENDING", externalId: null },
      data: { externalId, environment: environment === "LIVE" ? "PRODUCTION" : "SANDBOX" },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: "payment.provider_created",
        entityType: "payment",
        entityId: payment.id,
        details: { provider: "STRIPE", externalId, environment, status: intent.status || null },
      },
    });
    return {
      paymentId: payment.id,
      id: externalId,
      clientSecret: intent.client_secret,
      status: intent.status || "requires_payment_method",
      amount,
      currency: "brl",
      publishableKey: settings.publishableKey || "",
      environment,
    };
  }

  async createHostedCheckout(tenantId: string, input: { paymentId?: unknown }, expectedEnvironment?: "LIVE") {
    const paymentId = firstString(input.paymentId);
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(paymentId)) {
      throw new BadRequestException("Informe um pagamento local válido.");
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId, provider: { in: paymentProviderAliases("STRIPE") }, status: "PENDING" },
      select: { id: true, amount: true, externalId: true, invoiceUrl: true, environment: true },
    });
    if (!payment) throw new BadRequestException("Pagamento local pendente não encontrado para esta empresa.");
    const { environment } = await this.credentials(tenantId);
    if (expectedEnvironment && environment !== expectedEnvironment) throw new ForbiddenException("O Chatbot só gera links Stripe em produção.");
    const localEnvironment = environment === "LIVE" ? "PRODUCTION" : "SANDBOX";
    if (payment.externalId?.startsWith("cs_") && payment.invoiceUrl && payment.environment === localEnvironment) {
      return { paymentId, url: payment.invoiceUrl, environment };
    }
    if (payment.externalId) throw new BadRequestException("Este pagamento já possui uma cobrança Stripe.");
    const amount = amountToCents(payment.amount);
    if (amount < 50) throw new BadRequestException("O valor mínimo do Stripe é 50 centavos.");
    const home = publicAppOrigin() + "/";
    const body = new URLSearchParams({
      mode: "payment",
      success_url: home,
      cancel_url: home,
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(amount),
      "line_items[0][price_data][product_data][name]": "Pagamento Véxora",
      "line_items[0][quantity]": "1",
      client_reference_id: paymentId,
    });
    const session = await this.request<{ id?: string; url?: string; livemode?: boolean }>(
      tenantId, "/checkout/sessions", body, "POST", "vexora-hosted-" + paymentId,
    );
    const externalId = firstString(session.id);
    const url = firstString(session.url);
    if (!externalId.startsWith("cs_") || !/^https:\/\/checkout\.stripe\.com\//.test(url) || session.livemode !== (environment === "LIVE")) {
      throw new ServiceUnavailableException("O Stripe não confirmou um link de checkout válido.");
    }
    const changed = await this.prisma.payment.updateMany({
      where: { id: paymentId, tenantId, status: "PENDING", externalId: null },
      data: { externalId, invoiceUrl: url, environment: localEnvironment },
    });
    if (!changed.count) {
      const current = await this.prisma.payment.findFirst({
        where: { id: paymentId, tenantId, status: "PENDING", externalId, environment: localEnvironment },
        select: { invoiceUrl: true },
      });
      if (current?.invoiceUrl !== url) throw new BadRequestException("O pagamento mudou durante a criação do checkout.");
      return { paymentId, url, environment };
    }
    await this.prisma.auditLog.create({ data: {
      tenantId, action: "payment.provider_created", entityType: "payment", entityId: paymentId,
      details: { provider: "STRIPE", externalId, environment, checkout: "hosted" },
    } });
    return { paymentId, url, environment };
  }

  async verifyWebhook(tenantId: string, rawBody: Buffer, signature: string | undefined) {
    const settings = await this.settings(tenantId);
    if (settings.enabled !== true || !settings.webhookSecretEncrypted) {
      throw new ForbiddenException("Webhook Stripe não está configurado para esta empresa.");
    }
    let secret: string;
    try {
      secret = decryptIntegrationSecret(settings.webhookSecretEncrypted, "Stripe");
    } catch (error) {
      if (error instanceof IntegrationEncryptionError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
    return verifyStripeWebhookSignature(rawBody, signature, secret);
  }

  async settleWebhook(tenantId: string, event: Record<string, any>) {
    const type = firstString(event.type);
    const eventId = firstString(event.id);
    if (!eventId || !SUPPORTED_EVENTS.has(type)) return null;
    const data = objectOf(event.data);
    const object = objectOf(data.object);
    if (type === "checkout.session.completed") {
      if (object.payment_status !== "paid" || object.currency !== "brl" ||
          !Number.isSafeInteger(object.amount_total) || typeof object.livemode !== "boolean" ||
          !firstString(object.id).startsWith("cs_")) return null;
      return settleProviderPayment(this.prisma, tenantId, {
        provider: "STRIPE", externalId: object.id, status: "PAID", event: type,
        environment: object.livemode ? "LIVE" : "TEST", amountCents: object.amount_total,
        details: { eventId, livemode: object.livemode },
      });
    }
    const externalId = type === "charge.refunded" ? firstString(object.payment_intent) : firstString(object.id);
    if (!externalId) return null;
    const amountCents = type === "charge.refunded" ? object.amount_refunded : (object.amount_received ?? object.amount);
    const currency = firstString(object.currency).toLowerCase();
    if (currency && currency !== "brl") {
      this.logger.warn(`Webhook Stripe ignorado: moeda ${currency} não é suportada pelo financeiro local.`);
      return null;
    }
    const settings = await this.settings(tenantId);
    const status = type === "payment_intent.succeeded" ? "PAID" : "CANCELLED";
    return settleProviderPayment(this.prisma, tenantId, {
      provider: "STRIPE",
      externalId,
      status,
      event: type,
      environment: settings.environment || "TEST",
      amountCents,
      details: { eventId, currency: currency || null, livemode: object.livemode ?? null },
    });
  }
}
