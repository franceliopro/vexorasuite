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

test("a home não usa classes legadas proibidas", () => {
  assert.deepEqual(legacyTokens(pageClasses), [], "home com classes legadas");
  assert.doesNotMatch(pageClasses, /\b(?:emerald|green|lime|teal)-/);
  assert.doesNotMatch(pageClasses, /\bindigo-/);
});

test("as utilities TW padrão estão presentes na home", () => {
  for (const utility of [
    "flex", "grid", "min-h-dvh", "min-h-10", "rounded-lg", "rounded-xl",
    "border-gray-200", "bg-zinc-50", "bg-zinc-100", "text-slate-950",
    "text-slate-600", "bg-blue-600", "hover:bg-blue-700", "text-blue-950",
    "text-blue-700", "bg-blue-50", "border-amber-600", "bg-amber-100",
    "text-red-600", "text-sm", "text-xs", "font-bold", "shadow-md",
    "mobile-bottom-nav", "mobile-bottom-nav--overview",
  ]) {
    assert.ok(pageClasses.split(/\s+/).includes(utility), `falta na home: ${utility}`);
  }
});

test("o dark é slate real: sem navy/blue-dark e sem verde comum", () => {
  assert.doesNotMatch(page, /#0B1F3A|#101730|#141B33|#1B2A5C|#0B1114/i);
  assert.match(pageClasses, /bg-zinc-50/);
  assert.match(pageClasses, /text-slate-950/);
  assert.doesNotMatch(pageClasses, /\b(?:indigo|sky|cyan)-/);
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
    "ai-agents-workspace",
  ]) {
    assert.ok(page.includes(`dynamic(()=>import("./${moduleName}")`), `perdeu o módulo ${moduleName}`);
  }
  assert.equal(page.includes('import("./sites-workspace")'), false, "Sites não deve ser carregado pela home");
  assert.equal(page.includes('label: "Planos e pacotes"'), false, "o menu Planos e pacotes não deve aparecer na home");
  assert.equal(page.includes('active === "Planos e pacotes"'), false, "o workspace Planos e pacotes não deve ser renderizado");
  assert.ok(page.includes('label: "Planos e preços"'), "o rótulo da capacidade permanece no catálogo de módulos");
  assert.ok(page.includes("'Planos e preços':'PLANS'"), "Planos e preços deve usar o módulo PLANS, não SETTINGS");
  assert.ok(page.includes('const plansMenuVisible = session?.tenant.kind !== "PLATFORM" && (session?.allowedModules || []).includes("PLANS")'), "o menu de clientes precisa do gate explícito de PLANS");
  assert.ok(page.includes('(item.label !== "Planos e preços" || plansMenuVisible)'), "Planos e preços não pode aparecer por padrão no menu do cliente");
  assert.ok(page.includes('{!moduleVisible(active)||!providerVisible(active)?<section className={cardTw}><h2>Acesso não permitido</h2>'), "URL direta também precisa respeitar o gate");
});

test("a home não limpa mais o rascunho específico da Rastreabem", () => {
  assert.ok(!page.includes("vexora-chatbot-rastreabem-draft-v2"));
  assert.ok(page.includes('localStorage.removeItem("vexora:quick-replies")'));
});
