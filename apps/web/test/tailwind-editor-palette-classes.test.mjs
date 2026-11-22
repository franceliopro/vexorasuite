import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const palette = read("src/app/sites/editor/palette.tsx");

const constants = new Map();
for (const match of palette.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g)) constants.set(match[1], match[2]);

const values = [];
for (const match of palette.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/g)) {
  if (match[1] !== undefined) values.push(match[1]);
  else if (match[2] !== undefined) values.push(match[2]);
  else {
    for (const literal of match[3].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[3])) values.push(value);
    }
  }
}
const classes = values.join("\n");
/* Expressões com interpolação aninhada não são totalmente capturadas pelo
   extrator; os literais das constantes também entram na inspeção. */
const inspectable = classes + "\n" + [...constants.values()].join("\n");

test("a paleta do editor não usa classes componente legadas", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|ib-|rw-|ov-|chatbot-|content-card$|primary-button$|secondary-button$|danger-button$|danger-text$|icon-button$)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
  assert.doesNotMatch(palette, /vx-palette/);
});

test("a paleta usa utilities literais e tokens do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
    "flex items-baseline justify-between border-b border-line px-4 py-3.5",
    "m-0 text-base font-bold text-ink",
    "w-full rounded-token-sm border border-line bg-surface-2 px-3.5 py-2 text-catalog-card-title text-ink disabled:cursor-not-allowed disabled:opacity-50",
    "flex min-h-0 flex-col gap-2.5 overflow-y-auto px-4 py-3",
    "m-0 mb-2 text-2xs font-extrabold uppercase tracking-wider text-ink-secondary",
    "grid grid-cols-fm-picker gap-2",
    "flex cursor-grab select-none items-center gap-2 rounded-token-sm border border-line bg-surface px-3.5 py-2.5 text-catalog-card-title text-ink transition-colors hover:border-blue-600 hover:bg-brand-soft active:cursor-grabbing",
    "border-blue-600 bg-brand-soft shadow-token-lg",
    "pointer-events-none cursor-not-allowed opacity-50",
    "inline-flex size-7 shrink-0 items-center justify-center rounded-square border border-line bg-surface-2",
    "min-w-0 truncate",
    "flex flex-col items-center gap-2.5 px-4 py-10 text-ink-secondary",
  ]) {
    assert.ok(inspectable.includes(utility), `falta a utility ${utility}`);
  }
  for (const name of [
    "paletteTw",
    "paletteHeaderTw",
    "paletteTitleTw",
    "paletteCountTw",
    "paletteSearchWrapTw",
    "paletteSearchTw",
    "paletteCategoriesTw",
    "paletteCategoryTw",
    "paletteCategoryTitleTw",
    "paletteGridTw",
    "paletteItemTw",
    "paletteItemDraggingTw",
    "paletteItemDisabledTw",
    "paletteItemIconTw",
    "paletteItemLabelTw",
    "paletteEmptyTw",
    "paletteDisabledTw",
  ]) {
    assert.match(palette, new RegExp(`\\bconst\\s+${name}\\s*=\\s*'[^']+'`), `constante ${name} não é literal completa`);
  }
});

test("a paleta preserva contratos, acessibilidade e ações", () => {
  for (const token of [
    'aria-label="Paleta de blocos"',
    "Carregando blocos…",
    "Nenhum bloco disponível.",
    'placeholder="Buscar bloco…"',
    "Você não tem permissão para adicionar blocos.",
    "Estrutura", "Conteúdo", "Mídia", "Comércio",
    "draggable={!disabled}",
    "writeDragPayload(event.dataTransfer, { kind: 'palette', nodeType: type }, String(type));",
    "onDragStart={(event) => handleDragStart(block.type as NodeType, event)}",
    "onDragEnd={handleDragEnd}",
    "onClick={() => handleAdd(block.type as NodeType)}",
    "title={block.label}",
    "draggingType === block.type ? paletteItemDraggingTw : ''",
    "disabled ? paletteItemDisabledTw : ''",
  ]) {
    assert.ok(palette.includes(token), `paleta perdeu ${token}`);
  }
});
