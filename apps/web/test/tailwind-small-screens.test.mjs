import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const skills = read("src/app/product-skills-editor.tsx");
const pwa = read("src/app/pwa-controls.tsx");
const marketing = read("src/app/marketing-studio.tsx");
const greeting = read("src/app/greeting-settings.tsx");
const password = read("src/app/change-password-screen.tsx");
const screens = [skills, pwa, marketing, greeting, password];

/** Só literais de className são classes — a expressão ao redor não conta. */
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

test("as telas pequenas não usam mais classes componente de botão legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|danger-button|text-button|icon-button)\b/);
  assert.doesNotMatch(classes, /\b(?:ov|vx|ib|rw|ps)-[a-z][a-z0-9-]*/);
});

test("as telas pequenas usam só utilities, sem remendos", () => {
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
    "border border-red-600 bg-red-100 px-4 text-body font-bold text-red-600",
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600",
    "size-9 place-items-center rounded-token-sm border border-line bg-surface",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos das telas pequenas permanecem intactos", () => {
  for (const token of [
    "/api/backend/assistant/custom-skills", "/api/backend/assistant/skills",
    "Skills e capacidades", "Criar e salvar", "role=\"status\"",
  ]) assert.ok(skills.includes(token), `skills perdeu ${token}`);
  for (const token of [
    'aria-label="Aplicativo e notificações"', 'aria-expanded={open}',
    'aria-label="Fechar configurações do aplicativo"', 'role="status"',
    "/api/backend/notifications/push/subscribe", "vexora:install",
    "NEXT_PUBLIC_WINDOWS_INSTALLER_URL", "NEXT_PUBLIC_ANDROID_INSTALLER_URL",
    'data-testid="native-windows-download"', 'data-testid="native-android-download"',
  ]) assert.ok(pwa.includes(token), `pwa perdeu ${token}`);
  for (const token of [
    "api('marketing/library')", "marketing/library/sync", "Salvar pasta",
    "Sincronizar referências", "role=\"status\"",
  ]) assert.ok(marketing.includes(token), `marketing perdeu ${token}`);
  for (const token of [
    "/api/backend/conversations/quick-reply-settings", "Saudações e despedidas por horário",
    "Salvar frases", "role=\"status\"",
  ]) assert.ok(greeting.includes(token), `saudações perdeu ${token}`);
  for (const token of [
    "/api/backend/auth/change-password", 'autocomplete="current-password"'.replace("autocomplete", "autoComplete"),
    "Crie sua senha pessoal", "role=\"alert\"", "/api/backend/auth/logout",
  ]) assert.ok(password.includes(token), `senha perdeu ${token}`);
});
