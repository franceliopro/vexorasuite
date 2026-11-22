import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const files = {
  palette: read("src/app/sites/editor/palette.tsx"),
  styleInspector: read("src/app/sites/editor/style-inspector.tsx"),
  layerTree: read("src/app/sites/editor/layer-tree.tsx"),
  siteEditorWindow: read("src/app/sites/site-editor-window.tsx"),
};

function looksLikeClasses(value) {
  return /(?:^|\s)(?:flex|grid|inline|fixed|absolute|relative|rounded|border|bg|text|shadow|gap|p|m|w|h|z|min|max|overflow|items|justify|group|dark|disabled|hover|focus|active|cursor|select|animate|ring|accent|basis|list|transition|opacity|font|tracking|truncate|break|shrink|pointer|space)(?:-|\s|$)/.test(value);
}

function classStrings(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\}|`([^`]*)`)/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
    } else if (match[3] !== undefined) {
      values.push(match[3]);
    } else {
      for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    }
  }
  for (const match of source.matchAll(/const\s+[A-Za-z0-9_]+\s*=\s*(['"])([^'"]*)\1/g)) {
    if (looksLikeClasses(match[2])) values.push(match[2]);
  }
  for (const match of source.matchAll(/const\s+[A-Za-z0-9_]+\s*=\s*`([^`]*)`/g)) {
    if (looksLikeClasses(match[1])) values.push(match[1]);
  }
  return values.join("\n");
}

const classes = Object.fromEntries(
  Object.entries(files).map(([name, source]) => [name, classStrings(source)]),
);

test("editor palette, inspector, tree and window use only literal preset utilities", () => {
  const forbidden = [
    ["arbitrary values", /\[[a-zA-Z-]+:\s*[^\]\s]+\]/],
    ["hex color", /#[0-9a-fA-F]{3,8}\b/],
    ["color-mix", /color-mix\(/],
    ["!important", /!important/],
    ["@apply", /@apply/],
    ["@tailwind base", /@tailwind\s+base/],
    ["legacy vx class", /\bvx-[a-z0-9-]+\b/],
  ];
  for (const [name, source] of Object.entries(files)) {
    for (const [label, pattern] of forbidden) {
      const match = classes[name].match(pattern);
      assert.equal(match, null, `${name}: remendo visual (${label}): ${match?.[0]}`);
    }
    assert.doesNotMatch(source, /@apply|@tailwind\s+base|!important|color-mix\(/);
  }
});

test("palette keeps the preset grid and all disabled/dragging states", () => {
  const source = files.palette;
  for (const token of [
    "grid-cols-fm-picker",
    "hover:bg-brand-soft",
    "disabled:opacity-50",
    "cursor-grab",
    "active:cursor-grabbing",
    "size-7",
    "paletteItemTw",
    "paletteItemDisabledTw",
    "paletteItemDraggingTw",
    "draggingType === block.type ? paletteItemDraggingTw : ''",
  ]) assert.ok(source.includes(token), `palette perdeu ${token}`);
  assert.ok(source.includes('aria-label="Paleta de blocos"'));
});

test("style inspector keeps every control, expandable group and its active states", () => {
  const source = files.styleInspector;
  for (const token of [
    "group/style",
    "group-open/style:hidden",
    "group-open/style:inline",
    "grid-cols-2",
    "grid-cols-4",
    "min-h-control",
    "accent-brand",
    "disabled:opacity-60",
    "alignButtonActiveClass",
  ]) assert.ok(source.includes(token), `style inspector perdeu ${token}`);
  assert.ok(source.includes('aria-label="Opacidade"'));
  assert.ok(source.includes('aria-label={`Alinhar à ${align}`}'));
  assert.ok(source.includes('aria-label={`Cor de ${label.toLowerCase()}`}'));
  assert.ok(source.includes("COLOR_PRESETS"));
});

test("layer tree keeps tree semantics, permissions, drag payloads and drop indicators", () => {
  const source = files.layerTree;
  for (const token of [
    'role="tree"',
    "aria-multiselectable={true}",
    "aria-selected={isSelected(node.id)}",
    "aria-expanded={hasChildren ? expanded : undefined}",
    "tabIndex={0}",
    "onToggleVisibility?.(id, v)",
    "onLock?.(id, l)",
    "readDragPayload(event.dataTransfer)",
    "layerTreeDropBeforeTw",
    "layerTreeDropAfterTw",
    "layerTreeNodeContentSelectedTw",
    "Somente leitura",
  ]) assert.ok(source.includes(token), `layer tree perdeu ${token}`);
  assert.ok(source.includes("border-brand/40"));
});

test("site editor window keeps portal layering, permissions and stable contracts", () => {
  const source = files.siteEditorWindow;
  for (const token of [
    "z-50",
    "bg-slate-900",
    "text-white",
    "group-open/settings:border-b-0",
    "min-w-64",
    "max-h-64",
    "secondaryTw",
    'aria-label="Editor minimizado"',
    'aria-label="Domínio do site"',
    "htmlFor={`domain-${siteId}`}",
    "id={`domain-${siteId}`}",
    'role={aiMessage.error ? "alert" : "status"}',
    "readOnly={!canEdit}",
    "aiFeedback={aiMessage}",
  ]) assert.ok(source.includes(token), `site editor window perdeu ${token}`);
  assert.doesNotMatch(source, /style=\{\{/);
});
