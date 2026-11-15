export type MirrorRef = { raw: string; kind: "img" | "css" | "js" | "font" | "media" | "other" };

const SKIP = /^(data:|about:|javascript:|mailto:|tel:|\/\/)$/i;

/** Extrai referências a assets de um HTML (img, source, link, script, url() em <style>/style=). */
export function extractAssetRefs(html: string): MirrorRef[] {
  const refs: MirrorRef[] = [];
  const seen = new Set<string>();
  const push = (raw: string, kind: MirrorRef["kind"]) => {
    const value = String(raw || "").trim();
    if (!value || value.length > 500 || SKIP.test(value)) return;
    if (seen.has(value)) return;
    seen.add(value);
    refs.push({ raw: value, kind });
  };
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1] ?? "", "img");
  for (const m of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of (m[1] ?? "").split(",")) push(part.trim().split(/\s+/)[0] ?? "", "img");
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    if (/rel\s*=\s*["']?(stylesheet|icon|shortcut icon|apple-touch-icon|preload)/i.test(tag)) push(href, "font");
  }
  for (const m of html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1] ?? "", "js");
  for (const m of html.matchAll(/<video\b[^>]*?\bposter\s*=\s*["']([^"']+)["']/gi)) push(m[1] ?? "", "media");
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) push(m[1] ?? "", "img");
  return refs;
}

/** Resolve uma referência (possivelmente relativa) contra uma base. Devolve null se inválida. */
export function resolveAssetUrl(ref: string, base: string): string | null {
  try { const u = new URL(ref, base); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; }
}

/** Nome de arquivo plausível a partir de uma URL (para o relink manual por pasta). */
export function assetFileNameOf(url: string): string {
  try { const u = new URL(url); const base = u.pathname.split("/").filter(Boolean).pop() || "arquivo"; return base.split("?")[0] || "arquivo"; } catch { return "arquivo"; }
}

/** Substitui todas as ocorrências de `from` por `to` numa string. */
export function replaceAll(haystack: string, from: string, to: string): string {
  if (!from) return haystack;
  return haystack.split(from).join(to);
}
