const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");

function walk(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (entry.name.toLowerCase().endsWith(".html")) list.push(full);
  }
  return list;
}

function clean(html) {
  // Body sem dezenas de classes do WordPress/OceanWP.
  html = html.replace(/<body\b[^>]*>/i, "<body>");

  // Resíduos de funcionalidades que não existem no estático.
  html = html.replace(/<li class="search-toggle-li"[\s\S]*?<\/li>/gi, "");
  html = html.replace(/<div id="search-3"[^>]*>\s*<\/div>/gi, "");
  html = html.replace(/<div id="mobile-menu-search"[^>]*>\s*<\/div>/gi, "");
  html = html.replace(/\s+(?:itemscope|data-height)="[^"]*"/gi, "");
  html = html.replace(/\sitemscope(?=[\s>])/gi, "");
  html = html.replace(/\s+aria-describedby="caption-attachment-\d+"/gi, "");
  html = html.replace(/\sid="(?:attachment|caption-attachment)_\d+"/gi, "");
  html = html.replace(/\sid="caption-attachment-\d+"/gi, "");
  html = html.replace(/\sid=""/g, "");

  // Scripts do tema: substituídos por site.js + search.js.
  html = html.replace(/<script src="\/assets\/js\/(?:jquery\.min|theme\.min|drop-down-mobile-menu\.min|scroll-top\.min)\.js"><\/script>\s*/gi, "");

  // Classes e ids neutralizados.
  const tokens = [
    [/custom-logo-link/g, "banner-link"],
    [/\bcustom-logo\b/g, "banner-img"],
    [/\bwp-caption-text\b/g, "image-caption-text"],
    [/\bwp-caption\b/g, "image-caption"],
    [/\bwp-image-\d+\b/g, ""],
    [/\bsize-(?:thumbnail|medium|medium_large|large|full)\b/g, ""],
    [/\boceanwp-custom-menu\b/g, "side-menu"],
    [/\bocean_custom_menu-\d+\b/g, "side-menu"],
    [/\bwidget-oceanwp-custom-menu\b/g, "side-menu-widget"],
    [/\bcustom-menu-widget\b/g, "side-menu-widget"],
    [/\boceanwp-mobile-menu-icon\b/g, "mobile-menu-icon"],
    [/\boceanwp-text\b/g, "menu-open-text"],
    [/\boceanwp-close-text\b/g, "menu-close-text"],
    [/\bscreen-reader-text\b/g, "visually-hidden"],
    [/\bclr\b/g, "clearfix"],
    [/\bsf-menu\b/g, ""],
    [/\bdropdown-hover\b/g, ""],
    [/\bmobile-right\b/g, ""],
    [/\bmenu-item-type-post_type\b/g, ""],
    [/\bmenu-item-object-page\b/g, ""],
    [/\bmenu-item-home\b/g, ""],
    [/\bmenu-item-\d+\b/g, ""],
    [/\bpage-item-\d+\b/g, ""],
    [/\bpage_item\b/g, ""],
    [/\bcurrent_page_item\b/g, ""],
    [/\bcurrent-menu-item\b/g, "is-current"],
  ];
  for (const [replacement, value] of tokens) html = html.replace(replacement, value);

  html = html.replace(/\sid="menu-item-\d+"/g, "");
  html = html.replace(/id="menu-mnu"/g, 'id="main-menu"');
  html = html.replace(/id="menu-mnu-1"/g, 'id="mobile-menu"');
  html = html.replace(/id="menu-mnu-(\d+)"/g, 'id="side-menu-$1"');
  html = html.replace(/id="ocean_custom_menu-(\d+)"/g, 'id="side-menu-widget-$1"');
  let sideMenuIndex = 0;
  html = html.replace(/\sid="side-menu"/g, () => ` id="side-menu-${++sideMenuIndex}"`);

  // Remove classes duplicadas e espaços gerados pelas substituições.
  html = html.replace(/class="([^"]*)"/g, (match, value) => {
    const seen = new Set();
    const tokens = value.split(/\s+/).filter(Boolean).filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
    return tokens.length ? `class="${tokens.join(" ")}"` : "";
  });
  html = html.replace(/[ \t]{2,}/g, " ");

  return html;
}

let changed = 0;
for (const file of walk(src)) {
  const before = fs.readFileSync(file, "utf8");
  const after = clean(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
  }
}
console.log(`HTML limpo em ${changed} paginas`);
