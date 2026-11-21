import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const list = read("src/app/conversation-list.tsx");
const avatars = read("src/app/inbox-avatars.tsx");
const copilot = read("src/app/inbox-copilot.tsx");
const inboxes = read("src/app/inboxes-management.tsx");
const components = [list, avatars, copilot, inboxes];

/** Só literais de string dentro de className são classes — não o código da expressão. */
function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  return values.join("\n");
}
/** style={} e o corpo de contactLabels são dados do contato, não remendos visuais. */
const semDados = components.map((source) => source
  .replace(/style=\{\{[^}]*\}\}/g, "")
  .replace(/export function contactLabels\([\s\S]*?\n\}/g, "export function contactLabels(contact) { return dados; }")).join("\n");
const classes = components.map(classValues).join("\n");

test("a Conversa não usa classes componente legadas", () => {
  assert.doesNotMatch(classes, /\b(?:ov|vx|conversation|channel)-[a-z][a-z0-9-]*/);
  assert.doesNotMatch(classes, /\b(?:content-card|primary-button|secondary-button|icon-button|dialog-close|chip|ai-toggle)\b/);
  // ib-* aparece só como sufixo de utility do preset, nunca como classe componente.
  for (const token of classes.split(/\s+/).filter((part) => /(?:^|-)ib(?:-|$)/.test(part))) {
    assert.match(token, /^(?:font-ib|ib-(?:narrow|mobile|wide):[a-z0-9:-]+|(?:(?:bg|text|h|w|min-h|max-h|max-w|min-w|shadow|rounded|border|gap|gap-x|gap-y|px|py|p|my|mt|mb|font|grid-cols|col-span|justify-self)-ib-[a-z0-9-]+))$/, `classe ib-* não autorizada: ${token}`);
  }
});

test("a Conversa usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = semDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "grid min-h-0 flex-1 content-start overflow-y-auto",
    "gap-x-ib-gap gap-y-1",
    "border-l-blue-600 bg-blue-50 shadow-ib-selected",
    "h-ib-avatar w-ib-avatar",
    "h-ib-presence w-ib-presence",
    "text-ib-time tabular-nums",
    "text-ib-micro text-slate-600",
    "text-ib-tick tabular-nums",
    "bg-emerald-600 shadow-ib-newdot",
    "min-h-ib-tag items-center",
    "h-ib-mark w-ib-mark",
    "place-items-center rounded-ib-channel",
    "bg-ib-avatar text-ib-avatar-fallback",
  ]) {
    assert.ok(semDados.includes(utility), `falta a utility ${utility}`);
  }
  for (const token of [
    '"ib-coral": "#F0645E"',
    '"ib-amber": "#F2A93B"',
    '"ib-read": "#25D366"',
    '"ib-avatar": "linear-gradient',
    '"ib-time": ["10.5px"',
    '"ib-micro": ["9px"',
    '"ib-tick": ["10px"',
    '"ib-avatar-fallback": ["15px"',
    '"ib-avatar": "44px"',
    '"ib-avatar-sm": "38px"',
    '"ib-presence": "11px"',
    '"ib-newdot": "7px"',
    '"ib-tag": "16px"',
    '"ib-mark": "18px"',
    '"ib-channel": "5px"',
    '"ib-selected": "inset 3px 0 0 var(--primary)',
    '"ib-newdot": "0 0 0 2px',
    '"ib-dialog-icon": "11px"',
    '"ib-caption": ["11px"',
    '"ib-label": ["10px"',
    '"ib-input": ["12.5px"',
    '"ib-wide": { raw: "(max-width: 1150px)" }',
    '"ib-control": "37px"',
    '"ib-inboxes": "repeat(2, minmax(0, 1fr))"',
    '"ib-compact-meta": "repeat(3, minmax(0, 1fr))"',
    '"ib-details": "repeat(auto-fit, minmax(170px, 1fr))"',
    '"ib-detail-row": "96px minmax(0, 1fr)"',
    '"ib-copy": "42ch"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("a acessibilidade e os contratos da lista continuam intactos", () => {
  assert.ok(list.includes('data-testid="conversation-list"'));
  assert.ok(list.includes("aria-pressed={selected}"));
  assert.ok(list.includes('role="img" aria-label={mark.label}'));
  assert.ok(list.includes('role="status"'));
  assert.ok(list.includes("Carregando conversas…"));
  assert.ok(list.includes("Nenhuma conversa nesta fila"));
  assert.ok(list.includes("onSelect(item)"));
  assert.ok(list.includes("style={{ backgroundColor: tag.color"));
  assert.ok(list.includes("tagForeground(tag.color)"));
  assert.ok((list.match(/ChannelMark/g) ?? []).length >= 2);
});

test("os marcadores de canal preservam títulos, rótulos e detecção", () => {
  for (const label of ["IA", "Chatbot", "E-mail", "Instagram", "Facebook", "TikTok", "WhatsApp"]) {
    assert.ok(avatars.includes(`aria-label="${label}"`), `perdeu aria-label ${label}`);
  }
  assert.ok(avatars.includes("Atendimento por IA"));
  assert.ok(avatars.includes("Atendimento por chatbot"));
  assert.ok(avatars.includes("Chatbot do site"));
  assert.ok(avatars.includes("Inteligência artificial"));
  assert.ok(avatars.includes('alt={"Foto de " + contactDisplayName(contact)}'));
  assert.ok(avatars.includes('loading="lazy"'));
  assert.ok(avatars.includes('referrerPolicy="no-referrer"'));
  assert.ok(avatars.includes("/api/backend/contacts/"));
  assert.ok(avatars.includes("avatarUrl(contact)"));
  assert.ok(avatars.includes("contact.metadata?.tags"));
});

test("o copiloto preserva os contratos de acessibilidade e as integrações", () => {
  for (const token of [
    'role="tablist"',
    'aria-label="Ações da assistente"',
    'role="tab"',
    "aria-selected={action===item.id}",
    'role="status"',
    'role="alert"',
    "/api/backend/conversations/",
    "/copilot",
    "/internal-notes?view=",
    'dir="auto"',
    "<VexoraDialog",
    "onUse(result.text)",
    "onSend(result.text)",
    "onNote()",
    "onClose()",
  ]) {
    assert.ok(copilot.includes(token), `o copiloto deve manter ${token}`);
  }
  assert.equal((copilot.match(/role="tab"/g) ?? []).length, 1);
});

test("a gestão de inbox preserva os contratos e as integrações", () => {
  for (const token of [
    'aria-label="Gestão das inbox"',
    'aria-label="Distribuição automática de conversas"',
    'aria-label="Atualizar inbox"',
    'role="alert"',
    'role="status"',
    "/api/backend/channels/",
    "zernio/sync",
    '"inboxes"',
    "/api/backend/conversations/distribution-settings",
    'href="/?module=Chatbots"',
    'href={"/?module=Atendimento&conversation="',
    "expectedRevision:selected.routing.revision",
    "<VexoraDialog",
  ]) {
    assert.ok(inboxes.includes(token), `a gestão de inbox deve manter ${token}`);
  }
  assert.ok((inboxes.match(/role="alert"/g) ?? []).length >= 2);
  assert.ok((inboxes.match(/role="status"/g) ?? []).length >= 3);
});
