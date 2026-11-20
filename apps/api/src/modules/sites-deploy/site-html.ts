/**
 * Gerador determinístico de HTML estático a partir do SiteDocument.
 *
 * O navegador do editor nunca envia arquivos para o deploy: o backend lê o documento
 * salvo e produz o index.html. Toda interpolação é escapada; URLs passam por filtro
 * para impedir javascript: e data: em atributos publicados.
 */

type HtmlNode = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  styles?: Record<string, string>;
  children?: HtmlNode[];
};

type HtmlDocument = {
  version?: number;
  root?: HtmlNode;
  meta?: {
    title?: string;
    type?: string;
    theme?: Record<string, string>;
  };
};

const SAFE_TAG = /^(h1|h2|h3|h4|h5|h6|p|span|div|strong|em|blockquote|ul|ol|li)$/;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_URL = /^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value: unknown): string {
  const url = String(value ?? "").trim();
  return SAFE_URL.test(url) ? url : "#";
}

function safeColor(value: unknown, fallback: string): string {
  const color = String(value ?? "").trim();
  if (HEX_COLOR.test(color) || /^var\(--[a-z0-9-]+\)$/i.test(color)) return color;
  return fallback;
}

function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function styleAttr(styles: Record<string, string> | undefined): string {
  if (!styles) return "";
  const declarations = Object.entries(styles)
    .filter(([key, value]) => /^[a-zA-Z-]+$/.test(key) && typeof value === "string")
    .map(([key, value]) => `${kebab(key)}:${value.replace(/[;{}]/g, "")}`)
    .filter((declaration) => declaration.length > 3);
  return declarations.length ? ` style="${escapeHtml(declarations.join(";"))}"` : "";
}

function youtubeEmbed(src: string): string | null {
  try {
    const url = new URL(src);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)) return null;
    if (url.hostname.endsWith("youtu.be")) {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (url.pathname.startsWith("/embed/")) return src;
    return null;
  } catch {
    return null;
  }
}

function renderNode(node: HtmlNode | undefined, depth: number): string {
  if (!node || depth > 24) return "";
  const props = node.props ?? {};
  const style = styleAttr(node.styles);
  const children = (node.children ?? []).map((child) => renderNode(child, depth + 1)).join("");

  switch (node.type) {
    case "text": {
      const requested = String(props.tag ?? "p").toLowerCase();
      const tag = SAFE_TAG.test(requested) ? requested : "p";
      return `<${tag}${style}>${escapeHtml(props.content)}</${tag}>`;
    }
    case "image":
      return `<img src="${escapeHtml(safeUrl(props.src))}" alt="${escapeHtml(props.alt ?? "")}"${style} loading="lazy">`;
    case "button":
      return `<a href="${escapeHtml(safeUrl(props.href))}"${style}>${escapeHtml(props.label ?? "Saiba mais")}</a>`;
    case "video": {
      const src = String(props.src ?? "");
      const embed = youtubeEmbed(src);
      if (embed) {
        return `<div class="vx-video"${style}><iframe src="${escapeHtml(embed)}" title="${escapeHtml(props.title ?? "Vídeo")}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      }
      if (!safeUrl(src).startsWith("#")) {
        return `<video src="${escapeHtml(src)}" controls${style}></video>`;
      }
      return "";
    }
    case "form": {
      const fields = Array.isArray(props.fields) ? props.fields.filter((f): f is string => typeof f === "string") : ["nome", "email", "mensagem"];
      const inputs = fields
        .map((field) => {
          const name = escapeHtml(field.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
          const label = escapeHtml(field);
          const type = field.toLowerCase().includes("email") ? "email" : "text";
          return `<label>${label}<input name="${name}" type="${type}"></label>`;
        })
        .join("");
      return `<form class="vx-form"${style}>${inputs}<button type="submit">${escapeHtml(props.submitLabel ?? "Enviar")}</button><p class="vx-note">Formulário visual: o recebimento de respostas será ativado em uma próxima etapa.</p></form>`;
    }
    case "post-list":
      return `<section class="vx-placeholder"${style}><p>Lista de posts: será preenchida com as publicações do site.</p></section>`;
    case "product-grid":
      return `<section class="vx-placeholder"${style}><p>Vitrine de produtos: será preenchida com o catálogo do site.</p></section>`;
    case "section":
      return `<section${style}>${children}</section>`;
    case "container":
      return `<div${style}>${children}</div>`;
    default:
      return children;
  }
}

export function renderSiteHtml(
  document: unknown,
  site: { name: string; slug: string; primaryColor?: string | null; accentColor?: string | null },
): string {
  const doc = (document ?? {}) as HtmlDocument;
  const theme = doc.meta?.theme ?? {};
  const primary = safeColor(site.primaryColor || theme.primary, "#0E7A5C");
  const accent = safeColor(site.accentColor || theme.secondary, "#6258DF");
  const background = safeColor(theme.background, "#ffffff");
  const text = safeColor(theme.text, "#101d33");
  const title = escapeHtml(doc.meta?.title || site.name || "Site Véxora");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Vexora Sites">
<title>${title}</title>
<style>
:root{--primary:${primary};--accent:${accent};--background:${background};--text:${text}}
*{box-sizing:border-box}
body{margin:0;background:var(--background);color:var(--text);font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.5}
img{max-width:100%;height:auto}
a{color:var(--primary)}
.vx-video iframe{width:100%;aspect-ratio:16/9;border:0}
.vx-form{display:flex;flex-direction:column;gap:.75rem;max-width:32rem}
.vx-form label{display:flex;flex-direction:column;gap:.25rem;font-size:.875rem}
.vx-form input{padding:.65rem;border:1px solid #cbd5e1;border-radius:.5rem}
.vx-form button{padding:.7rem 1rem;border:0;border-radius:.5rem;background:var(--primary);color:#fff;font-weight:600;cursor:pointer}
.vx-note,.vx-placeholder p{font-size:.8125rem;opacity:.7}
</style>
</head>
<body>
${renderNode(doc.root, 0)}
</body>
</html>`;
}
