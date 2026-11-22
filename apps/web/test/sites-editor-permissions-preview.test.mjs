import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const windowSource = read("src/app/sites/site-editor-window.tsx");
const shell = read("src/app/sites/editor/editor-shell.tsx");
const inspector = read("src/app/sites/editor/inspector.tsx");
const contracts = read("src/app/sites/editor/contracts.ts");
const layerTree = read("src/app/sites/editor/layer-tree.tsx");
const canvas = read("src/app/sites/editor/canvas.tsx");
const css = read("src/app/sites/editor/editor.css");
const workspace = read("src/app/sites-workspace.tsx");
const previewPage = read("src/app/sites/preview/[token]/page.tsx");
const previewLayout = read("src/app/sites/preview/[token]/layout.tsx");

test("saving and publishing are transient states, not a permission denial", () => {
  assert.ok(!windowSource.includes("disabled={saving || publishing}"));
  assert.ok(windowSource.includes("readOnly={!canEdit}"));
  assert.ok(windowSource.includes("saving={saving}"));
  assert.ok(windowSource.includes("publishing={publishing}"));
  assert.ok(workspace.includes("canEdit={canManage}"));

  assert.ok(shell.includes("readOnly: boolean"));
  assert.ok(shell.includes("Salvando…"));
  assert.ok(shell.includes("Publicando…"));
  assert.ok(!shell.includes("Edição bloqueada — sem permissão para alterar este site."));
  assert.ok(!inspector.includes("Edição bloqueada — sem permissão para alterar este bloco."));
  assert.ok(!layerTree.includes("Edição bloqueada — sem permissão."));
  assert.ok(inspector.includes("Somente leitura"));
  assert.ok(layerTree.includes("Somente leitura"));
});

test("AI patch feedback is visible outside the collapsed settings", () => {
  const feedbackIndex = windowSource.indexOf("{aiMessage ? (");
  const settingsIndex = windowSource.indexOf("<details className={detailsClass}>");
  assert.ok(feedbackIndex > -1, "window must render the AI result");
  assert.ok(settingsIndex > -1, "settings must remain collapsible");
  assert.ok(feedbackIndex < settingsIndex, "AI feedback must not live inside collapsed settings");

  assert.ok(windowSource.includes("aiFeedback={aiMessage}"));
  assert.ok(inspector.includes("setAiPanelOpen(true)"));
  assert.ok(contracts.includes("INSPECTOR_AI_FEEDBACK_TEST_ID = 'vx-inspector-ai-feedback'"));
  assert.ok(inspector.includes("data-testid={INSPECTOR_AI_FEEDBACK_TEST_ID}"));
  assert.ok(inspector.includes("patch; revise e salve"));
});

test("temporary preview has its own visible address and copy action", () => {
  assert.ok(windowSource.includes("Ver prévia temporária"));
  assert.ok(windowSource.includes("navigator.clipboard.writeText(previewLink.url)"));
  assert.ok(windowSource.includes("/document/preview"));
  assert.ok(
    windowSource.includes("/sites/preview/${encodeURIComponent(token)}"),
    "the editor must open the web preview page, not the raw API path",
  );
  assert.ok(previewPage.includes("/api/backend/public/sites/preview/${encodeURIComponent(token)}"));
  assert.ok(previewPage.includes("não publicado"));
  assert.ok(previewPage.includes("formulários desativados"));
  assert.ok(previewLayout.includes("index: false, follow: false"));
});

test("fullscreen canvas escapes the editor through a body portal", () => {
  assert.ok(canvas.includes("createPortal("));
  assert.ok(canvas.includes("document.body,"));
  assert.ok(canvas.includes("event.key === 'Escape'"));
  assert.ok(canvas.includes("document.body.style.overflow = 'hidden'"));
  assert.ok(canvas.includes("srcDoc={frameHtml}"));

  const fullscreenRules = [...css.matchAll(/\.vx-canvas-fullscreen-portal\s*\{([^}]*)\}/g)].map(
    (match) => match[1],
  );
  const fullscreenRule = fullscreenRules.find((rule) => rule.includes("position:")) ?? "";
  assert.match(fullscreenRule, /position:\s*fixed/);
  assert.match(fullscreenRule, /inset:\s*0/);
  assert.match(fullscreenRule, /height:\s*100dvh/);
});

test("layer visibility and lock controls change the document and its preview", () => {
  assert.ok(shell.includes("handleNodeProp(nodeId, 'visible', visible)"));
  assert.ok(shell.includes("handleNodeProp(nodeId, 'locked', locked)"));
  assert.ok(layerTree.includes("onToggleVisibility?.(id, v)"));
  assert.ok(layerTree.includes("onLock?.(id, l)"));
  assert.ok(canvas.includes("n.props?.visible === false"));
  assert.ok(canvas.includes("data-locked"));
});
