import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guard puro (node:test, sem jsdom): lê as duas fontes migradas.
const WEB = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const LIST = path.join(WEB, "src", "app", "conversation-list.tsx");
const TRACK = path.join(WEB, "src", "app", "inbox-track.tsx");

const listRaw = fs.readFileSync(LIST, "utf8");
const trackRaw = fs.readFileSync(TRACK, "utf8");
const sources = [["conversation-list", listRaw], ["inbox-track", trackRaw]];

/** Conteúdo de um atributo JSX com chaves balanceadas. */
function bracedValues(src, attribute) {
  const values = [];
  const re = new RegExp("\\b" + attribute + "\\s*=\\s*\\{", "g");
  let match;
  while ((match = re.exec(src))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    values.push(src.slice(start, end));
    re.lastIndex = end + 1;
  }
  return values;
}

function quotedStrings(code) {
  return (code.match(/"[^"\n]*"|'[^'\n]*'/g) || []).map((value) => value.slice(1, -1));
}

/** Constantes TW, mapas de estado e literais de className resolvem para classes completas. */
function declarations(src) {
  const constants = new Map();
  const maps = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  for (const name of ["presenceToneTw", "tickToneTw"]) {
    const start = src.indexOf("const " + name);
    if (start < 0) continue;
    const end = src.indexOf("};", start);
    const block = src.slice(start, end >= 0 ? end + 2 : start + 800);
    maps.set(name, quotedStrings(block).filter(Boolean));
  }
  return { constants, maps };
}

function classValues(src) {
  const { constants, maps } = declarations(src);
  const values = [];
  for (const match of src.matchAll(/\bclassName\s*=\s*"([^"]*)"/g)) values.push(match[1]);
  for (const code of bracedValues(src, "className")) {
    for (const literal of quotedStrings(code)) {
      if (literal.trim()) values.push(literal);
    }
    for (const id of code.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
      if (maps.has(id[1])) values.push(...maps.get(id[1]));
    }
  }
  return values;
}

const BANNED_PREFIXES = [
  "ov-", "vx-", "ib-", "rw-", "auth-", "alarm-", "platform-admin-",
  "vx-rich-", "vx-post-", "vx-gallery-", "design-approval-",
];
const BANNED_NAMES = [
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button", "vx-spin",
];
const ALLOWED_VARIANTS = new Set(["dark", "hover", "focus-visible", "disabled", "sm", "md", "lg"]);

function tokensOf(values) {
  return values.flatMap((value) => value.split(/\s+/)).filter(Boolean);
}

function assertCleanTokens(values, label) {
  for (const token of tokensOf(values)) {
    const segments = token.split(":");
    for (const variant of segments.slice(0, -1)) {
      assert.ok(ALLOWED_VARIANTS.has(variant), `${label}: variante não autorizada ${variant}`);
    }
    const base = segments[segments.length - 1];
    for (const prefix of BANNED_PREFIXES) {
      assert.ok(!base.startsWith(prefix), `${label}: token legado ${JSON.stringify(token)}`);
      assert.ok(!base.includes("-" + prefix), `${label}: token legado ${JSON.stringify(token)}`);
    }
    for (const name of BANNED_NAMES) {
      assert.ok(!base.includes(name), `${label}: classe componente ${JSON.stringify(token)}`);
    }
    assert.ok(!/[[\]#!]/.test(base), `${label}: arbitrário, hex ou important em ${JSON.stringify(token)}`);
  }
}

test("as duas fontes migradas existem e são arquivos distintos", () => {
  assert.ok(fs.existsSync(LIST));
  assert.ok(fs.existsSync(TRACK));
  assert.notStrictEqual(LIST, TRACK);
});

test("as conversas restantes não têm tokens legados, arbitrários, hex ou remendos", () => {
  for (const [label, source] of sources) {
    assertCleanTokens(classValues(source), label);
    assert.doesNotMatch(source, /\b(?:ov|vx|ib|rw|auth|alarm|platform-admin)-[a-z]/, `${label}: token legado no JSX`);
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
    ]) {
      assert.equal(source.match(forbidden), null, `${label}: remendo proibido ${forbidden}`);
    }
  }
});

test("a lista e o track usam utilities Tailwind padrão", () => {
  for (const util of [
    "grid min-h-0 flex-1 content-start overflow-y-auto",
    "gap-x-2 gap-y-1",
    "border-b border-l-2 border-gray-200",
    "duration-200 ease-in-out",
    "h-11 w-11",
    "h-3 w-3",
    "text-xs tabular-nums",
    "text-2xs",
    "min-h-4",
    "rounded-lg",
    "ring-1 ring-inset ring-blue-100",
    "bg-blue-700",
    "bg-red-600",
    "bg-amber-600",
  ]) {
    assert.ok(listRaw.includes(util), `conversation-list sem "${util}"`);
  }
  for (const util of [
    "w-full max-w-3xl max-h-dvh",
    "rounded-2xl border border-gray-200",
    "px-5 pb-5",
    "grid-cols-1 gap-3.5 sm:grid-cols-2",
    "my-2 grid min-w-0 content-start gap-2",
    "rounded-xl border border-gray-200",
    "font-semibold",
    "bg-blue-700 px-4 text-xs font-bold text-white",
  ]) {
    assert.ok(trackRaw.includes(util), `inbox-track sem "${util}"`);
  }
  assert.ok(classValues(listRaw).some((value) => value.includes("h-11 w-11")));
  assert.ok(classValues(trackRaw).some((value) => value.includes("max-h-dvh")));
});

test("o dark é slate real, nunca blue-dark", () => {
  for (const token of ["dark:bg-slate-900", "dark:bg-slate-800", "dark:border-slate-700", "dark:text-slate-200", "dark:hover:bg-slate-800"]) {
    assert.ok(listRaw.includes(token), `conversation-list sem ${token}`);
  }
  for (const token of ["dark:bg-slate-900", "dark:bg-slate-800", "dark:border-slate-700", "dark:text-slate-50", "dark:hover:bg-slate-700"]) {
    assert.ok(trackRaw.includes(token), `inbox-track sem ${token}`);
  }
  for (const [label, source] of sources) {
    assert.doesNotMatch(source, /dark:(?:bg|text|border)-blue-(?:950|900|800)\b|\bblue-(?:950|900)\b/, `${label}: blue-dark reintroduzido`);
  }
});

test("constantes e mapas de estado resolvem para literais completas", () => {
  const listLiterals = [
    'const conversationRowTw = "relative flex w-full flex-wrap content-start items-start gap-x-2',
    'const conversationRowSelectedTw = "border-l-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-100 dark:bg-slate-800 dark:ring-slate-700"',
    'const conversationRowIdleTw = "border-l-transparent"',
    'overdue: "bg-red-600"',
    'idle: "bg-amber-600"',
    'read: "text-emerald-600 dark:text-emerald-400"',
    'sent: "text-slate-600 dark:text-slate-300"',
  ];
  for (const literal of listLiterals) assert.ok(listRaw.includes(literal), `literal incompleta: ${literal}`);
  const trackLiterals = [
    'const primaryTw = "inline-flex min-h-9',
    'const secondaryTw = "inline-flex min-h-9',
    'bg-blue-700 px-4 text-xs font-bold text-white shadow-sm',
    'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"',
  ];
  for (const literal of trackLiterals) assert.ok(trackRaw.includes(literal), `literal incompleta: ${literal}`);
  // Nenhuma className usa template interpolado: só literais completas e mapas.
  for (const [label, source] of sources) {
    for (const code of bracedValues(source, "className")) {
      assert.doesNotMatch(code, /`/, `${label}: template interpolado em className: ${code}`);
    }
  }
});

test("os contratos funcionais da lista de conversas permanecem intactos", () => {
  for (const token of [
    'data-testid="conversation-list"',
    "aria-pressed={selected}",
    'role="img" aria-label={mark.label}',
    'role="status"',
    "Carregando conversas…",
    "Buscando as conversas desta fila.",
    "Nenhuma conversa nesta fila",
    "Nenhuma conversa atribuída a você",
    "Nenhuma conversa da sua equipe",
    "Nenhuma conversa em que você foi incluído",
    "onSelect(item)",
    "style={{ backgroundColor: tag.color",
    "tagForeground(tag.color)",
    "borderColor: tag.color",
    "function timeShortLabel(",
    "formatDateBR(date)",
    "contactDisplayName(item.contact, item.botState)",
    "Atrasado · sem assistência",
    "Nova há ",
    "Sem mensagens",
  ]) {
    assert.ok(listRaw.includes(token), `contrato ausente: ${token}`);
  }
  assert.ok((listRaw.match(/ChannelMark/g) ?? []).length >= 2);
  for (const status of ["QUEUED", "FAILED", "READ", "DELIVERED", "SENT"]) {
    assert.ok(listRaw.includes(`"${status}"`), `status perdido: ${status}`);
  }
});

test("a lista continua sem estado de busca: filtros e telefone vivem no workspace", () => {
  const workspace = fs.readFileSync(path.join(WEB, "src", "app", "inbox-workspace.tsx"), "utf8");
  assert.doesNotMatch(listRaw, /useState|onChange=|inbox-filter-/);
  assert.match(listRaw, /export function ConversationList\(\{ conversations, conversationsLoading, selectedId, queueView, onSelect \}/);
  assert.match(workspace, /<ConversationList conversations=\{visibleConversations\}/);
  assert.match(workspace, /data-testid="inbox-list-tools"/);
  assert.ok(workspace.indexOf('data-testid="inbox-list-tools"') > workspace.indexOf("<ConversationList conversations={visibleConversations}"));
});

test("os contratos funcionais e2e do Track permanecem intactos", () => {
  for (const token of [
    'role={menuItem ? "menuitem" : undefined}',
    'aria-label="Véxora Track"',
    'aria-label="Chave de ingestão"',
    'aria-label="Dispositivos"',
    'aria-pressed={selected === device.id}',
    'role="alert"',
    'role="status"',
    "dialog.current?.showModal()",
    "dialog.current?.close()",
    'onClose={() => setToken("")}',
    'fetch("/api/backend/track/" + path',
    '"devices?page=" + targetPage',
    '"devices"',
    '"/simulate"',
    '"/history"',
    'values.get("name")',
    'values.get("reference")',
    'values.get("team") || null',
    'values.get("mode") === "simulation"',
    'values.get("latitude")',
    'values.get("longitude")',
    "Gerar outra chave? A chave atual deixará de receber posições.",
    "Dispositivo cadastrado.",
    "Posição simulada registrada.",
    "Nova chave gerada.",
    "Dispositivo atualizado.",
    "Falha no Track.",
    "Chave de ingestão",
    "Cadastrar dispositivo",
    "Filtrar nesta página",
    "Atualizar",
    "Anterior",
    "Próxima",
    "Pausar recebimento",
    "Retomar recebimento",
    "Gerar nova chave",
    "Histórico de posições",
    "Nenhum dispositivo disponível.",
    "openstreetmap.org",
  ]) {
    assert.ok(trackRaw.includes(token), `contrato ausente: ${token}`);
  }
  assert.ok((trackRaw.match(/role="status"/g) ?? []).length >= 2);
});
