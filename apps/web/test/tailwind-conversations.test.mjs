import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");
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
  const ibUtility = /^(?:font-ib(?:-[a-z0-9-]+)?|(?:ib-(?:desktop|narrow|mobile|wide|shell|grid|grid-ficha):[a-z0-9:/.-]+)|(?:(?:bg|text|h|w|min-h|max-h|min-w|max-w|size|shadow|rounded|border(?:-[tblr])?|gap(?:-[xy])?|p(?:[tblrxy])?|m(?:[tblrxy])?|font|grid-cols|grid-rows|col-span|justify-self|top|right|bottom|left|z|tracking|space-[xy])-ib-[a-z0-9-]+))$/;
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
    "gap-x-2 gap-y-1",
    "border-l-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-100",
    "h-11 w-11",
    "h-3 w-3",
    "text-xs tabular-nums text-slate-500 dark:text-slate-400",
    "text-xs text-slate-600",
    "text-xs tabular-nums",
    "h-2 w-2 rounded-full bg-blue-700 ring-2 ring-blue-100",
    "min-h-4 items-center",
    "h-5 w-5",
    "place-items-center rounded-full",
    "from-blue-600 to-blue-800",
    // Avatares e copiloto migrados para utilities Tailwind padrão com dark slate.
    "inline-grid h-5 w-5 flex-none place-items-center rounded-full",
    "bg-zinc-200 font-extrabold tracking-tight text-slate-800",
    "bg-blue-100 text-xs font-bold",
    "rounded-lg border border-gray-200 bg-slate-50",
    "min-h-4 items-center rounded-full bg-blue-100",
    "max-w-md text-xs",
    "dark:border-slate-700",
    "dark:bg-slate-900",
  ]) {
    assert.ok(semDados.includes(utility), `falta a utility ${utility}`);
  }
  // A lista usa apenas utilities padrão: tamanhos, tons e relevos saíram do preset.
  for (const utility of [
    "grid min-h-0 flex-1 content-start overflow-y-auto",
    "gap-x-2 gap-y-1",
    "border-l-blue-600 bg-blue-50",
    "h-11 w-11",
    "h-3 w-3",
    "text-xs tabular-nums",
    "text-2xs text-slate-600",
    "text-2xs tabular-nums",
    "bg-blue-700 ring-2 ring-blue-100",
    "min-h-4 items-center",
  ]) {
    assert.ok(list.includes(utility), `falta a utility ${utility} na lista`);
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
    '@custom-variant ib-wide (@media (max-width: 1150px));',
    '"ib-control": "37px"',
    '"ib-inboxes": "repeat(2, minmax(0, 1fr))"',
    '"ib-compact-meta": "repeat(3, minmax(0, 1fr))"',
    '"ib-details": "repeat(auto-fit, minmax(170px, 1fr))"',
    '"ib-detail-row": "96px minmax(0, 1fr)"',
    '"ib-copy": "42ch"',
    '@custom-variant ib-shell (@media (max-width: 980px));',
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
    assert.ok(config.includes(token) || theme.includes(token), `o preset deve expor ${token}`);
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
    "w-13",
    "h-12 w-12",
    "grid-cols-2",
    "max-w-md",
    "bg-slate-900",
    "text-fuchsia-400",
    "lg:grid-cols-2",
  ]) {
    assert.ok(values.includes(utility), `falta a utility ${utility}`);
  }
  for (const token of [
    '@custom-variant ib-desktop (@media (min-width: 960px));',
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
    assert.ok(config.includes(token) || theme.includes(token), `o preset deve expor ${token}`);
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
    "shadow-token-sm",
  ]) {
    assert.ok(source.includes(utility), `falta a utility ${utility}`);
  }
  assert.ok(appointments.includes('<ul className="divide-y divide-gray-200 dark:divide-slate-700">'), "a lista de compromissos precisa de linhas entre os itens");
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
    "flex h-ib-workspace min-h-ib-workspace gap-3 rw-laptop:flex-col",
    "w-(--inbox-list-w) shrink-0",
    "w-(--inbox-ficha-w)",
    "min-w-0 min-h-0 flex-1 flex-col",
    "grid-cols-4",
    "max-w-2xl",
    "z-50",
    "grid-rows-2",
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

