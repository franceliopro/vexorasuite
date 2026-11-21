import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const config = read("tailwind.config.ts");
const component = read("src/app/sites/components/FichaCliente.tsx");
const styles = read("src/app/sites/components/ficha-cliente.css");

test("Tailwind usa tokens Véxora e não reseta o CSS legado", () => {
  assert.match(config, /preflight:\s*false/);
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

test("o piloto da ficha não usa paleta padrão, hex, valores arbitrários nem remendo", () => {
  const source = `${component}\n${styles}`;

  for (const forbidden of [
    /\b(?:gray|slate|zinc|indigo|blue|green|amber|red)-\d{2,3}\b/,
    /\b(?:bg|text|border)-(?:white|black)\b/,
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
  ]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
});

test("a ficha usa componentes @apply e classes de token", () => {
  for (const tokenClass of [
    "vx-ficha-card",
    "vx-ficha-tabs",
    "vx-ficha-btn-primary",
    "vx-ficha-field",
    "vx-ficha-chip-success",
    "bg-brand",
    "text-ink",
    "border-line",
    "text-2xs",
    "max-h-ficha",
    "z-wizard",
  ]) {
    assert.ok(component.includes(tokenClass) || styles.includes(tokenClass), `falta ${tokenClass}`);
  }

  assert.match(styles, /@tailwind components;/);
  assert.match(styles, /@tailwind utilities;/);
  assert.doesNotMatch(styles, /@tailwind base;/);
});
