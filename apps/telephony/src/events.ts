import { createHash } from "node:crypto";
import type { ConsentChannel, ConsentDecision } from "./consent.js";
import { TelephonyInputError } from "./webhook.js";

export const EVENT_TYPES = [
  "call.started",
  "call.answered",
  "call.ended",
  "call.failed",
  "recording.ready",
  "transcript.ready",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type CallEvent = {
  tenantId: string;
  provider: string;
  externalCallId: string;
  eventType: EventType;
  direction: "INBOUND" | "OUTBOUND";
  channel: ConsentChannel;
  partyHash: string;
  counterpartyHash: string | null;
  occurredAt: Date;
  correlationId: string;
};

export type StoredMedia = {
  recordingUrl: string | null;
  transcript: string | null;
  aiAllowed: boolean;
};

function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

function stringField(payload: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

export function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s().-]/g, "");
  return /^\+?\d{5,20}$/.test(digits) ? digits : null;
}

export function partyHash(tenantId: string, phone: string): string {
  return createHash("sha256").update(`${tenantId}:PHONE:${phone}`).digest("hex");
}

/**
 * O tenant vem da rota autenticada/configurada. Um `tenantId` enviado no corpo
 * do webhook é ignorado: ele nunca pode redirecionar o evento para outra empresa.
 */
export function normalizeCallEvent(input: {
  tenantId: string;
  provider: string;
  event: string;
  payload: Record<string, unknown>;
  correlationId: string;
}): CallEvent {
  if (!isEventType(input.event)) {
    throw new TelephonyInputError("Tipo de evento de ligação não suportado");
  }
  const externalCallId = stringField(input.payload, ["externalCallId", "call_id"]);
  if (!externalCallId || !/^[A-Za-z0-9_.:-]{1,180}$/.test(externalCallId)) {
    throw new TelephonyInputError("externalCallId inválido");
  }
  const rawDirection = stringField(input.payload, ["direction"]) ?? "INBOUND";
  if (rawDirection !== "INBOUND" && rawDirection !== "OUTBOUND") {
    throw new TelephonyInputError("direction inválida");
  }
  const partyValue = stringField(input.payload, rawDirection === "INBOUND" ? ["from", "fromNumber"] : ["to", "toNumber"]);
  const party = partyValue ? normalizePhone(partyValue) : null;
  if (!party) {
    throw new TelephonyInputError("Número do participante inválido");
  }
  const otherValue = stringField(input.payload, rawDirection === "INBOUND" ? ["to", "toNumber"] : ["from", "fromNumber"]);
  const other = otherValue ? normalizePhone(otherValue) : null;

  const occurredValue = stringField(input.payload, ["occurredAt", "timestamp"]);
  const occurredAt = occurredValue ? new Date(occurredValue) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    throw new TelephonyInputError("occurredAt inválido");
  }

  return {
    tenantId: input.tenantId,
    provider: input.provider,
    externalCallId,
    eventType: input.event,
    direction: rawDirection,
    channel: "PHONE",
    partyHash: partyHash(input.tenantId, party),
    counterpartyHash: other ? partyHash(input.tenantId, other) : null,
    occurredAt,
    correlationId: input.correlationId,
  };
}

export function idempotencyKey(event: CallEvent): string {
  return `${event.tenantId}:${event.provider}:${event.externalCallId}:${event.eventType}`;
}

/** Mídia só é conservada quando o consentimento cobre o uso correspondente. */
export function mediaForEvent(
  payload: Record<string, unknown>,
  decision: ConsentDecision,
): StoredMedia {
  const rawUrl = stringField(payload, ["recordingUrl", "recording_url"]);
  const rawTranscript = stringField(payload, ["transcript"]);
  const recordingUrl =
    decision.allowRecording && rawUrl && rawUrl.length <= 2048 && /^https:\/\//.test(rawUrl)
      ? rawUrl
      : null;
  const transcript =
    decision.allowTranscription && rawTranscript
      ? rawTranscript.slice(0, 4000)
      : null;
  return { recordingUrl, transcript, aiAllowed: decision.allowAi };
}
