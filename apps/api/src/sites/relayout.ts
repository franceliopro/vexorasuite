/**
 * Sanitização e contrato do Relayout premium.
 * A IA devolve {"blocks":[...]}; nada entra no banco sem passar por aqui.
 * Blocos padrão reutilizam os mesmos tipos conhecidos; o tipo "layout" (seção com
 * colunas, flex e elementos) recebe validação profunda de elementos e estilos.
 */

const clampNum = (v: any, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const clampStr = (v: any, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const safeId = (v: any): string => (typeof v === "string" && /^[a-zA-Z0-9-]{6,40}$/.test(v) ? v : randomId());

/** Cores/gradientes seguros; bloqueia url(), javascript: e expression(). */
export const validCssColor = (v: any): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, 300) : "";
  if (!s) return undefined;
  if (/url\s*\(|javascript|expression/i.test(s)) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^(rgba?|hsla?)\s*\([0-9\s.,%]+\)$/i.test(s)) return s;
  if (/^linear-gradient\(/i.test(s)) return s;
  if (/^(white|black|transparent|currentColor)$/i.test(s)) return s;
  return undefined;
};

export const validLink = (v: any): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, 500) : "";
  if (!s) return undefined;
  if (/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:|wa\.me\/)/i.test(s)) return s;
  return undefined;
};

const validAlign = (v: any): string | undefined => (["left", "center", "right", "justify"] as const).find((a) => a === v);
const validJustify = (v: any): string | undefined => (["start", "center", "end", "between"] as const).find((a) => a === v);
const validColumnAlign = (v: any): string | undefined => (["start", "center", "end", "stretch"] as const).find((a) => a === v);

function sanitizeStyle(s: any): any {
  if (!s || typeof s !== "object") return {};
  const out: any = {};
  for (const key of ["padding", "margin"] as const) {
    if (s[key] !== undefined) out[key] = clampNum(s[key], 0, 160, 0);
  }
  const background = validCssColor(s.background); if (background) out.background = background;
  const color = validCssColor(s.color); if (color) out.color = color;
  const textAlign = validAlign(s.textAlign); if (textAlign) out.textAlign = textAlign;
  if (s.fontSize !== undefined) out.fontSize = clampNum(s.fontSize, 10, 96, 16);
  return out;
}

function sanitizeElement(el: any): any {
  if (!el || typeof el !== "object") return null;
  const id = safeId(el.id);
  const style = sanitizeStyle(el.style);
  switch (el.type) {
    case "text":
      return { id, type: "text", tag: (["p", "h1", "h2", "h3", "h4"] as const).find((t) => t === el.tag) ?? "p", text: clampStr(el.text, 4000), align: validAlign(el.align), style };
    case "image": {
      const url = clampStr(el.url, 600);
      const okUrl = /^https:\/\//.test(url) || /^\/api\/backend\/public\/site-assets\//.test(url);
      if (!okUrl) return null;
      return { id, type: "image", url, alt: clampStr(el.alt, 200), caption: clampStr(el.caption, 200), linkUrl: validLink(el.linkUrl), linkTarget: el.linkTarget === "_blank" ? "_blank" : "_self", width: clampNum(el.width, 10, 100, 100), radius: clampNum(el.radius, 0, 64, 0), align: (["left", "center", "right"] as const).find((a) => a === el.align), style };
    }
    case "button": {
      const label = clampStr(el.label, 80);
      if (!label) return null;
      const href = validLink(el.href) ?? "#";
      const size = (["sm", "md", "lg"] as const).find((s) => s === el.size) ?? "md";
      const variant = (["solid", "outline", "ghost"] as const).find((v) => v === el.variant) ?? "solid";
      return { id, type: "button", label, href, target: el.target === "_blank" ? "_blank" : "_self", background: validCssColor(el.background), color: validCssColor(el.color), radius: clampNum(el.radius, 0, 64, 10), size, variant, fullWidth: el.fullWidth === true, style };
    }
    case "spacer":
      return { id, type: "spacer", height: clampNum(el.height, 1, 240, 48), style };
    default:
      return null;
  }
}

