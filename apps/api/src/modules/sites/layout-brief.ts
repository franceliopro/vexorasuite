/**
 * Contrato da interpretação de uma captura de layout.
 *
 * O modelo devolve apenas estrutura (sequência de seções, ênfase e densidade).
 * Textos, marcas, fotos e dados da imagem nunca são copiados para o SiteDocument.
 * Toda saída passa por esta sanitização antes de influenciar o rascunho.
 */

export const LAYOUT_SECTION_IDS = {
  topo: "landing_nav",
  hero: "landing_hero",
  prova: "landing_proof",
  servicos: "landing_services",
  beneficios: "landing_benefits",
  processo: "landing_process",
  comparativo: "landing_compare",
  depoimentos: "landing_testimonials",
  sobre: "landing_about",
  faq: "landing_faq",
  contato: "landing_contact",
  rodape: "landing_footer",
} as const;

export type LayoutSectionKey = keyof typeof LAYOUT_SECTION_IDS;

export type LayoutBrief = {
  sections: LayoutSectionKey[];
  emphasis: LayoutSectionKey;
  density: "compacta" | "equilibrada" | "generosa";
  confidence: number;
  notes: string;
  model?: string;
};

const ALIASES: Record<string, LayoutSectionKey> = {
  topo: "topo", header: "topo", cabecalho: "topo", navegacao: "topo", nav: "topo",
  hero: "hero", banner: "hero", destaque: "hero", "first-fold": "hero",
  prova: "prova", autoridade: "prova", confianca: "prova", "selos": "prova",
  servicos: "servicos", servicosOfertas: "servicos", ofertas: "servicos", produtos: "servicos", catalogo: "servicos",
  beneficios: "beneficios", vantagens: "beneficios", diferenciais: "beneficios",
  processo: "processo", "como-funciona": "processo", etapas: "processo", metodologia: "processo",
  comparativo: "comparativo", comparacao: "comparativo", comparision: "comparativo",
  depoimentos: "depoimentos", testemunhos: "depoimentos", avaliacoes: "depoimentos", reviews: "depoimentos",
  sobre: "sobre", "sobre-nos": "sobre", about: "sobre", equipe: "sobre",
  faq: "faq", duvidas: "faq", perguntas: "faq",
  contato: "contato", contact: "contato", formulario: "contato", form: "contato",
  rodape: "rodape", footer: "rodape", pe: "rodape",
};

const DENSITIES: LayoutBrief["density"][] = ["compacta", "equilibrada", "generosa"];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-");
}

function cleanNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function readJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? raw;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value: unknown = JSON.parse(fenced.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Aceita somente uma resposta com pelo menos duas seções conhecidas. */
export function parseLayoutBrief(raw: string, model?: string): LayoutBrief | null {
  const value = readJsonObject(raw);
  if (!value) return null;

  const sections: LayoutSectionKey[] = [];
  for (const item of (Array.isArray(value.sections) ? value.sections : []).slice(0, 12)) {
    if (typeof item !== "string") continue;
    const key = ALIASES[normalize(item)];
    if (key && !sections.includes(key)) sections.push(key);
  }
  if (sections.length < 2) return null;

  const emphasisKey = typeof value.emphasis === "string" ? ALIASES[normalize(value.emphasis)] : undefined;
  const densityKey = typeof value.density === "string" ? normalize(value.density) : "";
  const confidence = Number(value.confidence);

  return {
    sections,
    emphasis: emphasisKey && sections.includes(emphasisKey) ? emphasisKey : sections[0]!,
    density: DENSITIES.includes(densityKey as LayoutBrief["density"]) ? densityKey as LayoutBrief["density"] : "equilibrada",
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    notes: cleanNotes(value.notes),
    ...(typeof model === "string" && model ? { model } : {}),
  };
}
