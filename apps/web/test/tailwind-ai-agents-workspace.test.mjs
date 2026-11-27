import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ai = read("src/app/ai-agents-workspace.tsx");
const config = read("tailwind.config.ts");

/** Só os usos em className entram na varredura; dados, hooks e aria ficam de fora. */
const classes = [...ai.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
  .map((m) => m[1] ?? m[2] ?? "")
  .join("\n");

const legadas = [
  "module-workspace", "ai-agents-workspace", "ai-agents-hero", "ai-agents-hero-copy",
  "ai-agents-hero-eyebrow", "ai-agents-hero-sub", "ai-agents-hero-badge",
  "ai-agent-status-pill", "ai-workspace-tabs", "ai-workspace-actions", "ai-notice",
  "ai-admin-grid", "ai-agent-layout", "content-card", "ai-admin-card", "ai-admin-heading",
  "ai-agent-list-heading", "ai-admin-note", "ai-toggle-note", "ai-admin-fields", "ai-toggle",
  "ai-agents-grid", "ai-agents-grid-empty", "ai-agent-card", "ai-agent-card-face",
  "ai-agent-card-body", "ai-agent-card-foot", "ai-agent-status", "ai-agent-tier",
  "ai-agent-tabs", "ai-routing-card", "ai-routing-list", "ai-routing-list-single",
  "ai-routing-item", "ai-flow-glyph", "ai-checkbox-group", "ai-field-hint",
  "ai-module-grid", "ai-module-option", "ai-admin-actions", "ai-prohibitions-block",
  "ai-prohibitions-actions", "ai-free-preset", "ai-free-preset-text", "ai-subtle-card",
  "ai-model-group", "ai-model-presets", "ai-assistant-panel", "ai-assistant-head",
  "ai-assistant-content", "ai-assistant-message", "ai-assistant-form", "workspace-disclosure",
  "creative-slide-list", "primary-button", "secondary-button", "workspace-surface",
  "ai-phone-card", "ai-phone-head", "ai-phone-list", "ai-phone-number", "ai-phone-remove",
  "ai-phone-rule", "is-on", "is-off",
];

test("o workspace de IA não usa classes componente legadas", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
  assert.equal(/className="[^"]+"/.test(ai), false, "className literal de componente permaneceu");
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /!important/, /@apply/, /color-mix\(/]) {
    const match = ai.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  const hexEmClasse = [...ai.matchAll(/className="[^"]*#[0-9a-fA-F]{3,8}/g)];
  assert.equal(hexEmClasse.length, 0, "hex direto em classe");
  for (const utility of [
    "grid min-w-0 gap-token",
    "flex flex-wrap items-start justify-between gap-4 rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface p-6 shadow-token-sm",
    "grid min-w-0 grid-cols-1 gap-token lg:grid-cols-ai-layout",
    "flex w-full min-w-0 flex-col gap-3 self-start lg:sticky lg:top-4",
    "grid gap-2.5 rounded-token border border-line bg-surface p-3 shadow-token",
    "flex w-full min-w-0 flex-col gap-1 rounded-token border border-line bg-surface-2 p-1.5 shadow-token",
    "grid min-w-0 content-start gap-token",
    "mt-3 grid w-full max-w-full grid-cols-ai-agents gap-2",
    "fixed right-4 bottom-4 z-50 flex max-h-ai-panel w-ai-panel flex-col overflow-hidden rounded-token border border-line bg-surface shadow-token-lg",
    "grid gap-3 rounded-ai-phone border border-line bg-surface-2 p-3",
    "bg-blue-600 px-brand-pad text-body font-bold text-blue-50",
  ]) {
    assert.ok(ai.includes(utility), `falta a utility ${utility}`);
  }
});

test("a lista de agentes fica no topo da coluna de conteúdo, em grade responsiva", () => {
  const nav = ai.indexOf('<nav className={workspaceNavTw}');
  const content = ai.indexOf('<div className={workspaceContentTw}>');
  const strip = ai.indexOf('{workspaceTab==="Agentes"&&<section className={adminCardTw}>');
  const actions = ai.indexOf('<div className={workspaceActionsTw}>');
  assert.ok(nav >= 0, "a navegação lateral não foi encontrada");
  assert.ok(content > nav, "a coluna de conteúdo deve vir depois da sidebar");
  assert.ok(strip > content, "a faixa de agentes deve ficar dentro da coluna de conteúdo");
  assert.ok(strip < actions, "a faixa de agentes deve vir antes das ações");
  assert.ok(ai.includes('className={agentsGridTw} role="listbox" aria-label="Agentes de IA"'));
  assert.ok(ai.includes('const agentsGridTw = "mt-3 grid w-full max-w-full grid-cols-ai-agents gap-2"'), "a faixa deve usar a grade do preset");
  const gridLine = ai.split("\n").find((line) => line.startsWith("const agentsGridTw =")) ?? "";
  assert.equal(gridLine.includes("overflow-x-auto"), false, "a faixa não pode voltar a ter rolagem horizontal");
  assert.equal(ai.match(/role="listbox"/g)?.length, 1, "deve existir uma única lista de agentes");
  assert.ok(ai.includes('const workspaceLayoutTw = "grid min-w-0 grid-cols-1 gap-token lg:grid-cols-ai-layout"'), "as colunas do workspace devem usar o preset");
  assert.equal(gridLine.includes("grid-cols-ai-layout"), false, "a lista não pode usar a grade estreita do layout");
});

test("a criação de agentes vive na sidebar, acima da navegação e fora da lista", () => {
  const sidebar = ai.indexOf('<aside className={workspaceSidebarTw}>');
  const quickActions = ai.indexOf('{workspaceTab==="Agentes"&&<div className={agentQuickActionsTw}');
  const agents = ai.indexOf('{workspaceTab==="Agentes"&&<section className={adminCardTw}>');
  const nav = ai.indexOf('<nav className={workspaceNavTw}');
  assert.ok(sidebar >= 0, "a sidebar da inteligência não foi encontrada");
  assert.ok(quickActions > sidebar, "as ações rápidas precisam ficar dentro da sidebar");
  assert.ok(quickActions < nav, "as ações rápidas precisam ficar acima da navegação");
  assert.ok(quickActions < agents, "as ações rápidas precisam ficar na sidebar, antes do conteúdo");
  assert.ok(ai.includes('<div className={adminHeadingTw}><h2 className={adminHeadingTitleTw}>'), "o cabeçalho da lista deve ficar limpo");
  assert.ok(ai.includes('aria-label="Criação de agente"'));
  assert.ok(ai.includes('aria-label="Tipo de agente"'));
  assert.ok(ai.includes('aria-label="Template da área"'));
  assert.ok(ai.includes('const sidebarLabelTw = "text-2xs font-extrabold uppercase tracking-wider text-ink-secondary"'));
  assert.ok(ai.includes('<span className={sidebarLabelTw}>Criar agente</span>'));
  assert.ok(ai.includes('<select className={sidebarSelectTw} aria-label="Tipo de agente"'));
  assert.ok(ai.includes('<select className={sidebarSelectTw} aria-label="Template da área"'));
  assert.ok(ai.includes('Use Novo na barra lateral'), "o estado vazio precisa apontar para a sidebar");
});

test("a navegação ativa usa texto branco sem cor herdada conflitante", () => {
  assert.ok(ai.includes('const workspaceNavActiveTw = "bg-blue-600 text-white shadow-token-sm hover:bg-blue-600 hover:text-white"'));
  assert.doesNotMatch(ai, /const workspaceNavItemTw = "[^"]*text-(?:ink|slate|blue-50)/);
  assert.ok(ai.includes("active ? workspaceNavActiveTw : workspaceNavIdleTw"));
  assert.ok(ai.includes("`${workspaceNavItemTw} ${workspaceNavIdleTw}`"));
});

