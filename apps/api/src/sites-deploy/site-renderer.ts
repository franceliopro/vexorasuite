import type { RenderFile } from "./cloudflare-pages.client";

/**
 * Renderizador estático dos dados persistidos do produto Sites.
 *
 * O produto Sites saiu do menu, mas os modelos (Site/SitePage/SiteBlock/SiteItem/
 * SiteAsset) continuam no banco. Este renderizador transforma esses dados em uma
 * pasta pronta para o Cloudflare Pages: HTML por página, CSS compartilhado e os
 * assets referenciados por id.
 *
 * Regras:
 *  - texto sempre escapado; só `freeLayout`/`externalHtml` são HTML do próprio tenant;
 *  - links absolutos a partir da raiz do domínio ("/servicos/"), o que funciona
 *    igual em `<projeto>.pages.dev` e no domínio próprio;
 *  - orçamento de arquivos/tamanho para não estourar o limite do Pages.
 */
export type RendererBlock = { id?: string; type: string; content?: unknown; sortOrder?: number; hidden?: boolean };
export type RendererPage = { id?: string; kind: string; slug: string; title: string; sortOrder?: number; hidden?: boolean; blocks: RendererBlock[] };
export type RendererItem = {
  kind: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  data?: unknown;
  sortOrder?: number;
};
export type RendererSite = {
  name: string;
  slug: string;
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  businessArea?: string | null;
  pages: RendererPage[];
  items?: RendererItem[];
  assets?: Map<string, { mimeType: string; bytes: Buffer }>;
};

export type RenderResult = {
  files: Map<string, RenderFile>;
  pageCount: number;
  assetCount: number;
  totalBytes: number;
};

const MAX_FILES = 5_000;
const MAX_BYTES = 80 * 1024 * 1024;

const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};

const text = (value: unknown, max = 20_000): string =>
  typeof value === "string" ? value.slice(0, max) : typeof value === "number" ? String(value) : "";

const pick = (content: Record<string, any>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = text(content[key]);
    if (value.trim()) return value;
  }
  return "";
};

const array = (value: unknown): any[] => (Array.isArray(value) ? value : []);

