/**
 * Resolução de entitlements (módulos e limites) por empresa.
 *
 * Consumidores: criação de empresa (snapshot do plano), navegação do cliente,
 * catálogo de planos (slug do plano -> snapshot) e enforcement leve no backend.
 *
 * Regra fundamental: empresa SEM entitlements materializados (legado, pré-planos)
 * tem acesso total — a migração nunca tranca ninguém para fora do que já usava.
 */
import { canonicalPaymentProvider, type PaymentProvider } from "../operations/payment-providers";
import { modulesForSegment } from "../operations/business-templates";

export type { PaymentProvider } from "../operations/payment-providers";
export type Entitlements = {
  modules: string[];
  attendants: number;
  bots: number;
  iaLimit: number;
  iaTier: "eco" | "standard" | "basic";
  sites: number;
  socialAccounts: number;
  marketingPublishing: boolean;
  followups: boolean;
  finance: boolean;
  crm: boolean;
  dynamicSites: boolean;
  forms: boolean;
  paymentProvider: PaymentProvider;
};
export const FULL_ENTITLEMENTS: Entitlements = {
  modules: ["INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SITES","SETTINGS"],
  attendants: 999, bots: 99, iaLimit: 999999, iaTier: "standard", sites: 0, socialAccounts: 999,
  marketingPublishing: true, followups: true, finance: true, crm: true, dynamicSites: true, forms: true,
  paymentProvider: "ASAAS",
};
/** SCHOOL é opcional e nunca entra no snapshot padrão: apenas a administração Véxora o oferece. */
const ALL_MODULE_IDS = [...FULL_ENTITLEMENTS.modules, "SCHOOL"];
const bool = (value: unknown): boolean => value === true;
const num = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback);
export function resolveEntitlements(raw: unknown): Entitlements {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return FULL_ENTITLEMENTS;
  const source = raw as Record<string, unknown>;
  const modules = Array.isArray(source.modules) ? source.modules.filter((m): m is string => typeof m === "string") : [];
  if (!modules.length) return FULL_ENTITLEMENTS;
  return {
    modules: [...new Set([...modules, "SETTINGS"])], // SETTINGS é sempre necessário para a própria empresa
    attendants: num(source.attendants, 0),
    bots: num(source.bots, 0),
    iaLimit: num(source.iaLimit ?? source.ia, 0),
    iaTier: ["eco", "basic", "standard"].includes(String(source.iaTier)) ? (source.iaTier as Entitlements["iaTier"]) : "standard",
    sites: num(source.sites, 0),
    socialAccounts: num(source.socialAccounts, 0),
    marketingPublishing: bool(source.marketingPublishing),
    followups: bool(source.followups),
    finance: bool(source.finance),
    crm: bool(source.crm),
    dynamicSites: bool(source.dynamic) || bool(source.dynamicSites),
    forms: bool(source.forms),
    paymentProvider: canonicalPaymentProvider(source.paymentProvider) || "ASAAS",
  };
}
/** Snapshot a partir do plans.limits jsonb + módulos derivados quando ausente. */
export function entitlementsFromPlanLimits(limits: Record<string, unknown> | null | undefined): Entitlements {
  const merged = limits && typeof limits === "object" ? { ...limits } : {};
  if (!Array.isArray(merged.modules)) merged.modules = FULL_ENTITLEMENTS.modules;
  return resolveEntitlements(merged);
}
/**
 * Módulos contratados por segmento entram no snapshot da empresa no ato do provisionamento.
 * Sem plano e sem módulos extras, a empresa permanece no modo legado (sem restrição materializada).
 */
export function entitlementsForSegment(
  limits: Record<string, unknown> | null | undefined,
  segmentId: string,
): Record<string, unknown> | null {
  const extras = modulesForSegment(segmentId);
  const hasPlanSnapshot = !!limits && typeof limits === "object" && Array.isArray((limits as Record<string, unknown>).modules);
  if (!extras.length && !hasPlanSnapshot) return null;
  const base = hasPlanSnapshot
    ? { ...(limits as Record<string, unknown>) }
    : { ...FULL_ENTITLEMENTS };
  const current = Array.isArray(base.modules)
    ? base.modules.filter((m): m is string => typeof m === "string")
    : [...FULL_ENTITLEMENTS.modules];
  return { ...base, modules: [...new Set([...current, "SETTINGS", ...extras])] };
}
/** Converte o snapshot salvo na empresa de volta para exibição/admin. */
export function entitlementsView(raw: unknown): Entitlements {
  return resolveEntitlements(raw);
}
/** true quando a empresa não tem restrição materializada (legado). */
export function hasNoEntitlementRestrictions(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return true;
  const modules = (raw as Record<string, unknown>).modules;
  return !Array.isArray(modules) || modules.length === 0;
}
/** Quais módulos da Véxora a empresa pode ver/usar. PLATFORM é sempre total. */
export function allowedModulesOf(kind: string, raw: unknown): string[] {
  // A Véxora oferece SCHOOL aos clientes, mas não usa o módulo na própria empresa.
  if (kind === "PLATFORM") return ALL_MODULE_IDS.filter((module) => module !== "SCHOOL");
  return resolveEntitlements(raw).modules;
}
/**
 * PLANOS é um módulo de plataforma, desligado por padrão para clientes.
 * Só entra na lista quando a administração Véxora libera explicitamente para o tenant.
 */
export const PLANS_MODULE = "PLANS";
export function hasPlansAccess(raw: unknown): boolean {
  return resolveEntitlements(raw).modules.includes(PLANS_MODULE);
}
/** Preserva os demais entitlements e só altera a permissão explícita de Planos e preços. */
export function withPlansAccess(raw: unknown, enabled: boolean): Record<string, unknown> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
  const current = Array.isArray(source.modules)
    ? source.modules.filter((m): m is string => typeof m === "string")
    : [...ALL_MODULE_IDS];
  const modules = enabled
    ? [...new Set([...current, "SETTINGS", PLANS_MODULE])]
    : [...new Set(current.filter((m) => m !== PLANS_MODULE).concat("SETTINGS"))];
  return { ...source, modules };
}
/** Mantém a liberação explícita quando um plano é (re)atribuído. */
export function preservePlansAccess(previousRaw: unknown, nextRaw: unknown): Record<string, unknown> {
  return withPlansAccess(nextRaw, hasPlansAccess(previousRaw));
}
/** Plataforma de pagamento de cada empresa; Asaas é o padrão recomendado até a Véxora escolher outra. */
export function paymentProviderOf(raw: unknown): PaymentProvider {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  return canonicalPaymentProvider(source.paymentProvider) || "ASAAS";
}
/** Só altera a plataforma de pagamento escolhida, preservando todos os outros entitlements. */
export function withPaymentProvider(raw: unknown, provider: unknown): Record<string, unknown> {
  const canonical = canonicalPaymentProvider(provider);
  if (!canonical) throw Error("Plataforma de pagamento inválida.");
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
  return { ...source, paymentProvider: canonical };
}
/** Reatribuir plano nunca troca a plataforma de pagamento já escolhida pela Véxora. */
export function preservePaymentProvider(previousRaw: unknown, nextRaw: unknown): Record<string, unknown> {
  const source = nextRaw && typeof nextRaw === "object" && !Array.isArray(nextRaw)
    ? { ...(nextRaw as Record<string, unknown>) }
    : {};
  const previous = canonicalPaymentProvider(
    previousRaw && typeof previousRaw === "object" && !Array.isArray(previousRaw)
      ? (previousRaw as Record<string, unknown>).paymentProvider
      : null,
  );
  return { ...source, paymentProvider: previous || paymentProviderOf(source) };
}
