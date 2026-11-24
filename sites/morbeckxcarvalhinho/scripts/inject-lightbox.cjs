const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const tag = '<script src="/assets/js/lightbox.js"></script>';

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
  const before = fs.readFileSync(file, "utf8");
  if (before.includes(tag)) continue;
  if (!before.includes("</body>")) throw new Error("body nao encontrado: " + file);
  const after = before.replace("</body>", tag + "\n</body>");
  fs.writeFileSync(file, after);
  changed++;
}
console.log(`Lightbox adicionado em ${changed} paginas`);
