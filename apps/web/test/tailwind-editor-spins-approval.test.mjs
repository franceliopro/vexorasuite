import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const files = [
  "src/app/design-approval/[token]/page.tsx",
  "src/app/sites/preview/[token]/page.tsx",
  "src/app/sites/editor/canvas.tsx",
  "src/app/sites/editor/editor-shell.tsx",
  "src/app/sites/editor/inspector.tsx",
  "src/app/sites/editor/palette.tsx",
  "src/app/sites/wizard/wizard-shell.tsx",
];
const sources = files.map(read);

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  return values.join("\n");
}
const classes = sources.map(classValues).join("\n");

test("editor, wizard, aprovacao e preview nao usam mais classes componente legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|danger-button|text-button|danger-text|icon-button|vx-spin)\b/);
  for (const source of sources) assert.doesNotMatch(source, /className="spin"/);
});

test("editor, wizard, aprovacao e preview usam so utilities, sem remendos", () => {
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
  assert.ok(sources.filter((source) => source.includes("animate-spin")).length >= 6);
});

test("os contratos de editor, wizard, aprovacao e preview permanecem intactos", () => {
  const [approval, preview, canvas, shell, inspector, palette, wizard] = sources;
  for (const token of [
    "/api/backend/public/design-approvals/", "Rejeitar", "Aprovar e publicar agora",
    "Aprovar (publicar no sistema)", 'role="status"', 'role="alert"',
  ]) assert.ok(approval.includes(token), `aprovacao perdeu ${token}`);
  for (const token of [
    "/api/backend/public/sites/preview/${encodeURIComponent(token)}", "Prévia temporária",
    "não publicado", "formulários desativados", "Abrir em nova aba",
  ]) assert.ok(preview.includes(token), `preview perdeu ${token}`);
  for (const token of ["createPortal(", "srcDoc={frameHtml}", "postMessage", "onSelect"]) {
    assert.ok(canvas.includes(token), `canvas perdeu ${token}`);
  }
  for (const token of ["Salvando…", "Publicando…", "readOnly", "saving", "publishing"]) {
    assert.ok(shell.includes(token), `shell perdeu ${token}`);
  }
  for (const token of ["vx-inspector-ai-feedback", "Somente leitura", "setAiPanelOpen(true)"]) {
    assert.ok(inspector.includes(token), `inspector perdeu ${token}`);
  }
  for (const token of ["draggable={!disabled}", "writeDragPayload", "onDragEnd={handleDragEnd}"]) {
    assert.ok(palette.includes(token), `paleta perdeu ${token}`);
  }
  for (const token of [
    "createPortal(", "handleToggleFullscreen", "aria-label={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}",
    "type WizardMode = 'fullscreen' | 'window' | 'minimized'",
  ]) assert.ok(wizard.includes(token), `wizard perdeu ${token}`);
});
