import AdmZip from "adm-zip";
import sharp from "sharp";

const HTML_EXT = /\.(html?|xhtml)$/i;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf|eot|css|js|mjs|mp4|webm|mp3|wav|glb|gltf|pdf)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const MAX_ENTRIES = 150;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_HTML_BYTES = 600_000;

export type ZipAsset = {
  zipPath: string;        // normalized posix path inside the zip
  folder: string;         // target folder inside the site's asset tree ("/importados/<slug>/assets/img")
  fileName: string;
  ext: string;
  mimeType: string;
  kind: "image" | "file";
  processImage: boolean;  // run through sharp (jpeg/png/webp) → webp
};

export type ZipPage = {
  zipPath: string;
  baseName: string;
  title: string;
  slug: string;
  isHome: boolean;
  html: string;
};

export type ZipSiteInspection = {
  pages: ZipPage[];
  assets: ZipAsset[];
  skipped: string[];
  totalBytes: number;
};

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  css: "text/css", js: "text/javascript", mjs: "text/javascript",
  mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
  glb: "model/gltf-binary", gltf: "model/gltf+json", pdf: "application/pdf",
};

const SKIP_NAMES = /(__MACOSX|\.DS_Store|Thumbs\.db|\.git)/i;
const decodeEntities = (value: string) =>
  String(value || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d) => { try { return String.fromCodePoint(Number(d)); } catch { return " "; } })
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return " "; } });
const stripTags = (value: string) =>
  decodeEntities(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const safeBaseName = (value: string): string => {
  const base = String(value || "pagina").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 60) || "pagina";
};

/** Normaliza um caminho relativo à raiz do zip: remove ./, resolve ../, garante posix limpo. */
export const normalizeZipPath = (path: string): string => {
  const parts = String(path || "").replace(/\\/g, "/").split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") { out.pop(); continue; }
    out.push(part);
  }
  return out.join("/");
};