test("os blocos das abas do agente têm respiro entre si", () => {
  for (const token of [
    'const adminFieldsTw = "grid gap-5"',
    'const surfaceFieldsTw = "grid min-w-0 gap-4 rounded-token border border-line bg-surface p-pad shadow-token"',
    'const checkboxGroupTw = "mt-5 grid min-w-0 gap-4 rounded-xl border border-line bg-surface-2 p-4"',
    'const subtleCardTw = "grid gap-4 rounded-xl border border-line bg-surface-2 p-3.5"',
    'const fieldsetSpacingTw = "mt-5"',
  ]) {
    assert.ok(ai.includes(token), `falta o espaçamento: ${token}`);
  }
});

test("as Informações ficam centralizadas na aba Agentes", () => {
  assert.doesNotMatch(ai, /"Conhecimento"/);
  assert.ok(ai.includes('useState<"Agentes"|"Configuração geral"|"Testar">("Agentes")'));
  assert.ok(ai.includes('{workspaceTab==="Agentes"&&<section className={adminCardTw}>'));
  assert.ok(ai.includes('<BrainCircuit size={19}/> Informações da empresa'));
  assert.ok(ai.includes('<summary><strong>Editar informações e documentos</strong></summary>'));
  assert.ok(ai.includes('<RichPromptEditor label={"Informações importantes"}'));
  assert.ok(ai.includes('para informações de toda a empresa, use a seção Informações nesta aba'));
});

test("os contratos de acessibilidade do workspace permanecem intactos", () => {
  for (const contrato of [
    'role="tablist"',
    'aria-label="Áreas de configuração da inteligência"',
    'aria-label="Configurações do agente"',
    'aria-controls="ai-workspace-tabpanel"',
    'aria-controls="ai-agent-tabpanel"',
    'id="ai-workspace-tabpanel"',
    'id="ai-agent-tabpanel"',
    'role="tabpanel"',
    'role="listbox"',
    'aria-label="Agentes de IA"',
    'role="option"',
    'aria-selected={selected === a.id}',
    'aria-label="Tipo de agente"',
    'role="status"',
    'role="alert"',
  ]) {
    assert.ok(ai.includes(contrato), `contrato ausente: ${contrato}`);
  }
});

test("os tokens de IA do preset preservam as medidas migradas", () => {
  for (const token of ['"ai-layout"', '"ai-agents"', '"ai-panel"', '"ai-phone"']) {
    assert.ok(config.includes(token), `token ausente no preset: ${token}`);
  }
  assert.equal(config.includes("color-mix("), false, "color-mix não pode voltar ao preset");
  assert.equal(/#2E7CF6/i.test(ai), false, "azul fixo não pode reaparecer na fatia");
});
