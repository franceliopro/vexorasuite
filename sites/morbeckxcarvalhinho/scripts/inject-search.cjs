const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");

const SEARCH_HTML = `
<section id="site-search" class="site-search" aria-label="Busca no site" style="max-width:1100px;margin:0 auto;padding:18px 20px;border-bottom:1px solid #d9d4c5;background:#f4f1e8;">
  <form id="site-search-form" role="search" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <label for="site-search-input" style="font-weight:600;color:#333;">Buscar no site</label>
    <input type="search" id="site-search-input" placeholder="Digite uma palavra..." autocomplete="off" style="flex:1 1 220px;min-width:0;padding:10px 12px;border:1px solid #aaa;border-radius:3px;font-size:16px;">
    <button type="submit" style="padding:10px 18px;background:#a29e6b;color:#fff;border:0;border-radius:3px;font-weight:600;cursor:pointer;">Buscar</button>
  </form>
  <div id="site-search-results" hidden style="margin-top:14px;"></div>
</section>
`;

const SEARCH_SCRIPT = '<script src="/assets/js/search.js"></script>';

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.name.toLowerCase().endsWith(".html")) list.push(full);
  }
  return list;
}

let changed = 0;
for (const file of walk(src)) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes('id="site-search-form"')) continue;
  const closeHeader = html.indexOf("</header>");
  if (closeHeader < 0) throw new Error("header nao encontrado: " + file);
  const at = closeHeader + "</header>".length;
  html = html.slice(0, at) + SEARCH_HTML + html.slice(at);
  html = html.replace("</body>", SEARCH_SCRIPT + "\n</body>");
  fs.writeFileSync(file, html);
  changed++;
}
console.log(`Busca injetada em ${changed} paginas`);
