import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const source = read("src/app/post-body-editor.tsx");
const legacyCss = read("src/app/vexora.css");

/** Resolve constantes de className e o `class:` dos nós renderizados pelo Tiptap. */
const constants = new Map();
for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
  constants.set(match[1], match[2]);
}

function classValues(src) {
  const values = [];
  for (const match of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  for (const match of src.matchAll(/\bclass:\s*("[^"]*"|[A-Za-z_$][\w$]*)/g)) {
    const raw = match[1];
    values.push(raw.startsWith('"') ? raw.slice(1, -1) : (constants.get(raw) ?? ""));
  }
  return values.join("\n");
}

const classes = classValues(source);
const cssBlock = source.match(/const POST_CONTENT_CSS = `([\s\S]*?)`;/)?.[1] ?? "";

test("o editor de corpo não usa mais classes componente decorativas", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|vx$|is-selected$|active$|primary-button$|secondary-button$|text-button$|danger-button$|icon-button$)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
  for (const legacy of [
    "vx-post-body", "vx-post-toolbar", "vx-post-source", "vx-post-popover", "vx-post-notice",
    "vx-post-hint", "vx-post-gallery", "vx-gallery-", "vx-youtube-node", "vx-field-hint",
    "vx-post-body-content", "vx-post-tool",
  ]) {
    assert.doesNotMatch(classes, new RegExp(`\\b${legacy}`), `classe ${legacy} ainda em className`);
  }
});

test("o editor de corpo usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "grid min-w-0 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900",
    "flex flex-wrap items-center gap-0.5 border-b border-slate-700 bg-slate-800 px-2.5 py-2",
    "inline-grid h-8 min-w-8 place-items-center rounded-lg bg-transparent font-extrabold text-slate-200",
    "min-h-64 outline-none px-4 py-4 text-base leading-relaxed text-slate-50",
    "min-h-72 w-full resize-y border-0 px-4 py-4 font-mono text-xs leading-relaxed outline-none",
    "m-0 bg-red-100 px-3 py-2 text-xs font-semibold text-red-600",
    "m-0 border-t border-slate-700 px-3 py-2.5 text-xs text-slate-200",
    "my-4 grid grid-cols-2 gap-2 sm:grid-cols-3",
    "grid grid-cols-2 gap-2 sm:grid-cols-3",
    "block aspect-square w-full object-cover",
    "grid h-5 w-5 place-items-center rounded-md border border-slate-700 bg-slate-900/80 text-slate-50",
    "block w-full rounded-xl",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("as regras descendentes do conteúdo rico usam atributo funcional e tokens", () => {
  assert.ok(cssBlock.length > 0, "bloco escopo-local do conteúdo não encontrado");
  assert.match(cssBlock, /\[data-vx-post-content\]/);
  for (const selector of ["h2", "h3", "p", "blockquote", "img", "pre"]) {
    assert.match(cssBlock, new RegExp(`\\[data-vx-post-content\\].*\\b${selector}\\b|:\\(?is\\(.*${selector}`));
  }
  assert.match(source, /"data-vx-post-content":\s*""/);
  assert.match(source, /const codeSurfaceStyle = \{ backgroundColor: "rgb\(15 23 42\)", color: "rgb\(226 232 240\)" \}/);
  assert.doesNotMatch(cssBlock, /color-mix\(|!important|@apply|#[0-9a-fA-F]/);
});

test("os contratos, a acessibilidade e o estado do editor permanecem intactos", () => {
  for (const token of [
    'role="toolbar"', 'aria-label="Formatação do texto"', 'role: "textbox"',
    '"aria-multiline": "true"', 'role="alert"', 'aria-label="Endereço do link"',
    'aria-label="Link do YouTube"', 'aria-label="Corpo do texto (HTML)"',
    'aria-label="Mover para a esquerda"', 'aria-label="Mover para a direita"',
    'aria-label="Excluir da galeria"', "aria-pressed=", "aria-hidden=\"true\"",
    'data-vx-gallery="true"', 'data-vx-youtube="true"', '"data-vx-gallery": ""',
    '"data-vx-youtube": ""', "EditorContent", "ReactNodeViewRenderer",
    "toggleBold()", "toggleItalic()", "toggleUnderline()", "toggleStrike()",
    "toggleHeading({ level: 2 })", "toggleHeading({ level: 3 })", "toggleBulletList()",
    "toggleOrderedList()", "toggleBlockquote()", "toggleCodeBlock()", "setLink({ href: parsed })",
    "insertYoutube()", "insertGallery", "setSource(v =>", "setLinkOpen(v => !v)",
    "setYoutubeOpen(v => !v)", "maxLength = 60000", "lastEmitted.current",
    "Corpo do texto", "Inserir galeria", "Inserir link", "Inserir vídeo", "Vídeo sem URL",
    "Nenhuma imagem ainda", "Dica: use o File manager", "O corpo do texto excedeu o limite",
    "const [imagePickerOpen, setImagePickerOpen] = useState(false)",
  ]) {
    assert.ok(source.includes(token), `editor perdeu ${token}`);
  }
});

test("o CSS legado órfão da fatia foi removido sem tocar nos tokens do tema", () => {
  for (const legacy of [
    ".vx-post-body", ".vx-post-toolbar", ".vx-post-source", ".vx-post-popover",
    ".vx-post-notice", ".vx-post-hint", ".vx-post-gallery", ".vx-gallery-",
    ".vx-youtube-node", ".vx-post-tool{", ".vx-post-body-content",
  ]) {
    assert.equal(legacyCss.includes(legacy), false, `CSS legado ${legacy} ainda em vexora.css`);
  }
  for (const token of [
    "--bg:#0F172A", "--s1:#1E293B", "--s2:#334155", "--tx:#F8FAFC",
    "--ln:#334155", "--sb-bg:#020617",
  ]) {
    assert.ok(legacyCss.includes(token), `token do dark slate ${token} foi alterado`);
  }
});
