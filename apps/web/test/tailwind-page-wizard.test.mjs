import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/** Teste puro: só node:test / node:assert / node:fs / node:path. */
const here = process.cwd();
const root = fs.existsSync(path.join(here, "apps/web/src/app/page.tsx"))
  ? here
  : path.resolve(here, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, "apps/web", file), "utf8");

const page = read("src/app/page.tsx");
const wizard = read("src/app/sites/wizard/wizard-shell.tsx");
const contracts = read("src/app/sites/editor/contracts.ts");

/**
 * Extrai só literais que são classes: strings em className, constantes TW e
 * entradas de mapas Record. Ignora rótulos, imports e ids funcionais.
 */
function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*"([^"]*)"/g)) values.push(match[1]);
  for (const match of source.matchAll(/className\s*=\s*\{([^}]*)\}/g)) {
    for (const literal of match[1].matchAll(/(["'])([^"'\n]*)\1/g)) values.push(literal[2]);
  }
  for (const match of source.matchAll(/\bconst\s+[A-Za-z_$][\w$]*(?::[^=]+)?\s*=\s*(["'])([^"'\n]*)\1/g)) {
    values.push(match[2]);
  }
  for (const match of source.matchAll(/\bconst\s+[A-Za-z_$][\w$]*\s*:\s*Record<[^=]+>\s*=\s*\{([\s\S]*?)\n\};/g)) {
    for (const entry of match[1].matchAll(/\b[\w$]+\s*:\s*(["'])([^"'\n]*)\1/g)) values.push(entry[2]);
  }
  return values.join("\n");
}

const pageClasses = classValues(page);
const wizardClasses = classValues(wizard);
const allClasses = [pageClasses, wizardClasses].join("\n");

/** Prefixos legados proibidos; variantes liberadas são removidas antes da checagem. */
const ALLOWED_VARIANTS = new Set(["ib-narrow:", "ov-laptop:", "ov-tablet:", "rw-laptop:"]);
const LEGACY_SEGMENTS = /(^|-)(vx-rich|vx-post|vx-gallery|platform-admin|design-approval|vx|ov|ib|rw|auth|alarm)-/;
const LEGACY_EXACT = /(^|-)(content-card|settings-card|primary-button|secondary-button|text-button|icon-button|vx-spin)(-|$)/;

function legacyTokens(classes) {
  const found = [];
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    let rest = token;
    let rejected = false;
    while (true) {
      const colon = rest.indexOf(":");
      if (colon === -1) break;
      const variant = rest.slice(0, colon + 1);
      if (!ALLOWED_VARIANTS.has(variant) && LEGACY_SEGMENTS.test(variant)) rejected = true;
      rest = rest.slice(colon + 1);
    }
    if (rejected || LEGACY_SEGMENTS.test(rest) || LEGACY_EXACT.test(rest)) found.push(token);
  }
  return found;
}

test("os dois arquivos não usam classes legadas proibidas", () => {
  assert.deepEqual(legacyTokens(pageClasses), [], "home com classes legadas");
  assert.deepEqual(legacyTokens(wizardClasses), [], "wizard com classes legadas");
  assert.doesNotMatch(allClasses, /\b(?:emerald|green|lime|teal)-/);
  assert.doesNotMatch(allClasses, /\bindigo-/);
});

test("as utilities TW padrão estão presentes nos dois arquivos", () => {
  for (const utility of [
    "flex", "grid", "min-h-dvh", "min-h-10", "rounded-lg", "rounded-xl",
    "border-gray-200", "bg-zinc-50", "bg-zinc-100", "text-slate-950",
    "text-slate-600", "bg-blue-600", "hover:bg-blue-700", "text-blue-950",
    "text-blue-700", "bg-blue-50", "border-amber-600", "bg-amber-100",
    "text-red-600", "text-sm", "text-xs", "font-bold", "shadow-md",
    "max-md:grid", "max-md:border-gray-200", "max-md:bg-zinc-50", "z-40",
  ]) {
    assert.ok(pageClasses.split(/\s+/).includes(utility), `falta na home: ${utility}`);
  }
  for (const utility of [
    "fixed", "inset-0", "flex", "grid", "min-h-0", "min-h-10",
    "rounded-lg", "rounded-md", "border-gray-200", "bg-zinc-50",
    "bg-zinc-100", "text-slate-950", "text-slate-600", "bg-blue-600",
    "hover:bg-blue-700", "text-blue-950", "text-blue-700", "bg-blue-50",
    "text-red-600", "shadow-lg", "border-b", "border-t", "px-4", "py-3",
    "text-sm", "text-xs", "font-bold", "animate-spin", "grid-cols-1",
    "sm:grid-cols-2", "md:grid-cols-3", "grid-cols-2", "sm:grid-cols-3",
    "md:grid-cols-5", "hover:bg-zinc-200", "disabled:cursor-not-allowed",
  ]) {
    assert.ok(wizardClasses.split(/\s+/).includes(utility), `falta no wizard: ${utility}`);
  }
});

test("o dark é slate real: sem navy/blue-dark e sem verde comum", () => {
  for (const source of [page, wizard]) {
    assert.doesNotMatch(source, /#0B1F3A|#101730|#141B33|#1B2A5C|#0B1114/i);
  }
  assert.match(pageClasses, /bg-zinc-50/);
  assert.match(wizardClasses, /bg-zinc-50/);
  assert.match(wizardClasses, /text-slate-950/);
  assert.doesNotMatch(allClasses, /\b(?:indigo|sky|cyan)-/);
});

test("os contratos funcionais da home permanecem", () => {
  for (const hook of [
    'data-testid="sidebar-color-popover"',
    'data-testid={active === "Visão geral" ? "ov-dock" : undefined}',
    'id="mobile-navigation-menu"',
    'aria-controls="mobile-navigation-menu"',
    'aria-labelledby="sidebar-color-title"',
    'id="sidebar-color-title"',
    'role="dialog"', 'role="menu"', 'role="menuitem"', 'role="status"', 'role="alert"',
    "aria-expanded={item.children ? expanded : undefined}",
    'aria-current="page"',
    'aria-label={sidebarCollapsed ? "Expansir menu" : "Recolher menu"}',
    'aria-label="Instalar Véxora"',
    'className="sidebar-collapse"',
    'className="persistent-module-tabs"',
    'className="mobile-menu"',
    'closest(".sidebar")',
    'closest(".mobile-menu")',
    'closest(\'[data-testid="sidebar-color-popover"]\')',
    'closest(".ai-assistant-panel,.ai-assistant-trigger")',
    "useGlobalPhoneMask()",
    'fetch("/api/backend/auth/me", { cache: "no-store" })',
    "applyBrandAll", "wcagRatio", "HYBRID_SIDEBAR_DEFAULTS",
    "disableDeviceNotifications", "saveSidebarColors", "workspaceTabs",
    "sidebarCollapsed", "navigationReady", "settingsAdvanced",
    "vexora:open-module", "vexora:mobile-conversation-list",
    "vexora:mobile-assume", "vexora:mobile-transfer",
    "vexora:mobile-finalize", "vexora:install", "vexora:open-companies",
    "vexora:team-updated", "vexora:brand-updated",
    "#4F46E5",
  ]) {
    assert.ok(page.includes(hook), `a home perdeu o contrato ${hook}`);
  }
  for (const moduleName of [
    "documents-workspace", "course-workspace", "workflows-workspace",
    "creative-library-workspace", "client-plans-workspace", "reports-workspace",
    "platform-admin-workspace", "inbox-workspace", "operations-settings",
    "crm-workspace", "finance-workspace", "channels-integrations",
    "calendar-workspace", "tasks-workspace", "chatbot-workspace",
    "ai-agents-workspace", "sites-workspace",
  ]) {
    assert.ok(page.includes(`dynamic(()=>import("./${moduleName}")`), `perdeu o módulo ${moduleName}`);
  }
});

test("os contratos funcionais do wizard permanecem", () => {
  assert.ok(contracts.includes("LAYOUT_IMAGE_INPUT_ID = 'vx-wizard-layout-image'"));
  assert.match(wizard, /import \{ LAYOUT_IMAGE_INPUT_ID \} from ['"]\.\.\/editor\/contracts['"]/);
  for (const hook of [
    'role="region"',
    'aria-label="Assistente de criação de site minimizado"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label="Assistente de criação de site"',
    'aria-label="Etapas do assistente"',
    'aria-label="Minimizar assistente"',
    "aria-label={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}",
    'aria-label="Fechar assistente"',
    "aria-current={isCurrent ? 'step' : undefined}",
    "aria-pressed={active}",
    "aria-required={value === 'image'}",
    'aria-label="Remover imagem de layout"',
    'aria-label="Nome do site"',
    'aria-label="URL do logotipo"',
    'role="alert"',
    'id={LAYOUT_IMAGE_INPUT_ID}',
    'htmlFor={LAYOUT_IMAGE_INPUT_ID}',
    "disabled={!isDone && !isCurrent}",
    "disabled={disabled || busy}",
    "disabled={disabled || busy || !canNext}",
    "disabled={disabled || !domain.trim()}",
    "disabled={disabled || readingLayoutImage}",
    "onClick={onClose}",
    "onClick={handleMinimize}",
    "onClick={handleToggleFullscreen}",
    "onClick={handleBack}",
    "onClick={handleNext}",
    "onClick={() => void handleFinish()}",
    "onDomainValidated={() => setDomainValidated(true)}",
    "createPortal(content, document.body)",
    "type WizardMode = 'fullscreen' | 'window' | 'minimized'",
    "useState<WizardMode>('fullscreen')",
    "onComplete({",
    "kind: 'clone'", "kind: 'html'", "kind: 'zip'", "kind: 'ia'", "kind: 'image'",
    "fileToLayoutImage", "fileToBase64", "setLayoutImage", "setDomainValidated",
  ]) {
    assert.ok(wizard.includes(hook), `o wizard perdeu o contrato ${hook}`);
  }
});

test("variantes resolvem mapas Record ou helpers de literais completas", () => {
  for (const trecho of [
    "const SIDEBAR_STATE_TW:Record<string,string>={",
    "const ACCORDION_STATE_TW:Record<string,string>={",
    "const NAV_ITEM_STATE_TW:Record<string,string>={",
    "const NAV_SUBITEM_STATE_TW:Record<string,string>={",
    "const MODULE_TAB_STATE_TW:Record<string,string>={",
    "const PAGE_CONTENT_STATE_TW:Record<string,string>={",
    "const DOCK_ITEM_STATE_TW:Record<string,string>={",
    "const DOCK_ICON_STATE_TW:Record<string,string>={",
    "const MOBILE_NAV_STATE_TW:Record<string,string>={",
    "function sidebarClass(", "function navItemClass(", "function dockItemClass(",
    "function mobileNavClass(", "className={sidebarClass(menuOpen, sidebarCollapsed)}",
    "className={dockItemClass(active === \"Visão geral\", menuOpen)}",
    "className={mobileNavClass(active === \"Visão geral\")}",
  ]) {
    assert.ok(page.includes(trecho), `a home perdeu o mapa/helper ${trecho}`);
  }
  for (const trecho of [
    "const STEP_STATE_TW: Record<StepState, string> = {",
    "const STEP_BADGE_STATE_TW: Record<StepState, string> = {",
    "const CONNECTOR_STATE_TW: Record<'done' | 'pending', string> = {",
    "const OPTION_STATE_TW: Record<OptionState, string> = {",
    "const OPTION_ICON_STATE_TW: Record<OptionState, string> = {",
    "const THEME_STATE_TW: Record<OptionState, string> = {",
    "function stepStateTw(", "function badgeStateTw(", "function connectorStateTw(",
    "function optionStateTw(", "function optionIconStateTw(", "function themeStateTw(",
    "function primaryButtonTw(",
    "className={stepStateTw(isDone, isCurrent)}",
    "className={badgeStateTw(isDone, isCurrent)}",
    "className={connectorStateTw(isDone)}",
    "className={optionStateTw(active, disabled)}",
    "className={optionIconStateTw(active, disabled)}",
    "className={themeStateTw(active, disabled)}",
    "className={primaryButtonTw(disabled || busy)}",
    "className={primaryButtonTw(disabled || busy || !canNext)}",
    "className={primaryButtonTw(disabled || !domain.trim())}",
  ]) {
    assert.ok(wizard.includes(trecho), `o wizard perdeu o mapa/helper ${trecho}`);
  }
});

test("nenhum remendo proibido foi introduzido", () => {
  for (const source of [page, wizard]) {
    for (const forbidden of [/!important/, /@apply/, /@tailwind\s+base/, /color-mix\(/, /hsl\(/]) {
      const match = source.match(forbidden);
      assert.equal(match, null, `remendo no código: ${match?.[0]}`);
    }
    assert.doesNotMatch(source, /className=\{[^}]*\$\{[^}]*\}/);
    assert.doesNotMatch(source, /className=\{"[^"]*"\s*\+/);
  }
  const classes = allClasses;
  assert.doesNotMatch(classes, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(classes, /\[[a-z-]+:\s*[^\]\s]+\]/);
  assert.doesNotMatch(classes, /\b(?:bg|text|border|shadow|rounded|p|m|h|w|gap|z)-\[/);
});
