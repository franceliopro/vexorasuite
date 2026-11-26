import { decideConsent } from "./consent.js";
import type { TenantConfig } from "./config.js";
import { mediaForEvent, normalizeCallEvent } from "./events.js";
import type { EventStore } from "./store.js";
import { TelephonyInputError, verifyWebhook, type Headers } from "./webhook.js";

export type HandlerResult = {
  status: number;
  body: Record<string, unknown>;
};

export type WebhookHandler = (
  tenantId: string,
  rawBody: Buffer,
  headers: Headers,
) => Promise<HandlerResult>;

export type HandlerDeps = {
  tenants: Map<string, TenantConfig>;
  store: EventStore;
  toleranceSeconds: number;
  mode: "simulation" | "real";
  now?: () => number;
};

/**
 * Recebe eventos de ligação já assinados. Não chama IA, não envia mensagens e
 * não disca: o tenant vem da rota, o consentimento é default-deny e a mídia só
 * é gravada quando o registro cobre o uso.
 */
export function createWebhookHandler(deps: HandlerDeps): WebhookHandler {
  return async (tenantId, rawBody, headers) => {
    try {
      const tenant = deps.tenants.get(tenantId);
      if (!tenant) {
        return { status: 404, body: { error: "Tenant não configurado", code: "unknown_tenant" } };
      }
      const verified = verifyWebhook(
        rawBody,
        headers,
        tenant.webhookSecret,
        deps.toleranceSeconds,
        deps.now?.() ?? Date.now(),
      );
      const event = normalizeCallEvent({
        tenantId,
        provider: tenant.provider,
        event: verified.event,
        payload: verified.payload,
        correlationId: verified.correlationId,
      });
      const consent = decideConsent(
        await deps.store.consentFor(tenantId, event.partyHash, event.channel),
        event.channel,
      );
      const media = mediaForEvent(verified.payload, consent);
      const saved = await deps.store.insertEvent(event, media, consent.reason);
      return {
        status: 200,
        body: {
          ok: true,
          duplicate: saved.duplicate,
          eventId: saved.id,
          mode: deps.mode,
          consent: consent.reason,
          recordingStored: media.recordingUrl !== null,
          transcriptStored: media.transcript !== null,
          aiInvoked: false,
        },
      };
    } catch (error) {
      if (error instanceof TelephonyInputError) {
        return { status: error.httpStatus, body: { error: error.message, code: "invalid_request" } };
      }
      throw error;
    }
  };
}
