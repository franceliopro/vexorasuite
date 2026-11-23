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
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const htmlFiles = walk(root);
if (!htmlFiles.length) throw new Error("Nenhum arquivo HTML encontrado na saída.");

const broken = [];
const checked = new Set();
const attrPattern = /(?:href|src|action|poster)\s*=\s*(["'])(.*?)\1/gi;
const srcsetPattern = /srcset\s*=\s*(["'])(.*?)\1/gi;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const candidates = [];
  for (const match of html.matchAll(attrPattern)) candidates.push(match[2]);
  for (const match of html.matchAll(srcsetPattern)) {
    for (const entry of match[2].split(",")) candidates.push(entry.trim().split(/\s+/)[0]);
  }
  for (const raw of candidates) {
    const value = raw.trim();
    if (!value || value.startsWith("#") || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(value)) continue;
    const clean = value.split("#")[0].split("?")[0];
    if (!clean || clean.startsWith("//")) continue;
    const key = file + "|" + clean;
    if (checked.has(key)) continue;
    checked.add(key);
    // Caminhos absolutos (/images/...) são relativos à raiz do site exportado.
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
