import { BadRequestException, ForbiddenException } from "@nestjs/common";

/** Listas gerenciáveis por tenant (pretensões, tipos por categoria, regiões, bairros). */
export type PropertyLists = {
  pretensions: string[];
  types: { Urbano: string[]; Rural: string[] };
  regions: string[];
  neighborhoods: string[];
};
export const DEFAULT_LISTS: PropertyLists = {
  pretensions: ["Comprar", "Alugar", "Vender", "Emprestar", "Trocar", "Doar"],
  types: {
    Urbano: ["Salão", "Sobrado", "Casa", "Kitnet", "Terreno", "Galpão", "Prédio", "Sala", "Apartamento", "Sala Comercial"],
    Rural: ["Área", "Chácara", "Fazenda", "Terreno", "Gado"],
  },
  regions: [],
  neighborhoods: [],
};
const clean = (value: unknown, max = 60, limit = 60): string[] =>
  Array.isArray(value)
    ? [...new Set((value as unknown[]).map(v => String(v ?? "").trim().slice(0, max)).filter(Boolean))].slice(0, limit)
    : [];
export function readPropertyLists(integrations: unknown): PropertyLists {
  const root = integrations && typeof integrations === "object" && !Array.isArray(integrations) ? integrations as Record<string, any> : {};
  const raw = root.realEstateLists && typeof root.realEstateLists === "object" && !Array.isArray(root.realEstateLists) ? root.realEstateLists as Record<string, any> : {};
  const defaults = DEFAULT_LISTS;
  const saved = {
    pretensions: clean(raw.pretensions).length ? clean(raw.pretensions) : [...defaults.pretensions],
    types: {
      Urbano: clean(raw.types?.Urbano).length ? clean(raw.types.Urbano) : [...defaults.types.Urbano],
      Rural: clean(raw.types?.Rural).length ? clean(raw.types.Rural) : [...defaults.types.Rural],
    },
    regions: clean(raw.regions),
    neighborhoods: clean(raw.neighborhoods),
  };
  return saved;
}
export function sanitizePropertyLists(input: unknown): PropertyLists {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Envie as listas de imóveis (objeto).");
  const raw = input as Record<string, any>;
  const lists: PropertyLists = {
    pretensions: clean(raw.pretensions),
    types: {
      Urbano: clean(raw.types?.Urbano),
      Rural: clean(raw.types?.Rural),
    },
    regions: clean(raw.regions),
    neighborhoods: clean(raw.neighborhoods),
  };
  if (!lists.pretensions.length) throw new BadRequestException("Defina ao menos uma pretensão (ex.: Comprar, Alugar).");
  if (!lists.types.Urbano.length && !lists.types.Rural.length) throw new BadRequestException("Defina ao menos um tipo de imóvel (Urbano ou Rural).");
  return lists;
}

export const PROPERTY_STATUS = ["AVAILABLE", "SOLD", "RENTED", "UNAVAILABLE"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUS)[number];
export const STATUS_LABEL: Record<PropertyStatus, string> = {
  AVAILABLE: "Disponível",
  SOLD: "Vendido",
  RENTED: "Alugado",
  UNAVAILABLE: "Indisponível",
};

/** Sanitiza o bloco de dados de um imóvel (ou a aplicação do anunciante) com validação contra as listas. */
export function sanitizePropertyData(input: any, lists: PropertyLists): Record<string, any> {
  const out: Record<string, any> = {};
  const pick = (key: string, max: number) => { const v = input?.[key]; if (typeof v === "string") { const t = v.trim().slice(0, max); if (t) out[key] = t; } return out[key]; };
  pick("city", 80); pick("code", 40); pick("region", 80); pick("neighborhood", 80);
  const category = String(input?.category || "").trim().slice(0, 20);
  if (category) {
    if (!["Urbano", "Rural"].includes(category)) throw new BadRequestException("Categoria deve ser Urbano ou Rural.");
    out.category = category;
  }
  const pretension = String(input?.pretension || "").trim().slice(0, 40);
  if (pretension) {
    if (!lists.pretensions.some(p => p.toLowerCase() === pretension.toLowerCase())) throw new BadRequestException(`Pretensão "${pretension}" não está nas listas. Cadastre-a em Listas.`);
    out.pretension = lists.pretensions.find(p => p.toLowerCase() === pretension.toLowerCase());
  }
  const type = String(input?.propertyType || input?.type || "").trim().slice(0, 60);
  if (type) {
    const allowed = [...lists.types.Urbano, ...lists.types.Rural];
    if (!allowed.some(t => t.toLowerCase() === type.toLowerCase())) throw new BadRequestException(`Tipo "${type}" não está nas listas. Cadastre-o em Listas.`);
    out.propertyType = allowed.find(t => t.toLowerCase() === type.toLowerCase());
  }
  const status = String(input?.status || "").trim().toUpperCase();
  if (status) {
    if (!PROPERTY_STATUS.includes(status as PropertyStatus)) throw new BadRequestException("Status deve ser Disponível, Vendido, Alugado ou Indisponível.");
    out.status = status as PropertyStatus;
  }
  const num = (key: string, min: number, max: number) => { const n = Number(input?.[key]); out[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : (input?.[key] === "" ? 0 : undefined); if (out[key] === undefined) delete out[key]; };
  num("beds", 0, 40); num("baths", 0, 40); num("parkingSpaces", 0, 40);
  const area = Number(input?.area); if (Number.isFinite(area)) out.area = Math.min(1e7, Math.max(0, area));
  if (typeof input?.beds === "number" || typeof input?.beds === "string") { const n = Number(input.beds); if (Number.isFinite(n)) out.beds = Math.min(40, Math.max(0, Math.round(n))); }
  if (typeof input?.baths === "number" || typeof input?.baths === "string") { const n = Number(input.baths); if (Number.isFinite(n)) out.baths = Math.min(40, Math.max(0, Math.round(n))); }
  return out;
}

export type ScopeCategory = "Urbano" | "Rural";
export async function membershipScopes(tx: any, membershipId: string): Promise<Set<ScopeCategory>> {
  if (!membershipId) return new Set();
  const rows = await tx.propertyScope.findMany({ where: { membershipId }, select: { category: true } });
  return new Set(rows.map((r: any) => String(r.category) as ScopeCategory));
}
/** null = sem restrição; Set = somente essas categorias. */
export async function scopeForRequest(tx: any, req: { user: { sub: string; role: string; tenantId?: string } }): Promise<Set<ScopeCategory> | null> {
  const role = String(req?.user?.role || "").toUpperCase();
  if (role === "OWNER" || role === "ADMIN" || role === "PLATFORM") return null;
  const membership = await tx.membership.findFirst({ where: { tenantId: (req.user as any).tenantId, userId: req.user.sub }, select: { id: true } });
  if (!membership) return null;
  const scopes = await membershipScopes(tx, membership.id);
  return scopes.size ? scopes : null;
}
export function itemCategory(item: any): ScopeCategory | null {
  const data = item?.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Record<string, any> : {};
  const category = String(data.category || "");
  return category === "Urbano" || category === "Rural" ? category : null;
}
/** Lança Forbidden se o membro tem escopo e o item está fora dele (ou sem categoria quando há escopo). */
export function assertItemInScope(scopes: Set<ScopeCategory> | null, item: any) {
  if (!scopes) return;
  const category = itemCategory(item);
  if (!category || !scopes.has(category)) {
    throw new ForbiddenException("Sem permissão para este imóvel — ele pertence à outra categoria de gestão.");
  }
}
