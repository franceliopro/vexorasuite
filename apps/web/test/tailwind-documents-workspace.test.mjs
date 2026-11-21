import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const docs = read("src/app/documents-workspace.tsx");
const config = read("tailwind.config.ts");

/** Só usos em className entram na varredura; dados, hooks e aria ficam de fora. */
const classes = [...docs.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
  .map((m) => m[1] ?? m[2] ?? "")
  .join("\n");

const legadas = [
  "documents-workspace", "creative-heading", "workspace-actions", "primary-button",
  "secondary-button", "text-button", "docs-error", "docs-notice", "docs-tabs",
  "docs-grid", "docs-list", "docs-list-head", "docs-template-item",
  "docs-template-actions", "docs-icon-btn", "danger", "docs-empty", "docs-detail",
  "docs-hint", "docs-generate", "docs-form", "docs-form-head", "docs-required",
  "docs-actions", "docs-preview", "docs-preview-actions", "docs-document", "docs-send",
  "docs-history", "docs-history-item", "docs-editor-window", "docs-editor-frame",
  "docs-editor", "docs-editor-head", "docs-editor-scroll", "docs-variables",
  "docs-variable-row", "docs-required-toggle", "active",
];

test("o workspace de Documentos não usa classes componente legadas", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
  assert.equal(/className="[^"]+"/.test(docs), false, "className literal de componente permaneceu");
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /!important/, /@apply/, /color-mix\(/]) {
    const match = docs.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  const hexEmClasse = [...docs.matchAll(/className="[^"]*#[0-9a-fA-F]{3,8}/g)];
  assert.equal(hexEmClasse.length, 0, "hex direto em classe");
  for (const utility of [
    "grid min-w-0 content-start gap-token",
    "flex flex-wrap gap-1.5 print:hidden",
    "grid grid-cols-docs-grid items-start gap-4 rw-wide:grid-cols-1",
    "m-0 max-h-docs-document overflow-auto whitespace-pre-wrap rounded-docs-card border border-line bg-surface p-docs-pad font-ui text-docs-document text-ink",
    "fixed inset-0 z-docs-editor bg-surface",
    "grid h-full w-full grid-rows-docs-editor bg-surface",
    "grid grid-cols-docs-variable items-center gap-1.5 ov-tablet:grid-cols-2",
    "bg-blue-600 px-brand-pad text-body font-bold text-blue-50",
  ]) {
    assert.ok(docs.includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos de acessibilidade de Documentos permanecem intactos", () => {
  for (const contrato of [
    'role="alert"',
    'role="status"',
    'role="tablist"',
    'aria-label="Tipo de documento"',
    'role="tab"',
    "aria-selected={kind === item.id}",
    "aria-selected={view === \"history\"}",
    'role="button"',
    'aria-label="Atualizar"',
    'aria-label="Editar modelo"',
    'aria-label="Excluir modelo"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby="docs-template-title"',
    'id="docs-template-title"',
    'role="region"',
    'aria-label="Campos do modelo"',
    'aria-label="Rótulo da variável"',
    'aria-label="Chave da variável"',
    'aria-label="Tipo"',
    'aria-label="Remover variável"',
    'aria-hidden="true"',
    "tabIndex={0}",
  ]) {
    assert.ok(docs.includes(contrato), `contrato ausente: ${contrato}`);
  }
});

test("os tokens de Documentos do preset preservam as medidas migradas", () => {
  for (const token of [
    '"docs-card"', '"docs-empty"', '"docs-field"', '"docs-alert"', '"docs-icon"',
    '"docs-editor-x"', '"docs-pad"', '"docs-safe-top"', '"docs-safe-bottom"',
    '"docs-name"', '"docs-meta"', '"docs-hint"', '"docs-grid"', '"docs-generate"',
    '"docs-variable"', '"docs-editor"', '"docs-document"', '"docs-send"',
    '"docs-frame"',
  ]) {
    assert.ok(config.includes(token), `token ausente no preset: ${token}`);
  }
  assert.equal(config.includes("color-mix("), false, "color-mix não pode voltar ao preset");
  assert.equal(/#2E7CF6/i.test(docs), false, "azul fixo não pode reaparecer na fatia");
});