export function escapeHtml(value: unknown): string {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Só http(s), mailto, tel e caminhos internos; bloqueia javascript: e dados arbitrários. */
export function safeUrl(value: unknown): string {
  const raw = text(value, 2000).trim();
  if (!raw) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return raw;
  if (/^\/(?!\/)/.test(raw) || /^#/.test(raw)) return raw;
  return "";
}

const mimeExtension = (mime: string): string => {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/gif": "gif", "image/svg+xml": "svg", "image/avif": "avif", "application/pdf": "pdf",
    "font/woff": "woff", "font/woff2": "woff2", "text/css": "css", "text/plain": "txt",
  };
  return map[mime.toLowerCase()] || "bin";
};

class AssetCollector {
  readonly files = new Map<string, RenderFile>();
  private readonly paths = new Map<string, string>();

  constructor(private readonly assets: Map<string, { mimeType: string; bytes: Buffer }>) {}

  /** Reescreve referências locais de asset para /assets/<id>.<ext> e coleta o binário. */
  rewrite(html: string): string {
    return html.replace(/\/(?:api\/(?:backend\/|sites\/)?)?(?:public\/)?site-assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi, (match, id: string) => {
      const exact = this.assets.get(id) || this.assets.get(id.toLowerCase());
      if (!exact) return match;
      let path = this.paths.get(id);
      if (!path) {
        path = `assets/${id}.${mimeExtension(exact.mimeType)}`;
        this.paths.set(id, path);
        this.files.set(path, { content: exact.bytes, contentType: exact.mimeType || "application/octet-stream" });
      }
      return "/" + path;
    });
  }
}

const slugify = (value: string): string =>
  text(value, 80).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

function button(label: string, url: string, variant: "primary" | "secondary" = "primary"): string {
  const href = safeUrl(url);
  if (!label || !href) return "";
  return `<a class="btn btn-${variant}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function renderLayout(content: Record<string, any>, collector: AssetCollector): string {
  const columns = array(content.columns);
  if (!columns.length) return "";
  const rendered = columns.map((column: any) => {
    const col = object(column);
    const elements = array(col.elements).map((element: any) => {
      const item = object(element);
      const type = text(item.type || "text", 30);
      if (type === "image") {
        const url = safeUrl(item.url || item.src);
        return url ? `<img src="${escapeHtml(collector.rewrite(url))}" alt="${escapeHtml(item.alt || "")}" loading="lazy"/>` : "";
      }
      if (type === "button") return button(text(item.label || item.text), text(item.url), item.variant === "secondary" ? "secondary" : "primary");
      if (type === "html") return text(item.html || item.content);
      const heading = text(item.heading || item.title);
      const body = text(item.text || item.body);
      return (heading ? `<h3>${escapeHtml(heading)}</h3>` : "") + (body ? `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>` : "");
    }).filter(Boolean).join("");
    const width = Number.isFinite(Number(col.width)) && Number(col.width) > 0 ? Math.min(100, Number(col.width)) : 0;
    return `<div class="col"${width ? ` style="flex:0 0 ${width}%"` : ""}>${elements}</div>`;
  }).join("");
  return `<section class="section layout"><div class="container row">${rendered}</div></section>`;
}

function renderItems(block: Record<string, any>, kind: string, items: RendererItem[], collector: AssetCollector): string {
  const list = items.filter((item) => item.kind === kind).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (!list.length) return "";
  const base = kind === "property" ? "/imoveis/" : "/noticias/";
  const cards = list.map((item) => {
    const data = object(item.data);
    const cover = safeUrl(item.coverUrl);
    const price = text(data.price || data.preco);
    const code = text(data.code);
    return `<article class="card">
      ${cover ? `<a href="${base}${encodeURIComponent(slugify(item.slug))}/"><img src="${escapeHtml(collector.rewrite(cover))}" alt="${escapeHtml(item.title)}" loading="lazy"/></a>` : ""}
      <div class="card-body">
        ${code ? `<span class="tag">${escapeHtml(code)}</span>` : ""}
        <h3><a href="${base}${encodeURIComponent(slugify(item.slug))}/">${escapeHtml(item.title)}</a></h3>
        ${item.excerpt ? `<p>${escapeHtml(item.excerpt)}</p>` : ""}
        ${price ? `<strong>${escapeHtml(price)}</strong>` : ""}
      </div>
    </article>`;
  }).join("");
  return `<div class="grid">${cards}</div>`;
}

function renderBlock(block: RendererBlock, site: RendererSite, collector: AssetCollector): string {
  const type = text(block.type, 40);
  const content = object(block.content);
  const items = site.items || [];
  switch (type) {
    case "hero": {
      const image = safeUrl(content.imageUrl || content.image);
      const title = pick(content, "title", "heading", "headline") || site.name;
      const subtitle = pick(content, "subtitle", "subheading", "text");
      return `<section class="hero"${image ? ` style="background-image:linear-gradient(rgba(0,0,0,.48),rgba(0,0,0,.48)),url('${escapeHtml(collector.rewrite(image))}')"` : ""}>
        <div class="container hero-inner">
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
          <div class="actions">
            ${button(pick(content, "primaryLabel", "ctaLabel", "buttonLabel"), pick(content, "primaryUrl", "ctaUrl", "buttonUrl"))}
            ${button(pick(content, "secondaryLabel"), pick(content, "secondaryUrl"), "secondary")}
          </div>
        </div>
      </section>`;
    }
    case "richText": {
      const title = pick(content, "title", "heading");
      const html = text(content.html);
      const body = html || escapeHtml(pick(content, "text", "body")).replace(/\n/g, "<br/>");
      return `<section class="section"><div class="container narrow">${title ? `<h2>${escapeHtml(title)}</h2>` : ""}<div class="prose">${html ? html : body}</div></div></section>`;
    }
    case "services": {
      const list = array(content.items || content.services);
      const cards = list.map((entry: any) => {
        const service = object(entry);
        return `<article class="card"><div class="card-body">
          ${service.icon ? `<span class="icon">${escapeHtml(service.icon)}</span>` : ""}
          <h3>${escapeHtml(service.title || service.name)}</h3>
          <p>${escapeHtml(service.description || service.text)}</p>
        </div></article>`;
      }).join("");
      return `<section class="section"><div class="container">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="grid">${cards}</div></div></section>`;
    }
    case "gallery": {
      const images = array(content.images || content.items).map((entry: any) => {
        const image = typeof entry === "string" ? { url: entry } : object(entry);
        const url = safeUrl(image.url || image.src);
        return url ? `<figure><img src="${escapeHtml(collector.rewrite(url))}" alt="${escapeHtml(image.caption || image.alt || "")}" loading="lazy"/>${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}</figure>` : "";
      }).join("");
      return `<section class="section"><div class="container">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="gallery">${images}</div></div></section>`;
    }
    case "testimonials": {
      const list = array(content.items || content.testimonials).map((entry: any) => {
        const quote = object(entry);
        return `<blockquote><p>“${escapeHtml(quote.text || quote.quote)}”</p><footer><strong>${escapeHtml(quote.name || quote.author)}</strong>${quote.role ? `<span>${escapeHtml(quote.role)}</span>` : ""}</footer></blockquote>`;
      }).join("");
      return `<section class="section alt"><div class="container">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}<div class="grid">${list}</div></div></section>`;
    }
    case "faq": {
      const list = array(content.items || content.faq).map((entry: any) => {
        const faq = object(entry);
        return `<details><summary>${escapeHtml(faq.question || faq.title)}</summary><p>${escapeHtml(faq.answer || faq.text)}</p></details>`;
      }).join("");
      return `<section class="section"><div class="container narrow">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : ""}${list}</div></section>`;
    }
    case "cta":
      return `<section class="section cta"><div class="container narrow">
        <h2>${escapeHtml(pick(content, "title", "heading") || "Fale com a gente")}</h2>
        ${pick(content, "text", "subtitle") ? `<p>${escapeHtml(pick(content, "text", "subtitle"))}</p>` : ""}
        ${button(pick(content, "label", "buttonLabel") || "Entrar em contato", pick(content, "url", "buttonUrl") || "#contato")}
      </div></section>`;
    case "posts":
      return `<section class="section" id="noticias"><div class="container">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : "<h2>Notícias</h2>"}${renderItems(content, "post", items, collector)}</div></section>`;
    case "properties":
      return `<section class="section" id="imoveis"><div class="container">${content.title ? `<h2>${escapeHtml(content.title)}</h2>` : "<h2>Imóveis</h2>"}${renderItems(content, "property", items, collector)}</div></section>`;
    case "contact": {
      const entries = array(content.items || content.contacts);
      const rows = entries.map((entry: any) => {
        const contact = object(entry);
        const whatsapp = text(contact.whatsapp || contact.phone).replace(/\D/g, "");
        const email = text(contact.email);
        return `<li>${contact.department || contact.name ? `<strong>${escapeHtml(contact.department || contact.name)}</strong>` : ""}
          ${whatsapp ? `<a href="https://wa.me/${escapeHtml(whatsapp)}" rel="noopener">WhatsApp ${escapeHtml(contact.phone || whatsapp)}</a>` : ""}
          ${email ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : ""}
          ${contact.address ? `<span>${escapeHtml(contact.address)}</span>` : ""}
        </li>`;
      }).join("");
      return `<section class="section" id="contato"><div class="container narrow"><h2>${escapeHtml(pick(content, "title") || "Contato")}</h2><ul class="contact">${rows}</ul></div></section>`;
    }
    case "spacer":
      return `<div style="height:${Math.max(8, Math.min(200, Number(content.height) || 48))}px"></div>`;
    case "divider":
      return `<div class="container"><hr/></div>`;
    case "layout":
      return renderLayout(content, collector);
    case "freeLayout":
      return `<style>${text(content.css, 100_000)}</style>${collector.rewrite(text(content.html, 400_000))}`;
    case "externalHtml":
      return collector.rewrite(text(content.html, 600_000));
    default:
      return "";
  }
}

function pagePath(page: RendererPage): string {
  return page.kind === "HOME" || page.slug === "inicio" ? "index.html" : `${encodeURIComponent(slugify(page.slug))}/index.html`;
}

function isStandalone(blocks: RendererBlock[]): string | null {
  const visible = blocks.filter((block) => !block.hidden);
  if (visible.length !== 1) return null;
  const type = text(visible[0]?.type, 40);
  if (type !== "externalHtml" && type !== "freeLayout") return null;
  const html = text(object(visible[0]?.content).html, 700_000);
  return /<!doctype\s+html|<html[\s>]/i.test(html) ? html : null;
}

function shell(site: RendererSite, pages: RendererPage[], page: RendererPage, body: string): string {
  const navigation = pages
    .filter((candidate) => !candidate.hidden)
    .map((candidate) => {
      const href = "/" + pagePath(candidate).replace(/index\.html$/, "");
      const current = candidate.id && page.id ? candidate.id === page.id : candidate.slug === page.slug;
      return `<a href="${escapeHtml(href)}"${current ? ' aria-current="page"' : ""}>${escapeHtml(candidate.title)}</a>`;
    })
    .join("");
  const logo = safeUrl(site.logoUrl);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(page.title)} · ${escapeHtml(site.name)}</title>
<meta name="description" content="${escapeHtml(text(site.businessArea, 160) || site.name)}"/>
<link rel="stylesheet" href="/assets/site.css"/>
</head>
<body>
<header class="topbar"><div class="container bar">
  <a class="brand" href="/">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(site.name)}"/>` : escapeHtml(site.name)}</a>
  <nav>${navigation}</nav>
