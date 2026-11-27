import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const page = read("src/app/page.tsx");
const auth = read("src/app/auth-screen.tsx");
const companies = read("src/app/company-switcher.tsx");
const popover = read("src/app/anchored-popover.tsx");
const inbox = read("src/app/inbox-workspace.tsx");
const picker = read("src/app/tailwind-color-picker.tsx");
const brandPanel = read("src/app/quick-brand-panel.tsx");
const css = read("src/app/vexora.css");

test("sessão expirada mostra aviso, reconexão e saída visível no mobile", () => {
  for (const token of [
    'const SESSION_EXPIRED_NOTICE="Sua sessão expirou. Entre novamente para continuar."',
    "authNotice",
    "retryAuth",
    "signOut",
    'sessionNotice={authNotice}',
    "onRetry={() => void retryAuth()}",
    'data-testid="logout-topbar"',
    'data-testid="logout-sidebar"',
    "/api/backend/auth/logout",
  ]) {
    assert.ok(page.includes(token), `a home perdeu ${token}`);
  }
  for (const token of [
    "sessionNotice",
    "onRetry",
    'data-testid="auth-session-notice"',
    'data-testid="auth-retry"',
    "Tentar reconectar",
  ]) {
    assert.ok(auth.includes(token), `a autenticação perdeu ${token}`);
  }
  assert.ok(css.includes(".topbar .topbar-company-button{min-width:var(--ctl)"), "a empresa continua visível no mobile");
  assert.ok(css.includes(".topbar .topbar-company-button span,.topbar .topbar-company-button svg:last-child{display:none}"), "só o rótulo some no mobile");
  assert.ok(css.includes("[data-testid='logout-sidebar'] span{display:none}"), "o texto do logout some na sidebar compacta");
});

test("a troca de empresa é um dropdown ancorado, não um modal dentro do topbar", () => {
  for (const token of [
    "createPortal",
    "anchorRef",
    "useLayoutEffect",
    "pointerdown",
    'aria-controls="company-dropdown"',
    'data-testid="company-dropdown"',
    'aria-label="Gerenciar empresas"',
    "/api/backend/auth/companies",
    "/api/backend/auth/'",
  ]) {
    assert.ok(companies.includes(token), `o seletor perdeu ${token}`);
  }
  assert.doesNotMatch(companies, /useModalDialog/);
  assert.doesNotMatch(companies, /aria-modal="true"/);
  assert.doesNotMatch(companies, /translate-y-\[50px\]/);
});

test("o popover de emojis abre centrado no ícone e escapa do stacking context", () => {
  for (const token of [
    "quickReplyEmojiRef",
    "emojiAnchorRef",
    "emojiTriggerRef",
    "closeEmoji",
    'id="composer-emoji-popover"',
    'aria-controls="composer-emoji-popover"',
    'side="top" align="center" portal role="dialog" ariaLabel="Emojis"',
    "[data-composer-tool-wrap='true'], [data-testid='composer-emoji-popover']",
    'const target = emojiTarget === "quick-reply" ? quickContentRef.current : composerRef.current',
  ]) {
    assert.ok(inbox.includes(token), `o composer perdeu ${token}`);
  }
  for (const token of [
    '"center"',
    "portal && mounted ? createPortal(panel, document.body) : panel",
    "const limitLeft = Math.max(margin, window.innerWidth - size.width - margin)",
    'maxWidth: "calc(100vw - 16px)"',
    'maxHeight: "calc(100vh - 16px)"',
    "zIndex: 260",
  ]) {
    assert.ok(popover.includes(token), `o popover ancorado perdeu ${token}`);
  }
});

test("o ajuste rápido de aparência usa os degraus exatos e salva no tenant", () => {
  for (const token of [
    "TAILWIND_WEIGHTS.indexOf(selected.weight)",
    "min={0}",
    "max={TAILWIND_WEIGHTS.length - 1}",
    "step={1}",
    "value={selectedIndex}",
    'addEventListener("wheel", onWheel, { passive: false })',
    'event.key === "ArrowRight" || event.key === "ArrowUp"',
    'event.key === "ArrowLeft" || event.key === "ArrowDown"',
    "<span>Tom {selected.weight}</span>",
  ]) {
    assert.ok(picker.includes(token), `o seletor perdeu ${token}`);
  }
  for (const token of [
    'data-testid="quick-brand-panel"',
    "brandIsReadable",
    'fetch("/api/backend/contacts/brand-settings"',
    'method: "PATCH"',
    "Mais opções",
    "applyBrandAll(brand, theme)",
  ]) {
    assert.ok(brandPanel.includes(token), `o painel rápido perdeu ${token}`);
  }
  for (const token of ['data-testid="quick-brand-button"', "openBrandPanel", "Personalizar aparência"]) {
    assert.ok(page.includes(token), `a home perdeu ${token}`);
  }
});
