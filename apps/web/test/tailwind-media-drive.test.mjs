import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const creative = read("src/app/creative-library-workspace.tsx");
const drive = read("src/app/drive-manager.tsx");
const admin = read("src/app/platform-admin-workspace.tsx");
const screens = [creative, drive, admin];

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
const classes = screens.map(classValues).join("\n");

test("biblioteca, drive e admin nao usam mais classes componente de botao legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b/);
});

test("biblioteca, drive e admin usam so utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = screens.join("\n").match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600",
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-red-600",
    "size-9 place-items-center rounded-token-sm border border-line bg-surface",
    "border border-red-600 bg-red-100 px-4 text-body font-bold text-red-600",
    "animate-spin",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos de biblioteca, drive e admin permanecem intactos", () => {
  for (const token of [
    "creative-references", 'aria-label="Atualizar biblioteca"', 'role="alert"', 'role="status"',
    'role="group"', "creative-delete-button", "Reconectar Drive", "MarketingStudio",
  ]) assert.ok(creative.includes(token), `biblioteca perdeu ${token}`);
  for (const token of [
    "drive-manager/", "integrations/google/start/drive-manager", 'aria-live="polite"',
    'role="status"', 'role="group"', "aria-pressed={layout===id}", "Criar pasta", "Lixeira",
  ]) assert.ok(drive.includes(token), `drive perdeu ${token}`);
  for (const token of [
    'role="tablist"', 'role="dialog"', 'aria-label="Arquivar plano"', 'aria-label="Abrir empresa"',
    'aria-label="Fechar"', "PLAN_PRESETS", "Arquivar", "animate-spin",
  ]) assert.ok(admin.includes(token), `admin perdeu ${token}`);
});