</div></header>
<main>${body}</main>
<footer class="footer"><div class="container">
  <span>${escapeHtml(site.name)}</span>
  <span>${escapeHtml(text(site.businessArea, 80))}</span>
</div></footer>
</body>
</html>`;
}

function itemPage(site: RendererSite, item: RendererItem, collector: AssetCollector): string {
  const data = object(item.data);
  const cover = safeUrl(item.coverUrl);
  const details = Object.entries(data)
    .filter(([key, value]) => !["price", "code"].includes(key) && (typeof value === "string" || typeof value === "number") && String(value).trim())
    .slice(0, 16)
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value)}</li>`)
    .join("");
  return shell(site, site.pages, { kind: "CUSTOM", slug: item.slug, title: item.title, blocks: [] }, `<article class="section"><div class="container narrow">
    <p class="back"><a href="${item.kind === "property" ? "/imoveis/" : "/noticias/"}">← Voltar</a></p>
    <h1>${escapeHtml(item.title)}</h1>
    ${cover ? `<img class="cover" src="${escapeHtml(collector.rewrite(cover))}" alt="${escapeHtml(item.title)}"/>` : ""}
    ${item.excerpt ? `<p class="lead">${escapeHtml(item.excerpt)}</p>` : ""}
    ${data.price ? `<p class="price">${escapeHtml(data.price)}</p>` : ""}
    ${details ? `<ul class="details">${details}</ul>` : ""}
    <p><a class="btn btn-primary" href="/#contato">Falar com a equipe</a></p>
  </div></article>`);
}