/** Resolve uma referência (relativa ou absoluta a partir da raiz) a partir de um diretório do zip. */
export const resolveInZip = (dirOfFile: string, ref: string): string => {
  const clean = String(ref || "").trim().split(/[?#]/)[0] || "";
  if (clean.startsWith("/")) return normalizeZipPath(clean.slice(1));
  return normalizeZipPath((dirOfFile ? dirOfFile.replace(/\/?$/, "/") : "") + clean);
};

const extOf = (name: string): string => (/\.([a-z0-9]{2,6})$/i.exec(name)?.[1] || "").toLowerCase();

/** Lê o zip em memória e devolve a inspeção: páginas, assets, itens ignorados. Nada é gravado. */
export function inspectSiteZip(buffer: Buffer, folderRoot: string): ZipSiteInspection {
  let zip: AdmZip;
  try { zip = new AdmZip(buffer); } catch { throw new Error("O arquivo não é um .zip válido. Gere-o novamente (no Windows: clique com o botão direito → Enviar para → Pasta compactada)."); }
  const entries = zip.getEntries().filter(e => !e.isDirectory).filter(e => !SKIP_NAMES.test(e.entryName));
  if (entries.length > MAX_ENTRIES) throw new Error(`O zip tem ${entries.length} arquivos — no máximo ${MAX_ENTRIES}. Envie só as páginas e os assets do site.`);
  const totalBytes = entries.reduce((sum, e) => sum + e.header.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error(`O zip descompactado tem ${Math.round(totalBytes / 1024 / 1024)} MB — no máximo 40 MB. Comprima as imagens ou envie o site em partes.`);

  const pages: ZipPage[] = [];
  const assets: ZipAsset[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const zipPath = normalizeZipPath(entry.entryName);
    if (!zipPath || zipPath.split("/").some(seg => seg === "..")) { skipped.push(entry.entryName); continue; }
    if (entry.header.size > MAX_FILE_BYTES) { skipped.push(zipPath + " (grande demais)"); continue; }
    const ext = extOf(zipPath);

    if (HTML_EXT.test(zipPath)) {
      const raw = entry.getData().toString("utf8");
      if (raw.length > MAX_HTML_BYTES) { skipped.push(zipPath + " (página grande demais)"); continue; }
      const baseName = zipPath.split("/").pop()?.replace(HTML_EXT, "") || "pagina";
      const slug = safeBaseName(baseName);
      const isHome = /^(index|home|inicio)$/i.test(baseName);
      const title = stripTags((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] || /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(raw)?.[1] || baseName)).slice(0, 80) || "Página";
      pages.push({ zipPath, baseName, title, slug: isHome ? "inicio" : slug, isHome, html: raw });
      continue;
    }
    if (ASSET_EXT.test(zipPath)) {
      const fileName = zipPath.split("/").pop() || "arquivo";
      const dirOfFile = zipPath.split("/").slice(0, -1).join("/");
      const folder = normalizeZipPath((folderRoot + "/" + dirOfFile).replace(/\/{2,}/g, "/"));
      const kind: "image" | "file" = IMAGE_EXT.test(zipPath) ? "image" : "file";
      assets.push({
        zipPath,
        folder: "/" + folder,
        fileName: safeBaseName(fileName.replace(/\.[a-z0-9]{2,6}$/i, "")) + (extOf(fileName) ? "." + extOf(fileName) : ""),
        ext,
        mimeType: MIME[ext] || "application/octet-stream",
        kind,
        processImage: kind === "image" && /\.(png|jpe?g|webp)$/i.test(zipPath),
      });
      continue;
    }
    skipped.push(zipPath);
  }

  if (!pages.length) throw new Error("Nenhuma página .html encontrada no zip. Estrutura esperada: index.html + assets/ (ou subpastas com as páginas).");
  return { pages, assets, skipped, totalBytes };
}

/** Reescreve as referências do HTML para os assets locais (ou para âncoras entre páginas do próprio site). */
export function rewriteZipReferences(html: string, filePath: string, pathToId: Map<string, string>, slugByZipPath: Map<string, string>): string {
  const dirOfFile = filePath.split("/").slice(0, -1).join("/");
  const out: { html: string } = { html: html };

  const rewriteUrl = (raw: string): string => {
    const value = String(raw || "").trim();
    if (!value) return value;
    if (/^(https?:|mailto:|tel:|javascript:|data:|#)/i.test(value)) return value;
    const resolved = resolveInZip(dirOfFile, value);
    const hit = pathToId.get(resolved);
    if (hit) return "/api/backend/public/site-assets/" + hit;
    const pageSlug = slugByZipPath.get(resolved);
    if (pageSlug) return "#" + pageSlug;
    return value;
  };

  const rewriteSrcset = (value: string): string =>
    value.split(",").map(part => {
      const seg = part.trim();
      if (!seg) return seg;
      const space = seg.search(/\s/);
      const url = space === -1 ? seg : seg.slice(0, space);
      const rest = space === -1 ? "" : seg.slice(space);
      return rewriteUrl(url) + rest;
    }).join(", ");

  out.html = out.html.replace(/\b(src|href|poster)\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+)/gi, (whole, attr, _q, dq, sq) => {
    const raw = dq ?? sq ?? whole.slice(whole.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
    return `${attr}="${rewriteUrl(raw)}"`;
  });
  out.html = out.html.replace(/\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/gi, (whole, _q, dq, sq) => {
    const raw = dq ?? sq ?? "";
    return `srcset="${rewriteSrcset(raw)}"`;
  });
  out.html = out.html.replace(/url\(\s*('([^']*)'|"([^"]*)"|([^'")]*))\s*\)/gi, (whole, _q, sq, dq, bare) => {
    const raw: string = (sq ?? dq ?? bare ?? "").trim();
    return `url('${rewriteUrl(raw)}')`;
  });
  return out.html;
}

/** Processa um asset de imagem para WebP/normalizado. Assets não-imagem ou não processáveis passam direto. */
export async function processZipAsset(buffer: Buffer, asset: ZipAsset): Promise<{ data: Buffer; mimeType: string; width: number; height: number }> {
  if (!asset.processImage) {
    return { data: buffer, mimeType: asset.mimeType, width: 0, height: 0 };
  }
  try {
    const out = await sharp(buffer, { failOn: "none" }).rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    return { data: out.data, mimeType: "image/webp", width: out.info.width, height: out.info.height };
  } catch {
    return { data: buffer, mimeType: asset.mimeType, width: 0, height: 0 };
  }
}

/** Escolhe um slug "inicio" para a home e garante slugs únicos entre as páginas importadas. */
export function assignZipSlugs(pages: ZipPage[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  const home = pages.find(p => p.isHome);
  if (home) { map.set(home.zipPath, "inicio"); used.add("inicio"); }
  for (const page of pages) {
    if (page.isHome) continue;
    let slug = page.slug || "pagina";
    let candidate = slug, n = 2;
    while (used.has(candidate)) { candidate = slug + "-" + n; n++; }
    map.set(page.zipPath, candidate);
    used.add(candidate);
  }
  return map;
}
