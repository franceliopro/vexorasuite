// Auditoria determinística do HTML exportado: links e assets locais precisam existir.
// Uso: node scripts/audit-links.cjs out
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2];
if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error("Informe um diretório de saída válido (por exemplo: out).");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.toLowerCase().endsWith(".html")) files.push(full);
  }
  return files;
}

const htmlFiles = walk(root);
if (!htmlFiles.length) throw new Error("Nenhum arquivo HTML encontrado na saída.");

const broken = [];
const checked = new Set();
const attrPattern = /(?:href|src|action|poster|data-src|data-lazy-src|data-href)\s*=\s*(["'])(.*?)\1/gi;
const srcsetPattern = /srcset\s*=\s*(["'])(.*?)\1/gi;
const cssUrlPattern = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;

function inspect(raw, file) {
  const value = raw.trim();
  if (!value || value.startsWith("#") || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|\/\/)/i.test(value)) return;
  const clean = value.split("#")[0].split("?")[0];
  if (!clean) return;
  const key = file + "|" + clean;
  if (checked.has(key)) return;
  checked.add(key);
  const target = clean.startsWith("/")
    ? path.resolve(root, "." + clean)
    : path.resolve(path.dirname(file), clean);
  const withIndex = clean.endsWith("/") ? path.join(target, "index.html") : target;
  const exists =
    fs.existsSync(withIndex) ||
    fs.existsSync(withIndex + ".html") ||
    fs.existsSync(path.join(withIndex, "index.html"));
  if (!exists) broken.push({ file: path.relative(root, file), ref: raw });
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(attrPattern)) inspect(match[2], file);
  for (const match of html.matchAll(srcsetPattern)) {
    for (const entry of match[2].split(",")) inspect(entry.trim().split(/\s+/)[0], file);
  }
  for (const match of html.matchAll(cssUrlPattern)) inspect(match[2], file);
}

for (const file of walk(root).filter((f) => f.toLowerCase().endsWith(".css"))) {
  const css = fs.readFileSync(file, "utf8");
  for (const match of css.matchAll(cssUrlPattern)) inspect(match[2], file);
}

console.log(
  JSON.stringify(
    {
      htmlFiles: htmlFiles.length,
      checkedReferences: checked.size,
      brokenReferences: broken,
    },
    null,
    2,
  ),
);
if (broken.length) process.exitCode = 1;
