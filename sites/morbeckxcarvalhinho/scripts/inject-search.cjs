const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");

const SEARCH_HTML = `
<section id="site-search" class="site-search" aria-label="Busca no site">
  <form id="site-search-form" role="search">
    <label class="screen-reader-text" for="site-search-input">Buscar no site</label>
    <input type="search" id="site-search-input" placeholder="Buscar..." autocomplete="off">
    <button type="submit">Buscar</button>
  </form>
  <div id="site-search-results" hidden></div>
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

  // Remove a versão anterior para reposicionar sem duplicar.
  html = html.replace(/<section id="site-search"[\s\S]*?<\/section>/i, "");

  // Busca fica dentro da barra lateral, acima do menu PRINCIPAL.
  const sidebar = /<div id="right-sidebar-inner"[^>]*>/i.exec(html);
  if (!sidebar) throw new Error("barra lateral nao encontrada: " + file);
  const insertAt = sidebar.index + sidebar[0].length;
  html = html.slice(0, insertAt) + SEARCH_HTML + html.slice(insertAt);

  if (!html.includes('/assets/js/search.js')) {
    html = html.replace("</body>", SEARCH_SCRIPT + "\n</body>");
  }

  fs.writeFileSync(file, html);
  changed++;
}
console.log(`Busca reposicionada em ${changed} paginas`);
