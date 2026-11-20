/**
 * Converte HTML (ou exportações de page builders) no SiteDocument do editor.
 *
 * Determinístico e sem executar JavaScript: o HTML de origem é tratado como dado.
 * Nenhum script, handler inline ou URL executável sobrevive à conversão.
 */
import { randomUUID } from "node:crypto";
import { parseDocument } from "htmlparser2";

export type ImportedNodeType =
  | "section"
  | "text"
  | "image"
  | "button"
  | "form"
  | "post-list"
  | "product-grid"
  | "video"
  | "container";

export type ImportedNode = {
  id: string;
  type: ImportedNodeType;
  props: Record<string, unknown>;
  styles: Record<string, string>;
  children: ImportedNode[];
};

export type ImportedKind = "static" | "blog" | "real-estate" | "ecommerce";

export type ImportedDocument = {
  version: number;
  root: ImportedNode;
  meta: {
    title: string;
    type: ImportedKind;
    theme: Record<string, string>;
  };
};

export type ConversionResult = {
  document: ImportedDocument;
  warnings: string[];
};

type RawNode = {
  type: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: RawNode[];
  data?: string;
};

type Ctx = {
  base?: string;
  warnings: Set<string>;
  count: number;
};

const MAX_NODES = 250;
const MAX_DEPTH = 12;
const MAX_TEXT = 4000;
const SAFE_TAG = /^h[1-3]$/;

