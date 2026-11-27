#!/usr/bin/env node
/**
 * Auditoria determinística do HTML gerado.
 * Verifica arquivos essenciais, links internos, assets locais e URLs do sitemap.
 * Uso: node scripts/audit-links.mjs dist
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const dist = resolve(process.argv[2] || "dist");

if (!existsSync(dist)) {
  console.error(`[audit] Diretório não encontrado: ${dist}`);
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const required = ["index.html", "404.html", "sitemap.xml", "robots.txt"];
const missingRequired = required.filter((file) => !existsSync(join(dist, file)));
if (missingRequired.length) {
  console.error(`[audit] Arquivos obrigatórios ausentes: ${missingRequired.join(", ")}`);
  process.exit(1);
}

const htmlFiles = walk(dist).filter((file) => file.endsWith(".html"));
const problems = [];
let checked = 0;

function toFilesystemPath(raw, fromFile) {
  let value = raw.split("#")[0].split("?")[0].trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (/^(https?:)?\/\//i.test(value)) return null;
  if (/^(mailto:|tel:|data:|javascript:)/i.test(value)) return null;

  const target = value.startsWith("/")
    ? join(dist, value)
    : join(relative(dist, fromFile), "..", value);
  const clean = resolve(dist, target);

  if (!clean.startsWith(dist + sep) && clean !== dist) {
    problems.push(`fora de dist: ${raw}`);
    return null;
  }

  const candidates = [clean];
  if (!clean.split(sep).pop()?.includes(".")) {
    candidates.push(join(clean, "index.html"));
    candidates.push(`${clean}.html`);
  } else if (clean.endsWith(".html")) {
    candidates.push(join(clean, "index.html"));
  }

  const found = candidates.find((candidate) => existsSync(candidate));
  checked += 1;
  if (!found) problems.push(`arquivo ausente: ${raw}`);
  return found ?? null;
}

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const attrs = /\b(?:href|src|action)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrs)) {
    toFilesystemPath(match[1], file);
  }
}

const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
for (const match of sitemap.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
  try {
    const pathname = new URL(match[1].trim()).pathname;
    toFilesystemPath(pathname, join(dist, "index.html"));
  } catch {
    problems.push(`URL inválida no sitemap: ${match[1]}`);
  }
}

const robots = readFileSync(join(dist, "robots.txt"), "utf8");
if (!/Sitemap:\s*https:\/\//.test(robots)) {
  problems.push("robots.txt sem Sitemap absoluto HTTPS");
}

if (problems.length) {
  console.error(`[audit] ${problems.length} problema(s) encontrado(s):`);
  for (const problem of [...new Set(problems)].slice(0, 40)) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(
  `[audit] OK — ${htmlFiles.length} páginas HTML, ${checked} links/assets internos verificados.`,
);
