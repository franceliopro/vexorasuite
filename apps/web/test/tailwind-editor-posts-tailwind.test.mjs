import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guard node:test puro: nenhuma dependência de node_modules.
const cwd = process.cwd();
const webRoot = fs.existsSync(path.join(cwd, "apps/web/src/app/sites"))
  ? path.join(cwd, "apps/web")
  : cwd;
const read = (file) => fs.readFileSync(path.join(webRoot, file), "utf8");

const paths = {
  post: "src/app/post-body-editor.tsx",
  prompt: "src/app/rich-prompt-editor.tsx",
  canvas: "src/app/sites/editor/canvas.tsx",
  shell: "src/app/sites/editor/editor-shell.tsx",
  inspector: "src/app/sites/editor/inspector.tsx",
  window: "src/app/sites/site-editor-window.tsx",
  domain: "src/app/sites-domain-config.tsx",
};

const sources = Object.fromEntries(
  Object.entries(paths).map(([name, file]) => [name, read(file)]),
);

const UTILITY_HINT =
  /(?:^|\s)(?:flex|grid|inline|fixed|absolute|relative|block|hidden|peer|truncate|overflow|bg-|text-|border|rounded|p-|px-|py-|m-|mx-|my-|w-|h-|min-|max-|gap-|items-|justify|shadow|font-|cursor|opacity|disabled:|hover:|focus:|group|z-|animate-|transition|leading-|resize|placeholder:|basis-|list-|tabular|underline|outline|place-|space)/;

/** Resolve className literals, constantes e mapas para auditar o que chega ao JSX. */
function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\}|`([^`]*)`)/g)) {
    if (match[1] !== undefined) values.push(match[1]);
    else if (match[3] !== undefined) values.push(match[3]);
    else for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  for (const match of source.matchAll(/\bclass:\s*(["'])([^"']*)\1/g)) values.push(match[2]);
  for (const match of source.matchAll(/(["'])([^"'\n`]+)\1/g)) {
    if (UTILITY_HINT.test(match[2])) values.push(match[2]);
  }
  return [...new Set(values)].join("\n");
}

const classes = Object.fromEntries(
  Object.entries(sources).map(([name, source]) => [name, classValues(source)]),
);

const ALLOWED_LEGACY_VARIANTS = /\b(?:ib-narrow|ov-laptop|rw-laptop):/g;
const stripAllowed = (value) => value.replace(ALLOWED_LEGACY_VARIANTS, "");

const LEGACY = [
  "ov-",
  "vx-",
  "ib-",
  "rw-",
  "auth-",
  "alarm-",
  "platform-admin-",
  "vx-rich-",
  "vx-post-",
  "vx-gallery-",
  "design-approval-",
  "content-card",
  "settings-card",
  "primary-button",
  "secondary-button",
  "text-button",
  "icon-button",
  "vx-spin",
];