test("o avatar do cabeçalho tem tamanho próprio e o header alinha os blocos", () => {
  assert.ok(avatars.includes('const contactAvatarFillTw = "relative block h-full w-full overflow-hidden rounded-full";'));
  assert.match(avatars, /export function ContactAvatar\(\{ contact, className = contactAvatarFillTw \}/);
  assert.ok(avatars.includes("<span className={className}>"));
  // A lista continua preenchendo o wrapper; só o chamador do cabeçalho define o tamanho.
  assert.ok(list.includes("<ContactAvatar contact={item.contact} />"));
  assert.ok(workspace.includes('className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600 text-base font-extrabold text-white"'));

  const heading = workspace.match(/<header data-testid="thread-heading"[^>]*>/)?.[0] ?? "";
  const hasUtility = (utility) => heading.includes(` ${utility} `) || heading.includes(` ${utility}"`);
  for (const utility of ["flex", "flex-none", "flex-nowrap", "items-center", "gap-2"]) {
    assert.ok(hasUtility(utility), `o header deve manter ${utility}: ${heading}`);
  }
  assert.doesNotMatch(heading, /h-full|w-full|size-ib-avatar|flex-wrap/);
  for (const utility of ["flex-nowrap", "gap-2", "ib-narrow:px-3"]) assert.ok(hasUtility(utility), `o header deve manter ${utility}`);
  const primaryActions = workspace.match(/<div data-testid="thread-primary-actions" className="([^"]*)">/)?.[1] ?? "";
  for (const utility of ["ml-auto", "flex", "shrink-0", "flex-nowrap", "items-center", "gap-2"]) {
    assert.ok(primaryActions.includes(utility), `as ações primárias devem manter ${utility}: ${primaryActions}`);
  }
  assert.ok(workspace.includes('data-testid="thread-header-actions" data-open={moreActionsOpen ? "true" : "false"} id="thread-header-actions" className={moreActionsOpen ? "flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 p-2 shadow-xl" : "hidden"}'));
  assert.ok(workspace.includes('data-testid="thread-mobile-actions" className="hidden items-center gap-2 ib-narrow:flex"'));
  assert.ok(workspace.includes('bg-white text-blue-800'), "badge ativo das filas com bolinha branca");
  assert.ok(workspace.includes('bg-blue-100 text-blue-800 ring-1 ring-blue-600'), "badge inativo das filas mantém o contraste");
  assert.ok(workspace.includes('data-testid="thread-finalize-button" aria-label="Finalizar atendimento" className="grid size-8 place-items-center rounded-lg bg-blue-600 text-blue-900'), "Finalizar com ícone claro sobre azul");
  for (const hook of ['data-testid="thread-heading"', 'aria-controls="thread-header-actions"', 'id="thread-header-actions"', 'data-testid="thread-primary-actions"', 'data-testid="thread-header-actions"', 'data-testid="thread-mobile-actions"']) {
    assert.ok(workspace.includes(hook), `o cabeçalho deve manter ${hook}`);
  }
  const css = read("src/app/vexora.css");
  assert.doesNotMatch(css, /\[data-testid=.thread-heading.\]\{[^}]*flex-wrap/);
});

test("o contexto interno da conversa mantém ícone e selo com contraste", () => {
  const noteStart = workspace.indexOf('message.direction === "INTERNAL"');
  const noteEnd = workspace.indexOf(' : <div data-testid="message-line"', noteStart);
  const note = workspace.slice(noteStart, noteEnd);
  assert.ok(workspace.includes('border border-dashed border-amber-400 bg-amber-200 p-3 text-amber-950 shadow'));
  assert.ok(workspace.includes('rounded bg-amber-400 text-amber-950'));
  assert.ok(workspace.includes('rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-extrabold uppercase tracking-widest text-amber-950'));
  assert.ok(workspace.includes('const isHandoffContext = message.metadata?.kind === "handoff_context" || message.senderName === "Contexto do atendimento"'));
  assert.ok(note.includes('internalTone.card'), "o bloco interno usa o tom por tipo");
  assert.ok(workspace.includes('border border-dashed border-blue-600 bg-blue-50 p-3 shadow'), "notas privadas seguem azuis");
  assert.ok(note.includes('Só a equipe vê</small>'));
  assert.doesNotMatch(note, /bg-warning(?:-soft)?\b/);
});

test("as bolhas OUTBOUND e INBOUND usam TW com fundos leves e visíveis", () => {
  assert.ok(workspace.includes('data-testid="message-line" data-direction={message.direction} className={message.direction === "OUTBOUND" ? "flex justify-end" : "flex justify-start"}'));
  assert.ok(workspace.includes('className={"max-w-2xl break-words rounded-xl border p-2.5 font-sans text-sm shadow " + (message.direction === "OUTBOUND" ? "border-blue-700 bg-blue-700 text-white" : "border-gray-200 bg-zinc-100 text-slate-950")}'));
  assert.ok(workspace.includes('const brandStatusTw={failed:"text-red-200",read:"text-emerald-200",delivered:"text-blue-100",queued:"text-amber-200",sent:"text-blue-100"}'));
  assert.ok(workspace.includes('<MessageStatus message={message} onBrand />'));
  const css = read("src/app/vexora.css");
  assert.doesNotMatch(css, /\[data-testid='message-bubble'\]\{[^}]*(?:background|border-radius|padding|font-family|font-size|max-width)/);
  assert.doesNotMatch(css, /\[data-testid='message-line'\]\[data-direction='(?:OUTBOUND|INTERNAL)'\] \[data-testid='message-bubble'\]/);
});

