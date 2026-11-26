/**
 * Normalização pura de parâmetros de atribuição (UTM e click IDs).
 *
 * Esta função apenas transforma dados recebidos em um objeto determinístico.
 * Ela não faz leitura ou escrita em banco, não envia mensagens, não chama modelos
 * de IA, não consulta serviços externos e não guarda estado entre chamadas.
 * A decisão de persistir, vincular a campanha ou disparar qualquer ação pertence
 * a uma camada posterior, com tenant, consentimento e auditoria próprios.
 */

export const UNKNOWN_ORIGIN = "unknown" as const;

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export const CLICK_ID_KEYS = ["gclid", "fbclid", "msclkid", "ttclid", "dclid"] as const;
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

const MAX_INPUT_LENGTH = 4096;
const MAX_VALUE_LENGTH = 200;

export type AttributionInput = string | URLSearchParams | Record<string, unknown>;

export interface NormalizedAttribution {
  /** Origem de aquisição explícita, ou "unknown" quando não há evidência declarada. */
  origin: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  /** Tokens opacos de clique; nunca são convertidos em origem ou campanha. */
  clickIds: Record<ClickIdKey, string | null>;
  /** Nunca inferido aqui: a chave canônica de campanha é interna e humana. */
  campaignId: null;
  /** Nunca inferido aqui: o primeiro toque é definido pela camada de domínio. */
  firstTouchAt: null;
  hasEvidence: boolean;
}

function emptyResult(): NormalizedAttribution {
  return {
    origin: UNKNOWN_ORIGIN,
    source: null,
    medium: null,
    campaign: null,
    term: null,
    content: null,
    clickIds: { gclid: null, fbclid: null, msclkid: null, ttclid: null, dclid: null },
    campaignId: null,
    firstTouchAt: null,
    hasEvidence: false,
  };
}

function cleanValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) return null;
  return trimmed;
}

function isSupportedKey(key: string): boolean {
  return UTM_KEYS.some((candidate) => candidate === key) || CLICK_ID_KEYS.some((candidate) => candidate === key);
}

function toEntries(input: AttributionInput): Array<[string, unknown]> {
  if (typeof input === "string") {
    if (input.length > MAX_INPUT_LENGTH) return [];
    try {
      const url = new URL(input, "https://attribution.local");
      return Array.from(url.searchParams.entries());
    } catch {
      return [];
    }
  }

  if (input instanceof URLSearchParams) {
    return Array.from(input.entries());
  }

  if (input && typeof input === "object" && !Array.isArray(input)) {
    return Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]);
  }

  return [];
}

/**
 * Normaliza UTMs e click IDs suportados apenas. A primeira ocorrência de cada
 * chave prevalece; chaves desconhecidas e valores vazios ou excessivos são
 * descartados. A mesma entrada sempre produz a mesma saída.
 */
export function normalizeAttribution(input: AttributionInput): NormalizedAttribution {
  const result = emptyResult();
  const found = new Map<string, string>();

  for (const [rawKey, rawValue] of toEntries(input)) {
    const key = rawKey.trim().toLowerCase();
    if (!isSupportedKey(key) || found.has(key)) continue;
    const value = cleanValue(rawValue);
    if (value) found.set(key, value);
  }

  const source = found.get("utm_source");
  const medium = found.get("utm_medium");
  const campaign = found.get("utm_campaign");
  const term = found.get("utm_term");
  const content = found.get("utm_content");

  result.source = source ? source.toLowerCase() : null;
  result.medium = medium ? medium.toLowerCase() : null;
  result.campaign = campaign ?? null;
  result.term = term ?? null;
  result.content = content ?? null;

  for (const key of CLICK_ID_KEYS) {
    result.clickIds[key] = found.get(key) ?? null;
  }

  result.origin = result.source ?? UNKNOWN_ORIGIN;
  result.hasEvidence = Boolean(
    result.source ||
      result.medium ||
      result.campaign ||
      result.term ||
      result.content ||
      CLICK_ID_KEYS.some((key) => result.clickIds[key] !== null),
  );

  return result;
}