const FORBIDDEN = [
  ["valor arbitrário", /\[[a-z-]+:\s*[^\]\s]+\]/],
  ["hex em classe", /#[0-9a-fA-F]{3,8}\b/],
  ["color-mix", /color-mix\(/],
  ["!important", /!important/],
  ["@apply", /@apply/],
  ["@tailwind base", /@tailwind\s+base/],
  ["classe de estado legada", /\bis-(?:active|disabled|error|ok|selected|dragging|drop-)/],
];

test("os 7 arquivos migrados não usam classes componente legadas", () => {
  for (const [name, value] of Object.entries(classes)) {
    const audited = stripAllowed(value);
    for (const token of LEGACY) {
      const pattern = new RegExp(token.endsWith("-") ? `\\b${token}` : `\\b${token}\\b`);
      const match = audited.match(pattern);
      assert.equal(match, null, `${name}: classe legada ${token}: ${match?.[0]}`);
    }
  }
});

test("os 7 arquivos migrados usam utilities literais do preset, sem remendos", () => {
  for (const [name, value] of Object.entries(classes)) {
    for (const [label, pattern] of FORBIDDEN) {
      const match = value.match(pattern);
      assert.equal(match, null, `${name}: remendo visual (${label}): ${match?.[0]}`);
    }
  }
  assert.doesNotMatch(sources.canvas, /color-mix\(/, "canvas ainda monta cor com color-mix");
  assert.doesNotMatch(sources.prompt, /\[&_|content-\[attr\(/, "prompt ainda usa seletor arbitrário");
});

test("o escuro dos editores e posts é slate real", () => {
  for (const name of ["canvas", "shell", "window", "domain"]) {
    assert.match(classes[name], /bg-slate-900/, `${name}: falta bg-slate-900`);
    assert.match(classes[name], /text-slate-50/, `${name}: falta text-slate-50`);
    assert.match(classes[name], /border-slate-700/, `${name}: falta border-slate-700`);
  }
  assert.doesNotMatch(classes.shell, /\b(?:bg|text|border)-(?:blue|indigo)-(?:900|950)\b/);
  assert.doesNotMatch(classes.window, /\b(?:bg|text|border)-(?:blue|indigo)-(?:900|950)\b/);
  assert.doesNotMatch(classes.domain, /\b(?:bg|text|border)-(?:blue|indigo)-(?:900|950)\b/);
});

test("estados resolvem mapas ou helpers com classes completas", () => {
  assert.match(sources.post, /galleryNodeClass\(selected\)/);
  assert.match(sources.post, /youtubeNodeClass\(selected\)/);
  assert.match(sources.canvas, /CANVAS_DEVICE_BUTTON_CLASS\[d === device \? 'active' : 'idle'\]/);
  assert.match(sources.shell, /SHELL_NOTICE_KIND\[noticeKind\]/);
  assert.match(sources.shell, /SHELL_DEVICE_BUTTON_CLASS\[d === device \? 'active' : 'idle'\]/);
  assert.match(sources.shell, /SHELL_SECONDARY_BUTTON_CLASS\[/);
  assert.match(sources.inspector, /INSPECTOR_FEEDBACK_KIND\[aiFeedback\.error \? 'error' : 'ok'\]/);
  assert.match(sources.window, /aiMessage\.error \? aiStatusErrorClass : aiStatusOkClass/);
  assert.match(sources.domain, /stepClassTw: Record<string, string>/);
  assert.match(sources.domain, /stepBadgeClassTw: Record<string, string>/);
  assert.match(sources.domain, /statusPillVariantTw: Record<string, string>/);
  for (const source of Object.values(sources)) {
    assert.doesNotMatch(source, /className=\{`\$\{[^}]+\}\$\{/, "className montado por concatenação parcial");
  }
});

test("contratos funcionais dos editores e posts permanecem", () => {
  const expected = {
    post: [
      'role="toolbar"', '"aria-multiline": "true"', "data-vx-post-content",
      "data-vx-gallery", "data-vx-youtube", '"data-vx-gallery": ""',
      '"data-vx-youtube": ""', "EditorContent", "ReactNodeViewRenderer",
      "insertYoutube()", "Inserir galeria", "Corpo do texto",
    ],
    prompt: [
      'role:"textbox"', '"aria-multiline":"true"', "data-placeholder",
      "VexoraDialog", "Concluir edição", "Alternar texto de origem", "markdown",
      "current.current.onChange(markdown)", "data-rich-content",
    ],
    canvas: [
      "createPortal(", "srcDoc={frameHtml}", "postMessage", "onSelectNode",
      "onDragOver", "onDrop", 'title="canvas"', 'data-vx-dnd-indicator',
      'sandbox="allow-same-origin allow-scripts"', 'aria-label={`Preview do site',
    ],
    shell: [
      'role="application"', 'htmlFor="vx-editor-page"', 'id="vx-editor-page"',
      'aria-label="Dispositivo de preview"', "<Palette", "<LayerTree", "<Canvas",
      "<Inspector", "onSave", "onPublish", "onClose", "readOnly", "saving", "publishing",
    ],
    inspector: [
      'aria-label="Propriedades do bloco"', 'id="vexora-ai-prompt"',
      'data-testid="vx-inspector-ai-feedback"', 'role={aiFeedback.error ? \'alert\' : \'status\'}',
      "onPropChange(", "onStyleChange", "onAIChange(", "<StyleInspector",
    ],
    window: [
      "createPortal(", 'aria-label={`Editor do site ${title}`}', 'htmlFor={`domain-${siteId}`}',
      'id={`domain-${siteId}`}', '<details className={detailsClass}>',
      'role={aiMessage.error ? "alert" : "status"}', "<EditorShell",
      "readOnly={!canEdit}", "aiFeedback={aiMessage}", "Ver prévia temporária",
    ],
    domain: [
      'aria-label="Configuração de domínio próprio"', 'aria-label="Etapas de configuração"',
      'aria-label="Registros DNS"', 'id="domain-error"', 'id="domain-hint"',
      'aria-describedby="domain-error domain-hint"', 'role="progressbar"',
      "aria-valuenow={deployProgress}", "onClick={checkAndSetDomain}",
      "onClick={deploy}", "onClick={retry}", "statusPillClass",
    ],
  };
  for (const [name, markers] of Object.entries(expected)) {
    for (const marker of markers) {
      assert.ok(sources[name].includes(marker), `${name}: perdeu ${marker}`);
    }
  }
});
