import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const manager = read("src/app/file-manager.tsx");
const picker = read("src/app/file-image-picker.tsx");
const components = [manager, picker];

/** Literais de className e constantes TW referenciadas por className são classes. */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
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
const classes = components.map(classValues).join("\n");
// `*-vx-*` são utilities do preset, não classes componente: só são aceitas
// quando o namespace vx é prefixo de utility e o token existe no preset.
const vxDeclared = new Set([...config.matchAll(/"(vx-[a-z0-9-]+)"/g)].map((match) => match[1]));
const legacyScanClasses = classes
  .split(/\s+/)
  .filter((token) => {
    const name = token.match(/vx-[a-z0-9-]+/)?.[0];
    return !(name && vxDeclared.has(name) && /^[a-z][a-z0-9-]*-vx-[a-z0-9-]+$/.test(token));
  })
  .join("\n");

test("os seletores de arquivo não usam classes componente legadas", () => {
  for (const forbidden of [
    /\bfile-manager(?:-[a-z0-9-]+)?\b/,
    /\bfile-image-picker(?:-[a-z0-9-]+)?\b/,
    /\bvx-dialog(?:-[a-z0-9-]+)?\b/,
    /\bvx-spin\b/,
    /\b(?:primary|secondary|icon)-button\b/,
    /\bis-selected\b/,
    /\bactive\b/,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("os seletores de arquivo usam só utilities, sem remendos", () => {
  for (const source of components) {
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
    ]) {
      const match = source.match(forbidden);
      assert.equal(match, null, `remendo visual: ${match?.[0]}`);
    }
  }
  for (const utility of [
    "min-w-fm-search",
    "grid-cols-fm-items",
    "aspect-fm-preview",
    "max-w-fm-move",
    "z-fm-lightbox",
    "max-w-fm-lightbox",
    "max-h-fm-lightbox-img",
    "min-h-fm-filter",
    "min-w-fm-new-folder",
    "grid-cols-fm-picker",
    "grid-rows-fm-picker-item",
    "max-h-fm-picker-grid",
    "min-w-fm-picker-body",
    "size-fm-check",
    "animate-vx-scrim-in",
    "animate-vx-in",
    "w-ib-dialog-wide",
    "max-h-ib-dialog",
    "z-ib-dialog",
    "p-vx-dialog-pad",
    "animate-spin",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens dos seletores de arquivo", () => {
  for (const token of [
    '"fm-search": "220px"',
    '"fm-new-folder": "120px"',
    '"fm-move": "108px"',
    '"fm-check": "26px"',
    '"fm-filter": "30px"',
    '"fm-preview": "4 / 3"',
    '"fm-items": "repeat(auto-fill,minmax(180px,1fr))"',
    '"fm-picker": "repeat(auto-fill,minmax(150px,1fr))"',
    '"fm-picker-grid": "420px"',
    '"fm-lightbox-img": "74vh"',
    '"fm-lightbox": "min(960px,94vw)"',
    '"fm-picker-body": "min(860px,94vw)"',
    '"fm-lightbox": "60"',
    '"fm-card": "14px"',
    '"fm-search": "10px"',
    '"fm-pill": "99px"',
    '"fm-lightbox": "16px"',
    '"fm-meta": "10.5px"',
    '"fm-pdf": "10px"',
    '"fm-caption": "12.5px"',
    '"fm-picker-item": "1fr auto"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("o gerenciador preserva hooks, acessibilidade e integrações", () => {
  for (const token of [
    'data-testid="file-manager"',
    'aria-label="Navegação de pastas"',
    'aria-label="Pesquisar nesta pasta"',
    'aria-label="Filtrar por tipo"',
    'aria-pressed={filter === value}',
    'role="status"',
    'aria-label="Nome da nova pasta"',
    'aria-label="Renomear pasta"',
    'aria-label="Renomear arquivo"',
    'aria-label="Mover para pasta"',
    'aria-label="Copiar URL"',
    'aria-label="Excluir"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label={"Visualizar " + preview.name}',
    'aria-label="Fechar"',
    '"/sites/assets?folder=" + encodeURIComponent(target)',
    '"/sites/assets/all-folders"',
    '"/api/backend/sites/assets"',
    '"/sites/assets/folders"',
    '"/sites/assets/folders/rename"',
    '/sites/assets/${asset.id}/move',
    "onNotice?.(",
    "onSelect(asset.url, asset.name)",
    "selectable && asset.kind === \"image\"",
  ]) {
    assert.ok(manager.includes(token), `o gerenciador deve manter ${token}`);
  }
});

test("o seletor de imagens preserva o contrato e os hooks", () => {
  for (const token of [
    'data-testid="file-image-picker"',
    'data-testid="file-image-picker-backdrop"',
    'data-testid="file-image-picker-body"',
    'data-testid="file-image-picker-grid"',
    'data-testid="file-image-picker-item"',
    'data-testid="file-image-picker-check"',
    'role="presentation"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label={title}',
    'aria-label="Fechar"',
    'aria-label="Pesquisar imagens"',
    'aria-pressed={multiple ? isSelected : true}',
    '"/sites/assets"',
    '"/api/backend/sites/assets"',
    "onSelect([asset.url], [asset])",
    "onSelect(chosen.map(a => a.url), chosen)",
    "onClose()",
    'if (e.key === "Escape") onClose()',
    "if (e.target === e.currentTarget) onClose()",
  ]) {
    assert.ok(picker.includes(token), `o seletor deve manter ${token}`);
  }
});
