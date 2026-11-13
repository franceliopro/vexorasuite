import { BadRequestException } from "@nestjs/common";
import { promises as dns } from "node:dns";

/**
 * Clonagem de sites públicos (WordPress REST API com fallback para HTML).
 * Tudo é best-effort e delimitado: sem tema/CSS de terceiros, sem credenciais,
 * apenas conteúdo público — o tema visual é o do Véxora Sites (editável depois).
 */

export type CloneReport = {
  source: "wordpress" | "html";
  pagesImported: number;
  postsImported: number;
  propertiesImported: number;
  imagesFound: number;
  mediaMapped: number;
};

export type ClonePage = { slug: string; kind: string; title: string; sortOrder: number; blocks: { type: string; content: any; sortOrder: number }[] };
export type CloneItem = { kind: "post" | "property"; slug: string; title: string; excerpt?: string | null; coverUrl?: string | null; data: any; publishedAt: Date | null };

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s);
const storeSlug = (entry: any, fallback: string): string => String(entry?.slug || "") || safeSlugInner(fallback) || "item";
const safeSlugInner = (v: unknown): string => String(v || "").trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const decodeEntities = (s: string) =>
  String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d) => { try { return String.fromCodePoint(Number(d)); } catch { return " "; } })
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return " "; } });

const stripTags = (html: string) =>
  decodeEntities(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "))
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export const safeSlug = safeSlugInner;

const isPrivateIp = (ip: string): boolean => {
  if (ip.includes(":")) {
    const norm = ip.toLowerCase();
    return norm === "::1" || norm.startsWith("fe80") || norm.startsWith("fc") || norm.startsWith("fd") || norm.startsWith("::ffff:127.") || norm.startsWith("::ffff:10.") || norm.startsWith("::ffff:192.168.") || norm.startsWith("::ffff:169.254.") || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(norm);
  }
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
};

/** Só HTTPS em host público — bloqueia loopback, RFC1918, CGNAT e link-local (SSRF). */
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(String(raw || "").trim()); } catch { throw new BadRequestException("URL inválida. Use https://…"); }
  if (url.protocol !== "https:") throw new BadRequestException("A URL do site precisa usar https://");
  if (url.username || url.password) throw new BadRequestException("A URL não pode conter usuário ou senha.");
  if (!url.hostname.includes(".")) throw new BadRequestException("Host inválido.");
  let addresses: { address: string }[];
  try { addresses = await dns.lookup(url.hostname, { all: true }); } catch { throw new BadRequestException("Não foi possível resolver o domínio. Confira se o site está no ar."); }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) throw new BadRequestException("Endereço não permitido: o site precisa estar em um IP público.");
  return url;
}

