import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const layerTree = read("src/app/sites/editor/layer-tree.tsx");

const constants = new Map();
for (const match of layerTree.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']*)'/g)) {
  constants.set(match[1], match[2]);
}

const values = [];
for (const match of layerTree.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/g)) {
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

test("a árvore de camadas não usa classes componente legadas", () => {
  for (const token of inspectable.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|ib-|rw-|ov-|chatbot-|content-card$|primary-button$|secondary-button$|danger-button$|danger-text$|icon-button$)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
  assert.doesNotMatch(layerTree, /vx-layer-tree/);
  assert.doesNotMatch(layerTree, /is-drop-(?:before|after|inside)/);
});

test("a árvore usa utilities literais e tokens do preset, sem remendos", () => {
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
    "flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line",
    "flex items-baseline justify-between border-b border-line px-4 py-3",
    "m-0 text-base font-bold text-ink",
    "text-xs text-ink-secondary",
    "min-h-0 flex-1 overflow-y-auto",
    "m-0 list-none p-0",
    "flex flex-col items-center gap-2 px-4 py-6 text-ink-secondary",
    "py-1 pr-1",
    "relative flex items-center gap-1.5 rounded-token-sm px-2 py-1.5",
    "border border-brand/40 bg-brand-soft",
    "opacity-50",
    "cursor-grabbing",
    "cursor-default",
    "cursor-grab",
    "cursor-pointer",
    "opacity-60",
    "bg-brand-soft outline-2 -outline-offset-2 outline-dashed outline-brand",
    "pointer-events-none absolute inset-x-1.5 z-10 h-0.5 rounded-full bg-brand",
    "-top-px",
    "-bottom-px",
    "inline-flex size-5 shrink-0 items-center justify-center border-0 bg-transparent text-ink-secondary",
    "size-5 shrink-0",
    "flex shrink-0 gap-1",
    "inline-flex size-6.5 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-secondary hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50",
    "min-w-0 flex-1 truncate text-catalog-card-title text-ink",
    "ml-1.5 whitespace-nowrap text-2xs text-ink-secondary",
    "ml-1.5 shrink-0 rounded-2xl bg-danger/10 px-1.5 py-px text-2xs text-danger",
    "ml-4.5",
  ]) {
    assert.ok(inspectable.includes(utility), `falta a utility ${utility}`);
  }
  for (const name of [
    "layerTreeTw",
    "layerTreeHeadTw",
    "layerTreeTitleTw",
    "layerTreeCountTw",
    "layerTreeScrollTw",
    "layerTreeListTw",
    "layerTreeEmptyTw",
    "layerTreeNodeTw",
    "layerTreeNodeContentTw",
    "layerTreeNodeContentSelectedTw",
    "layerTreeNodeContentDraggingTw",
    "layerTreeNodeContentPointerTw",
    "layerTreeNodeContentCursorGrabbingTw",
    "layerTreeNodeContentCursorDefaultTw",
    "layerTreeNodeContentCursorGrabTw",
    "layerTreeNodeContentBusyTw",
    "layerTreeNodeContentDropInsideTw",
    "layerTreeDropLineTw",
    "layerTreeDropBeforeTw",
    "layerTreeDropAfterTw",
    "layerTreeExpandTw",
    "layerTreeExpandPlaceholderTw",
    "layerTreeControlsTw",
    "layerTreeControlButtonTw",
    "layerTreeLabelTw",
    "layerTreeNodeIdTw",
    "layerTreeDisabledTagTw",
    "layerTreeChildrenTw",
  ]) {
    assert.match(layerTree, new RegExp(`\\bconst\\s+${name}\\s*=\\s*'[^']+'`), `constante ${name} não é literal completa`);
  }
});

test("a árvore preserva acessibilidade, drag-and-drop e ações", () => {
  for (const token of [
    'aria-label="Camadas do site"',
    'role="tree"',
    "aria-multiselectable={true}",
    'role="treeitem"',
    'role="group"',
    "aria-selected={isSelected(node.id)}",
    "aria-expanded={hasChildren ? expanded : undefined}",
    "tabIndex={0}",
    "draggable={draggable}",
    "onDragOver={(event) => onDragOverNode(event, node)}",
    "onDrop={(event) => onDropNode(event, node)}",
    "isDescendantId(root, sourceId, node.id)",
    "onToggleVisibility?.(id, v)",
    "onLock?.(id, l)",
    "Somente leitura",
    "style={{ paddingLeft: 16 + depth * 18 }}",
    "dropState === 'inside' ? layerTreeNodeContentDropInsideTw : ''",
    "dropState === 'before'",
    "dropState === 'after'",
    "aria-label={expanded ? 'Colapsar' : 'Expandir'}",
    "aria-label={readOnly ? 'Somente leitura: visibilidade indisponível' : visible ? 'Ocultar' : 'Mostrar'}",
    "aria-label={readOnly ? 'Somente leitura: bloqueio indisponível' : locked ? 'Desbloquear' : 'Bloquear'}",
    "title={readOnly ? 'Somente leitura' : visible ? 'Ocultar bloco' : 'Mostrar bloco'}",
    "title={readOnly ? 'Somente leitura' : locked ? 'Desbloquear bloco' : 'Bloquear bloco'}",
    "onSelect(id, true)",
    "onDragTarget?.(node.id, position)",
    "readDragPayload(event.dataTransfer)",
  ]) {
    assert.ok(layerTree.includes(token), `árvore perdeu ${token}`);
  }
});
