import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const list = read("src/app/conversation-list.tsx");
const avatars = read("src/app/inbox-avatars.tsx");
const copilot = read("src/app/inbox-copilot.tsx");
const inboxes = read("src/app/inboxes-management.tsx");
const profile = read("src/app/contact-profile-panel.tsx");
const appointments = read("src/app/inbox-appointments.tsx");
const workspace = read("src/app/inbox-workspace.tsx");
const components = [list, avatars, copilot, inboxes, profile, appointments, workspace];

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
  const ibUtility = /^(?:font-ib(?:-[a-z0-9-]+)?|(?:ib-(?:desktop|narrow|mobile|wide|shell):[a-z0-9:/.-]+)|(?:(?:bg|text|h|w|min-h|max-h|min-w|max-w|size|shadow|rounded|border(?:-[tblr])?|gap(?:-[xy])?|p(?:[tblrxy])?|m(?:[tblrxy])?|font|grid-cols|grid-rows|col-span|justify-self|top|right|bottom|left|z|tracking|space-[xy])-ib-[a-z0-9-]+))$/;
  for (const token of classes.split(/\s+/).filter((part) => /(?:^|-)ib(?:-|$)/.test(part))) {
    assert.match(token, ibUtility, `classe ib-* não autorizada: ${token}`);
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
    '"ib-shell": { raw: "(max-width: 980px)" }',
    '"ib-workspace": "minmax(260px,340px) minmax(0,1fr) minmax(300px,380px)"',
    '"ib-workspace-profile": "minmax(240px,280px) minmax(0,1fr) minmax(300px,380px)"',
    '"ib-supervision": "repeat(4,1fr)"',
    '"ib-workspace": "calc(100dvh - var(--top) - 56px)"',
    '"ib-quick-dialog": "auto minmax(0,1fr)"',
    '"ib-emoji": "repeat(auto-fill, minmax(34px, 1fr))"',
    '"ib-bubble": "min(78%, 560px)"',
    '"ib-queue-menu": "180px"',
    '"ib-status-menu": "210px"',
    '"ib-context-menu": "190px"',
    '"ib-overlay": "120"',
    '"ib-lightbox": "240"',
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


test("a ficha do contato usa só utilities TW e hooks estáveis", () => {
  const values = classValues(profile).replace(/style=\{\{[^}]*\}\}/g, "");
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /#[0-9a-fA-F]{3,8}\b/, /color-mix\(/, /!important/, /@apply/]) {
    const match = values.match(forbidden);
    assert.equal(match, null, `remendo visual na ficha: ${match?.[0]}`);
  }
  for (const token of [
    'data-testid="contact-profile"',
    'data-collapsed={expanded ? "false" : "true"}',
    'data-bare={bare ? "true" : "false"}',
    'data-testid="contact-profile-heading"',
    'data-testid="contact-profile-identity"',
    'role="alert"',
    "/api/backend/contacts/",
    "/identities/rebind",
    "/history",
    "/profile-config",
    "/api/backend/tasks",
    "tagForeground(tag.color)",
  ]) {
    assert.ok(profile.includes(token), `a ficha deve manter ${token}`);
  }
  for (const utility of [
    "w-ib-profile-collapsed",
    "h-ib-profile-avatar w-ib-profile-avatar",
    "grid-cols-ib-profile-field-row",
    "max-w-ib-profile-control",
    "bg-ib-avatar",
    "text-ib-instagram",
    "ib-desktop:grid-cols-2",
  ]) {
    assert.ok(values.includes(utility), `falta a utility ${utility}`);
  }
  for (const token of [
    '"ib-desktop": { raw: "(min-width: 960px)" }',
    '"ib-instagram": "#E1306C"',
    '"ib-facebook": "#1877F2"',
    '"ib-email": "#EA4335"',
    '"ib-profile-field-row": "minmax(0, 1fr) auto"',
    '"ib-profile-identity": "minmax(0, 1fr) auto"',
    '"ib-profile-control": "400px"',
    '"ib-profile-copy": "560px"',
    '"ib-profile-row": "460px"',
    '"ib-profile-agenda": "320px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("os agendamentos usam TW e preservam o contrato da agenda do Google", () => {
  const values = classValues(appointments);
  const source = appointments.replace(/style=\{\{[^}]*\}\}/g, "");
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /#[0-9a-fA-F]{3,8}\b/, /color-mix\(/, /!important/, /@apply/]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual nos agendamentos: ${match?.[0]}`);
  }
  assert.doesNotMatch(values, /\b(?:inbox-appointments|ai-admin-fields|inbox-appointment-times|invite-check|content-card|primary-button|text-button)\b/);
  for (const utility of [
    "grid gap-3 text-xs text-ink",
    "grid gap-2 rounded-token border border-line bg-surface p-pad shadow-token",
    "grid grid-cols-2 gap-3",
    "flex items-center gap-2",
  ]) {
    assert.ok(source.includes(utility), `falta a utility ${utility}`);
  }
  for (const token of [
    'data-testid="inbox-appointments"',
    'data-testid="inbox-appointment-confirmed"',
    'role="alert"',
    "/api/backend/integrations/google/calendar/",
    "if(!event.id)throw Error",
    "onConfirm(",
    "attendees:(addInvite&&contact.email?",
  ]) {
    assert.ok(appointments.includes(token), `os agendamentos devem manter ${token}`);
  }
});

