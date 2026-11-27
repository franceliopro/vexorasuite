import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const richPromptSource = readFileSync(
  new URL("../src/app/rich-prompt-editor.tsx", import.meta.url),
  "utf8",
);
const adminSource = readFileSync(
  new URL("../src/app/platform-admin-workspace.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../src/app/vexora.css", import.meta.url),
  "utf8",
);

const SOURCES = [
  ["rich-prompt-editor.tsx", richPromptSource],
  ["platform-admin-workspace.tsx", adminSource],
];

const FORBIDDEN = [
  /\[[a-z-]+:\s*[^]\s]+\]/g,
  /#[0-9a-fA-F]{3,8}\b/g,
  /color-mix\(/g,
  /!important/g,
  /@apply/g,
  /@tailwind\s+base/g,
];

for (const [name, source] of SOURCES) {
  test(`${name}: no legacy component classes`, () => {
    for (const pattern of [
      /\bvx-rich-[\w-]+/g,
      /\bvx-toolbar-[\w-]+/g,
      /\bvx-field-notice\b/g,
      /\bplatform-admin-[\w-]+/g,
    ]) {
      assert.equal(source.match(pattern)?.length ?? 0, 0);
    }
  });

  test(`${name}: no forbidden Tailwind patches`, () => {
    for (const pattern of FORBIDDEN) {
      assert.equal(source.match(pattern)?.length ?? 0, 0);
    }
  });
}

test("rich prompt editor uses preset utilities", () => {
  for (const utility of [
    "bg-surface",
    "bg-surface-2",
    "bg-surface-3",
    "border-line",
    "border-line-strong",
    "text-ink",
    "text-ink-secondary",
    "text-warning",
    "focus-within:border-blue-600",
    "focus-visible:outline-blue-600",
    "text-blue-50",
  ]) {
    assert.ok(richPromptSource.includes(utility), `falta a utility ${utility}`);
  }
});

test("platform admin workspace uses preset utilities", () => {
  for (const utility of [
    "bg-surface",
    "bg-surface-2",
    "border-line",
    "text-ink",
    "text-ink-secondary",
    "text-blue-800",
    "text-red-600",
    "max-lg:grid-cols-1",
    "max-md:flex-col",
    "max-md:grid-cols-2",
    "grid-rows-docs-editor",
    "grid-cols-catalog-grid",
  ]) {
    assert.ok(adminSource.includes(utility), `falta a utility ${utility}`);
  }
});

test("rich prompt editor preserves editor contracts", () => {
  for (const expected of [
    'role="toolbar"',
    'role:"textbox"',
    '"aria-multiline":"true"',
    "aria-pressed={!!item.active}",
    'role="status"',
    "current.current.onChange(markdown)",
    "data-placeholder",
    "content:attr(data-placeholder)",
    "data-rich-content",
    "VexoraDialog",
    "Concluir edição",
  ]) {
    assert.ok(richPromptSource.includes(expected), `o prompt perdeu ${expected}`);
  }
  assert.doesNotMatch(richPromptSource, /Rascunho/);
  assert.ok(richPromptSource.includes("var(--tx)"));
  assert.ok(richPromptSource.includes("var(--ln2)"));
  assert.ok(richPromptSource.includes("var(--primary)"));
});

test("platform admin workspace preserves state and accessibility contracts", () => {
  for (const expected of [
    'role="tablist"',
    'role="tab"',
    "aria-selected={",
    'role="alert"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label="Arquivar plano"',
    'aria-label="Abrir empresa"',
    'aria-label="Fechar"',
    'role="group"',
    "PLAN_PRESETS",
    "confirmArchive",
    "editorOpen",
    "saving",
    "zIndex: 2100",
    "minWidth: 980",
  ]) {
    assert.ok(adminSource.includes(expected), `o admin perdeu ${expected}`);
  }
});

test("vexora.css has no orphaned component classes", () => {
  for (const pattern of [
    /\.vx-rich-[\w-]+/g,
    /\.vx-toolbar-[\w-]+/g,
    /\.vx-field-notice\b/g,
    /\.platform-admin-[\w-]+/g,
  ]) {
    assert.equal(cssSource.match(pattern)?.length ?? 0, 0);
  }
});
