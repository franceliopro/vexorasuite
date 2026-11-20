import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  appendNode,
  insertNodeAt,
  moveNode,
} from "../src/app/sites/editor/site-tree.ts";
import {
  createHistory,
  pushHistory,
  undo,
  redo,
} from "../src/app/sites/[siteId]/edit/history.ts";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

function node(id, type = "text", children = [], props = {}) {
  return { id, type, props, styles: {}, children };
}

function sampleRoot() {
  return node("root", "section", [
    node("a", "container", [node("a1"), node("a2")]),
    node("b"),
    node("c", "container"),
  ]);
}

function ids(nodes) {
  return nodes.map((item) => item.id);
}

test("insertNodeAt handles append, before, after and inside without mutating", () => {
  const root = sampleRoot();
  const added = node("new");

  assert.deepEqual(ids(appendNode(root, added).children), ["a", "b", "c", "new"]);
  assert.deepEqual(ids(insertNodeAt(root, added, "b", "before").children), ["a", "new", "b", "c"]);
  assert.deepEqual(ids(insertNodeAt(root, added, "b", "after").children), ["a", "b", "new", "c"]);
  assert.deepEqual(ids(insertNodeAt(root, added, "c", "inside").children[2].children), ["new"]);
  assert.deepEqual(ids(root.children), ["a", "b", "c"]);

  // Folha não recebe filhos e a raiz não tem irmãos.
  assert.equal(insertNodeAt(root, added, "b", "inside"), root);
  assert.equal(insertNodeAt(root, added, "root", "before"), root);
  assert.equal(insertNodeAt(root, added, "root", "after"), root);
});

test("moveNode reorders siblings and can move a node into a container", () => {
  const root = sampleRoot();

  const reordered = moveNode(root, "c", "a", "before");
  assert.deepEqual(ids(reordered.children), ["c", "a", "b"]);
  assert.deepEqual(ids(root.children), ["a", "b", "c"]);

  const nested = moveNode(root, "b", "c", "inside");
  assert.deepEqual(ids(nested.children), ["a", "c"]);
  assert.deepEqual(ids(nested.children[1].children), ["b"]);

  const beforeChild = moveNode(root, "b", "a1", "before");
  assert.deepEqual(ids(beforeChild.children[0].children), ["b", "a1", "a2"]);
});

test("moveNode rejects self, root and descendant targets", () => {
  const root = sampleRoot();

  assert.equal(moveNode(root, "a", "a", "after"), root);
  assert.equal(moveNode(root, "root", "b", "after"), root);
  assert.equal(moveNode(root, "a", "a1", "after"), root);
  assert.equal(moveNode(root, "a", "a2", "inside"), root);
});

test("locked nodes and their children cannot be moved into or out of", () => {
  const root = node("root", "section", [
    node("a", "container", [node("a1")], { locked: true }),
    node("b"),
  ]);

  assert.equal(moveNode(root, "a", "b", "after"), root);
  assert.equal(moveNode(root, "a1", "b", "after"), root);
  assert.equal(moveNode(root, "b", "a", "inside"), root);
  assert.equal(insertNodeAt(root, node("new"), "a1", "after"), root);
});

test("a drop through history is undoable and redoable", () => {
  const doc = { version: 1, root: sampleRoot(), meta: { title: "Teste", type: "static" } };
  const movedRoot = moveNode(doc.root, "c", "a", "before");
  assert.notEqual(movedRoot, doc.root);

  const movedDoc = { ...doc, root: movedRoot };
  let history = pushHistory(createHistory(doc), movedDoc);
  assert.deepEqual(ids(history.present.root.children), ["c", "a", "b"]);

  history = undo(history);
  assert.equal(history.present, doc);
  assert.deepEqual(ids(history.present.root.children), ["a", "b", "c"]);

  history = redo(history);
  assert.equal(history.present, movedDoc);
  assert.deepEqual(ids(history.present.root.children), ["c", "a", "b"]);
});

test("palette and layer tree expose native drag payloads", () => {
  const palette = read("src/app/sites/editor/palette.tsx");
  const layerTree = read("src/app/sites/editor/layer-tree.tsx");
  const dnd = read("src/app/sites/editor/dnd.ts");

  assert.match(palette, /draggable=\{!disabled\}/);
  assert.ok(palette.includes("writeDragPayload(event.dataTransfer, { kind: 'palette', nodeType: type }"));
  assert.ok(palette.includes("onDragEnd={handleDragEnd}"));
  assert.ok(layerTree.includes("draggable={draggable}"));
  assert.ok(layerTree.includes("onDragOver={(event) => onDragOverNode(event, node)}"));
  assert.ok(layerTree.includes("onDrop={(event) => onDropNode(event, node)}"));
  assert.ok(layerTree.includes("isDescendantId(root, sourceId, node.id)"));
  assert.ok(dnd.includes("DND_MIME_BLOCK = 'application/x-vexora-block'"));
  assert.ok(dnd.includes("DND_MIME_NODE = 'application/x-vexora-node'"));
});

test("canvas runtime reports drop targets without rebuilding srcdoc on drag", () => {
  const canvas = read("src/app/sites/editor/canvas.tsx");
  const shell = read("src/app/sites/editor/editor-shell.tsx");
  const css = read("src/app/sites/editor/editor.css");

  assert.ok(canvas.includes("useMemo(() => buildIframeHtml(doc), [doc])"));
  assert.ok(canvas.includes("srcDoc={frameHtml}"));
  assert.ok(canvas.includes("data-root="));
  assert.ok(canvas.includes("data-container="));
  assert.ok(canvas.includes("MIME_BLOCK"));
  assert.ok(canvas.includes("post('drag-start'"));
  assert.ok(canvas.includes("post('drag-over'"));
  assert.ok(canvas.includes("post('drop'"));
  assert.ok(canvas.includes("payload: dropPayload(e)"));
  assert.ok(canvas.includes("type: 'drag-source'"));
  assert.ok(canvas.includes("type: 'drop-indicator'"));
  assert.ok(canvas.includes("e.source !== parent"));
  assert.ok(canvas.includes("e.source !== iframeRef.current.contentWindow"));

  assert.ok(shell.includes("onDrop={applyDrop}"));
  assert.ok(shell.includes("dragOverId={dragTarget.targetId}"));
  assert.ok(shell.includes("setDoc(withActiveRoot(nextRoot))"));
  assert.ok(shell.includes("insertNodeAt(activeRoot, node, targetId, position)"));
  assert.ok(shell.includes("moveNode(activeRoot, payload.nodeId, targetId, position)"));
  assert.ok(shell.includes("rootId={activeRoot?.id ?? null}"));

  assert.match(css, /\.vx-palette-item[^{]*\{[^}]*cursor:\s*grab/);
  assert.match(css, /\.vx-layer-tree-node\.is-drop-before/);
  assert.match(css, /\.vx-layer-tree-node\.is-drop-after/);
  assert.match(css, /\.vx-layer-tree-node\.is-drop-inside/);
});
