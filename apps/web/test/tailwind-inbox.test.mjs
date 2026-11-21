import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");
const layout = read("src/app/layout.tsx");
const track = read("src/app/inbox-track.tsx");
const support = read("src/app/inbox-support.tsx");
const components = [track, support];
const e2eFiles = ["e2e/support-collaboration-browser.mjs", "e2e/inbox-visual-regression.mjs"];

// Só os valores de className são classes. data-* (como o testid estável) e
// texto de interface não entram nessa varredura.
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

test("o Atendimento não usa classes componente vx-* nem ib-* no JSX", () => {
  const values = components.map(classValues).join("\n");
  // `shadow-vx-brand` etc. são utilities do preset: só são aceitas quando o
  // namespace vx aparece como prefixo de utility e o token existe no preset.
  const vxDeclared = new Set([...config.matchAll(/"(vx-[a-z0-9-]+)"/g)].map((match) => match[1]));
  for (const token of values.split(/\s+/).filter(Boolean)) {
    if (!token.includes("vx-")) continue;
    assert.match(token, /^(?:bg|shadow|text|border)-vx-[a-z0-9-]+$/, `classe vx-* não autorizada: ${token}`);
    const name = token.match(/vx-[a-z0-9-]+/)?.[0];
    if (name) assert.ok(vxDeclared.has(name), `o preset não declara ${name}`);
  }

  // `*-ib-*` aqui são utilities do preset, não classes componente: cada uma
  // precisa ter formato de utility e usar um token ib-* realmente declarado.
  const declared = new Set([...config.matchAll(/"(ib-[a-z-]+)"/g)].map((match) => match[1]));
  const utilityShape = /^(?:(?:w|max-h|max-w|rounded|px|py|pb|pt|p|gap|my|mt|mb|font|text|grid-cols|col-span|justify-self|h|min-h)-ib-[a-z0-9-]+|ib-(?:narrow|mobile):[a-z0-9:-]+|font-ib)$/;
  for (const source of components) {
    for (const token of classValues(source).split(/\s+/).filter(Boolean)) {
      if (!/(?:^|-)ib(?:-|$)/.test(token)) continue;
      assert.match(token, utilityShape, `classe componente ib-* não autorizada: ${token}`);
      const name = token.match(/ib-[a-z-]+/)?.[0];
      if (name) assert.ok(declared.has(name), `o preset não declara ${name}`);
    }
  }
  assert.match(track, /className="w-ib-track max-h-ib-track/);
  assert.match(support, /className="w-ib-support max-h-ib-support/);
});

test("as utilities do Atendimento não usam arbitrários, hex, !important nem @apply no JSX", () => {
  for (const source of components) {
    const classes = classValues(source);
    assert.doesNotMatch(classes, /\[[^\]]+\]/);
    assert.doesNotMatch(classes, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(classes, /!important/);
    assert.doesNotMatch(source, /@apply\b/);
  }
});

test("não há CSS de tela do Atendimento nem @layer components de inbox", () => {
  const appDir = path.join(rootDir, "src", "app");
  const screenCss = fs.readdirSync(appDir).filter((name) => /^inbox.*\.css$/.test(name));
  assert.deepEqual(screenCss, []);
  assert.doesNotMatch(layout, /import "\.\/inbox(?:-track|-support|-context)?\.css"/);
  for (const source of components) {
    assert.doesNotMatch(source, /import "\.\/inbox(?:-track|-support|-context)?\.css"/);
  }
  assert.doesNotMatch(theme, /@layer components\s*\{[^}]*\.ib-/);
});

test("o preset expõe todos os tokens ib-* usados pelo Atendimento", () => {
  for (const token of [
    '"ib-narrow": { raw: "(max-width: 600px)" }',
    '"ib-mobile": { raw: "(max-width: 520px)" }',
    '"ib-modal": "16px"',
    '"ib-entry": "9px"',
    '"ib-article": "10px"',
    '"ib-panel": "12px"',
    '"ib-title": ["1.2rem", { lineHeight: "1.3" }]',
    'ib: "650"',
    '"ib-pad": "18px"',
    '"ib-gap": "9px"',
    '"ib-block": "10px"',
    '"ib-track": "minmax(0, 1fr) minmax(0, 1.4fr)"',
    '"ib-field": "minmax(0, 1fr) minmax(0, 1.4fr) auto"',
    '"ib-track": "85dvh"',
    '"ib-support": "min(82dvh, 780px)"',
    '"ib-track": "min(760px, calc(100vw - 24px))"',
    '"ib-support": "min(620px, calc(100vw - 24px))"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("as utilities dos tokens ib-* estão aplicadas diretamente no JSX", () => {
  for (const token of [
    "max-h-ib-track",
    "rounded-ib-modal",
    "bg-zinc-100",
    "px-ib-pad",
    "pb-ib-pad",
    "text-ib-title",
    "font-ib",
    "gap-ib-gap",
    "my-ib-block",
    "rounded-ib-entry",
    "grid-cols-ib-track",
    "gap-3.5",
    "ib-narrow:grid-cols-1",
    "border-blue-600",
  ]) {
    assert.ok(track.includes(token), `Track deve usar ${token}`);
  }
  for (const token of [
    "max-h-ib-support",
    "shadow-token-lg",
    "rounded-ib-article",
    "whitespace-pre-wrap",
    "bg-blue-50",
    "text-blue-800",
    "grid-cols-ib-field",
    "ib-mobile:grid-cols-2",
    "ib-mobile:col-span-2",
    "ib-mobile:justify-self-start",
  ]) {
    assert.ok(support.includes(token), `Apoio deve usar ${token}`);
  }
});

test("o contexto de apoio tem um data-testid estável nos e2e e no JSX", () => {
  assert.match(support, /data-testid="ib-support-context"/);
  assert.match(support, /\{context && <>[\s\S]*?data-testid="ib-support-context"/);
  for (const file of e2eFiles) {
    const e2e = read(file);
    assert.match(e2e, /\[data-testid=["']ib-support-context["']\]/);
    assert.doesNotMatch(e2e, /\.vx-support-context/);
  }
});

test("o ::backdrop é a única exceção de CSS dos diálogos e vive no core", () => {
  const backdropRules = theme.match(/dialog::backdrop\s*\{[^}]*\}/g) ?? [];
  assert.equal(backdropRules.length, 1);
  assert.match(backdropRules[0], /@apply bg-slate-950\/60;/);
  // --tx é uma cor completa: o placeholder padrão gera o modificador /60.
  assert.match(config, /950:\s*"rgb\(from var\(--tx\) r g b \/ <alpha-value>\)"/);
  for (const source of components) assert.doesNotMatch(source, /::backdrop/);
});
