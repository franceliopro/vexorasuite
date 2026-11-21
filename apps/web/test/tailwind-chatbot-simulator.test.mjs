import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const workspace = read("src/app/chatbot-workspace.tsx");
/* A fatia cobre só o simulador: o shell do canvas ainda é exigido por
   flow-canvas-layout/clipping e será migrado numa sub-fatia separada. */
const simulator = workspace.slice(
  workspace.indexOf("type PhoneSimulatorProps"),
  workspace.indexOf("export function ChatbotWorkspace"),
);

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
const classes = classValues(simulator);
const tokens = classes.split(/\s+/).filter(Boolean);

const legacy = new Set([
  "phone-simulator",
  "phone-frame",
  "phone-side-button",
  "phone-side-volume-up",
  "phone-side-volume-down",
  "phone-side-power",
  "phone-screen",
  "phone-island",
  "phone-statusbar",
  "phone-clock",
  "phone-signal",
  "phone-chat-header",
  "phone-avatar",
  "phone-peer",
  "phone-online-dot",
  "phone-call-icons",
  "phone-wallpaper",
  "phone-day-pill",
  "phone-bubble",
  "phone-ticks",
  "phone-quick-replies",
  "phone-composer",
  "phone-composer-pill",
  "phone-composer-hint",
  "phone-composer-mic",
  "phone-home-indicator",
  "chatbot-simulator-close",
  "is-fullscreen",
  "bot",
  "user",
]);

test("o simulador não usa classes componente legadas", () => {
  for (const token of tokens) {
    assert.equal(legacy.has(token), false, `classe legada no JSX: ${token}`);
  }
});

test("o simulador usa só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = simulator.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  for (const utility of [
    "aspect-phone-frame",
    "w-phone-frame",
    "rounded-phone-screen",
    "bg-phone-wallpaper",
    "bg-phone-wallpaper-size",
    "animate-phone-pulse",
    "max-w-phone-bubble",
    "rounded-tl-phone-tail",
    "rounded-tr-phone-tail",
    "z-phone-island",
  ]) {
    assert.ok(simulator.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens do simulador", () => {
  for (const token of [
    'frame: "#454b54"',
    'screen: "#0b141a"',
    'chrome: "#202c33"',
    'ink: "#e9edef"',
    'muted: "#8696a0"',
    'divider: "#2a3942"',
    'pill: "#182229"',
    'sent: "#123E63"',
    'tick: "#53bdeb"',
    '"on-accent": "#04120d"',
    'accent: "var(--primary)"',
    '"accent-soft": "var(--primary-soft)"',
    '"phone-frame": "9 / 18.6"',
    '"phone-frame": "min(300px,84vw)"',
    '"phone-frame-overlay": "min(360px,88vw)"',
    '"phone-frame": "min(760px,92dvh)"',
    '"phone-pulse": "phone-pulse 2.4s ease-in-out infinite"',
    '"phone-wallpaper": "auto, auto, 17px 17px"',
    '"phone-pill": "9px"',
    '"phone-tail": "3px"',
    '"phone-bubble": "11px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("o simulador preserva contratos, acessibilidade e estados", () => {
  for (const marker of [
    "type PhoneSimulatorProps",
    "onClose",
    "onChoose",
    "onReply",
    "fullscreen",
    'aria-label="Fechar simulação"',
    'aria-label={"Celular com o robô " + botName}',
    'role="log"',
    'aria-label="Conversa simulada com o robô"',
    'role="group"',
    'aria-label="Opções do robô"',
    'aria-label="Resposta do cliente"',
    'aria-label="Enviar resposta"',
    "onClick={onClose}",
    "onClick={chip.onChoose}",
    "onReply(reply.trim())",
    'data-fullscreen={fullscreen ? "true" : undefined}',
  ]) {
    assert.ok(simulator.includes(marker), `missing ${marker}`);
  }
  assert.doesNotMatch(simulator, /requestFullscreen/);
});
