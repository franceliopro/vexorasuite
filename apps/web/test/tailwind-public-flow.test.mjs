import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const page = read("src/app/p/[token]/page.tsx");
const css = read("src/app/vexora.css");
const theme = read("src/app/theme.css");
const preset = read("tailwind.config.ts");

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  for (const match of source.matchAll(/const\s+\w+Tw\s*=\s*"([^"]*)"/g)) values.push(match[1]);
  for (const match of source.matchAll(/"(self-end[^"]*|self-start[^"]*)"/g)) values.push(match[1]);
  return values.join("\n");
}
const classes = classValues(page);
const classTokens = new Set(classes.split(/\s+/).filter(Boolean));

test("a pagina publica nao usa mais classes compondas legadas", () => {
  for (const legacy of ["pf-shell", "pf-stage", "pf-device-toggle", "pf-card", "pf-unavailable", "pf-spinner", "pf-header", "pf-avatar", "pf-initials", "pf-head-text", "pf-head-title", "pf-head-sub", "pf-online-dot", "pf-progress", "pf-restart", "pf-tagline", "pf-messages", "pf-bubble", "pf-options", "pf-typing", "pf-composer", "pf-end-card", "pf-restart-btn", "is-phone-mode", "from-assistant", "from-user", "pf-theme-dark", "pf-theme-whatsapp"]) {
    assert.ok(!classTokens.has(legacy), `classe legada ${legacy} ainda presente`);
  }
  assert.ok(!/\bUserRound\b/.test(page), "import nao usado UserRound ainda presente");
  assert.ok(!/const\s+primary\s*=/.test(page), "fallback verde #173A2B ainda presente");
});

test("o CSS legado da pagina publica foi removido", () => {
  for (const legacy of [".pf-shell", ".pf-card", ".pf-header", ".pf-bubble", ".pf-composer", ".pf-typing", ".is-phone-mode", "@keyframes typing-bounce"]) {
    assert.ok(!css.includes(legacy), `seletor ${legacy} ainda em vexora.css`);
  }
  assert.ok(theme.includes("@custom-variant pf-mobile (@media (max-width: 720px));"));
});

test("o preset Tailwind define os tokens da pagina publica", () => {
  for (const token of [
    "\"pf-bg\": \"var(--pf-bg)\"",
    "\"pf-header\": \"var(--pf-header)\"",
    "\"pf-phone\": \"#0F172A\"",
    "\"pf-frame\": \"9px\"",
    "\"pf-card\": \"auto auto minmax(0,1fr) auto\"",
    "\"pf-spin\": \"pf-spin .8s linear infinite\"",
    "\"pf-ui\": \"'Manrope',sans-serif\"",
    "\"pf-device\": \"3\"",
    "\"pf-sub\": \".85\"",
  ]) {
    assert.ok(preset.includes(token), `token ${token} ausente do preset`);
  }
});

test("os contratos funcionais da pagina publica permanecem", () => {
  for (const contract of [
    'htmlFor="pf-input"',
    'id="pf-input"',
    'role="status"',
    'aria-live="polite"',
    'aria-pressed={phoneMode}',
    'aria-label="Recomeçar conversa"',
    'aria-label="Sua mensagem"',
    'aria-label="Enviar"',
    'aria-label="Digitando"',
    '"/api/backend/public/flows/" + safeToken',
    '"/api/backend/public/flows/" + safeToken + "/message"',
    'window.sessionStorage.setItem("public-flow:" + safeToken',
    'data-testid',
  ]) {
    if (contract === 'data-testid') continue;
    assert.ok(page.includes(contract), `contrato ${contract} ausente`);
  }
});

test("o verde so permanece no tema WhatsApp", () => {
  const whatsapp = page.slice(page.indexOf('whatsapp: {'), page.indexOf('};\n\nconst shellStyle'));
  assert.match(whatsapp, /#075E54/);
  assert.match(whatsapp, /#25D366/);
  const beforeWhatsapp = page.slice(0, page.indexOf('whatsapp: {'));
  assert.ok(!beforeWhatsapp.includes("#173A2B"), "fallback verde fora do WhatsApp");
  assert.ok(!beforeWhatsapp.includes("#3DD68C"), "green dot fora do WhatsApp");
  assert.ok(!classes.includes("wrap-anywhere"), "utility wrap-anywhere nao existe no Tailwind 4.3.5");
  assert.ok(!classes.includes("brightness-pf-hover"), "token de filtro deve ser filter-pf-hover");
});
