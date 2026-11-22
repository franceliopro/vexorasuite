import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const editor = read("src/app/sites/site-editor-window.tsx");

/* Constantes literais e o mapa Record<AiStatus, string> são resolvidos antes de
   inspecionar: o guard precisa ver o valor final das classes, não o nome. */
const constants = new Map();
for (const match of editor.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
  constants.set(match[1], match[2]);
}
const aiStatusBlock = editor.match(/const aiStatusTw: Record<AiStatus, string> = \{([\s\S]*?)\n\};/)?.[1] ?? "";
const aiStatusValues = [...aiStatusBlock.matchAll(/"([^"]*)"/g)].map((match) => match[1]);

const classValues = [];
const push = (value) => classValues.push(...value.split(/\s+/).filter(Boolean));
for (const match of editor.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]*?)\})/g)) {
  if (match[1] !== undefined) push(match[1]);
  else if (match[2] !== undefined) push(match[2]);
  else {
    const expression = match[3] ?? "";
    for (const literal of expression.matchAll(/(["'])([^"']*)\1/g)) push(literal[2]);
    for (const name of Object.keys({ aiStatusTw: true, ...Object.fromEntries(constants) })) {
      if (new RegExp(`\\b${name}\\b`).test(expression)) {
        if (name === "aiStatusTw") push(aiStatusValues.join(" "));
        else push(constants.get(name));
      }
    }
  }
}
const classes = [...classValues, ...constants.values(), ...aiStatusValues].join("\n");

test("a janela do editor não usa classes componente legadas", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|ib-|rw-|ov-|auth-|alarm-|platform-admin-|vx-rich-|vx-post-|vx-gallery-|design-approval-)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
  for (const legacy of ["vx-editor-", "vx-wizard-dock-", "is-error", "is-ok"]) {
    assert.doesNotMatch(editor, new RegExp(legacy.replace(/-/g, "\\-")));
  }
});

test("a janela usa utilities literais do preset, sem remendos", () => {
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
    "fixed inset-0 flex flex-col bg-surface-page text-ink",
    "fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-token border border-line bg-surface p-1.5 shadow-token-lg",
    "inline-flex items-center gap-1.5 rounded-token border-0 bg-brand px-4 py-2 text-sm font-bold text-white",
    "inline-flex size-9 items-center justify-center rounded-token border border-line bg-surface text-ink",
    "flex flex-none flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5",
    "mr-auto flex min-w-60 flex-col gap-0.5",
    "text-sm text-ink",
    "text-xs text-ink-secondary",
    "basis-full text-xs text-danger",
    "mx-4 flex-none rounded-token-sm border border-success bg-success-soft px-3 py-2 text-sm text-success",
    "mx-4 flex-none rounded-token-sm border border-danger bg-danger/10 px-3 py-2 text-sm text-danger",
    "group flex-none px-4 text-ink open:border-b open:border-line open:pb-2",
    "cursor-pointer py-2 text-sm font-bold text-ink-secondary group-open:text-ink",
    "group flex-none px-4 text-ink",
    "cursor-pointer py-1.5 text-sm font-bold text-ink-secondary group-open:text-ink",
    "mb-2 flex max-h-42 flex-col gap-2 overflow-y-auto rounded-token-sm border border-line bg-surface px-3 pb-3 pt-2",
    "rounded-token-sm border border-line px-2.5 py-2",
    "flex justify-between gap-3 text-xs",
    "mt-1 break-words",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "animate-spin",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
  for (const name of constants.keys()) {
    assert.match(editor, new RegExp(`\\bconst\\s+${name}\\s*=\\s*"[^"]+"`), `constante ${name} não é literal completa`);
  }
});

test("o mapa de status da IA resolve strings completas", () => {
  assert.ok(editor.includes("type AiStatus = \"ok\" | \"error\";"));
  assert.ok(editor.includes("const aiStatusTw: Record<AiStatus, string> = {"));
  assert.ok(editor.includes("className={aiMessage.error ? aiStatusTw.error : aiStatusTw.ok}"));
  assert.equal(aiStatusValues.length, 2);
  for (const value of aiStatusValues) {
    assert.match(value, /^mx-4 flex-none rounded-token-sm border border-/);
    assert.doesNotMatch(value, /\b(?:vx-|is-error|is-ok)\b/);
  }
});

test("a camada fullscreen continua nos tokens de z-index", () => {
  for (const token of [
    'const editorWindowStyle: React.CSSProperties = { zIndex: "var(--z-fullscreen-window, 10000)" };',
    'const editorDockStyle: React.CSSProperties = { zIndex: "var(--z-fullscreen-dock, 10001)" };',
    "<div className={editorWindowTw} style={editorWindowStyle}",
    "<div className={editorDockTw} style={editorDockStyle}",
  ]) {
    assert.ok(editor.includes(token), `camada fullscreen perdeu ${token}`);
  }
});

test("a janela preserva portal, acessibilidade, permissoes e contratos e2e", () => {
  for (const token of [
    'import { createPortal } from "react-dom"',
    "createPortal(",
    "document.body,",
    'role="region"',
    'aria-label="Editor minimizado"',
    "aria-label={`Editor do site ${title}`}",
    'aria-label="Prévia temporária"',
    'role="status"',
    'role="alert"',
    'role={aiMessage.error ? "alert" : "status"}',
    "htmlFor={`domain-${siteId}`}",
    "id={`domain-${siteId}`}",
    'aria-label="Domínio do site"',
    '<summary className={editorSettingsSummaryTw}>Domínio, publicação e respostas</summary>',
    "onToggle={(event) => {",
    "event.currentTarget.open && !submissions && !submissionsLoading",
    "readOnly={!canEdit}",
    "saving={saving}",
    "publishing={publishing}",
    "aiFeedback={aiMessage}",
    "onSave={save}",
    "onPublish={() => void publish()}",
    "onMinimize={() => setMinimized(true)}",
    "onClose={requestClose}",
    "Ver prévia temporária",
    "Voltar para Sites",
    "Vincular",
    "Verificar",
    "Respostas do formulário",
    "Editando: {title}",
    "/api/backend/sites/${siteId}/document",
    "/document/preview",
    "/domain/verify",
    "/forms/submissions?limit=50",
    "/document/ai-edit",
    "navigator.clipboard.writeText(previewLink.url)",
    "rel=\"noopener noreferrer\"",
  ]) {
    assert.ok(editor.includes(token), `editor perdeu ${token}`);
  }
});
