import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const creative = read("src/app/creative-library-workspace.tsx");

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
const classes = classValues(creative);

test("as midias da biblioteca teem limites dimensionais e nao ficam gigantes", () => {
  assert.ok(
    creative.includes('const previewMediaTw = "size-full max-h-56 object-contain"'),
    "a midia da miniatura precisa de limites de largura, altura e object-contain",
  );
  assert.ok(
    creative.includes('const gridTw = "grid grid-cols-1 gap-token sm:grid-cols-2 xl:grid-cols-3"'),
    "o grid de referencias precisa manter colunas responsivas",
  );
});

test("a miniatura e clicavel e abre o lightbox", () => {
  for (const token of [
    'data-testid="creative-reference-thumbnail"',
    'aria-label={"Ampliar "+r.name}',
    'data-testid="creative-reference-lightbox"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label={"Visualizar "+r.name}',
    'aria-label="Fechar imagem"',
    'aria-label="Diminuir zoom"',
    'aria-label="Aumentar zoom"',
    "setLightboxOpen(true)",
    'event.key==="Escape"',
  ]) assert.ok(creative.includes(token), `a miniatura/lightbox perdeu ${token}`);
});

test("o zoom do lightbox tem limites e opcao de ajustar a tela", () => {
  for (const token of [
    "Math.max(1,Math.round((value-0.25)*100)/100)",
    "Math.min(4,Math.round((value+0.25)*100)/100)",
    "Ajustar à tela",
    "Math.round(zoom*100)}%",
  ]) assert.ok(creative.includes(token), `o zoom perdeu ${token}`);
});

test("os contratos funcionais da biblioteca permanecem intactos", () => {
  for (const token of [
    "creative-references", 'aria-label="Atualizar biblioteca"', 'role="alert"', 'role="status"',
    'role="group"', "creative-delete-button", "Reconectar Drive", "MarketingStudio",
    "Extrair paleta", "Abrir arquivo",
  ]) assert.ok(creative.includes(token), `a biblioteca perdeu ${token}`);
});

test("a biblioteca nao usa remendos visuais proibidos", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b/);
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = creative.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
});