export function sanitizeLayout(content: any): any {
  const columnsIn = Array.isArray(content?.columns) ? content.columns : [];
  const columns = columnsIn.slice(0, 4).map((col: any) => {
    const elements = (Array.isArray(col?.elements) ? col.elements : []).slice(0, 40).map(sanitizeElement).filter(Boolean);
    return {
      id: safeId(col?.id),
      span: clampNum(col?.span, 1, 12, 12),
      direction: col?.direction === "row" ? "row" : "column",
      align: validColumnAlign(col?.align) ?? "stretch",
      justify: validJustify(col?.justify) ?? "start",
      gap: clampNum(col?.gap, 0, 64, 12),
      elements,
    };
  });
  const out: any = { columns };
  if (content?.gap !== undefined) out.gap = clampNum(content.gap, 0, 96, 12);
  const background = validCssColor(content?.background); if (background) out.background = background;
  if (content?.padding !== undefined) out.padding = clampNum(content.padding, 0, 200, 0);
  return out;
}

const KNOWN_STANDARD = new Set(["hero", "richText", "services", "gallery", "testimonials", "faq", "cta", "posts", "properties", "contact", "spacer", "divider"]);

export type RelayoutBlock = { type: string; content: any };

/** Aceita a saída da IA e devolve apenas blocos válidos e seguros. */
export function sanitizeRelayoutBlocks(raw: any): RelayoutBlock[] {
  const source = Array.isArray(raw?.blocks) ? raw.blocks : [];
  const kept: RelayoutBlock[] = [];
  for (const block of source.slice(0, 40)) {
    const type = clampStr(block?.type, 40);
    if (!type) continue;
    if (type === "layout") { const content = sanitizeLayout(block?.content); kept.push({ type, content }); continue; }
    if (KNOWN_STANDARD.has(type)) {
      const c = block?.content && typeof block.content === "object" && !Array.isArray(block.content) ? block.content : {};
      const out: any = {};
      for (const [k, v] of Object.entries(c).slice(0, 100)) out[String(k).slice(0, 60)] = typeof v === "string" ? v.slice(0, 5000) : v;
      kept.push({ type, content: out }); continue;
    }
  }
  return kept;
}

export const RELAYOUT_SYSTEM = `Você é um diretor de design gráfico e web sênior, brasileiro. Sua tarefa é transformar uma página de site comum no design premium que ela merece — sem perder fatos reais (preços, telefones, endereços, links e textos factuais devem ser preservados).

Regras rígidas:
1. NUNCA invente fatos, avaliações falsas com datas, certificações ou números de resultado. Reescreva a copy para ser atraente, mas fiel.
2. Melhore hierarquia, respiro, contraste e ritmo do conteúdo. Prefira poucos blocos excelentes a muitos blocos medianos.
3. Use depoimentos/FAQ apenas com o conteúdo que já existe na página; se não existir, crie apenas com placeholders editáveis marcados como "exemplo editável" — nunca como prova social real.
4. Devolva SOMENTE JSON válido no formato {"blocks":[{"type":"hero","content":{...}}, ...]}. Sem markdown, sem comentários, sem chaves extras.
5. Tipos permitidos: hero, richText, services, gallery, testimonials, faq, cta, posts, properties, contact, spacer, divider, layout.

CONTRATO do bloco layout — seção flex com colunas e elementos:
{"type":"layout","content":{"gap":24,"background":"#0A1730 ou linear-gradient(160deg,#050D22,#0A1730)","padding":64,"columns":[{"span":6,"direction":"column","align":"center","justify":"center","gap":16,"elements":[
{"type":"text","tag":"h1","text":"...","align":"left","style":{"color":"#FFFFFF","fontSize":44,"padding":8}},
{"type":"image","url":"https://…","alt":"...","width":100,"radius":16,"caption":"...","linkUrl":"https://wa.me/55…","linkTarget":"_blank"},
{"type":"button","label":"Quero conversar","href":"https://wa.me/55…","target":"_blank","background":"#2E7CF6","color":"#FFFFFF","variant":"solid","size":"lg","radius":12,"fullWidth":false},
{"type":"spacer","height":24}
]}]}}
- columns.span é fração de 12 (use 6+6, 4+8, 12 etc.). Mínimo 1, máximo 4 colunas.
- Textos suportam **negrito**, *itálico* e ~~riscado~~.
- Para images use SEMPRE as URLs que já existem no conteúdo atual, ou URLs seguras https:// (unsplash.com/other). NUNCA invente domínios.
- Botões devem ter ação real: WhatsApp, link interno da página (#) ou URL válida.`;