function nodeId(): string {
  return `n_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function makeNode(
  type: ImportedNodeType,
  props: Record<string, unknown>,
  children: ImportedNode[] = [],
  styles: Record<string, string> = {},
): ImportedNode {
  return { id: nodeId(), type, props, styles, children };
}

function warn(ctx: Ctx, message: string): void {
  ctx.warnings.add(message);
}

function plainText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

function textOf(node: RawNode | undefined, depth = 0): string {
  if (!node || depth > MAX_DEPTH) return "";
  if (node.type === "text" || node.type === "cdata") return node.data ?? "";
  if (node.type === "script" || node.type === "style" || node.type === "comment") return "";
  return (node.children ?? []).map((child) => textOf(child, depth + 1)).join(" ");
}

function safeUrl(value: string | undefined, ctx: Ctx): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "#";
  if (/^(javascript|data|vbscript|file):/i.test(raw)) {
    warn(ctx, "Links com esquema não seguro foram removidos.");
    return "#";
  }
  try {
    const url = ctx.base ? new URL(raw, ctx.base) : new URL(raw);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      warn(ctx, "Links com protocolo não suportado foram removidos.");
      return "#";
    }
    return url.toString();
  } catch {
    if (/^(\/|#|\.\/|\.\.\/)/.test(raw)) return raw;
    return "#";
  }
}

function youtubeEmbed(value: string | undefined, ctx: Ctx): string | null {
  const url = safeUrl(value, ctx);
  if (url === "#") return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(parsed.hostname)) return null;
    let id = "";
    if (parsed.hostname.endsWith("youtu.be")) id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    else if (parsed.pathname === "/watch") id = parsed.searchParams.get("v") ?? "";
    else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.split("/")[2] ?? "";
    if (!/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

function attrs(node: RawNode): Record<string, string> {
  return node.attribs ?? {};
}

function classes(node: RawNode): string {
  return String(attrs(node).class ?? "").toLowerCase();
}

function shortcodeAttrs(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) result[match[1]!.toLowerCase()] = match[2]!;
  return result;
}

/** Divi costuma exportar o conteúdo como shortcodes em vez de tags HTML. */
function shortcodeNodes(html: string, ctx: Ctx): ImportedNode[] | null {
  if (!/\[et_pb_/i.test(html)) return null;
  const nodes: ImportedNode[] = [];
  const re = /\[et_pb_([a-z0-9_]+)([^\]]*)\]([\s\S]*?)\[\/et_pb_\1\]/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) && nodes.length < MAX_NODES) {
    const widget = `et_pb_${match[1]!.toLowerCase()}`;
    const settings = shortcodeAttrs(match[2] ?? "");
    const inner = match[3] ?? "";
    const node = mapBuilderWidget(widget, settings, plainText(inner), ctx, shortcodeNodes(inner, ctx) ?? []);
    if (node) nodes.push(node);
  }
  return nodes;
}

/** Mapeia widgets conhecidos dos builders para os blocos que o editor entende. */
function mapBuilderWidget(
  widget: string,
  settings: Record<string, string>,
  text: string,
  ctx: Ctx,
  children: ImportedNode[],
): ImportedNode | null {
  const id = String(settings.id ?? "");
  // Elementor/Crocoblock mandam "jet-listing.default", "button.default" etc.
  const known = widget.toLowerCase().split(/[.:]/)[0] ?? "";
  if (/^(heading|et_pb_text|et_pb_blurb|fl-module-rich-text|text-editor|jet-heading)$/.test(known)) {
    const size = String(settings.header_size ?? settings.size ?? "p").replace(/^h/, "");
    const tag = /^[1-3]$/.test(size) ? `h${size}` : "p";
    return makeNode("text", { content: text || String(settings.title ?? settings.editor ?? ""), tag });
  }
  if (/^(image|et_pb_image|fl-module-photo|jet-image)$/.test(known)) {
    return makeNode("image", {
      src: safeUrl(settings.src ?? settings.url ?? settings.image ?? "", ctx),
      alt: String(settings.alt ?? ""),
    });
  }
  if (/^(button|et_pb_button|fl-module-button|jet-button)$/.test(known)) {
    return makeNode("button", {
      label: plainText(text || settings.text || "Saiba mais"),
      href: safeUrl(settings.href ?? settings.link ?? settings.button_url ?? "", ctx),
    });
  }
  if (/^(video|et_pb_video|fl-module-video|jet-video)$/.test(known)) {
    const embed = youtubeEmbed(settings.src ?? settings.youtube_url ?? settings.url ?? "", ctx);
    return embed ? makeNode("video", { src: embed }) : null;
  }
  if (/^(form|et_pb_contact_form|fl-module-form|jet-form-builder)$/.test(known)) {
    warn(ctx, "Formulário importado sem backend de respostas; o envio ainda não está ativo.");
    return makeNode("form", { fields: ["nome", "email", "mensagem"], submitLabel: "Enviar" });
  }
  if (/^(jet-listing|post-list|et_pb_blog|fl-module-posts|fl-module-post-grid)$/.test(known)) {
    return makeNode("post-list", { count: 6, layout: "grid" });
  }
  if (/^(product-grid|et_pb_shop|jet-woo|fl-module-woocommerce|fl-module-woo-product-grid)$/.test(known)) {
    return makeNode("product-grid", { count: 8, columns: 4 });
  }
  if (!id && !children.length && !text) return null;
  return makeNode("container", { source: widget }, children);
}

function builderWidgetOf(node: RawNode): { widget: string; settings: Record<string, string> } | null {
  const a = attrs(node);
  const widget = String(a["data-widget_type"] ?? "").trim();
  if (widget) {
    let settings: Record<string, string> = {};
    try {
      const raw = JSON.parse(String(a["data-settings"] ?? "{}"));
      if (raw && typeof raw === "object") settings = raw as Record<string, string>;
    } catch {
      settings = {};
    }
    return { widget, settings };
  }
  const classList = classes(node).split(/\s+/);
  const divi = classList.find((name) => name.startsWith("et_pb_") && !name.startsWith("et_pb_module"));
  if (divi) return { widget: divi, settings: {} };
  const beaver = classList.find((name) => name.startsWith("fl-module-") && name !== "fl-module");
  if (beaver) return { widget: beaver, settings: {} };
  return null;
}

function mapDomNode(node: RawNode, ctx: Ctx, depth: number): ImportedNode | null {
  if (ctx.count >= MAX_NODES || depth > MAX_DEPTH) {
    warn(ctx, "Parte do conteúdo foi omitida para manter o documento dentro do limite.");
    return null;
  }
  if (
    node.type === "script" ||
    node.type === "style" ||
    node.type === "comment" ||
    node.type === "directive"
  ) return null;
  if (["head", "title", "meta", "link", "noscript"].includes(String(node.name ?? "").toLowerCase())) return null;

  const a = attrs(node);
  const childNodes = (node.children ?? [])
    .map((child) => mapDomNode(child, ctx, depth + 1))
    .filter((child): child is ImportedNode => child !== null);
  const name = String(node.name ?? "").toLowerCase();
  const text = plainText(textOf(node));
  const builder = builderWidgetOf(node);

  if (builder) {
    const mapped = mapBuilderWidget(builder.widget, builder.settings, text, ctx, childNodes);
    if (mapped) {
      ctx.count += 1;
      return mapped;
    }
  }

  let result: ImportedNode | null = null;
  if (/^h[1-6]$/.test(name)) {
    const level = name[1]!;
    result = makeNode("text", { content: text, tag: SAFE_TAG.test(`h${level}`) ? `h${level}` : "h3" });
  } else if (name === "p" || name === "li" || name === "blockquote" || name === "figcaption") {
    result = makeNode("text", { content: text, tag: "p" });
  } else if (name === "img") {
    warn(ctx, "Imagens importadas continuam apontando para a URL original; hospede-as no seu domínio.");
    result = makeNode("image", { src: safeUrl(a.src, ctx), alt: String(a.alt ?? "") });
  } else if (name === "a" && text) {
    result = makeNode("button", { label: text, href: safeUrl(a.href, ctx) });
  } else if (name === "iframe") {
    const embed = youtubeEmbed(a.src, ctx);
    if (embed) result = makeNode("video", { src: embed });
    else warn(ctx, "Um iframe não suportado não foi importado.");
  } else if (name === "form") {
    warn(ctx, "Formulário importado sem backend de respostas; o envio ainda não está ativo.");
    result = makeNode("form", { fields: ["nome", "email", "mensagem"], submitLabel: "Enviar" });
  } else if (name === "section" || name === "main" || name === "article") {
    result = makeNode("section", { padding: "3rem 1rem" }, childNodes);
  } else if (name === "div" || name === "body" || name === "header" || name === "footer" || name === "nav") {
    result = childNodes.length ? makeNode("container", {}, childNodes) : null;
  } else if (childNodes.length) {
    result = makeNode("container", {}, childNodes);
  }

  if (result) ctx.count += 1;
  return result;
}

function findBody(node: RawNode): RawNode | null {
  if (String(node.name ?? "").toLowerCase() === "body") return node;
  for (const child of node.children ?? []) {
    const found = findBody(child);
    if (found) return found;
  }
  return null;
}

function defaultTheme(): Record<string, string> {
  return {
    primary: "#0E7A5C",
    secondary: "#6258DF",
    background: "#ffffff",
    text: "#101d33",
    fontHeading: "Inter",
    fontBody: "Inter",
  };
}

/**
 * Converte HTML em SiteDocument. `baseUrl` resolve URLs relativas do site clonado.
 */
export function htmlToDocument(
  html: string,
  options: { baseUrl?: string; title?: string; kind?: ImportedKind } = {},
): ConversionResult {
  const source = String(html ?? "").replace(/<!doctype[^>]*>/gi, "").trim();
  if (!source) throw new Error("HTML vazio.");
  const ctx: Ctx = { base: options.baseUrl, warnings: new Set<string>(), count: 0 };
  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  let children: ImportedNode[];
  const fromShortcode = shortcodeNodes(source, ctx);
  if (fromShortcode) {
    children = fromShortcode;
    warn(ctx, "Conteúdo Divi reconhecido via shortcodes.");
  } else {
    const parsed = parseDocument(source, { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true });
    // Começar no <body> evita que todo o conteúdo fique dentro de um único container <html>.
    const contentRoot = findBody(parsed as unknown as RawNode) ?? (parsed as unknown as RawNode);
    children = (contentRoot.children ?? [])
      .map((node) => mapDomNode(node, ctx, 0))
      .filter((node): node is ImportedNode => node !== null);
  }

  const title = plainText(options.title ?? titleMatch?.[1] ?? "").slice(0, 100) || "Site importado";
  const root = makeNode("section", { padding: "3rem 1rem" }, children);
  return {
    document: {
      version: 1,
      root,
      meta: { title, type: options.kind ?? "static", theme: defaultTheme() },
    },
    warnings: [...ctx.warnings],
  };
}

/** Converte o JSON de conteúdo do Elementor (também usado por exports Crocoblock). */
export function elementorToNodes(value: unknown, ctx: Ctx, depth = 0): ImportedNode[] {
  if (!value || depth > MAX_DEPTH || ctx.count >= MAX_NODES) return [];
  const elements = Array.isArray(value)
    ? value
    : Array.isArray((value as { content?: unknown }).content)
      ? ((value as { content: unknown[] }).content)
      : Array.isArray((value as { elements?: unknown }).elements)
        ? ((value as { elements: unknown[] }).elements)
        : [];
  const nodes: ImportedNode[] = [];
  for (const item of elements) {
    const el = item as { elType?: string; widgetType?: string; settings?: Record<string, any>; elements?: unknown };
    const widget = String(el.widgetType ?? el.elType ?? "");
    const settings = el.settings ?? {};
    const nested = elementorToNodes(el.elements, ctx, depth + 1);
    if (widget && widget !== "section" && widget !== "column" && widget !== "container") {
      const text = plainText(
        String(settings.title ?? settings.editor ?? settings.text ?? settings.form_name ?? ""),
      );
      const mapped = mapBuilderWidget(widget, settings as Record<string, string>, text, ctx, nested);
      if (mapped) {
        ctx.count += 1;
        nodes.push(mapped);
      }
    } else if (nested.length) {
      nodes.push(makeNode("container", {}, nested));
    }
  }
  return nodes;
}

export function elementorConversion(value: unknown, title: string, kind: ImportedKind): ConversionResult {
  const ctx: Ctx = { warnings: new Set<string>(), count: 0 };
  const children = elementorToNodes(value, ctx);
  if (!children.length) throw new Error("O JSON de Elementor não continha blocos reconhecíveis.");
  if (ctx.warnings.size === 0) ctx.warnings.add("Exportação do Elementor lida. Revise os blocos convertidos no editor.");
  return {
    document: {
      version: 1,
      root: makeNode("section", { padding: "3rem 1rem" }, children),
      meta: { title: plainText(title).slice(0, 100) || "Site importado", type: kind, theme: defaultTheme() },
    },
    warnings: [...ctx.warnings],
  };
}

export { textOf, shortcodeAttrs, plainText };
