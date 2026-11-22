import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/chatbot-workspace.tsx");
const styles = read("src/app/vexora.css");

/* Sub-fatia do inspetor: só as configurações da página pública do bot. */
const start = workspace.indexOf('<section className={publicSettingsTw} data-flow-public-page');
const endTag = "</section>";
const end = workspace.indexOf(endTag, start);
assert.notEqual(start, -1, "configurações da página pública não encontradas");
assert.notEqual(end, -1, "fim da seção da página pública não encontrado");
const section = workspace.slice(start, end + endTag.length);

const constants = new Map();
for (const match of workspace.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
  constants.set(match[1], match[2]);
}

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  return values.join("\n");
}

const classes = classValues(section);

test("a página pública do bot não usa classes componente legadas", () => {
  assert.doesNotMatch(
    classes,
    /\b(?:public-page-[a-z0-9-]+|swatch-[a-z0-9-]+|ai-admin-note|handoff-section-label)\b/,
  );
  assert.doesNotMatch(section, /className="(?:public-page-|swatch-|ai-admin-note|handoff-section-label)/);
});

test("a página pública do bot usa só utilities, sem remendos", () => {
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
    "grid gap-2.5 rounded-token border border-line bg-surface-2 p-3",
    "inline-flex w-max min-h-9 items-center gap-2.5 rounded-full border border-line bg-surface px-3",
    "block break-all select-all rounded-xl border border-line bg-surface p-2.5",
    "mt-3.5 grid gap-2.5 rounded-token-lg border border-dashed border-blue-600 bg-blue-50 p-3.5",
    "grid gap-2.5 rounded-xl border border-line p-2.5",
    "inline-flex min-h-9 min-w-16 flex-none items-center justify-center rounded-xl border-2",
    "block overflow-x-auto whitespace-nowrap rounded-token-sm border border-line bg-slate-950",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o CSS legado da página pública foi removido", () => {
  assert.doesNotMatch(styles, /\.public-page-(?:settings|toggle|link|actions|theme|swatch|reserved|widget)/);
  assert.doesNotMatch(styles, /\.swatch-(?:cream|dark|whatsapp|default|solid|gradient|image)/);
  assert.doesNotMatch(styles, /\.ai-admin-note\b/);
});

test("a página pública preserva contratos, acessibilidade e ações", () => {
  for (const token of [
    'data-flow-public-page',
    'aria-label="Página pública de teste"',
    "Robô em tela cheia (página pública)",
    "Página pública ativada",
    "Página pública desativada",
    "publicPage.loaded",
    "publicPage.busy",
    "publicPage.enabled",
    "publicPage.token",
    "savePublicPage({enabled:e.target.checked})",
    "publicPageUrl",
    "botHostInfo.botHost",
    "widgetSnippet",
    "ENDEREÇO RESERVADO NA VÉXORA CLOUD",
    "AGUARDANDO ATIVAÇÃO",
    'role="status"',
    'aria-pressed={(publicPage.theme.mode||"cream")===option.mode}',
    'aria-pressed={publicPage.theme.backgroundKind===option.kind}',
    'type="checkbox"',
    'type="color"',
    "maxLength={60}",
    "maxLength={120}",
    'target="_blank"',
    'rel="noopener noreferrer"',
    "setPublicPageNotice(",
    "Tema do bot",
    "Fundo da página",
  ]) {
    assert.ok(section.includes(token), `a página pública perdeu ${token}`);
  }
  assert.match(section, /onChange=\{e=>void savePublicPage\(\{theme:\{\.\.\.publicPage\.theme/);
});
