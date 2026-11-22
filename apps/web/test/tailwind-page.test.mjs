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
  for (const match of src.matchAll(/\bconst\s+[A-Za-z_$][\w$]*\s*:\s*Record<\s*string\s*,\s*string\s*>\s*=\s*\{([\s\S]*?)\}\s*;/g)) {
    for (const literal of match[1].matchAll(/(['"])([^"']*)\1/g)) values.push(literal[2]);
  }
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
    'fixed inset-x-0 bottom-0 z-40 hidden max-md:grid max-md:grid-flow-col max-md:auto-cols-auto max-md:justify-center max-md:gap-x-8 max-md:border-t max-md:border-gray-200 max-md:bg-zinc-50 max-md:px-3 max-md:pb-2 max-md:pt-1',
    "Recolher menu", "Instalar Véxora", "workspaceTabs", "sidebarCollapsed", "applyBrandAll",
    "#1D4ED8", 'aria-controls="mobile-navigation-menu"', 'id="mobile-navigation-menu"',
    'aria-labelledby="sidebar-color-title"', 'id="sidebar-color-title"',
  ]) assert.ok(source.includes(marker), `faltou ${marker}`);

  for (const utility of [
    "min-h-dvh", "bg-zinc-50", "max-w-md", "content-center",
    "rounded-xl", "border-gray-200", "bg-zinc-100", "p-4", "shadow-md",
    "bg-blue-600", "text-blue-950", "hover:bg-blue-700", "disabled:cursor-not-allowed",
    "min-h-10", "text-sm", "text-slate-950", "text-slate-600", "text-sm font-bold",
    "text-xs", "tracking-widest", "bg-blue-50", "rounded-2xl",
    "shadow-lg", "z-50", "border-amber-600", "bg-amber-100", "text-amber-600",
    "border-blue-700", "bg-transparent", "text-blue-700", "text-red-600",
    "max-md:grid-flow-col", "max-md:auto-cols-auto", "max-md:pb-2", "z-40", "max-md:grid",
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
