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
