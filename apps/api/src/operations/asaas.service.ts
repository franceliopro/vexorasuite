import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

type AsaasSettings = { enabled?: boolean; sandbox?: boolean; apiKey?: string; encryptedApiKey?: string; encryptedWebhookToken?: string };
type AsaasDebt = { id: string; value: number; dueDate: string; status: string; description: string; invoiceUrl?: string | null; bankSlipUrl?: string | null };

function mergedCustomerMetadata(customer: Record<string, string | null>): Record<string, string | null> { return { ...customer }; }

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  constructor(private readonly prisma: PrismaService) {}

  private encryptionKey(): Buffer {
    const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new ServiceUnavailableException("Configure JWT_ACCESS_SECRET ou INTEGRATION_ENCRYPTION_KEY antes de salvar credenciais.");
    return createHash("sha256").update(secret).digest();
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
  }

  private decrypt(value: string): string {
    const [version, iv, tag, encrypted] = value.split(":");
    if (version !== "v1" || !iv || !tag || !encrypted) throw new ServiceUnavailableException("Credencial Asaas armazenada em formato inválido.");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(iv, "hex"));
      decipher.setAuthTag(Buffer.from(tag, "hex"));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
    } catch {
      throw new ServiceUnavailableException("Não foi possível descriptografar a credencial Asaas. Confira a chave de criptografia.");
    }
  }

  private async settings(tenantId: string): Promise<AsaasSettings> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    const all = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown> : {};
    return all.asaas && typeof all.asaas === "object" ? all.asaas as AsaasSettings : {};
  }

  async publicSettings(tenantId: string) {
    const settings = await this.settings(tenantId);
    const configuredOrigin = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.vexorasuite.com.br";
    let origin = "https://app.vexorasuite.com.br";
    try { origin = new URL(configuredOrigin).origin; } catch { /* use the known public app origin */ }
    return { enabled: settings.enabled === true, sandbox: settings.sandbox !== false, configured: Boolean(settings.encryptedApiKey), apiKeyMasked: settings.encryptedApiKey ? "••••••••••••" : "", webhookTokenConfigured: Boolean(settings.encryptedWebhookToken), webhookUrl: origin + "/api/webhooks/asaas/" + tenantId };
  }

  async saveSettings(tenantId: string, input: { enabled?: unknown; sandbox?: unknown; apiKey?: unknown; webhookToken?: unknown }) {
    if (typeof input.enabled !== "boolean" || typeof input.sandbox !== "boolean") throw new BadRequestException("Informe se o Asaas está ativado e se usa Sandbox.");
    const current = await this.settings(tenantId);
    let encryptedApiKey = current.encryptedApiKey;
    if (typeof input.apiKey === "string" && input.apiKey.trim()) {
      if (input.apiKey.trim().length > 500) throw new BadRequestException("A chave Asaas é inválida.");
      encryptedApiKey = this.encrypt(input.apiKey.trim());
    }
    if (input.enabled && !encryptedApiKey) throw new BadRequestException("Informe a chave de API do Asaas antes de ativar.");
    let encryptedWebhookToken = current.encryptedWebhookToken;
    if (typeof input.webhookToken === "string" && input.webhookToken.trim()) {
      if (input.webhookToken.trim().length > 500) throw new BadRequestException("O token de webhook Asaas é inválido.");
      encryptedWebhookToken = this.encrypt(input.webhookToken.trim());
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    const all = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown> : {};
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { integrations: { ...all, asaas: { enabled: input.enabled, sandbox: input.sandbox, encryptedApiKey: encryptedApiKey || null, encryptedWebhookToken: encryptedWebhookToken || null } } as any } });
    if (input.enabled) void this.syncPendingCustomers(tenantId).catch((error) => this.logger.warn("Falha ao retomar sincronização de clientes pendentes do Asaas: " + (error instanceof Error ? error.message : "erro desconhecido")));
    return this.publicSettings(tenantId);
  }

  private async credentials(tenantId: string): Promise<{ key: string; sandbox: boolean }> {
    const config = await this.settings(tenantId);
    if (config.enabled !== true || !config.encryptedApiKey) throw new ServiceUnavailableException("Integração Asaas não está configurada para esta empresa.");
    return { key: this.decrypt(config.encryptedApiKey), sandbox: config.sandbox !== false };
  }

  private async request<T>(tenantId: string, path: string, init?: RequestInit): Promise<T> {
    const credentials = await this.credentials(tenantId);
    const base = credentials.sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
    const response = await fetch(base + path, {
      ...init,
      headers: { access_token: credentials.key, "user-agent": "VexoraSuite", "content-type": "application/json", ...(init?.headers || {}) },
      signal: AbortSignal.timeout(12000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = response.status === 401 ? "A chave Asaas foi recusada." : response.status === 404 ? "Cobrança ou cadastro não encontrado no Asaas." : "O Asaas não conseguiu concluir a consulta.";
      throw new ServiceUnavailableException(detail);
    }
    return body as T;
  }

  private digits(value: string): string { return value.replace(/\D/g, ""); }

  private validDocument(value: string): boolean {
    const doc = this.digits(value);
    if (!/^\d{11}$|^\d{14}$/.test(doc) || /^(\d)\1+$/.test(doc)) return false;
    const calc = (base: string, weights: number[]) => {
      const sum = [...base].reduce((total, digit, index) => total + Number(digit) * (weights[index] ?? 0), 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };
    if (doc.length === 11) {
      const a = calc(doc.slice(0, 9), [10,9,8,7,6,5,4,3,2]);
      const b = calc(doc.slice(0, 9) + a, [11,10,9,8,7,6,5,4,3,2]);
      return doc[9] === String(a) && doc[10] === String(b);
    }
    const a = calc(doc.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
    const b = calc(doc.slice(0, 12) + a, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
    return doc[12] === String(a) && doc[13] === String(b);
  }

  async verifyWebhookToken(tenantId: string, provided: string | undefined): Promise<boolean> {
    if (!provided) return false;
    const config = await this.settings(tenantId);
    if (config.enabled !== true || !config.encryptedWebhookToken) return false;
    try {
      const expected = Buffer.from(this.decrypt(config.encryptedWebhookToken));
      const actual = Buffer.from(provided);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
  }

  async settleWebhook(tenantId: string, body: unknown) {
    if (!body || typeof body !== "object") return null;
    const envelope = body as { event?: unknown; payment?: { id?: unknown; value?: unknown; status?: unknown } };
    const event = String(envelope.event || "");
    const externalId = typeof envelope.payment?.id === "string" ? envelope.payment.id : "";
    if (!externalId) return null;
    const paid = event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED";
    const status = paid ? "PAID" : event === "PAYMENT_OVERDUE" ? "OVERDUE" : ["PAYMENT_DELETED", "PAYMENT_REFUNDED"].includes(event) ? "CANCELLED" : null;
    if (!status) return null;
    const existing = await this.prisma.payment.findFirst({ where: { tenantId, provider: "ASAAS", externalId }, include: { conversation: { include: { contact: true, channelConnection: true } } } });
    if (!existing) return null;
    const currentConfig = await this.settings(tenantId);
    const currentEnvironment = currentConfig.sandbox !== false ? "SANDBOX" : "PRODUCTION";
    if (existing.environment !== currentEnvironment) return null;
    if (paid && envelope.payment?.value !== undefined && Math.abs(Number(envelope.payment.value) - Number(existing.amount)) > 0.01) return null;
    if (existing.status === "PAID" && event !== "PAYMENT_REFUNDED") return null;
    if (existing.status === status) return null;

    // Make webhook reconciliation atomic: Asaas can retry or deliver events concurrently.
    // A stale OVERDUE/DELETED event must never overwrite a payment already marked PAID.
    const statusGuard = event === "PAYMENT_REFUNDED"
      ? { not: status }
      : paid
        ? { notIn: ["PAID", "CANCELLED"] }
        : { notIn: ["PAID", status] };
    const changed = await this.prisma.payment.updateMany({
      where: { id: existing.id, tenantId, status: statusGuard },
      data: { status },
    });
    if (!changed.count) return null;
    const updated = await this.prisma.payment.findFirst({
      where: { id: existing.id, tenantId },
      include: { conversation: { include: { contact: true, channelConnection: true } } },
    });
    if (!updated) return null;
    if (paid) {
      const amount = Number(updated.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      await this.prisma.message.create({
        data: { tenantId, conversationId: updated.conversationId, direction: "INTERNAL", status: "RECEIVED", content: (updated.environment === "SANDBOX" ? "TESTE · " : "") + "Pagamento confirmado pelo Asaas · " + amount, contentType: "text", senderName: "Sistema financeiro", metadata: { provider: "ASAAS", paymentId: updated.id, event, environment: updated.environment } },
      });
    }
    return { payment: updated, conversation: existing.conversation, paid };
  }


  /**
   * Ensures a CRM-converted customer exists in the currently configured Asaas environment.
   * Matching is based only on exact document, email or phone values, never on name alone.
   * Failures remain visible as PENDING and are retried by the scheduler.
   */
  async syncCustomerByContact(tenantId: string, contactId: string): Promise<{ status: "SYNCED" | "PENDING"; customerId?: string; message?: string }> {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact) throw new BadRequestException("Cliente não encontrado nesta empresa.");
    const metadataOf = (value: unknown): Record<string, unknown> =>
      value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const existingMetadata = metadataOf(contact.metadata);
    const existingAsaas = metadataOf(existingMetadata.asaas);
    const existingSync = metadataOf(existingMetadata.asaasSync);
    const markPending = async (message: string) => {
      const latest = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { metadata: true } });
      const latestMetadata = metadataOf(latest?.metadata);
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { metadata: {
          ...latestMetadata,
          asaasSync: { ...metadataOf(latestMetadata.asaasSync), status: "PENDING", lastAttemptAt: new Date().toISOString(), lastError: message },
        } as Prisma.InputJsonObject },
      });
      return { status: "PENDING" as const, message };
    };

    try {
      const credentials = await this.credentials(tenantId);
      const environment = credentials.sandbox ? "SANDBOX" : "PRODUCTION";
      if (typeof existingAsaas.customerId === "string" && existingAsaas.customerId
          && existingAsaas.environment === environment) {
        await this.prisma.contact.update({
          where: { id: contactId },
          data: { metadata: {
            ...existingMetadata,
            asaas: { ...existingAsaas, status: "ACTIVE", syncedAt: new Date().toISOString() },
            asaasSync: { ...existingSync, status: "SYNCED", environment, lastError: null, syncedAt: new Date().toISOString() },
          } as Prisma.InputJsonObject },
        });
        return { status: "SYNCED", customerId: existingAsaas.customerId };
      }

      const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
      const emailKey = (value: unknown) => String(value ?? "").trim().toLowerCase();
      const phoneKey = (value: unknown) => {
        let phone = digits(value);
        if (phone.startsWith("55") && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2);
        if (phone.length === 11 && phone[2] === "9") phone = phone.slice(0, 2) + phone.slice(3);
        return phone;
      };
      const document = digits(existingMetadata.document);
      const name = String(contact.name || "").trim();
      const email = String(contact.email || "").trim();
      const phone = String(contact.phone || "").trim();
      if (!name) return await markPending("O cliente precisa ter um nome antes de ser enviado ao Asaas.");
      if (!document && !email && !phone) {
        return await markPending("Informe CPF/CNPJ, e-mail ou telefone para evitar cadastro duplicado no Asaas.");
      }

      type AsaasCustomerRecord = { id: string; name?: string; email?: string | null; phone?: string | null; mobilePhone?: string | null; cpfCnpj?: string | null; deleted?: boolean };
      const remoteCustomers: AsaasCustomerRecord[] = [];
      let offset = 0;
      for (let page = 0; page < 100; page++) {
        const result = await this.request<{ data?: AsaasCustomerRecord[]; hasMore?: boolean }>(
          tenantId, "/customers?limit=100&offset=" + offset,
        );
        const batch = Array.isArray(result.data) ? result.data : [];
        remoteCustomers.push(...batch.filter((item) => typeof item.id === "string" && !item.deleted));
        if (!result.hasMore || batch.length === 0) break;
        offset += batch.length;
        if (page === 99) throw new ServiceUnavailableException("A consulta de clientes do Asaas excedeu o limite seguro.");
      }
      let matches: AsaasCustomerRecord[] = [];
      if (document) {
        matches = remoteCustomers.filter((item) => digits(item.cpfCnpj) === document);
      } else if (email) {
        matches = remoteCustomers.filter((item) => emailKey(item.email) === emailKey(email));
      } else {
        const normalizedPhone = phoneKey(phone);
        matches = remoteCustomers.filter((item) => [item.phone, item.mobilePhone].some((value) => phoneKey(value) === normalizedPhone && normalizedPhone.length >= 10));
      }
      if (matches.length > 1) {
        return await markPending("Há mais de um cadastro compatível no Asaas. Revise os dados antes de sincronizar para evitar duplicidade.");
      }

      let remote: AsaasCustomerRecord;
      if (matches.length === 1) {
        remote = matches[0]!;
      } else {
        const payload: Record<string, string> = { name };
        if (document) payload.cpfCnpj = document;
        if (email) payload.email = email;
        if (phone) payload.mobilePhone = phone;
        remote = await this.request<AsaasCustomerRecord>(tenantId, "/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!remote?.id) throw new ServiceUnavailableException("O Asaas não retornou o identificador do novo cliente.");
      }

      const latest = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { metadata: true } });
      const latestMetadata = metadataOf(latest?.metadata);
      const syncedAt = new Date().toISOString();
      await this.prisma.contact.update({
        where: { id: contactId },
        data: { metadata: {
          ...latestMetadata,
          contactType: "CUSTOMER",
          asaas: {
            ...metadataOf(latestMetadata.asaas),
            customerId: remote.id,
            environment,
            source: matches.length === 1 ? "ASAAS_MATCH" : "VEXORA",
            status: remote.deleted ? "DELETED" : "ACTIVE",
            syncedAt,
          },
          asaasSync: { ...metadataOf(latestMetadata.asaasSync), status: "SYNCED", environment, lastError: null, syncedAt },
        } as Prisma.InputJsonObject },
      });
      return { status: "SYNCED", customerId: remote.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar cliente com o Asaas.";
      this.logger.warn("Asaas customer push pending tenant=" + tenantId + " contact=" + contactId + ": " + message);
      return await markPending(message);
    }
  }

  async syncPendingCustomers(tenantId: string): Promise<{ attempted: number; synced: number; pending: number }> {
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId },
      select: { id: true, metadata: true },
      take: 5000,
    });
    const eligible = contacts.filter((contact) => {
      const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
        ? contact.metadata as Record<string, unknown> : {};
      const finalization = metadata.crmFinalization && typeof metadata.crmFinalization === "object" && !Array.isArray(metadata.crmFinalization)
        ? metadata.crmFinalization as Record<string, unknown> : {};
      const asaas = metadata.asaas && typeof metadata.asaas === "object" && !Array.isArray(metadata.asaas)
        ? metadata.asaas as Record<string, unknown> : {};
      const sync = metadata.asaasSync && typeof metadata.asaasSync === "object" && !Array.isArray(metadata.asaasSync)
        ? metadata.asaasSync as Record<string, unknown> : {};
      return metadata.contactType === "CUSTOMER" && finalization.outcome === "WON"
        && !(typeof asaas.customerId === "string" && asaas.customerId)
        && sync.status !== "SYNCED";
    });
    let synced = 0;
    for (const contact of eligible) {
      const result = await this.syncCustomerByContact(tenantId, contact.id);
      if (result.status === "SYNCED") synced++;
    }
    return { attempted: eligible.length, synced, pending: eligible.length - synced };
  }

  async syncEnabledTenants(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true, integrations: true } });
    for (const tenant of tenants) {
      const integrations = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
        ? tenant.integrations as Record<string, unknown> : {};
      const settings = integrations.asaas && typeof integrations.asaas === "object"
        ? integrations.asaas as AsaasSettings : {};
      if (settings.enabled !== true || !settings.encryptedApiKey) continue;
      try {
        const result = await this.syncCustomers(tenant.id);
        const pending = await this.syncPendingCustomers(tenant.id);
        this.logger.log("Asaas customer sync tenant=" + tenant.id + " environment=" + result.environment
          + " total=" + result.total + " created=" + result.created + " updated=" + result.updated
          + " notListed=" + result.notListed + " CRM-pending-attempted=" + pending.attempted
          + " CRM-synced=" + pending.synced + " CRM-pending=" + pending.pending);
      } catch (error) {
        this.logger.warn("Asaas customer sync failed tenant=" + tenant.id + ": "
          + (error instanceof Error ? error.message : "erro desconhecido"));
      }
    }
  }

  async syncCustomers(tenantId: string): Promise<{ created: number; updated: number; unchanged: number; notListed: number; pages: number; total: number; environment: string }> {
    const credentials = await this.credentials(tenantId);
    type AsaasCustomer = {
      id: string; name?: string; email?: string | null; phone?: string | null; mobilePhone?: string | null;
      cpfCnpj?: string | null; postalCode?: string | null; address?: string | null; addressNumber?: string | null;
      complement?: string | null; province?: string | null; city?: number | null; cityName?: string | null;
      state?: string | null; country?: string | null; personType?: string | null; dateCreated?: string | null; deleted?: boolean;
    };
    const customers: AsaasCustomer[] = [];
    const limit = 100;
    let offset = 0;
    let pages = 0;
    // Follow Asaas pagination until hasMore is false; cap total pages to avoid an accidental endless loop.
    for (let page = 0; page < 1000; page++) {
      const result = await this.request<{ data?: AsaasCustomer[]; hasMore?: boolean }>(
        tenantId, "/customers?limit=" + limit + "&offset=" + offset,
      );
      const batch = Array.isArray(result.data) ? result.data : [];
      pages++;
      customers.push(...batch.filter((customer) => typeof customer.id === "string" && customer.id.length > 0));
      if (!result.hasMore || batch.length === 0) break;
      offset += batch.length;
      if (page === 999) throw new ServiceUnavailableException("A sincronização excedeu o limite seguro de páginas do Asaas.");
    }

    const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
    const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
    const normalizePhone = (value: unknown) => {
      let phone = digits(value);
      if (phone.startsWith("55") && (phone.length === 12 || phone.length === 13)) phone = phone.slice(2);
      return phone.length === 11 && phone[2] === "9" ? phone.slice(0, 2) + phone.slice(3) : phone;
    };
    const counters = { created: 0, updated: 0, unchanged: 0, notListed: 0, pages, total: customers.length, environment: credentials.sandbox ? "SANDBOX" : "PRODUCTION" };

    // Load the tenant's contacts once; a query per imported customer would become quadratic.
    const tenantContacts = await this.prisma.contact.findMany({
      where: { tenantId },
      select: { id: true, name: true, phone: true, email: true, source: true, metadata: true },
    });

    // Reconcile only unambiguous matches. Never merge two contacts because of a shared name.
    for (const customer of customers) {
      const document = digits(customer.cpfCnpj);
      const phone = customer.mobilePhone || customer.phone || null;
      const email = customer.email?.trim() || null;
      const address = [
        customer.address, customer.addressNumber, customer.complement, customer.province,
        customer.cityName, customer.state, customer.postalCode, customer.country,
      ].filter((part) => typeof part === "string" && part.trim()).join(", ");
      const incoming = {
        name: customer.name?.trim() || "",
        phone,
        email,
        source: "ASAAS",
        document: document || null,
        personType: document.length === 14 ? "PJ" : document.length === 11 ? "PF" : customer.personType || null,
        address: address || null,
        state: customer.state || null,
        customerId: customer.id,
        environment: counters.environment,
        status: typeof customer.deleted === "boolean" ? (customer.deleted ? "DELETED" : "ACTIVE") : "UNKNOWN",
        dateCreated: customer.dateCreated || null,
        syncedAt: new Date().toISOString(),
      };

      await this.prisma.$transaction(async (tx) => {
        const metadataOf = (value: unknown): Record<string, unknown> =>
          value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
        const asaasOf = (value: unknown): Record<string, unknown> => metadataOf(metadataOf(value).asaas);
        let matches = tenantContacts.filter((contact) => asaasOf(contact.metadata).customerId === customer.id);
        if (matches.length !== 1 && document) {
          const byDocument = tenantContacts.filter((contact) => digits(metadataOf(contact.metadata).document) === document);
          if (byDocument.length === 1) matches = byDocument;
        }
        if (matches.length !== 1 && phone) {
          const normalized = normalizePhone(phone);
          const byPhone = tenantContacts.filter((contact) => normalizePhone(contact.phone) === normalized && normalized.length >= 10);
          if (byPhone.length === 1) matches = byPhone;
        }
        if (matches.length !== 1 && email) {
          const byEmail = tenantContacts.filter((contact) => normalizeEmail(contact.email) === normalizeEmail(email));
          if (byEmail.length === 1) matches = byEmail;
        }

        if (matches.length === 1) {
          const existing = matches[0];
          if (!existing) throw new ServiceUnavailableException("Não foi possível reconciliar o cadastro Asaas com segurança.");
          const previous = metadataOf(existing.metadata);
          const previousAsaas = asaasOf(existing.metadata);
          const mergedAsaas = { ...previousAsaas, ...incoming };
          const nextMetadata = {
            ...previous,
            contactType: "CUSTOMER",
            document: document || previous.document || null,
            personType: incoming.personType || previous.personType || null,
            address: address || previous.address || null,
            asaas: mergedAsaas,
          };
          const nextName = incoming.name || existing.name;
          const nextPhone = incoming.phone || existing.phone;
          const nextEmail = incoming.email || existing.email;
          const stablePrevious = { ...previous, asaas: { ...previousAsaas, syncedAt: undefined } };
          const stableNext = { ...nextMetadata, asaas: { ...mergedAsaas, syncedAt: undefined } };
          const changed = nextName !== existing.name || nextPhone !== existing.phone || nextEmail !== existing.email
            || !existing.source || JSON.stringify(stablePrevious) !== JSON.stringify(stableNext);
          if (!changed) { counters.unchanged++; return; }
          const updated = await tx.contact.update({
            where: { id: existing.id },
            data: {
              name: nextName, phone: nextPhone, email: nextEmail,
              source: existing.source || "ASAAS", metadata: nextMetadata as Prisma.InputJsonObject,
            },
            select: { id: true, name: true, phone: true, email: true, source: true, metadata: true },
          });
          Object.assign(existing, updated);
          counters.updated++;
          return;
        }

        const metadata = {
          contactType: "CUSTOMER",
          document: document || null,
          personType: incoming.personType,
          address: address || null,
          asaas: mergedCustomerMetadata(incoming),
        };
        const created = await tx.contact.create({
          data: {
            tenantId,
            name: incoming.name || "Cliente Asaas",
            phone: incoming.phone,
            email: incoming.email,
            externalId: "asaas:" + customer.id,
            source: "ASAAS",
            metadata: metadata as Prisma.InputJsonObject,
          },
          select: { id: true, name: true, phone: true, email: true, source: true, metadata: true },
        });
        tenantContacts.push(created);
        counters.created++;
      });
    }
    // If a previously linked record no longer appears in a successful, non-empty full listing,
    // preserve the local contact but flag the Asaas link for review instead of deleting it.
    if (customers.length > 0) {
      const linkedContacts = await this.prisma.contact.findMany({
        where: { tenantId },
        select: { id: true, metadata: true },
      });
      const seen = new Set(customers.map((customer) => customer.id));
      for (const contact of linkedContacts) {
        const metadata = contact.metadata && typeof contact.metadata === "object" && !Array.isArray(contact.metadata)
          ? contact.metadata as Record<string, unknown> : {};
        const asaas = metadata.asaas && typeof metadata.asaas === "object" && !Array.isArray(metadata.asaas)
          ? metadata.asaas as Record<string, unknown> : {};
        const customerId = typeof asaas.customerId === "string" ? asaas.customerId : "";
        if (!customerId || seen.has(customerId) || ["NOT_LISTED", "DELETED"].includes(String(asaas.status))) continue;
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { metadata: { ...metadata, asaas: { ...asaas, status: "NOT_LISTED", syncedAt: new Date().toISOString() } } as Prisma.InputJsonObject },
        });
        counters.notListed++;
      }
    }
    return counters;
  }

  async openDebts(tenantId: string, document: string, whatsappPhone?: string): Promise<{ name: string; environment: string; debts: AsaasDebt[] }> {
    const doc = this.digits(document);
    if (!this.validDocument(doc)) throw new BadRequestException("CPF/CNPJ inválido. Digite somente números.");
    const credentials = await this.credentials(tenantId);
    const customers = await this.request<{ data?: Array<{ id: string; name: string; cpfCnpj: string; phone?: string; mobilePhone?: string }> }>(tenantId, "/customers?cpfCnpj=" + encodeURIComponent(doc) + "&limit=100");
    const found = (customers.data || []).filter((customer) => this.digits(customer.cpfCnpj) === doc).slice(0, 10);
    if (!found.length) return { name: "", environment: credentials.sandbox ? "SANDBOX" : "PRODUCTION", debts: [] };
    const normalizePhone = (value: string | undefined) => {
      let number = this.digits((value || "").split("@")[0] || "");
      if (number.startsWith("55") && (number.length === 12 || number.length === 13)) number = number.slice(2);
      const withoutNinth = (number: string) => number.length === 11 && number[2] === "9" ? number.slice(0, 2) + number.slice(3) : number;
      return withoutNinth(number);
    };
    const inbound = normalizePhone(whatsappPhone || "");
    const matched = found.filter((customer) => {
      const registered = [customer.mobilePhone || "", customer.phone || ""].map(normalizePhone).filter(Boolean);
      return inbound.length >= 10 && registered.some((phone) => phone.length >= 10 && phone === inbound);
    });
    if (matched.length !== 1) throw new BadRequestException("Não foi possível confirmar o telefone deste WhatsApp com o cadastro financeiro. O atendimento deve ser encaminhado ao Financeiro.");
    const debts: AsaasDebt[] = [];
    for (const customer of matched) {
      for (const status of ["OVERDUE", "PENDING"]) {
        const result = await this.request<{ data?: Array<AsaasDebt>; hasMore?: boolean }>(tenantId, "/payments?customer=" + encodeURIComponent(customer.id) + "&status=" + status + "&limit=100&offset=0");
        for (const payment of result.data || []) debts.push({ ...payment, id: payment.id, value: Number(payment.value) });
      }
    }
    debts.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    return { name: matched[0]?.name || "", environment: credentials.sandbox ? "SANDBOX" : "PRODUCTION", debts };
  }

  async paymentDetails(tenantId: string, paymentId: string) {
    if (!/^pay_[A-Za-z0-9_-]+$/.test(paymentId)) throw new BadRequestException("Identificador de cobrança inválido.");
    const payment = await this.request<any>(tenantId, "/payments/" + encodeURIComponent(paymentId));
    const [line, pix] = await Promise.all([
      this.request<any>(tenantId, "/payments/" + encodeURIComponent(paymentId) + "/identificationField").catch(() => null),
      this.request<any>(tenantId, "/payments/" + encodeURIComponent(paymentId) + "/pixQrCode").catch(() => null),
    ]);
    return {
      id: payment.id, value: Number(payment.value), status: payment.status, dueDate: payment.dueDate,
      invoiceUrl: payment.invoiceUrl || null, bankSlipUrl: payment.bankSlipUrl || null,
      identificationField: line?.identificationField || null, pixPayload: pix?.payload || null,
      environment: (await this.credentials(tenantId)).sandbox ? "SANDBOX" : "PRODUCTION",
    };
  }
}
