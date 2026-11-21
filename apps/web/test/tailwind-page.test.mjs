import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("src/app/page.tsx");

/** Constantes TW referenciadas por className contam como classes (parser dos guards). */
function classValues(src) {
  const constants = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
    }
  }
  return values.join("\n");
}
const classes = classValues(source);
const hasClass = (name) => new RegExp(`(^|\\s)${name.replace(/[-]/g, "\\-")}($|\\s)`).test(classes);

test("a home não usa mais as classes do vexora.css legado", () => {
  const forbidden = [
    "auth-panel", "auth-screen", "brand-color-picker", "brand-contrast-badge",
    "crumb-slash", "icon-button", "theme-toggle", "nav-submenu-panel", "nav-parent",
    "primary-button", "secondary-button", "text-button", "settings-back-link",
    "settings-field", "settings-hint", "sidebar-color-actions", "sidebar-color-cancel",
    "sidebar-color-close", "sidebar-color-error", "sidebar-color-field",
    "sidebar-color-footer", "sidebar-color-picker", "sidebar-color-popover-footer",
    "sidebar-color-popover-header", "sidebar-color-warning", "content-card",
    "module-placeholder", "module-placeholder-icon", "page-heading", "placeholder-status",
    "mobile-inbox-nav", "is-ok", "is-warn",
  ];
  for (const name of forbidden) assert.equal(hasClass(name), false, `classe legada: ${name}`);
  assert.doesNotMatch(source, /className="[^"]*sidebar-color-popover/);
  assert.match(source, /closest\('\[data-testid="sidebar-color-popover"\]'\)/);
});

test("a home mantém as utilities e os marcadores funcionais", () => {
  for (const marker of [
    'className="sidebar-collapse"', 'className="persistent-module-tabs"',
    'data-testid={active === "Visão geral" ? "ov-dock" : undefined}',
    'fixed inset-x-0 bottom-0 z-dock hidden ov-tablet:grid ov-tablet:grid-cols-ov-dock',
    "Recolher menu", "Instalar Véxora", "workspaceTabs", "sidebarCollapsed", "applyBrandAll",
    "#1D4ED8", 'aria-controls="mobile-navigation-menu"', 'id="mobile-navigation-menu"',
    'aria-labelledby="sidebar-color-title"', 'id="sidebar-color-title"',
  ]) assert.ok(source.includes(marker), `faltou ${marker}`);

  for (const utility of [
    "min-h-dvh", "bg-vx-page", "max-w-md", "content-center",
    "rounded-token-lg", "border-line", "bg-surface-2", "p-pad", "shadow-token",
    "bg-blue-600", "text-blue-900", "hover:bg-blue-700", "disabled:cursor-not-allowed",
    "min-h-control", "text-body", "text-ink", "text-ink-secondary", "text-nav",
    "text-2xs", "tracking-fin-eyebrow", "bg-blue-100", "rounded-token-xl",
    "shadow-vx-popover", "z-popover", "border-warning", "bg-warning-soft", "text-warning",
    "border-success", "bg-success-soft", "text-success", "text-danger",
    "grid-cols-ov-dock", "pb-ov-dock-pb", "z-dock", "ov-tablet:grid",
  ]) assert.ok(classes.includes(utility), `falta a utility ${utility}`);
});

test("a home não tem remendos visuais e as constantes TW estão declaradas", () => {
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /color-mix\(/, /!important/, /@apply/, /@tailwind\s+base/]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo: ${match?.[0]}`);
  }
  const declared = new Set([...source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/g)].map((m) => m[1]));
  const referenced = new Set();
  for (const m of source.matchAll(/className=\{([^}]*)\}/g)) {
    for (const id of m[1].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (/^(true|false|null|undefined|active|ok|item|value|theme|session|menuOpen|sidebarCollapsed)$/.test(id[1])) continue;
      referenced.add(id[1]);
    }
  }
  const missing = [...referenced].filter((name) => /Tw$|^(primaryButton|secondaryButton)$/.test(name) && !declared.has(name));
  assert.deepEqual(missing, [], `constantes não declaradas: ${missing.join(", ")}`);
});
