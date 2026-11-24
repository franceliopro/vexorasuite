const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "out");

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&copy;/gi, "©")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.name.toLowerCase().endsWith(".html")) list.push(full);
  }
  return list;
}

const files = walk(out);
const index = files.map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  let url = "/" + path.relative(out, file).replace(/\\/g, "/").replace(/index\.html$/i, "");
  if (url === "//") url = "/";
  return {
    title,
    url,
    text: visibleText(html).slice(0, 4000),
  };
});

index.sort((a, b) => a.url.localeCompare(b.url, "pt-BR"));
fs.writeFileSync(path.join(out, "assets/js/search-index.json"), JSON.stringify(index));
console.log(`Indice de busca: ${index.length} paginas`);
