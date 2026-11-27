import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const ops = read("src/app/operations-settings.tsx");
const config = read("tailwind.config.ts");

/** Constantes TW referenciadas por className (o parser canônico não as abre). */
const constantes = Object.fromEntries(
  [...ops.matchAll(/^const (\w+Tw|\w+Button|tab\w+) = "([^"]*)";$/gm)].map((m) => [m[1], m[2]]),
);
const resolver = (termo) => constantes[termo] ?? termo.replace(/^"|"$/g, "");
const resolvido = ops.replace(/className=\{([^{}]*)\}/g, (_, expr) => {
  const partes = expr.split("?").map((parte) => parte.trim());
  if (partes.length === 2 && !expr.includes("wcagRatio")) {
    const [sim, nao] = partes[1].split(":").map((parte) => resolver(parte.trim()));
    return ` className="${resolver(partes[0])} ${sim} ${nao}"`;
  }
  if (expr.includes("wcagRatio") || expr.includes("logoShape")) {
    return ` className="${[...expr.matchAll(/\b(\w+Tw)\b/g)].map((m) => resolver(m[1])).join(" ")}"`;
  }
  return ` className="${resolver(expr.trim())}"`;
});

/** Só as classes — data-testid, ids, aria-* e cores de dados não são classes componente. */
const semDados = resolvido
  .replace(/style=\{\{[^}]*\}\}/g, "")
  .replace(/"#[0-9a-fA-F]{3,8}"/g, '""');
const classes = [...semDados.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).join("\n");

/** Classes componente removidas desta fatia (sufixos crm, ov, ib do preset são utilities). */
const legadas = [
  "settings-workspace", "settings-heading", "settings-tabs", "settings-stack", "settings-card",
  "settings-card-heading", "settings-icon", "settings-muted", "settings-button-row", "settings-field",
  "settings-feedback", "settings-danger-card", "settings-inline-heading", "settings-toggle",
  "settings-danger-copy", "settings-hint", "settings-grid", "settings-grid-item", "settings-quarter-item",
  "settings-full-item", "settings-group-list", "settings-group-option", "organization-settings-grid",
  "organization-card", "organization-form-grid", "organization-form-wide", "organization-field-hint",
  "brand-settings-card", "brand-preview", "brand-subsection", "brand-upload", "brand-file-button",
  "brand-field-grid", "brand-color", "brand-sidebar", "brand-contrast-badge", "brand-save-row",
  "brand-name-toggle", "eyebrow", "danger-button", "primary-button", "secondary-button", "text-button",
  "active", "is-ok", "is-warn", "round", "square", "rectangular",
];

test("Configurações não usam classes componente", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /!important/,
    /@apply/,
  ]) {
    const match = semDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  /** Hex só em dados (cor da marca, contraste) — nunca em classes. */
  const hexEmClasse = [...semDados.matchAll(/className="[^"]*#[0-9a-fA-F]{3,8}/g)];
  assert.equal(hexEmClasse.length, 0, "hex direto em classe");
  for (const utility of [
    "grid min-w-0 grid-cols-1 content-start gap-token",
    "text-h1 font-heading text-slate-950",
    "rounded-token-sm border border-red-600 bg-red-100",
    "rounded-token-sm border border-emerald-600 bg-emerald-100",
    "grid-cols-org-form",
    "grid-cols-settings",
    "grid-cols-settings-upload",
    "grid-cols-settings-sidebar",
    "h-settings-icon w-settings-icon",
    "rounded-settings-icon",
    "h-settings-logo w-settings-logo",
    "min-h-settings-stage",
    "max-w-settings-name",
    "max-h-group-list",
    "rounded-settings-swatch",
    "grid grid-cols-1 gap-3 md:grid-cols-2",
    "grid grid-cols-1 gap-3 md:grid-cols-settings-upload",
  ]) {
    assert.ok(resolvido.includes(utility), `falta a utility ${utility}`);
  }
});

test("as abas, feedbacks e ações preservam os contratos", () => {
  for (const hook of [
    'role="tablist"', 'aria-label="Categorias de configuração"',
    'role="tabpanel"', 'aria-labelledby={"settings-tab-"+key}',
    'id={"settings-tab-"+key}', 'id={"settings-panel-"+key}',
    'role="alert"', 'role="status"',
    'aria-label="Fechar erro"', 'aria-label="Fechar aviso"',
    'aria-label="Código HEX da cor"',
  ]) {
    assert.ok(ops.includes(hook), `perdeu ${hook}`);
  }
  for (const acao of [
    "onClick={()=>void verifyMail()}", "onClick={()=>void sendMailTest()}",
    "onClick={()=>void saveOrganization()}", "onClick={()=>void saveBrand()}",
    "onClick={()=>void saveGroups()}", "onClick={()=>void purgeTenant()}",
    "onClick={()=>void loadInitialSettings()}",
    "onClick={()=>void resetPlatformEnvironment(false)}",
    "onClick={()=>void resetPlatformEnvironment(true)}",
    "onClick={()=>void deleteSelectedCompany()}",
  ]) {
    assert.ok(ops.includes(acao), `perdeu ${acao}`);
  }
  assert.ok(ops.includes("applyBrandAll(next,document.documentElement.dataset.theme)"));
  assert.ok(ops.includes("wcagRatio(brand.sidebarBackground"));
});

test("as medidas da fatia vivem no preset", () => {
  for (const token of [
    '"settings-icon": "34px"',
    '"settings-logo": "76px"',
    '"settings-stage": "132px"',
    '"settings-name": "180px"',
    '"group-list": "300px"',
    '"settings-icon": "9px"',
    '"settings-swatch": "10px"',
    '"settings": "repeat(auto-fit, minmax(min(100%, 340px), 1fr))"',
    '"org-form": "repeat(auto-fit, minmax(220px, 1fr))"',
    '"settings-upload": "repeat(3, minmax(0, 1fr))"',
    '"settings-sidebar": "repeat(auto-fit, minmax(220px, 1fr))"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});
