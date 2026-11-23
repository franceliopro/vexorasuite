import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const config = read("tailwind.config.ts");
const component = read("src/app/sites-workspace.tsx");
const core = read("src/app/theme.css");
const postcss = read("postcss.config.js");

test("Tailwind usa tokens Véxora e o Preflight oficial sem sobrescrever o legado", () => {
  assert.doesNotMatch(config, /preflight:\s*false/);
  assert.doesNotMatch(config, /corePlugins/);
  assert.match(postcss, /"@tailwindcss\/postcss"/);
  assert.match(core, /@import "tailwindcss\/theme\.css" layer\(theme\);/);
  assert.match(core, /@import "tailwindcss\/preflight\.css" layer\(base\);/);
  assert.match(config, /darkMode:\s*\["class",\s*'\[data-theme="dark"\]'\]/);
  assert.match(config, /content:\s*\["\.\/src\/\*\*\/\*\.\{ts,tsx\}"\]/);

  for (const token of [
    "--primary",
    "--primary-soft",
    "--s1",
    "--s2",
    "--tx",
    "--tx2",
    "--ln",
    "--ok",
    "--warn",
    "--shadow-lg",
    "--r-xl",
    "--font-ui",
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("o workspace de Sites não usa hex, valores arbitrários nem remendo", () => {
  const source = component;

  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
    /@tailwind base;/,
  ]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
});

test("o workspace de Sites usa utilities literais e classes de token", () => {
  for (const tokenClass of [
    "bg-surface",
    "text-ink",
    "border-line",
    "text-2xs",
    "rounded-token-sm",
    "shadow-token-sm",
    "bg-blue-600",
  ]) {
    assert.ok(component.includes(tokenClass), `falta ${tokenClass}`);
  }

  assert.doesNotMatch(component, /vx-ficha-/);
  assert.doesNotMatch(component, /ficha-cliente\.css/);
});
