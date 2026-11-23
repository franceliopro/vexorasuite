/** Contrato comum dos provedores de pagamento. Nenhum alias legado é descartado. */
export const PAYMENT_PROVIDERS = ["ASAAS", "STRIPE", "INFINITEPAY"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

const ALIASES: Record<string, PaymentProvider> = {
  ASAAS: "ASAAS",
  asaas: "ASAAS",
  Asaas: "ASAAS",
  STRIPE: "STRIPE",
  stripe: "STRIPE",
  Stripe: "STRIPE",
  INFINITEPAY: "INFINITEPAY",
  INFINITE_PAY: "INFINITEPAY",
  "infinite-pay": "INFINITEPAY",
  InfinitePay: "INFINITEPAY",
  infinitepay: "INFINITEPAY",
};

export function canonicalPaymentProvider(value: unknown): PaymentProvider | null {
  if (typeof value !== "string") return null;
  return ALIASES[value.trim()] ?? null;
}

/** Inclui maiúsculas/minúsculas usadas por registros antigos e pelo novo adaptador. */
export function paymentProviderAliases(provider: PaymentProvider): string[] {
  return Object.keys(ALIASES).filter((alias) => ALIASES[alias] === provider);
}

export function publicAppOrigin(): string {
  const configured = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.vexorasuite.com.br";
  try {
    return new URL(configured).origin;
  } catch {
    return "https://app.vexorasuite.com.br";
  }
}

export function objectOf(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

export function firstString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/** Valores locais são reais; gateways trabalham com a menor unidade monetária. */
export function amountToCents(value: unknown): number {
  const cents = Math.round(Number(value || 0) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : -1;
}

export function amountsMatch(cents: unknown, localAmount: unknown): boolean {
  const expected = amountToCents(localAmount);
  const actual = Number(cents);
  return expected >= 0 && Number.isSafeInteger(actual) && Math.abs(actual - expected) <= 1;
}
