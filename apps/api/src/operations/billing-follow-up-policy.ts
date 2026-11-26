/** Configuração de follow-up de cobrança: sem envio implícito, sempre auditável e tenant-scoped. */

export type FollowUpVariant = { id: string; text: string };

export type BillingFollowUpPolicy = {
  enabled: boolean;
  timeZone: string;
  steps: number[];
  minIntervalMinutes: number;
  quietStartHour: number;
  quietEndHour: number;
  maxPerDay: number;
  /** Nunca pode ser desativado pela UI: opt-out do cliente é obrigatório. */
  optOutRespected: true;
  suspendOnPayment: boolean;
  variants: FollowUpVariant[];
};

export const DEFAULT_BILLING_FOLLOW_UP_POLICY: BillingFollowUpPolicy = {
  enabled: false,
  timeZone: "America/Sao_Paulo",
  steps: [-5, -3, 0, 2, 5],
  minIntervalMinutes: 1440,
  quietStartHour: 20,
  quietEndHour: 8,
  maxPerDay: 3,
  optOutRespected: true,
  suspendOnPayment: true,
  variants: [
    { id: "v1", text: "Olá, {{nome}}! Sua cobrança de {{valor}} vence em {{vencimento}}. Consulte sua fatura: {{fatura}}." },
    { id: "v2", text: "Olá, {{nome}}! Sua cobrança de {{valor}} vence hoje. Segue a fatura: {{fatura}}." },
    { id: "v3", text: "Olá, {{nome}}! Identificamos uma cobrança vencida em {{vencimento}}. Podemos ajudar? {{fatura}}" },
    { id: "v4", text: "Olá, {{nome}}! Sua cobrança de {{valor}} continua em aberto. Para regularizar, acesse: {{fatura}}." },
    { id: "v5", text: "Olá, {{nome}}! Estamos à disposição para ajudar com sua cobrança pendente. Confira: {{fatura}}." },
  ],
};

function normalizeTimeZone(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length > 64) return DEFAULT_BILLING_FOLLOW_UP_POLICY.timeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_BILLING_FOLLOW_UP_POLICY.timeZone;
  }
}

function normalizeHour(value: unknown, fallback: number): number {
  const hour = Math.round(Number(value));
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
}

function normalizeSteps(value: unknown): number[] {
  const list = Array.isArray(value) ? value : DEFAULT_BILLING_FOLLOW_UP_POLICY.steps;
  const steps = [...new Set(list.map((item) => Math.round(Number(item))).filter((day) => Number.isFinite(day) && day >= -30 && day <= 30))]
    .sort((a, b) => a - b)
    .slice(0, 8);
  return steps.length ? steps : [...DEFAULT_BILLING_FOLLOW_UP_POLICY.steps];
}

function normalizeVariants(value: unknown): FollowUpVariant[] {
  const list = Array.isArray(value) ? value : [];
  if (list.length < 5) throw new Error("Informe pelo menos 5 variantes de texto.");
  return list.slice(0, 10).map((raw, index) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const text = typeof item.text === "string" ? item.text.trim().slice(0, 1000) : "";
    if (text.length < 10) throw new Error(`A variante ${index + 1} precisa de pelo menos 10 caracteres.`);
    const rawId = typeof item.id === "string" ? item.id.trim() : "";
    return { id: /^[A-Za-z0-9_-]{1,40}$/.test(rawId) ? rawId : `v${index + 1}`, text };
  });
}

export function normalizeBillingFollowUpPolicy(input: unknown): BillingFollowUpPolicy {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const minInterval = Math.round(Number(source.minIntervalMinutes));
  const maxPerDay = Math.round(Number(source.maxPerDay));
  return {
    enabled: source.enabled === true,
    timeZone: normalizeTimeZone(source.timeZone),
    steps: normalizeSteps(source.steps),
    minIntervalMinutes: Number.isFinite(minInterval) && minInterval >= 60 && minInterval <= 10080 ? minInterval : DEFAULT_BILLING_FOLLOW_UP_POLICY.minIntervalMinutes,
    quietStartHour: normalizeHour(source.quietStartHour, DEFAULT_BILLING_FOLLOW_UP_POLICY.quietStartHour),
    quietEndHour: normalizeHour(source.quietEndHour, DEFAULT_BILLING_FOLLOW_UP_POLICY.quietEndHour),
    maxPerDay: Number.isFinite(maxPerDay) && maxPerDay >= 1 && maxPerDay <= 10 ? maxPerDay : DEFAULT_BILLING_FOLLOW_UP_POLICY.maxPerDay,
    optOutRespected: true,
    suspendOnPayment: source.suspendOnPayment !== false,
    variants: normalizeVariants(source.variants),
  };
}

function fnv1a(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** Mesmo contato e mesma tentativa sempre escolhem a mesma variante. */
export function pickVariant(policy: BillingFollowUpPolicy, contactId: string, attempt: number): FollowUpVariant {
  if (policy.variants.length < 5) throw new Error("A política precisa de pelo menos 5 variantes.");
  const index = fnv1a(`${contactId}:${attempt}:${policy.variants.length}`) % policy.variants.length;
  return policy.variants[index]!;
}

function hourInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone }).formatToParts(now);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0") % 24;
}

export function canSend(args: {
  policy: BillingFollowUpPolicy;
  lastSentAt: Date | null;
  now: Date;
  sentToday: number;
}): boolean {
  const { policy, lastSentAt, now, sentToday } = args;
  if (sentToday >= policy.maxPerDay) return false;
  if (lastSentAt && now.getTime() - lastSentAt.getTime() < policy.minIntervalMinutes * 60_000) return false;

  const hour = hourInZone(now, policy.timeZone);
  const { quietStartHour, quietEndHour } = policy;
  const quiet = quietStartHour <= quietEndHour
    ? hour >= quietStartHour && hour < quietEndHour
    : hour >= quietStartHour || hour < quietEndHour;
  return !quiet;
}