export async function fetchTextGuarded(startUrl: string, maxBytes: number, timeoutMs: number, accept: string): Promise<{ text: string; finalUrl: string }> {
  let current = startUrl;
  for (let hop = 0; hop < 3; hop++) {
    await assertPublicHttpsUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (compatible; VexoraBot/1.0; +https://vexorasuite.com.br)", accept },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new BadRequestException("O site redirecionou para um endereço vazio.");
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw new BadRequestException("O site respondeu com erro " + response.status + ". Verifique se está no ar.");
    const reader = response.body?.getReader();
    if (!reader) throw new BadRequestException("Resposta vazia do site.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > maxBytes) throw new BadRequestException("O site é grande demais para ser clonado por aqui (limite de segurança).");
        chunks.push(part.value);
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return { text: Buffer.concat(chunks).toString("utf8"), finalUrl: current };
  }
  throw new BadRequestException("O site tem redirecionamentos demais.");
}

const extractMeta = (html: string) => {
  const title = clip(stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""), 80);
  const description = clip(decodeEntities(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']{0,300})["']/i)?.[1] || html.match(/<meta[^>]+content=["']([^"']{0,300})["'][^>]*name=["']description["']/i)?.[1] || ""), 300);
  const ogImage = (html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["'](https:[^"']+)["']/i)?.[1] || html.match(/<meta[^>]+content=["'](https:[^"']+)["'][^>]*property=["']og:image["']/i)?.[1] || "").trim();
  return { title, description, ogImage: /^https:\/\//.test(ogImage) ? ogImage.slice(0, 600) : "" };
};

const extractHeadings = (html: string, max = 8): string[] =>
  [...String(html || "").matchAll(/<h([123])[^>]*>([\s\S]*?)<\/h[123]>/gi)].map((m) => clip(stripTags(m[2] || ""), 140)).filter(Boolean).slice(0, max);

const extractImages = (html: string, baseUrl: string, max = 10): { url: string; caption: string }[] => {
  const urls: string[] = [];
  const push = (raw: string | undefined) => {
    if (!raw) return;
    try {
      const abs = new URL(decodeEntities(raw).trim(), baseUrl).toString();
      if (/^https:\/\//.test(abs) && !/\.(svg|ico|gif)($|\?)/i.test(abs) && abs.length < 600) urls.push(abs);
    } catch { /* ignora */ }
  };
  for (const m of String(html || "").matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (src) { push(src); continue; }
    const srcset = tag.match(/\ssrcset=["']([^"']+)["']/i)?.[1];
    if (srcset) push(srcset.split(",")[0]?.trim().split(/\s+/)[0]);
  }
  push((String(html || "").match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || [])[1]);
  return [...new Set(urls)].slice(0, max).map((url) => ({ url, caption: "" }));
};

const htmlToParagraphs = (html: string, max = 6000): string =>
  clip(
    decodeEntities(String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section|article)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n"))
      .replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    max,
  );

const wpRendered = (value: any): string => (value && typeof value === "object" ? String(value.rendered || "") : String(value || ""));

async function wpGet(origin: string, path: string): Promise<any> {
  const { text } = await fetchTextGuarded(origin + path, 4 * 1024 * 1024, 15000, "application/json");
  try { return JSON.parse(text); } catch { throw new BadRequestException("O WordPress devolveu uma resposta inválida."); }
}

const propertyTypePattern = /imovel|imovei|property|properties|casa|apartamento|chacara|terreno/i;

/** Monta o conteúdo clonado (sem gravar nada). O chamador decide slug/transação. */
export async function buildSiteClone(input: { url: string; area: string; name?: string; whatsapps: { label: string; handle: string }[]; socials: { platform: string; handle: string }[]; kind: "STATIC" | "DYNAMIC" | null }): Promise<{ name: string; kind: "STATIC" | "DYNAMIC"; pages: ClonePage[]; items: CloneItem[]; report: CloneReport }> {  const startUrl = String(input.url || "").trim();
  await assertPublicHttpsUrl(startUrl);
  const { text: homeHtml, finalUrl } = await fetchTextGuarded(startUrl, 1_500_000, 15000, "text/html");
  const origin = new URL(finalUrl).origin;
  const baseUrl = finalUrl;
  const meta = extractMeta(homeHtml);
  const headings = extractHeadings(homeHtml, 8);
  const homeImages = extractImages(homeHtml, baseUrl, 10);
  const waLink = input.whatsapps[0] ? "https://wa.me/" + input.whatsapps[0].handle.replace(/\D/g, "") : "";
  const siteName = clip(String(input.name || meta.title || headings[0] || "Site clonado").trim() || "Site clonado", 80);

  const pages: ClonePage[] = [];
  const items: CloneItem[] = [];
  const report: CloneReport = { source: "html", pagesImported: 0, postsImported: 0, propertiesImported: 0, imagesFound: homeImages.length, mediaMapped: 0 };
  const usedSlugs = new Set<string>(["inicio", "contato", "noticias", "imoveis"]);
  const uniqueSlug = (raw: string) => {
    const base = safeSlug(raw) || "pagina";
    let slug = base, n = 2;
    while (usedSlugs.has(slug)) slug = base + "-" + n++;
    usedSlugs.add(slug);
    return slug;
  };

  const homeBlocks: ClonePage["blocks"] = [];
  homeBlocks.push({ type: "hero", sortOrder: 0, content: { headline: clip(headings[0] || meta.title || siteName, 120), sub: clip(meta.description || "Bem-vindo — conheça nosso trabalho e fale com a equipe.", 300), badge: siteName, ctaLabel: "Quero conversar", ctaUrl: waLink || "#", ...(meta.ogImage || homeImages[0]?.url ? { imageUrl: meta.ogImage || homeImages[0]!.url } : {}) } });
  if (homeImages.length) homeBlocks.push({ type: "gallery", sortOrder: 1, content: { title: "Quem somos na prática", items: homeImages.slice(0, 8) } });

  let wpPages: any[] | null = null;
  let wpPosts: any[] = [];
  let propertyType: { slug: string; rest_base?: string } | null = null;
  let propertyItems: any[] = [];
  // Posts só entram quando fazem sentido: site dinâmico ou área de conteúdo/imóveis.
  const importPosts = input.kind === "DYNAMIC" || ["blog", "imobiliaria", "escola_musica", "escola_teologia", "escola_cursos"].includes(input.area);
  try {
    const fetched = await wpGet(origin, "/wp-json/wp/v2/pages?per_page=40&status=publish&_fields=slug,title,content,menu_order,link&orderby=menu_order&order=asc");
    if (Array.isArray(fetched)) wpPages = fetched;
  } catch { wpPages = null; }
  if (wpPages) {
    report.source = "wordpress";
    try { if (importPosts) { const fetched = await wpGet(origin, "/wp-json/wp/v2/posts?per_page=100&status=publish&_fields=slug,title,excerpt,content,date,link,featured_media&orderby=date&order=desc"); if (Array.isArray(fetched)) wpPosts = fetched; } } catch { wpPosts = []; }
    try {
      const types = await wpGet(origin, "/wp-json/wp/v2/types?_fields=slug,rest_base,name");
      const match = types && typeof types === "object" ? Object.values(types as Record<string, any>).find((t: any) => t && propertyTypePattern.test(String(t.slug || ""))) : null;
      if (match) {
        propertyType = { slug: String(match.slug), rest_base: String(match.rest_base || match.slug) };
        try { const fetched = await wpGet(origin, "/wp-json/wp/v2/" + encodeURIComponent(propertyType.rest_base!) + "?per_page=100&status=publish&_fields=slug,title,excerpt,content,date,link,featured_media&orderby=date&order=desc"); if (Array.isArray(fetched)) propertyItems = fetched; } catch { propertyItems = []; }
      }
    } catch { propertyType = null; }
    // Mapeia mídias em lote (capas)
    const mediaIds = [...new Set([...wpPosts, ...propertyItems].map((i) => Number(i?.featured_media)).filter((n) => Number.isFinite(n) && n > 0))].slice(0, 200);
    const mediaMap = new Map<number, string>();
    for (let chunkStart = 0; chunkStart < mediaIds.length; chunkStart += 100) {
      const chunk = mediaIds.slice(chunkStart, chunkStart + 100);
      try {
        const media = await wpGet(origin, "/wp-json/wp/v2/media?include=" + chunk.join(",") + "&per_page=100&_fields=id,source_url");
        if (Array.isArray(media)) for (const item of media) { const id = Number(item?.id); const src = String(item?.source_url || ""); if (id && /^https:\/\//.test(src)) mediaMap.set(id, src); }
      } catch { /* sem capas */ }
    }
    report.mediaMapped = mediaMap.size;
    // Páginas clonadas
    for (const wpPage of wpPages.slice(0, 40)) {
      const title = clip(stripTags(wpRendered(wpPage?.title)) || "Página", 60);
      const slug = uniqueSlug(String(wpPage?.slug || title));
      const contentHtml = wpRendered(wpPage?.content);
      const text = htmlToParagraphs(contentHtml, 6000);
      const images = extractImages(contentHtml, origin, 8);
      const blocks: ClonePage["blocks"] = [];
      if (text) blocks.push({ type: "richText", content: { title, body: text }, sortOrder: 0 });
      if (images.length) blocks.push({ type: "gallery", content: { title: "Galeria", items: images }, sortOrder: 1 });
      if (!blocks.length) continue;
      const isContact = /contato|fale/i.test(slug) || /contato|fale/i.test(title);
      if (isContact) blocks.push({ type: "contact", content: { title: "Fale com a gente" }, sortOrder: blocks.length });
      pages.push({ slug, kind: isContact ? "CONTACT" : "CUSTOM", title, sortOrder: 0, blocks });
      report.pagesImported += 1;
    }
    // Posts
    for (const post of wpPosts.slice(0, 100)) {
      const title = clip(stripTags(wpRendered(post?.title)) || "Matéria", 160);
      const slug = safeSlug(storeSlug(post, title));
      const finalSlug = uniqueSlug(slug || title);
      items.push({ kind: "post", slug: finalSlug, title, excerpt: clip(stripTags(wpRendered(post?.excerpt)), 300) || null, coverUrl: mediaMap.get(Number(post?.featured_media)) || null, data: { body: htmlToParagraphs(wpRendered(post?.content), 20000), sourceUrl: String(post?.link || ""), publishedAt: post?.date || null }, publishedAt: post?.date ? new Date(post.date) : new Date() });
      report.postsImported += 1;
    }
    // Imóveis (tipo próprio de post)
    for (const imovel of propertyItems.slice(0, 100)) {
      const title = clip(stripTags(wpRendered(imovel?.title)) || "Imóvel", 160);
      const slug = safeSlug(storeSlug(imovel, title));
      const finalSlug = uniqueSlug(slug || title);
      const metaData = imovel?.meta && typeof imovel.meta === "object" ? imovel.meta : {};
      const price = metaData.price ?? metaData.preco ?? metaData.valor ?? (imovel?.acf && typeof imovel.acf === "object" ? imovel.acf.price : undefined);
      items.push({ kind: "property", slug: finalSlug, title, excerpt: clip(stripTags(wpRendered(imovel?.excerpt)), 300) || null, coverUrl: mediaMap.get(Number(imovel?.featured_media)) || null, data: { body: htmlToParagraphs(wpRendered(imovel?.content), 20000), sourceUrl: String(imovel?.link || ""), ...(price !== undefined && price !== null && price !== "" ? { price: String(price).slice(0, 40) } : {}) }, publishedAt: imovel?.date ? new Date(imovel.date) : new Date() });
      report.propertiesImported += 1;
    }
  }

  // Página inicial clonada (hero + galeria + blocos dinâmicos)
  const homeKind: ClonePage["kind"] = "HOME";
  if (report.postsImported > 0) homeBlocks.push({ type: "posts", sortOrder: homeBlocks.length, content: { title: "Últimas matérias" } });
  if (report.propertiesImported > 0) homeBlocks.push({ type: "properties", sortOrder: homeBlocks.length, content: { title: "Imóveis disponíveis" } });
  homeBlocks.push({ type: "contact", sortOrder: homeBlocks.length, content: { title: "Fale com a gente" } });
  const homePage: ClonePage = { slug: "inicio", kind: homeKind, title: "Início", sortOrder: 0, blocks: homeBlocks };

  // Página de contato padrão se o site clonado não trouxe uma
  const hasContact = pages.some((p) => p.kind === "CONTACT");
  const contactPage: ClonePage | null = hasContact ? null : { slug: "contato", kind: "CONTACT", title: "Contato", sortOrder: 0, blocks: [{ type: "richText", sortOrder: 0, content: { title: "Fale com a gente", body: "Envie sua mensagem pelo formulário do site, chame no WhatsApp ou visite o endereço. Nossa equipe responde rápido." } }, { type: "contact", sortOrder: 1, content: { title: "Canais diretos" } }] };

  const postsPage: ClonePage | null = report.postsImported > 0 ? { slug: "noticias", kind: "POSTS", title: "Notícias", sortOrder: 0, blocks: [{ type: "posts", sortOrder: 0, content: { title: "Últimas matérias" } }] } : null;
  const propertiesPage: ClonePage | null = report.propertiesImported > 0 ? { slug: "imoveis", kind: "IMOVEIS", title: "Imóveis", sortOrder: 0, blocks: [{ type: "properties", sortOrder: 0, content: { title: "Imóveis disponíveis" } }] } : null;

  const ordered: ClonePage[] = [homePage, ...(propertiesPage ? [propertiesPage] : []), ...(postsPage ? [postsPage] : []), ...pages, ...(contactPage ? [contactPage] : [])];
  ordered.forEach((page, index) => { page.sortOrder = index; });

  const kind: "STATIC" | "DYNAMIC" = input.kind ?? ((report.postsImported > 0 || report.propertiesImported > 0) ? "DYNAMIC" : "STATIC");
  return { name: siteName, kind, pages: ordered, items, report };
}
