import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_HEADER = "x-vexora-signature";
const TIMESTAMP_HEADER = "x-vexora-timestamp";
const CORRELATION_HEADER = "x-vexora-correlation-id";
const CORRELATION_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export type Headers = Record<string, string | string[] | undefined>;

export class TelephonyInputError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus = 400) {
    super(message);
    this.name = "TelephonyInputError";
    this.httpStatus = httpStatus;
  }
}

export interface VerifiedWebhook {
  correlationId: string;
  event: string;
  payload: Record<string, unknown>;
}

function header(headers: Headers, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

/** Assina `timestamp.corpo` em HMAC-SHA256; usado pelos produtores e pelos testes. */
export function signWebhook(rawBody: Buffer, secret: string, timestamp: string): string {
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
    throw new TelephonyInputError("Webhook sem assinatura ou timestamp", 401);
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    throw new TelephonyInputError("Timestamp do webhook inválido", 401);
  }
  const skew = Math.abs(Math.floor(nowMs / 1000) - Number(timestamp));
  if (skew > toleranceSeconds) {
    throw new TelephonyInputError("Webhook fora da janela de tempo", 401);
  }

  const expected = Buffer.from(signWebhook(rawBody, secret, timestamp), "utf8");
  const received = Buffer.from(provided, "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new TelephonyInputError("Assinatura do webhook inválida", 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new TelephonyInputError("JSON do webhook inválido");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TelephonyInputError("JSON do webhook inválido");
  }
  const body = parsed as Record<string, unknown>;
  if (typeof body.event !== "string" || body.event.trim().length === 0) {
    throw new TelephonyInputError("event do webhook é obrigatório");
  }
  if (typeof body.payload !== "object" || body.payload === null || Array.isArray(body.payload)) {
    throw new TelephonyInputError("payload do webhook é obrigatório");
  }

  const correlationId =
    header(headers, CORRELATION_HEADER) ??
    (typeof body.correlationId === "string" ? body.correlationId : undefined);
  if (!correlationId || !CORRELATION_PATTERN.test(correlationId)) {
    throw new TelephonyInputError("ID de correlação do webhook inválido");
  }

  return {
    correlationId,
    event: body.event,
    payload: body.payload as Record<string, unknown>,
  };
}
