import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const profile = read("src/app/sidebar-profile.tsx");
const sites = read("src/app/sites-workspace.tsx");
const content = read("src/app/manual-content-workspace.tsx");
const screens = [profile, sites, content];

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

test("perfil, sites e conteudo nao usam mais classes componente de botao legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button|vx-spin)\b/);
  assert.doesNotMatch(screens.join("\n"), /className="spin"/);
});

test("perfil, sites e conteudo usam so utilities, sem remendos", () => {
  const withoutInlineStyles = screens.map((source) => source.replace(/style=\{\{[\s\S]*?\}\}/g, "")).join("\n");
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = withoutInlineStyles.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600",
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-red-600",
    "size-9 place-items-center rounded-token-sm border border-line bg-surface",
    "animate-spin",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("o menu de perfil da sidebar usa so utilities do preset", () => {
  const profileClasses = new Set(classValues(profile).split(/\s+/).filter(Boolean));
  for (const forbidden of [
    "sidebar-profile-menu",
    "sidebar-profile-popover",
    "profile-row",
    "profile-avatar",
    "profile-copy",
    "ai-admin-fields",
  ]) {
    assert.equal(profileClasses.has(forbidden), false, `classe legada no perfil: ${forbidden}`);
  }
  for (const utility of [
    "group relative w-full",
    "flex w-full cursor-pointer list-none items-center gap-profile-gap",
    "relative grid size-profile-avatar shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft",
    "flex min-w-0 flex-col gap-profile-copy-gap overflow-hidden",
    "absolute z-profile-popover grid gap-token bg-surface p-pad text-ink shadow-token ov-tablet:fixed",
    "grid gap-1.5 text-body font-semibold text-ink",
  ]) {
    assert.ok(profile.includes(utility), `falta a utility de perfil ${utility}`);
  }
});

test("os contratos de perfil, sites e conteudo permanecem intactos", () => {
  for (const token of [
    "/api/backend/profile", 'role="status"', 'role="alert"', "Tentar novamente", "Salvar perfil",
  ]) assert.ok(profile.includes(token), `perfil perdeu ${token}`);
  for (const token of [
    "/api/backend/sites", "/api/backend/sites/import/url", "/api/backend/sites/import/html",
    "/api/backend/sites/import/zip", 'role="status"', 'role="alert"', "animate-spin",
    "Criar meu primeiro site", "Abrir editor", "Excluir",
  ]) assert.ok(sites.includes(token), `sites perdeu ${token}`);
  for (const token of [
    "/api/backend/drive-manager/", "/api/backend/creative-references/", 'role="dialog"',
    'aria-modal="true"', "marketing-drive-pick", "marketing-drive-library-action",
    "Publicar manualmente", "Criação com IA", "Salvar rascunho", "Gerar rascunho pronto",
  ]) assert.ok(content.includes(token), `conteudo perdeu ${token}`);
});
