import test from "node:test";
import assert from "node:assert/strict";
import { createNode, BLOCK_REGISTRY, BLOCK_TYPES } from "../src/app/sites/[siteId]/edit/nodes/registry.ts";
import {
  canReceiveChildren,
  insertNodeAt,
  moveNode,
} from "../src/app/sites/editor/site-tree.ts";

function ids(nodes) {
  return nodes.map((item) => item.id);
}

test("ready-made blocks are registered with editable schemas", () => {
  for (const type of ["hero", "columns", "image-text", "heading"]) {
    assert.ok(BLOCK_TYPES.includes(type), `${type} deve estar no registry`);
    assert.ok(BLOCK_REGISTRY[type].schema.length > 0, `${type} deve ter schema editável`);
  }

  const columns = createNode("columns");
  assert.equal(columns.props.columnCount, 3);
  assert.equal(columns.children.length, 3);
  assert.ok(columns.children.every((child) => child.type === "div"));

  const options = BLOCK_REGISTRY.columns.schema.find((field) => field.key === "columnCount").options;
  assert.deepEqual(options.map((option) => option.value), ["2", "3", "4", "5", "6", "7", "8"]);
});

test("hero and image-text create editable children", () => {
  const hero = createNode("hero");
  assert.deepEqual(hero.children.map((child) => child.type), ["heading", "text", "button"]);
  assert.equal(hero.children[0].props.level, "h1");

  const imageText = createNode("image-text");
  assert.deepEqual(imageText.children.map((child) => child.type), ["image", "div"]);
  assert.deepEqual(imageText.children[1].children.map((child) => child.type), ["heading", "text", "button"]);
});

test("structural containers accept children and allow reordering inside them", () => {
  for (const type of ["section", "container", "div", "header", "footer", "aside", "hero", "columns", "image-text"]) {
    assert.equal(canReceiveChildren(createNode(type)), true, `${type} deve aceitar filhos`);
  }
  assert.equal(canReceiveChildren(createNode("text")), false);

  for (const type of ["div", "header", "footer", "aside"]) {
    const root = createNode("section", {
      children: [createNode(type, { children: [createNode("text", { id: "a" }), createNode("text", { id: "b" })] })],
    });
    const container = root.children[0];
    const reordered = moveNode(root, "b", "a", "before");
    assert.deepEqual(ids(reordered.children[0].children), ["b", "a"], `${type} deve permitir reordenar`);

    const withNew = insertNodeAt(root, createNode("heading"), container.id, "inside");
    assert.equal(withNew.children[0].children.length, 3, `${type} deve permitir inserir filhos`);
  }
});

test("columns cannot receive a node inside its own descendant", () => {
  const root = createNode("section", {
    children: [
      createNode("columns", {
        children: [createNode("div", { children: [createNode("text", { id: "inner" })] })],
      }),
    ],
  });
  const columnsId = root.children[0].id;
  assert.equal(moveNode(root, columnsId, "inner", "inside"), root);
});
