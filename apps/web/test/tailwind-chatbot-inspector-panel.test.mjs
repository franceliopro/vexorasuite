import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/chatbot-workspace.tsx");

/* Sub-fatia do painel do inspetor: começa no <aside> das propriedades e vai
   até o diálogo de criação com IA, que tem guard próprio. O estado de carga
   entra junto porque usa o mesmo cartão. */
const panelStart = workspace.indexOf('<aside className={`${canvasPanel} ${canvasInspector}');
const panelEnd = workspace.indexOf("{aiCreateOpen?", panelStart);
assert.notEqual(panelStart, -1, "inspetor não encontrado");
assert.notEqual(panelEnd, -1, "diálogo de IA não encontrado");
const loadingStart = workspace.indexOf("if(!ready)return");
const loadingReturnEnd = workspace.indexOf("</section>;", loadingStart);
const loadingEnd = loadingReturnEnd < 0 ? -1 : loadingReturnEnd + "</section>;".length;
assert.notEqual(loadingStart, -1, "estado de carga não encontrado");
assert.notEqual(loadingEnd, -1, "retorno do estado de carga não encontrado");
const loading = workspace.slice(loadingStart, loadingEnd);
const panel = workspace.slice(panelStart, panelEnd);
const region = loading + "\n" + panel;

const constants = new Map();
for (const match of workspace.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
  constants.set(match[1], match[2]);
}

function classValues(source) {
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

const classes = classValues(region);

test("o inspetor não usa classes componente legadas", () => {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    assert.equal(
      /^(?:vx-|ib-|rw-|ov-|chatbot-channel-|chatbot-panel$|chatbot-transition-editor$|chatbot-simulator(?:-heading|-overlay)?$|content-card$|business-flow-|primary-button$|secondary-button$|danger-button$|danger-text$|icon-button$)/.test(token),
      false,
      `classe legada no JSX: ${token}`,
    );
  }
  assert.doesNotMatch(region, /className="(?:chatbot-channel-|chatbot-panel|chatbot-simulator|content-card)/);
});

test("o inspetor usa utilities literais e tokens do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "grid min-w-0 gap-3 rounded-token-lg border border-line bg-surface-2 p-pad shadow-none",
    "grid gap-1.5",
    "flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-2.5 py-2 text-small font-semibold text-ink transition-colors hover:border-line-strong hover:bg-hover",
    "flex items-center gap-2.5 rounded-xl border border-blue-600/45 bg-brand-soft px-2.5 py-2 text-small font-semibold text-ink transition-colors",
    "size-4 min-h-4 flex-none accent-blue-600",
    "grid size-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface",
    "grid min-w-0 gap-px text-small font-semibold text-ink",
    "text-catalog-metric font-normal text-ink-secondary",
    "grid gap-2 rounded-token border border-line bg-surface p-3",
    "flex flex-wrap items-start justify-between gap-3",
    "fixed inset-0 z-flow-fullscreen grid animate-dialog-scrim place-items-center bg-overlay p-4 backdrop-blur-sm",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
  for (const name of [
    "inspectorCardTw",
    "inspectorSimulatorCardTw",
    "inspectorSimulatorHeadingTw",
    "inspectorChannelListTw",
    "inspectorChannelItemTw",
    "inspectorChannelItemActiveTw",
    "inspectorChannelInputTw",
    "inspectorChannelGlyphTw",
    "inspectorChannelCopyTw",
    "inspectorChannelMetaTw",
    "inspectorTransitionTw",
    "inspectorSimulatorOverlayTw",
  ]) {
    assert.match(workspace, new RegExp(`\\bconst\\s+${name}\\s*=\\s*"[^"]+"`), `constante ${name} não é literal completa`);
  }
});

test("o inspetor preserva contratos, acessibilidade e estados", () => {
  for (const marker of [
    'aria-label="Ajustar largura do painel de propriedades"',
    'aria-label="Fechar painel"',
    'data-flow-panel-handle',
    'aria-label={rightCollapsed?"Exibir propriedades":"Ocultar propriedades"}',
    'aria-pressed={studioPanel==="settings"}',
    'aria-pressed={studioPanel==="test"}',
    'aria-pressed={studioPanel==="nodes"}',
    'data-flow-public-page',
    'platformColor(channel.platform||channel.provider)',
    '<PlatformIcon platform={channel.platform||channel.provider} size={22}/>',
    'chatbot-delete-block',
    'aria-label={`Destino de ${option}`}',
    'Abrir no celular',
    'Reiniciar teste',
    'Teste local: nada é enviado para clientes reais.',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label="Simulação do chatbot"',
    'onMouseDown={e=>{if(e.target===e.currentTarget)setSimulatorFullScreen(false)}}',
    'onClose={()=>setSimulatorFullScreen(false)}',
    'fullscreen/>',
    'createPortal(',
  ]) {
    assert.ok(panel.includes(marker), `painel perdeu ${marker}`);
  }
  assert.ok(loading.includes('aria-busy={!loadError}'), "estado de carga perdeu aria-busy");
  assert.ok(loading.includes("Tentar novamente"), "estado de carga perdeu a ação de nova tentativa");
  assert.ok(panel.includes('className={(flow.channelIds||[]).includes(channel.id)?inspectorChannelItemActiveTw:inspectorChannelItemTw}'), "seleção de canal deixou de refletir o estado");
});
