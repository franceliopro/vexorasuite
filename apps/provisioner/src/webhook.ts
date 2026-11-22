import { createHmac, timingSafeEqual } from "node:crypto";
import { ProvisionerError } from "./types.js";

const SIGNATURE_HEADER = "x-vexora-signature";
const TIMESTAMP_HEADER = "x-vexora-timestamp";
const CORRELATION_HEADER = "x-vexora-correlation-id";
const CORRELATION_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

type Headers = Record<string, string | string[] | undefined>;

export interface VerifiedWebhook {
  correlationId: string;
  event: string;
  payload: Record<string, unknown>;
}

function header(headers: Headers, name: string): string | undefined {
  const key = name.toLowerCase();
  for (const [nameInHeaders, value] of Object.entries(headers)) {
    if (nameInHeaders.toLowerCase() !== key) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

/** Assina `timestamp.corpo` em HMAC-SHA256; usado por clientes e pelos testes. */
export function signWebhook(
  rawBody: Buffer,
  secret: string,
  timestamp: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
  return `sha256=${digest}`;
}

export function verifyWebhook(
  rawBody: Buffer,
  headers: Headers,
  secret: string,
  toleranceSeconds: number,
  nowMs: number = Date.now(),
): VerifiedWebhook {
  const timestamp = header(headers, TIMESTAMP_HEADER);
  const provided = header(headers, SIGNATURE_HEADER);
  if (!timestamp || !provided) {
    throw new ProvisionerError(
      "Webhook sem assinatura ou timestamp",
      "invalid_request",
      401,
    );
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    throw new ProvisionerError(
      "Timestamp do webhook inválido",
      "invalid_request",
      401,
    );
  }
  const skew = Math.abs(Math.floor(nowMs / 1000) - Number(timestamp));
  if (skew > toleranceSeconds) {
    throw new ProvisionerError(
      "Webhook fora da janela de tempo",
      "invalid_request",
      401,
    );
  }

  const expected = signWebhook(rawBody, secret, timestamp);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new ProvisionerError(
      "Assinatura do webhook inválida",
      "invalid_request",
      401,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ProvisionerError(
      "JSON do webhook inválido",
      "invalid_request",
      400,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ProvisionerError(
      "JSON do webhook inválido",
      "invalid_request",
      400,
    );
  }
  const body = parsed as Record<string, unknown>;
  if (typeof body.event !== "string" || body.event.trim().length === 0) {
    throw new ProvisionerError(
      "event do webhook é obrigatório",
      "invalid_request",
      400,
    );
  }
  if (
    typeof body.payload !== "object" ||
    body.payload === null ||
    Array.isArray(body.payload)
  ) {
    throw new ProvisionerError(
      "payload do webhook é obrigatório",
      "invalid_request",
      400,
    );
  }

  const correlationId =
    header(headers, CORRELATION_HEADER) ??
    (typeof body.correlationId === "string" ? body.correlationId : undefined);
  if (!correlationId || !CORRELATION_PATTERN.test(correlationId)) {
    throw new ProvisionerError(
      "ID de correlação do webhook inválido",
      "invalid_request",
      400,
    );
  }

  return {
    correlationId,
    event: body.event,
    payload: body.payload as Record<string, unknown>,
  };
}
