import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guard puro (node:test, sem jsdom): lê as duas fontes migradas.
const WEB = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const AVATARS = path.join(WEB, "src", "app", "inbox-avatars.tsx");
const COPILOT = path.join(WEB, "src", "app", "inbox-copilot.tsx");

const avatarsRaw = fs.readFileSync(AVATARS, "utf8");
const copilotRaw = fs.readFileSync(COPILOT, "utf8");

/** Dados do contato e style={{}} não são classes: fora da auditoria de utilitários. */
function jsxOf(raw) {
  return raw
    .replace(/style=\{\{[\s\S]*?\}\}/g, "")
    .replace(/export function contactLabels\([\s\S]*?\n\}/g, "export function contactLabels(contact) { return dados; }");
}
const avatars = jsxOf(avatarsRaw);
const copilot = jsxOf(copilotRaw);

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
  return (code.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) || []).map((value) => value.slice(1, -1));
}

/** Constantes e mapas que resolvem para literais completas de classes. */
function declarations(src) {
  const constants = new Map();
  const maps = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  for (const name of ["channelTw", "tabTw"]) {
    const start = src.indexOf("const " + name);
    if (start < 0) continue;
    const end = src.indexOf("\n};", start);
    const block = src.slice(start, end >= 0 ? end + 3 : start + 800);
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
const ALLOWED_VARIANTS = ["ib-narrow:", "ov-laptop:", "rw-laptop:"];

function tokensOf(values) {
  return values.flatMap((value) => value.split(/\s+/)).filter(Boolean);
}

function assertCleanTokens(values, label) {
  for (const token of tokensOf(values)) {
    let normalized = token;
    for (const variant of ALLOWED_VARIANTS) normalized = normalized.split(variant).join("");
    for (const prefix of BANNED_PREFIXES) {
      assert.ok(!normalized.startsWith(prefix), `${label}: token legado ${JSON.stringify(token)}`);
      assert.ok(!normalized.includes("-" + prefix), `${label}: token legado ${JSON.stringify(token)}`);
    }
    for (const name of BANNED_NAMES) {
      assert.ok(!normalized.includes(name), `${label}: classe componente ${JSON.stringify(token)}`);
    }
    assert.ok(!normalized.includes("["), `${label}: valor arbitrário em ${JSON.stringify(token)}`);
    assert.ok(!normalized.includes("#"), `${label}: hex em classe ${JSON.stringify(token)}`);
    assert.ok(!normalized.includes("!"), `${label}: important em classe ${JSON.stringify(token)}`);
  }
}

test("as duas fontes migradas existem e são arquivos distintos", () => {
  assert.ok(fs.existsSync(AVATARS));
  assert.ok(fs.existsSync(COPILOT));
  assert.notStrictEqual(AVATARS, COPILOT);
});

test("avatares e copiloto não têm tokens legados, arbitrários, hex ou important", () => {
  for (const [label, source] of [["inbox-avatars", avatars], ["inbox-copilot", copilot]]) {
    assertCleanTokens(classValues(source), label);
    assert.doesNotMatch(source, /\b(?:ov|vx|ib|rw|auth|alarm|platform-admin)-[a-z]/, `${label}: token legado no JSX`);
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
      /color-mix\(/,
    ]) {
      assert.equal(source.match(forbidden), null, `${label}: remendo proibido ${forbidden}`);
    }
  }
  // O hex de tag continua sendo dado do contato, nunca classe.
  assert.ok(avatarsRaw.includes('color: "#eeecff"'));
});

test("avatares e copiloto usam utilities Tailwind padrão", () => {
  for (const util of [
    "inline-grid h-5 w-5 flex-none place-items-center rounded-full",
    "bg-slate-200 font-extrabold tracking-tight text-slate-800",
    "grid h-7 w-7 flex-none place-items-center rounded-full bg-blue-100 text-xs font-bold",
    "relative block h-full w-full overflow-hidden rounded-full",
  ]) {
    assert.ok(avatars.includes(util), `inbox-avatars sem "${util}"`);
  }
  for (const util of [
    "rounded-lg border border-slate-200 bg-slate-50",
    "dark:border-slate-700 dark:bg-slate-900",
    "min-h-9 rounded-lg border border-slate-200 bg-white",
    "min-h-4 items-center rounded-full bg-blue-100",
    "max-w-md text-xs",
  ]) {
    assert.ok(copilot.includes(util), `inbox-copilot sem "${util}"`);
  }
  assert.ok(classValues(avatars).some((value) => value.includes("inline-grid h-5 w-5 flex-none place-items-center rounded-full")));
  assert.ok(classValues(copilot).some((value) => value.includes("max-w-md text-xs")));
});

test("o dark mode é slate real, nunca blue-dark", () => {
  assert.ok(avatars.includes("dark:bg-slate-800"));
  assert.ok(avatars.includes("dark:text-slate-50"));
  assert.ok(copilot.includes("dark:bg-slate-900"));
  assert.ok(copilot.includes("dark:bg-slate-800"));
  assert.ok(copilot.includes("dark:border-slate-700"));
  assert.ok(copilot.includes("dark:text-slate-200"));
  for (const [label, source] of [["inbox-avatars", avatars], ["inbox-copilot", copilot]]) {
    assert.doesNotMatch(source, /dark:(?:bg|text|border)-blue-|blue-(?:950|900)/, `${label}: blue-dark reintroduzido`);
  }
});

test("constantes e variantes de estado resolvem para literais completas", () => {
  const avatarsLiterals = [
    'const channelBaseTw = "inline-grid h-5 w-5 flex-none place-items-center rounded-full"',
    'const contactAvatarFillTw = "relative block h-full w-full overflow-hidden rounded-full"',
    'ai: "bg-blue-100 text-blue-700 dark:bg-slate-800 dark:text-slate-200"',
    'whatsapp: "bg-emerald-100 text-emerald-600 dark:bg-slate-800 dark:text-slate-200"',
  ];
  for (const literal of avatarsLiterals) assert.ok(avatars.includes(literal), `literal incompleta: ${literal}`);
  const copilotLiterals = [
    'const primaryButton = "inline-flex min-h-9',
    'const secondaryButton = "inline-flex min-h-9',
    'const selectTw = "min-h-9',
    'const eyebrowTw = "inline-flex items-center gap-1.5 text-xs',
    'const noticeTw = "m-0 text-xs text-amber-600',
    'const errorTw = "m-0 text-xs text-red-600',
    'active: "bg-blue-100 text-blue-800 dark:bg-slate-800 dark:text-slate-50"',
    'idle: "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"',
  ];
  for (const literal of copilotLiterals) assert.ok(copilot.includes(literal), `literal incompleta: ${literal}`);
  // A única concatenação em className combina uma literal completa com um mapa.
  for (const code of bracedValues(copilot, "className")) {
    if (!code.includes("+")) continue;
    assert.match(code, /^\s*"[^"]+"\s*\+\s*tabTw\[[^\]]+\]\s*$/, `concatenação solta: ${code}`);
  }
  assert.ok(copilot.includes("className={errorTw}"));
  assert.ok(!copilot.includes('noticeTw+"'));
});

test("os contratos funcionais dos avatares permanecem intactos", () => {
  for (const key of [
    "avatarUrl", "profilePictureUrl", "photoUrl", "pictureUrl",
    "profileImage", "profilePicUrl", "profilePicture", "imageUrl", "photo", "avatar",
  ]) {
    assert.ok(avatarsRaw.includes(`"${key}"`), `chave de metadata perdida: ${key}`);
  }
  for (const token of [
    "export function avatarUrl(", "export function ChannelMark(", "export function ContactAvatar(",
    "export function InitialsAvatar(", "export function contactLabels(",
    String.raw`/^https:\/\//i.test(value)`, "const proxy = \"/api/backend/contacts/\" + contact.id + \"/avatar\"",
    "useEffect(() => setSrc(proxy), [proxy, contact.metadata?.avatarUrl])",
    'alt={"Foto de " + contactDisplayName(contact)}', 'loading="lazy"',
    'referrerPolicy="no-referrer"',
    "onError={() => setSrc(current => current === proxy ? avatarUrl(contact) : null)}",
    "contact.metadata?.tags", 'name: raw, color: "#eeecff"',
    'data-testid="mention-avatar"', "parts.slice(0, 2)",
    "Atendimento por IA", "Atendimento por chatbot", "Chatbot do site", "Inteligência artificial",
  ]) {
    assert.ok(avatarsRaw.includes(token), `contrato ausente: ${token}`);
  }
  for (const label of ["IA", "Chatbot", "E-mail", "Instagram", "Facebook", "TikTok", "WhatsApp"]) {
    assert.ok(avatarsRaw.includes(`aria-label="${label}"`), `aria-label perdido: ${label}`);
  }
  assert.strictEqual((avatarsRaw.match(/aria-label="/g) || []).length, 7);
  assert.strictEqual((avatarsRaw.match(/aria-label=\{isAi \? "IA" : "Chatbot"\}/g) || []).length, 1);
});

test("os contratos funcionais, e2e e de acessibilidade do copiloto permanecem intactos", () => {
  for (const token of [
    "export function InboxCopilot(", "type Result=", "const languages:Record<string,string>=",
    'role="tablist"', 'aria-label="Ações da assistente"', 'role="tab"',
    "aria-selected={action===item.id}", 'role="status"', 'role="alert"', 'dir="auto"',
    "<VexoraDialog", "onUse(result.text)", "onSend(result.text)", "onNote()", "onClose()",
    "async function generate(", "async function send(", "async function saveNote()",
    '"/api/backend/conversations/"+conversationId+"/copilot"', '"/internal-notes?view="+encodeURIComponent(view)',
    "setSaved(true)", "const changed=draft!==source", 'method:"POST"', 'signal:controller.signal',
  ]) {
    assert.ok(copilotRaw.includes(token), `contrato ausente: ${token}`);
  }
  assert.strictEqual((copilotRaw.match(/role="tab"/g) || []).length, 1);
  assert.strictEqual((copilotRaw.match(/h-1\.5 w-1\.5 animate-pulse/g) || []).length, 3);
  for (const id of ["pt-BR", "en", "es", "fr", "de", "it", "ja", "zh", "ar"]) {
    assert.ok(copilotRaw.includes(`"${id}":`) || copilotRaw.includes(`${id}:`), `idioma perdido: ${id}`);
  }
  for (const option of ['value="natural"', 'value="cordial"', 'value="formal"', 'value="conciso"']) {
    assert.ok(copilotRaw.includes(option), `tom perdido: ${option}`);
  }
  for (const text of [
    "Melhorar texto", "Traduzir rascunho", "Sugerir resposta", "Resumir atendimento",
    "Traduzir mensagem", "Assistente de escrita", "Preparando…", "Gerar outra versão",
    "Gerar versão", "Ajustando as palavras…", "A assistente está trabalhando no texto.",
    "MENSAGEM ORIGINAL", "SEU RASCUNHO", "Preservada no histórico", "Texto atual",
    "Prévia", "Resumo para a equipe", "Tradução da mensagem", "Sugestão pronta para revisar",
    "Substituir rascunho atual", "Usar no rascunho", "Enviando…", "Enviar esta versão",
    "Salvo no chat interno", "Salvar como nota interna",
    "Resumo sugerido pela IA · revisado pela equipe",
    "Seu rascunho mudou desde a geração. Confira antes de substituí-lo.",
    "Tradução para leitura. Nenhuma mensagem enviada.",
    "Usa a IA e o limite diário desta empresa. Notas internas ficam fora da análise.",
    "Escolha o idioma e o tom, gere uma versão e confira o resultado.",
  ]) {
    assert.ok(copilotRaw.includes(text), `texto e2e perdido: ${text}`);
  }
});
