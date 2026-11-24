const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const out = path.join(root, "out");

if (!fs.existsSync(path.join(src, "index.html"))) {
  throw new Error("src/index.html nao encontrado");
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(src, out, { recursive: true });

const html = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.toLowerCase().endsWith(".html")) html.push(path.relative(out, full));
  }
}
walk(out);

require("./build-search-index.cjs");

console.log(`Morbeck x Carvalhinho: ${html.length} paginas HTML geradas em sites/morbeckxcarvalhinho/out`);