test("a lista, a supervisão e o composer alinham os filhos em uma linha só", () => {
  const listHeading = workspace.match(/<div className="[^"]*"><h2[^>]*>Conversas<\/h2><button[^>]*aria-label="Atualizar conversas"/)?.[0] ?? "";
  assert.match(listHeading, /flex flex-none items-center justify-between gap-2/);
  assert.match(listHeading, /<h2 className="text-xs font-extrabold">Conversas<\/h2>/);

  const supervision = workspace.match(/<section className="[^"]*" aria-label="Supervisão operacional">/)?.[0] ?? "";
  assert.match(supervision, /grid gap-1\.5 border-b border-gray-200 px-4 py-2\.5 text-xs/);
  assert.match(supervision, /gap-1\.5/);
  for (const metric of ["Aguardando", "Abertas", "Pausadas", "Fora do SLA"]) {
    assert.ok(workspace.includes(`<small className="text-xs text-slate-600">${metric}</small>`), `métrica ${metric}`);
  }

  const composerRow = workspace.match(/<div className="([^"]*)">\s*<textarea data-testid="inbox-composer-input"/)?.[1] ?? "";
  assert.match(composerRow, /flex flex-nowrap items-center gap-2/);
  assert.ok(workspace.includes('data-testid="composer-tools" className="order-1 flex flex-nowrap shrink-0 items-center gap-1"'));
  assert.ok(workspace.includes('data-testid="inbox-composer-input" className="order-2 min-w-0 flex-1 resize-none ib-narrow:order-first ib-narrow:basis-full'));
  assert.ok(workspace.includes('className="order-3 flex shrink-0 items-center gap-1"'));
  // No desktop a linha segue única (tools → textarea → enviar). No mobile a textarea
  // vai para a primeira linha e os ícones ficam abaixo, sem mudar a ordem do DOM.
  assert.match(composerRow, /ib-narrow:flex-wrap/);
  assert.match(composerRow, /ib-narrow:justify-between/);
  assert.doesNotMatch(composerRow, /(?:^|\s)flex-wrap(?:\s|$)/);
  assert.ok(
    workspace.indexOf('<textarea data-testid="inbox-composer-input"') < workspace.indexOf('data-testid="composer-tools"'),
    "a textarea vem antes das ferramentas no DOM; o mobile só muda a ordem visual",
  );

  // O aviãozinho mantém o ícone e o rótulo lado a lado, sem grid sobreposto.
  const sendButton = workspace.match(/<button className="([^"]*)" type="submit" aria-label=\{busy \? "Enviando mensagem"/)?.[1] ?? "";
  assert.match(sendButton, /inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4/);
  assert.doesNotMatch(sendButton, /grid size-10 place-items-center/);

  // Contratos preservados.
  for (const hook of [
    'aria-label="Supervisão operacional"',
    'aria-label="Atualizar conversas"',
    'data-testid="composer-tools"',
    'data-testid="inbox-composer-input"',
    'data-testid="composer-icon-button"',
    'aria-label={busy ? "Enviando mensagem" : "Enviar mensagem"}',
    'aria-label="Salvar anotação"',
  ]) {
    assert.ok(workspace.includes(hook), `hook ausente: ${hook}`);
  }
});

test("o rodapé da lista usa utilities literais e filtra sem tocar no backend", () => {
  const values = classValues(workspace);
  for (const utility of [
    "flex flex-none shrink-0 flex-wrap items-center gap-1.5 border-t border-gray-200 px-3 py-2",
    "inline-flex min-h-7 items-center gap-1.5 rounded-md border border-gray-200 px-2 text-xs font-bold text-slate-600 hover:bg-zinc-300",
    "grid w-72 gap-2 rounded-lg border border-gray-200 bg-zinc-100 p-2.5 shadow-xl",
    "grid max-h-96 w-80 gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-zinc-100 p-2.5 shadow-xl",
    "grid grid-cols-2 gap-2",
    "w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950",
    "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 text-xs font-bold text-blue-900 transition-colors hover:bg-blue-700",
  ]) {
    assert.ok(values.includes(utility), `falta a utility ${utility} no rodapé da lista`);
  }

  for (const token of [
    "conversations={visibleConversations}",
    "() => filterInboxConversations(conversations, inboxListFilters, serviceProtocol?.code || \"\", selectedId)",
    "function loosePhoneMatch(",
    "value.replace(/\\D/g, \"\")",
    "const EMPTY_INBOX_LIST_FILTERS: InboxListFilters =",
  ]) {
    assert.ok(workspace.includes(token), `contrato do filtro local ausente: ${token}`);
  }
  assert.ok(workspace.indexOf('data-testid="inbox-list-tools"') > workspace.indexOf("conversations={visibleConversations}"));
  // A filtragem é pura e local: nenhuma requisição nova sai do helper.
  const helper = workspace.slice(workspace.indexOf("function filterInboxConversations("), workspace.indexOf("type QuickReply ="));
  assert.doesNotMatch(helper, /fetch\(|api<|setInterval\(/);
});
