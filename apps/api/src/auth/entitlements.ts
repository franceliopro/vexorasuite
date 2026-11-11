/**
 * Resolução de entitlements (módulos e limites) por empresa.
 *
 * Consumidores: criação de empresa (snapshot do plano), navegação do cliente,
 * catálogo de planos (slug do plano -> snapshot) e enforcement leve no backend.
 *
 * Regra fundamental: empresa SEM entitlements materializados (legado, pré-planos)
 * tem acesso total — a migração nunca tranca ninguém para fora do que já usava.
 */
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
};
export const FULL_ENTITLEMENTS: Entitlements = {
  modules: ["SITES","INBOX","CRM","AUTOMATION","CHANNELS","CALENDAR","TASKS","FINANCE","MARKETING","SETTINGS"],
  attendants: 999, bots: 99, iaLimit: 999999, iaTier: "standard", sites: 999, socialAccounts: 999,
  marketingPublishing: true, followups: true, finance: true, crm: true, dynamicSites: true, forms: true,
};
const ALL_MODULE_IDS = FULL_ENTITLEMENTS.modules;
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
  };
}
/** Snapshot a partir do plans.limits jsonb + módulos derivados quando ausente. */
export function entitlementsFromPlanLimits(limits: Record<string, unknown> | null | undefined): Entitlements {
  const merged = limits && typeof limits === "object" ? { ...limits } : {};
  if (!Array.isArray(merged.modules)) merged.modules = ALL_MODULE_IDS;
  return resolveEntitlements(merged);
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
  if (kind === "PLATFORM") return ALL_MODULE_IDS;
  return resolveEntitlements(raw).modules;
}