test("o shell do workspace usa TW e preserva os hooks de estado", () => {
  const values = classValues(workspace).replace(/style=\{\{[^}]*\}\}/g, "");
  const source = workspace.replace(/style=\{\{[^}]*\}\}/g, "");
  for (const forbidden of [/\[[a-z-]+:\s*[^]\s]+\]/, /#[0-9a-fA-F]{3,8}\b/, /color-mix\(/, /!important/, /@apply/, /@tailwind\s+base/]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual no shell: ${match?.[0]}`);
  }
  assert.doesNotMatch(values, /\b(?:inbox-workspace|inbox-thread|inbox-composer|composer-shell|composer-tools|composer-icon-button|thread-heading|thread-header-actions|inbox-queue-button|handoff-option|message-line|message-bubble|quick-reply-use|emoji-category|finalization-outcome|ficha-open|ficha-compact|mobile-thread-open|inbox-full-screen|composer-is-note|more-open|is-alert|recording|active|selected|won|lost)\b/);
  for (const utility of [
    "grid h-ib-workspace min-h-ib-workspace grid-cols-ib-workspace gap-3 ib-shell:grid-cols-1",
    "grid-cols-ib-supervision",
    "max-w-ib-bubble",
    "z-ib-overlay",
    "grid-rows-ib-quick-dialog",
  ]) {
    assert.ok(values.includes(utility), `falta a utility ${utility}`);
  }
  for (const token of [
    'data-testid="inbox-workspace"',
    'data-fullscreen={fullScreen ? "true" : "false"}',
    'data-mobile-thread={mobileThreadOpen ? "true" : "false"}',
    'data-ficha-open={fichaOpen ? "true" : "false"}',
    'data-ficha-compact={!selected || !contactProfileExpanded ? "true" : "false"}',
    'data-testid="inbox-thread"',
    'data-testid="thread-heading"',
    'data-testid="thread-header-actions"',
    'data-testid="inbox-queue-button"',
    'data-testid="handoff-option"',
    'data-testid="message-line"',
    'data-testid="message-bubble"',
    'data-testid="inbox-composer"',
    'data-note={composerTab === "note" ? "true" : "false"}',
    'data-testid="composer-tools"',
    'data-testid="composer-mode-button"',
    'data-recording={listening ? "true" : "false"}',
    'data-testid="quick-reply-use"',
    'data-testid="emoji-category"',
    'data-testid="finalization-outcome"',
    "data-status=",
    'data-testid="audio-player"',
    'data-testid="link-preview"',
    'role="alert"',
    'role="status"',
    'aria-pressed={queueView === item.id}',
    'aria-current={queueView === item.id ? "page" : undefined}',
    "/api/backend/conversations/",
    "/api/backend/channels/",
  ]) {
    assert.ok(workspace.includes(token), `o shell deve manter ${token}`);
  }
});
