import sanitizeHtml from "sanitize-html";
import type { Blueprint } from "./blueprint";

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
  if (/^linear-gradient\([#a-z0-9(),.%\s-]+\)$/i.test(s)) return s;
  if (/^(white|black|transparent|currentColor)$/i.test(s)) return s;
  return undefined;
};

export const validLink = (v: any): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, 500) : "";
  if (!s || /[\\\u0000-\u0020]/.test(s)) return undefined;
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

export type RelayoutBlock = { type: string; content: any };

const functionalTypes = new Set(["contact", "posts", "properties"]);
const itemFields: Record<string, string[]> = {
  services: ["title", "text"],
  faq: ["question", "answer"],
  testimonials: ["name", "text"],
  gallery: ["url", "caption"],
};

const freeLayoutTags = [
  "main", "section", "header", "footer", "nav", "article", "aside", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "img", "picture", "source", "figure", "figcaption",
  "ul", "ol", "li", "strong", "em", "b", "i", "small", "br", "hr", "blockquote",
  "details", "summary", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "th", "td",
];

export function sanitizeFreeLayout(value: any): { html: string; css: string } | null {
  if (typeof value?.html !== "string" || typeof value?.css !== "string" ||
      value.html.length > 32000 || value.css.length > 24000 || /<\/style/i.test(value.css)) return null;
  const html = sanitizeHtml(value.html, {
    allowedTags: freeLayoutTags,
    allowedAttributes: {
      "*": ["id", "class", "role", "aria-*", "data-vx-element"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      source: ["srcset", "media", "type"],
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"], source: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => {
        const href = validLink(attrs.href) ?? "";
        const publicAsset = /^https:\/\//i.test(href) || /^(mailto|tel):/i.test(href);
        return { tagName: "a", attribs: { ...attrs, href: href.startsWith("#") || publicAsset ? href : "", target: publicAsset ? "_blank" : "_self", rel: "noopener noreferrer" } };
      },
    },
  });
  if (!sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()) return null;
  return { html, css: value.css };
}

function sanitizeBlocks(raw: unknown, existing: RelayoutBlock[] = []): RelayoutBlock[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > 40) return null;
  const blocks: RelayoutBlock[] = [];
  const functional = existing.filter(block => functionalTypes.has(block.type));
  const used = new Set<RelayoutBlock>();
  let hasContent = false;
  for (const block of raw) {
    const { type, content: c } = block ?? {};
    if (typeof type !== "string" || !c || typeof c !== "object" || Array.isArray(c)) return null;
    if (functionalTypes.has(type)) {
      const original = functional.find(item => item.type === type && !used.has(item));
      if (original) {
        blocks.push(original);
        used.add(original);
      }
      continue;
    }
    const out: Record<string, unknown> = {};
    for (const key of ["title", "headline", "sub", "badge", "body", "ctaLabel"]) {
      if (typeof c[key] === "string") out[key] = c[key].slice(0, key === "body" ? 5000 : 500);
    }
    if (type === "freeLayout") {
      const content = sanitizeFreeLayout(c);
      if (!content) return null;
      blocks.push({ type, content });
      hasContent = true;
      continue;
    }
    if (type === "layout") {
      const layout = sanitizeLayout(c);
      if (!layout.columns.some((col: any) => col.elements.some((el: any) => el.type === "image" || el.label || el.text?.trim()))) return null;
      blocks.push({ type, content: layout });
      hasContent = true;
      continue;
    }
    if (type === "hero" || type === "cta") {
      const heading = type === "hero" ? out.headline : out.title;
      if (typeof heading !== "string" || !heading.trim()) return null;
      const ctaUrl = validLink(c.ctaUrl);
      if (ctaUrl) out.ctaUrl = ctaUrl;
      if (type === "hero") {
        const imageUrl = validLink(c.imageUrl);
        if (imageUrl && /^https?:\/\//i.test(imageUrl)) out.imageUrl = imageUrl;
        if (["overlay", "split", "editorial", "fullscreen"].includes(c.variant)) out.variant = c.variant;
        if (["manrope", "playfair", "dmserif", "fraunces"].includes(c.fontPair)) out.fontPair = c.fontPair;
        const design: Record<string, string> = {};
        for (const key of ["background", "headlineColor", "subColor", "badgeBackground", "buttonBackground", "buttonColor"]) {
          const color = validCssColor(c.design?.[key]);
          if (color) design[key] = color;
        }
        const align = validAlign(c.design?.textAlign);
        if (align) design.textAlign = align;
        if (["sm", "md", "lg"].includes(c.design?.minHeight)) design.minHeight = c.design.minHeight;
        out.design = design;
      }
    } else if (Object.prototype.hasOwnProperty.call(itemFields, type)) {
      if (!Array.isArray(c.items) || !c.items.length) return null;
      out.items = c.items.slice(0, 16).map((item: any) => Object.fromEntries(itemFields[type]!.map(key => [
        key, key === "url" ? validLink(item?.url) ?? "" : clampStr(item?.[key], 1000),
      ])));
    } else if (type === "spacer") {
      out.size = clampNum(c.size, 1, 240, 48);
    } else if (type === "divider") {
      out.style = c.style === "dashed" ? "dashed" : "solid";
    } else if (type !== "richText" || !(out.title || out.body)) {
      return null;
    }
    if (type !== "spacer" && type !== "divider") hasContent = true;
    blocks.push({ type, content: out });
  }
  return hasContent || (functional.length > 0 && functional.every(block => used.has(block))) ? [...blocks, ...functional.filter(block => !used.has(block))] : null;
}

function modelJson(text: string): any {
  try {
    return JSON.parse(text.trim().replace(/^\x60{3}(?:json)?\s*|\s*\x60{3}$/gi, ""));
  } catch {
    return null;
  }
}

export function editableSitePages(blueprint: Blueprint, includeOperational = false) {
  return includeOperational ? blueprint.pages : blueprint.pages.filter(page => ["HOME", "SERVICES", "TEAM"].includes(page.kind));
}

export function parseSiteDesign(text: string, blueprint: Blueprint, requireFreeLayout = false): Blueprint | null {
  const raw = modelJson(text);
  const pages = editableSitePages(blueprint, requireFreeLayout);
  if (!Array.isArray(raw?.pages) || raw.pages.length !== pages.length) return null;
  const generated = new Map<string, RelayoutBlock[]>();
  for (const page of pages) {
    const blocks = sanitizeBlocks(raw.pages.find((entry: any) => entry?.slug === page.slug)?.blocks, page.blocks);
    if (!blocks || (requireFreeLayout && !blocks.some(block => block.type === "freeLayout"))) return null;
    generated.set(page.slug, blocks);
  }
  return { ...blueprint, pages: blueprint.pages.map(page => ({ ...page, blocks: generated.get(page.slug) ?? page.blocks })) };
}

export function parseSitePage(text: string, current: RelayoutBlock[], requireFreeLayout = false) {
  const blocks = sanitizeBlocks(modelJson(text)?.blocks, current);
  return requireFreeLayout && !blocks?.some(block => block.type === "freeLayout") ? null : blocks;
}

export const SITE_DESIGN_SYSTEM = `Você é Design Gráfico & Web sênior. Crie um site brasileiro sob medida. Defina composição, cores, fontes, espaçamento, hierarquia e microinterações em CSS a partir do pedido, da marca, do segmento e das referências. Use HTML semântico, responsivo e acessível. Retorne somente JSON no formato solicitado.

Para compor uma página, inclua {"type":"freeLayout","content":{"html":"fragmento HTML","css":"folha de estilos CSS"}}. Use HTML e CSS próprios. Você pode usar grid, flex, media queries, fontes instaladas no dispositivo, fontes locais do produto (DM Sans, Manrope, Inter, Playfair Display, Fraunces e DM Serif Display), fontes incorporadas em data: e pilhas CSS personalizadas, animações CSS e o padrão visual que melhor atende ao projeto. Use CSS separado do HTML. Inclua no máximo um bloco freeLayout por página. Escreva HTML compacto para caber na resposta. Navegação interna da composição deve usar âncoras. Use links HTTPS, tel e mailto fornecidos. O cabeçalho externo do site já navega entre páginas.

BAR nível agência — OBRIGATÓRIO:
- Contraste mínimo WCAG AA: texto claro sobre fundo escuro OU texto escuro sobre fundo claro. NUNCA texto preto/cinza-escuro sobre azul-marinho, NUNCA fundo azul-marinho/preto com texto preto. Se usar fundo escuro, texto #F2F6FF (ou similar claro); se fundo claro, texto #111827 (ou similar escuro).
- Paleta derivada da marca do cliente: use a cor primária e a de destaque informadas (ou gere uma paleta coerente com o segmento) — não use azul-marinho genérico como única cor, nem fundo saturado sem gradiente/sutileza.
- Hierarquia forte: hero com título grande (clamp 32–56px), subtítulo claro e CTA em destaque; seções com ritmo, respiração e máx. 3–4 blocos visuais por seção.
- Tipografia com personalidade: escolha um par display+sans (ex.: Playfair/Fraunces para o hero + Inter/Manrope para texto). Nada de fonte default sem peso/tamanho definido.
- Imagens reais do segmento; hero com imagem de fundo ou coluna com foto (use apenas URLs fornecidas ou Unsplash confiáveis).
- Mobile-first: respeite @media (max-width: 640px); nada de largura fixa; botões com 44px+ de alvo de toque.
- Sem lorem ipsum, sem texto placeholder visível; copy brasileira concreta e específica do segmento.
- HTML limpo e compacto; CSS separado do HTML; sem scripts, sem embeds.

Use somente fatos, contatos e imagens do briefing ou da página existente. Referências externas são exemplos visuais. Preserve dados e funcionalidades do site. Blocos operacionais de contato, imóveis e notícias são preservados pelo sistema. A composição roda isolada, sem scripts, embeds e formulários HTML. Deixe a captura de dados para os blocos operacionais.`;
