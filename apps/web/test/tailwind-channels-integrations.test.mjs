import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const source = read("src/app/channels-integrations.tsx");

/** Literais de className e constantes TW referenciadas por className são classes. */
function classValues(src) {
  const constants = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
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
const classes = classValues(source);
const vxDeclared = new Set([...config.matchAll(/"(vx-[a-z0-9-]+)"/g)].map((match) => match[1]));
const legacyScanClasses = classes
  .split(/\s+/)
  .filter((token) => {
    const name = token.match(/vx-[a-z0-9-]+/)?.[0];
    return !(name && vxDeclared.has(name) && /^[a-z][a-z0-9-]*-vx-[a-z0-9-]+$/.test(token));
  })
  .join("\n");

test("a página de conexões não usa classes componente legadas", () => {
  for (const forbidden of [
    /^channels-(?:page|shell-heading|shell-section|section-heading|section-metric|provider-mark|configuration-shell|connection-form|connection-shortcuts|form-note|inbox-grid|inbox-card|inbox-title|inbox-name|inbox-route|inbox-actions|inbox-editor|platform-icon|platform-icon-large|status-pill|settings-toggle|alert|google-shell|google-grid|google-card|connected-list|google-account|google-account-actions|renewable-warning|help|help-body|attach-fieldset|attach-grid|attach-toggle|attach-warning|waha-qr)$/m,
    /^content-card$/m,
    /^eyebrow$/m,
    /^compact$/m,
    /^(?:error|success)$/m,
    /^(?:primary|secondary|text|danger|icon)-button$/m,
    /^danger-text$/m,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("a página de conexões usa só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]'"\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  // Hex em mailBrandColor e no style das marcas é dado do provedor, não remendo.
  assert.match(source, /function mailBrandColor\(/);
  for (const utility of [
    "grid-cols-channels-inbox",
    "grid-cols-channels-google",
    "grid-cols-channels-attach",
    "rounded-channels-card",
    "rounded-channels-alert",
    "rounded-channels-help",
    "rounded-channels-attach",
    "rounded-channels-account",
    "text-channels-name",
    "text-channels-meta",
    "text-channels-field",
    "h-channels-icon",
    "w-channels-icon",
    "h-channels-icon-lg",
    "w-channels-icon-lg",
    "h-channels-metric",
    "min-w-channels-metric",
    "bg-channels-qr",
    "bg-blue-600",
    "border-gray-200",
    "bg-zinc-100",
    "bg-zinc-200",
    "text-slate-950",
    "text-blue-800",
    "text-xs font-extrabold uppercase tracking-wider text-blue-800",
    "text-xs text-slate-600",
    "text-red-600",
    "text-emerald-600",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens da página de conexões", () => {
  for (const token of [
    '"channels-card": "16px"',
    '"channels-alert": "12px"',
    '"channels-help": "12px"',
    '"channels-attach": "10px"',
    '"channels-account": "11px"',
    '"channels-qr": "#FFFFFF"',
    '"channels-inbox": "repeat(auto-fit,minmax(min(100%,270px),1fr))"',
    '"channels-google": "repeat(auto-fit,minmax(min(100%,280px),1fr))"',
    '"channels-attach": "repeat(2,1fr)"',
    '"channels-name": "13.5px"',
    '"channels-meta": ["11.5px", { lineHeight: "1.5" }]',
    '"channels-field": ["12.5px", { lineHeight: "1.45" }]',
    '"channels-icon": "38px"',
    '"channels-icon-lg": "46px"',
    '"channels-metric": "23px"',
    '"channels-metric": "26px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("a página de conexões usa duas colunas e agrupa Gmail, Agenda e Drive", () => {
  assert.ok(source.includes('const connectionsLayoutTw="grid grid-cols-1 items-start gap-token xl:grid-cols-2"'));
  assert.ok(source.includes('const connectionsColumnTw="grid min-w-0 content-start gap-token"'));
  assert.ok(source.includes('<div className={connectionsLayoutTw}>'));
  assert.equal((source.match(/<div className=\{connectionsColumnTw\}>/g) || []).length, 2);
  const google = source.slice(source.indexOf('<h2 className={sectionHeadingTitleTw}>Google</h2>'));
  const gmail = google.indexOf('<GmailOAuthMailboxSettings />');
  const calendar = google.indexOf('"Google Agenda"');
  const drive = google.indexOf('"Google Drive"');
  const end = google.indexOf('</section>', google.indexOf('</article>') + 1);
  assert.ok(gmail >= 0 && calendar > gmail && drive > calendar, "Gmail, Agenda e Drive devem ficar no mesmo bloco");
  assert.ok(end < 0 || drive < end, "o bloco Google não pode ser reaberto depois das outras seções");
  assert.ok(source.includes('<article className={googleCardTw}><div className={sectionHeadingTw}><span className={inboxPlatformTw} style={{color:"#EA4335"}}><GoogleGlyph size={19}/>'));
  assert.doesNotMatch(source, /(?:^|\n)\s*<EmailMailboxSettings \/><GmailOAuthMailboxSettings \/>/);
});

test("a página de conexões preserva estados, acessibilidade e ações", () => {
  for (const marker of [
    'role="status"',
    'role="alert"',
    'aria-label="Fechar aviso"',
    'aria-label={"Nome do canal "+inbox.name}',
    'id={"mode-"+inbox.id}',
    'id={"target-type-"+inbox.id}',
    'id={"target-id-"+inbox.id}',
    "document.getElementById(\"mode-\"+inbox.id)",
    "void saveInbox(inbox.id,",
    "onClick={()=>void openWahaSetup(",
    "onClick={()=>void reconnectInbox(",
    "onClick={()=>void disconnectInbox(",
    "onClick={()=>void deleteInbox(",
    'title="Conectar WhatsApp"',
    'alt="QR Code para conectar o WhatsApp"',
  ]) {
    assert.ok(source.includes(marker), `faltou ${marker}`);
  }
  assert.doesNotMatch(source, /\.catch\(\(\)=>\{\}\)/);
});
