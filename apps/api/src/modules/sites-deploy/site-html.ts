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

/** Espelha a normalização do service de formulários para que chave e whitelist coincidam. */
function formFieldName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

type RenderContext = {
  siteId?: string;
  /** Base da API pública, sem a parte do formulário (ex.: https://api.vexorasuite.com.br). */
  apiBase?: string;
};

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

function renderNode(node: HtmlNode | undefined, depth: number, ctx: RenderContext = {}): string {
  if (!node || depth > 24) return "";
  const props = node.props ?? {};
  const style = styleAttr(node.styles);
  const children = (node.children ?? []).map((child) => renderNode(child, depth + 1, ctx)).join("");

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
      const rawFields = Array.isArray(props.fields)
        ? props.fields.filter((field): field is string => typeof field === "string")
        : ["nome", "email", "mensagem"];
      const fields = [...new Set(rawFields.map(formFieldName).filter(Boolean))].slice(0, 20);
      const inputs = fields
        .map((field) => {
          const type = field.replace(/_/g, "").includes("email")
            ? "email"
            : /telefone|celular|phone/.test(field)
              ? "tel"
              : "text";
          const human = escapeHtml(field.replace(/_/g, " "));
          return `<label>${human}<input name="${escapeHtml(field)}" type="${type}" autocomplete="${type === "email" ? "email" : type === "tel" ? "tel" : "off"}"></label>`;
        })
        .join("");
      const blockId = typeof node.id === "string" && /^[\w-]{1,80}$/.test(node.id) ? node.id : "";
      const base = String(ctx.apiBase ?? "").replace(/\/+$/, "");
      const endpoint = base && /^https:\/\//i.test(base)
        ? `${base}/api/public/sites/${encodeURIComponent(ctx.siteId ?? "")}/forms`
        : "";
      const unavailable = endpoint
        ? ""
        : '<p class="vx-note">Formulário indisponível: a URL pública da API não foi configurada nesta instalação.</p>';
      return `<form class="vx-form"${style} data-vx-form data-vx-block="${escapeHtml(blockId)}" data-vx-endpoint="${escapeHtml(endpoint)}">${inputs}<input class="vx-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit"${endpoint ? "" : " disabled"}>${escapeHtml(props.submitLabel ?? "Enviar")}</button><p class="vx-form-status" role="status" aria-live="polite"></p>${unavailable}</form>`;
    }
    case "post-list":
      return `<section class="vx-placeholder"${style}><p>Lista de posts: será preenchida com as publicações do site.</p></section>`;
    case "product-grid":
      return `<section class="vx-placeholder"${style}><p>Vitrine de produtos: será preenchida com o catálogo do site.</p></section>`;
    case "section": {
      // `anchor` é um detalhe do template de landing page: permite que o botão
      // de chamada para ação role até o formulário no HTML publicado.
      const anchor = typeof props.anchor === "string" && /^[a-z][a-z0-9-]{0,60}$/.test(props.anchor)
        ? ` id="${escapeHtml(props.anchor)}"`
        : "";
      return `<section${anchor}${style}>${children}</section>`;
    }
    case "container":
      return `<div${style}>${children}</div>`;
    default:
      return children;
  }
}

export function renderSiteHtml(
  document: unknown,
  site: { name: string; slug: string; primaryColor?: string | null; accentColor?: string | null },
  context: RenderContext = {},
): string {
  const doc = (document ?? {}) as HtmlDocument;
  const theme = doc.meta?.theme ?? {};
  const primary = safeColor(site.primaryColor || theme.primary, "#0E7A5C");
  const accent = safeColor(site.accentColor || theme.secondary, "#6258DF");
  const background = safeColor(theme.background, "#ffffff");
  const text = safeColor(theme.text, "#101d33");
  const title = escapeHtml(doc.meta?.title || site.name || "Site Véxora");
  const html = renderNode(doc.root, 0, context);
  // Só injeta o script quando há ao menos um formulário realmente habilitado.
  const hasForm = /data-vx-endpoint="https/.test(html);

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
.vx-form button[disabled]{opacity:.5;cursor:not-allowed}
.vx-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important}
.vx-form-status{font-size:.8125rem;min-height:1em}
.vx-note,.vx-placeholder p{font-size:.8125rem;opacity:.7}
</style>
</head>
<body>
${html}
${hasForm ? `<script>(function(){var started=Date.now();document.querySelectorAll('form[data-vx-form]').forEach(function(form){form.addEventListener('submit',function(ev){ev.preventDefault();var endpoint=form.getAttribute('data-vx-endpoint');var status=form.querySelector('.vx-form-status');var button=form.querySelector('button[type=submit]');if(!endpoint){if(status)status.textContent='Formulário indisponível no momento.';return}var values={};Array.prototype.forEach.call(form.querySelectorAll('input[name]'),function(el){if(el.name&&el.name!=='website')values[el.name]=el.value});var hp=form.querySelector('input[name=website]');var body=new URLSearchParams();Object.keys(values).forEach(function(k){body.append('values['+k+']',values[k])});body.append('website',hp?hp.value:'');body.append('startedAt',String(started));if(button)button.disabled=true;if(status)status.textContent='Enviando…';fetch(endpoint+'/'+encodeURIComponent(form.getAttribute('data-vx-block')||'')+'/submit',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body:body.toString()}).then(function(r){return r.json().catch(function(){return {}}).then(function(j){return{ok:r.ok,message:j&&j.message}})}).then(function(x){if(status)status.textContent=x.message||(x.ok?'Mensagem enviada. Obrigado pelo contato!':'Não foi possível enviar. Tente novamente.');if(x.ok)form.reset()}).catch(function(){if(status)status.textContent='Não foi possível enviar. Tente novamente.'}).finally(function(){if(button)button.disabled=false})})})})();</script>` : ""}
</body>
</html>`;
}