const color = (value: unknown, fallback: string): string =>
  /^#[0-9a-f]{3,8}$/i.test(typeof value === "string" ? value.trim() : "") ? String(value).trim() : fallback;

export function renderSite(site: RendererSite): RenderResult {
  if (!site.pages.length) throw new Error("O site não tem páginas para publicar.");
  const collector = new AssetCollector(site.assets ?? new Map());
  const files = new Map<string, RenderFile>();
  const ordered = [...site.pages].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const pages = ordered.filter((page) => !page.hidden);
  if (!pages.length) throw new Error("Todas as páginas estão ocultas.");

  const css = `:root{--primary:${color(site.primaryColor, "#0E7A5C")};--accent:${color(site.accentColor, "#6258DF")};--ink:#111827;--muted:#5b6472;--bg:#ffffff;--soft:#f5f7f6}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
img{max-width:100%;height:auto;display:block}a{color:var(--primary)}h1,h2,h3{line-height:1.2;margin:0 0 .6em}
.container{width:min(1120px,92vw);margin:0 auto}.narrow{max-width:780px}
.topbar{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid #e9edf0}
.bar{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:68px;flex-wrap:wrap}
.brand{font-weight:800;font-size:20px;text-decoration:none;color:var(--ink)}.brand img{max-height:44px}
nav{display:flex;gap:18px;flex-wrap:wrap}nav a{text-decoration:none;color:var(--muted);font-weight:600}nav a[aria-current]{color:var(--primary)}
.hero{padding:96px 0;background:var(--primary);background-size:cover;background-position:center;color:#fff}
.hero-inner{max-width:780px}.hero h1{font-size:clamp(32px,5vw,56px)}.hero p{font-size:clamp(17px,2vw,21px);color:rgba(255,255,255,.92)}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.btn{display:inline-block;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700}
.btn-primary{background:var(--accent);color:#fff}.btn-secondary{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.5)}
.section{padding:64px 0}.section.alt{background:var(--soft)}.section h2{font-size:clamp(24px,3vw,34px)}
.grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.card{background:#fff;border:1px solid #e9edf0;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(17,24,39,.05)}
.card img{aspect-ratio:16/10;object-fit:cover;width:100%}.card-body{padding:20px}.card h3{margin-bottom:.35em}.tag{display:inline-block;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase}
.gallery{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}figure{margin:0}figcaption{font-size:13px;color:var(--muted);padding-top:6px}
blockquote{margin:0;background:#fff;border-left:4px solid var(--accent);padding:22px;border-radius:12px}blockquote footer{display:flex;flex-direction:column;font-size:14px;color:var(--muted)}
details{background:#fff;border:1px solid #e9edf0;border-radius:12px;padding:14px 18px;margin-bottom:10px}summary{cursor:pointer;font-weight:700}
.contact{list-style:none;padding:0}.contact li{display:flex;flex-direction:column;gap:4px;padding:14px 0;border-bottom:1px solid #e9edf0}
.row{display:flex;gap:24px;flex-wrap:wrap}.col{flex:1 1 260px}
.cta{background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff}.cta a.btn{background:#fff;color:var(--primary)}
.prose p{margin:0 0 1em}.lead{font-size:19px;color:var(--muted)}.price{font-size:24px;font-weight:800;color:var(--primary)}
.cover{border-radius:16px;margin:18px 0}.back a{text-decoration:none;color:var(--muted)}.details li{margin-bottom:6px}
.footer{padding:28px 0;background:#0f172a;color:#cbd5e1;font-size:14px}.footer .container{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:640px){.hero{padding:64px 0}.section{padding:44px 0}}
`;
  files.set("assets/site.css", { content: Buffer.from(css, "utf8"), contentType: "text/css; charset=utf-8" });

  let pageCount = 0;
  for (const page of pages) {
    const standalone = isStandalone(page.blocks);
    let html: string;
    if (standalone) {
      html = collector.rewrite(standalone);
    } else {
      const body = page.blocks
        .filter((block) => !block.hidden)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((block) => renderBlock(block, site, collector))
        .join("\n");
      html = shell(site, pages, page, body);
    }
    files.set(pagePath(page), { content: Buffer.from(html, "utf8"), contentType: "text/html; charset=utf-8" });
    pageCount++;
  }

  for (const item of site.items || []) {
    if (item.kind !== "post" && item.kind !== "property") continue;
    const base = item.kind === "property" ? "imoveis" : "noticias";
    const html = itemPage(site, item, collector);
    files.set(`${base}/${encodeURIComponent(slugify(item.slug))}/index.html`, { content: Buffer.from(html, "utf8"), contentType: "text/html; charset=utf-8" });
    pageCount++;
  }

  // Listagens de posts/imóveis, para não deixar link quebrado.
  for (const [kind, base, title] of [["post", "noticias", "Notícias"], ["property", "imoveis", "Imóveis"]] as const) {
    const items = (site.items || []).filter((item) => item.kind === kind);
    if (!items.length) continue;
    const html = shell(site, pages, { kind: "CUSTOM", slug: base, title, blocks: [] }, `<section class="section"><div class="container"><h1>${title}</h1>${renderItems({}, kind === "post" ? "posts" : "properties", items, collector)}</div></section>`);
    files.set(`${base}/index.html`, { content: Buffer.from(html, "utf8"), contentType: "text/html; charset=utf-8" });
    pageCount++;
  }

  const notFound = shell(site, pages, { kind: "CUSTOM", slug: "404", title: "Página não encontrada", blocks: [] }, `<section class="section"><div class="container narrow"><h1>Página não encontrada</h1><p>O endereço acessado não existe ou foi movido.</p><p><a class="btn btn-primary" href="/">Voltar ao início</a></p></div></section>`);
  files.set("404.html", { content: Buffer.from(notFound, "utf8"), contentType: "text/html; charset=utf-8" });

  for (const [path, file] of collector.files) {
    if (!files.has(path)) files.set(path, file);
  }

  let totalBytes = 0;
  for (const file of files.values()) totalBytes += file.content.byteLength;
  if (files.size > MAX_FILES) throw new Error(`O site gerou ${files.size} arquivos; o limite configurado é ${MAX_FILES}.`);
  if (totalBytes > MAX_BYTES) throw new Error("O site gerado passou de 80 MB; reduza imagens ou arquivos.");

  return { files, pageCount, assetCount: collector.files.size, totalBytes };
}
