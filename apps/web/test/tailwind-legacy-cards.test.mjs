import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const paths = {
  creative: "src/app/creative-library-workspace.tsx",
  drive: "src/app/drive-manager.tsx",
  company: "src/app/company-switcher.tsx",
  business: "src/app/business-templates.tsx",
  manual: "src/app/manual-content-workspace.tsx",
  alarms: "src/app/personal-alarms.tsx",
  sites: "src/app/sites-workspace.tsx",
};
const sources = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, read(file)]));

function stringConstants(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])([\s\S]*?)\2\s*;/g)) {
    constants.set(match[1], match[3]);
  }
  return constants;
}

function stringMaps(source) {
  const maps = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\}\s*;/g)) {
    const values = new Map();
    for (const pair of match[2].matchAll(/(["'])([^"']*)\1\s*:\s*(["'])([^"']*)\3/g)) {
      values.set(pair[2], pair[4]);
    }
    maps.set(match[1], values);
  }
  return maps;
}

function stringHelpers(source) {
  const helpers = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*([\s\S]*?);\n/g)) {
    if (/["']/.test(match[3])) helpers.set(match[1], match[3]);
  }
  return helpers;
}

function resolvedClassNames(source) {
  const constants = stringConstants(source);
  const maps = stringMaps(source);
  const helpers = stringHelpers(source);

  const resolve = (expression) => {
    let value = expression;
    for (let pass = 0; pass < 5; pass += 1) {
      let changed = false;
      value = value.replace(/\b([A-Za-z_$][\w$]*)\s*\([^()]*\)/g, (whole, name) => {
        if (!helpers.has(name)) return whole;
        changed = true;
        return `(${helpers.get(name)})`;
      });
      value = value.replace(/\b([A-Za-z_$][\w$]*)\s*\[[^\]]+\]/g, (whole, name) => {
        if (!maps.has(name)) return whole;
        changed = true;
        return JSON.stringify([...maps.get(name).values()].join(" "));
      });
      value = value.replace(/\b[A-Za-z_$][\w$]*\b/g, (token) => {
        if (!constants.has(token)) return token;
        changed = true;
        return JSON.stringify(constants.get(token));
      });
      if (!changed) break;
    }
    return [...value.matchAll(/(["'])([^"']*)\1/g)].map((match) => match[2]).join(" ");
  };

  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    values.push(resolve(match[1] ?? match[2] ?? ""));
  }
  return values.join("\n");
}

const classes = Object.values(sources).map(resolvedClassNames).join("\n");
const withoutInlineStyles = Object.values(sources)
  .map((source) => source.replace(/style=\{\{[\s\S]*?\}\}/g, ""))
  .join("\n");

const legacyClass = new RegExp(
  [
    String.raw`\b(?:ov|vx|ib|rw|ps)-[a-z][a-z0-9-]*\b`,
    String.raw`\b(?:content-card|settings-card(?:-[a-z0-9-]+)?|primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b`,
    String.raw`\b(?:creative-[a-z0-9-]+|drive-[a-z0-9-]+|marketing-[a-z0-9-]+|alarms-[a-z0-9-]+|(?<!topbar-)company-[a-z0-9-]+)\b`,
    String.raw`\b(?:simple-workspace|page-heading|page-subtitle|workspace-surface|workspace-actions|workspace-section-heading|workspace-disclosure|workspace-error|module-tabs|ai-admin-fields|workflow-notice|status-pill|status-(?:ready|published|scheduled|draft|muted)|eyebrow|settings-field|settings-toggle|checkbox-line|sites-field-hint|file-symbol)\b`,
  ].join("|"),
  "g",
);

test("os cards legados não voltam nas classes resolvidas", () => {
  const match = classes.match(legacyClass);
  assert.equal(match, null, `classe legada encontrada: ${match?.[0]}`);
});

test("a migração não usa remendos visuais", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = withoutInlineStyles.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
});

test("todas as classes migradas são literais completos do preset", () => {
  assert.ok(classes.includes("rounded-token border border-line bg-surface p-pad text-ink shadow-token-sm"));
  assert.ok(classes.includes("min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600"));
  assert.ok(classes.includes("grid gap-3 rounded-token-sm border border-line bg-surface-2 p-pad"));
  assert.ok(classes.includes("grid grid-cols-1 gap-token lg:grid-cols-2"));
});

test("os contratos de biblioteca e drive permanecem intactos", () => {
  for (const token of [
    'data-testid="creative-delete-button"', "Reconectar Drive", "MarketingStudio",
    'aria-label="Atualizar biblioteca"', 'role="alert"', 'role="status"', 'role="group"',
  ]) assert.ok(sources.creative.includes(token), `biblioteca perdeu ${token}`);
  for (const token of [
    "drive-manager/", "integrations/google/start/drive-manager", 'aria-live="polite"',
    'aria-pressed={layout===id}', "Criar pasta", "Lixeira",
  ]) assert.ok(sources.drive.includes(token), `drive perdeu ${token}`);
});

test("os contratos de empresas, modelos e alarmes permanecem intactos", () => {
  for (const token of [
    'aria-labelledby="company-heading"', 'id="company-heading"', 'aria-label="Gerenciar empresas"',
    'aria-label="Fechar empresas"', 'role="dialog"', 'aria-controls="company-dropdown"',
    'data-testid="company-dropdown"', "createPortal(", "/api/backend/auth/companies",
  ]) assert.ok(sources.company.includes(token), `empresas perdeu ${token}`);
  for (const token of ["Tentar novamente", "business-templates", "settings-field", "Carregar"]) {
    assert.ok(sources.business.includes(token), `modelos perdeu ${token}`);
  }
  for (const token of [
    "/api/backend/reminders/alarms", 'aria-pressed={weekdays.includes(day)}', 'role="switch"',
    'aria-checked={alarm.enabled}', 'aria-label="Alarmes configurados"', "Criar alarme",
    'data-testid="alarms-remove"',
  ]) assert.ok(sources.alarms.includes(token), `alarmes perdeu ${token}`);
});

test("os contratos de sites e conteúdo permanecem intactos", () => {
  for (const token of [
    "/api/backend/sites/hub/requests", 'role="status"', 'role="alert"',
    "animate-spin", "Registrar pedido", "Registrar preview", "Solicitar publicação",
  ]) assert.ok(sources.sites.includes(token), `sites perdeu ${token}`);
  for (const token of [
    "wizard-shell", "site-editor-window", "sites/editor/", "Criar meu primeiro site", "Abrir editor",
  ]) assert.ok(!sources.sites.includes(token), `sites ainda referencia legado: ${token}`);
  for (const token of [
    "/api/backend/drive-manager/", "/api/backend/creative-references/", 'role="dialog"',
    'aria-modal="true"', 'data-testid="marketing-drive-pick"',
    'data-testid="marketing-drive-library-action"', "Publicar manualmente", "Criação com IA",
    "Salvar rascunho", "Gerar rascunho pronto",
  ]) assert.ok(sources.manual.includes(token), `conteúdo perdeu ${token}`);
});
