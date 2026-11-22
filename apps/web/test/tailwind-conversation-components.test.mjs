import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const css = read("src/app/vexora.css");
const quote = read("src/app/catalog-quote-panel.tsx");
const dialog = read("src/app/vexora-dialog.tsx");
const mentions = read("src/app/mention-notifications.tsx");
const bridge = read("src/app/whatsapp-bridge.tsx");
const support = read("src/app/inbox-support.tsx");
const track = read("src/app/inbox-track.tsx");
const components = [quote, dialog, mentions, bridge, support, track];

/** Literais de className e constantes TW referenciadas por className são classes. */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  // Mapas Record<string,string> guardam literais completas por estado.
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<[^>]*>\s*=\s*\{([\s\S]*?)\};/g)) {
    const literals = [...match[2].matchAll(/(["'])([^"']*)\1/g)].map((literal) => literal[2]);
    if (literals.length) constants.set(match[1], literals.join(" "));
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
const classes = components.map(classValues).join("\n");
// `*-vx-*` são utilities do preset, não classes componente: só são aceitas
// quando o namespace vx é prefixo de utility e o token existe no preset.
const vxDeclared = new Set([...config.matchAll(/"(vx-[a-z0-9-]+)"/g)].map((match) => match[1]));
const legacyScanClasses = classes
  .split(/\s+/)
  .filter((token) => {
    const name = token.match(/vx-[a-z0-9-]+/)?.[0];
    return !(name && vxDeclared.has(name) && /^[a-z][a-z0-9-]*-vx-[a-z0-9-]+$/.test(token));
  })
  .join("\n");

test("os componentes de conversa não usam classes componente legadas", () => {
  for (const forbidden of [
    /\bcatalog-quote-[a-z0-9-]+/,
    /\bcomposer-ai-error\b/,
    /\bvx-dialog(?:-[a-z0-9-]+)?\b/,
    /\bmention-(?:notifications|count|toast|panel)\b/,
    /\bicon-button\b/,
    /\bwhatsapp-bridge\b/,
    /\b(?:primary|secondary)-button\b/,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("os componentes de conversa usam só utilities, sem remendos", () => {
  for (const source of components) {
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
    ]) {
      const match = source.match(forbidden);
      assert.equal(match, null, `remendo visual: ${match?.[0]}`);
    }
  }
  for (const utility of [
    "min-h-80",
    "max-h-96",
    "mt-1",
    "leading-snug",
    "px-2",
    "min-h-8",
    "rounded-lg",
    "max-w-xs",
    "fixed inset-0 grid place-items-center",
    "bg-slate-900/80",
    "p-4 backdrop-blur-sm",
    "max-h-dvh w-full max-w-lg",
    "max-w-4xl",
    "rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
    "size-10 rounded-lg",
    "size-8 rounded-lg",
    "max-h-60 rounded-xl",
    "w-80 rounded-xl",
    "size-9 rounded-lg",
    "rounded-full",
    "dark:bg-slate-800 dark:text-slate-200",
    "text-xs text-slate-600 dark:text-slate-300",
    "text-2xs",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os novos tokens do orçamento, do modal e das menções", () => {
  for (const token of [
    '"ib-quote": "320px"',
    '"ib-quote-list": "56vh"',
    '"ib-quote-qty": "30px"',
    '"ib-quote-qty": "8px"',
    '"ib-quote-error-y": "5px"',
    '"ib-quote-qty-x": "9px"',
    '"vx-dialog-pad": "18px"',
    '"ib-quote-empty": "70%"',
    '"ib-quote-error": "1.35"',
    '"ib-dialog": "calc(100dvh - 44px)"',
    '"ib-dialog": "min(100%, 520px)"',
    '"ib-dialog-wide": "min(100%, 860px)"',
    '"ib-mention": "min(100vw - 32px, 360px)"',
    '"ib-dialog": "1000"',
    '"ib-dialog-inner": "1"',
    '"ib-mention": "65"',
    '"ctl-sm": "var(--ctl-sm)"',
    '"vx-scrim-in": "vx-scrim-in .18s ease both"',
    '"vx-in": "vx-in .26s var(--ease) both"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});

test("o painel de orçamento preserva hooks, acessibilidade e integrações", () => {
  for (const token of [
    'data-testid="catalog-quote-panel"',
    'data-testid="catalog-quote-error"',
    'data-testid="catalog-quote-notice"',
    'data-testid="catalog-quote-list"',
    'data-testid="catalog-quote-item"',
    'data-testid="catalog-quote-qty-btn"',
    'role="alert"',
    'role="status"',
    'aria-label="Buscar produto ou serviço"',
    'aria-label={qty > 0 ? "Diminuir" : "Adicionar"}',
    "/api/backend/catalog?q=",
    "/api/backend/documents/generate",
    "/api/backend/documents/${data.document.id}/send-whatsapp",
    "onNotice?.(",
    "setTimeout(onClose, 1500)",
  ]) {
    assert.ok(quote.includes(token), `o orçamento deve manter ${token}`);
  }
});

test("o modal compartilhado preserva o contrato e os hooks no CSS", () => {
  for (const token of [
    'data-testid="vexora-dialog-backdrop"',
    'data-testid="vexora-dialog"',
    'data-wide={wide?"true":"false"}',
    'data-testid="vexora-dialog-heading"',
    'data-testid="vexora-dialog-icon"',
    'data-testid="vexora-dialog-close"',
    'data-testid="vexora-dialog-body"',
    'data-testid="vexora-dialog-footer"',
    'role="dialog"',
    'aria-modal="true"',
    "aria-label={title}",
    'aria-label="Fechar janela"',
    "useModalDialog(open&&mounted,ref,onClose)",
    "createPortal(",
    "document.body",
  ]) {
    assert.ok(dialog.includes(token), `o modal deve manter ${token}`);
  }
  for (const hook of [
    "[data-testid='vexora-dialog']",
    "[data-testid='vexora-dialog-backdrop']",
    "[data-testid='vexora-dialog-heading']",
    "[data-testid='vexora-dialog-icon']",
    "[data-testid='vexora-dialog-body']",
    "[data-testid='vexora-dialog-footer']",
  ]) {
    assert.ok(css.includes(hook), `o CSS deve aceitar o hook ${hook}`);
    assert.ok(css.includes(".vx-dialog"), `o CSS deve manter o seletor legado para outros componentes`);
  }
});

test("as menções preservam o contrato de tempo real e os hooks", () => {
  for (const token of [
    'data-testid="mention-notifications"',
    'data-testid="mention-trigger"',
    'data-testid="mention-count"',
    'data-testid="mention-toast"',
    'data-testid="mention-panel"',
    'aria-expanded={open}',
    'role="status"',
    'role="alert"',
    'aria-label="Fechar aviso de menção"',
    'aria-label="Fechar menções"',
    'aria-label="Suas menções"',
    "/api/backend/conversations/mentions",
    'new EventSource("/api/backend/events")',
    '"conversation.updated"',
    '"team.updated"',
    '"vexora:team-updated"',
    'window.location.assign("/?module=Atendimento&conversation="',
    "Marcar como lida",
  ]) {
    assert.ok(mentions.includes(token), `as menções devem manter ${token}`);
  }
});

test("o bridge do WhatsApp preserva o contrato de abertura", () => {
  for (const token of [
    'data-testid="whatsapp-bridge"',
    'role="status"',
    'type="tel"',
    'maxLength={60}',
    'required',
    'placeholder="+55 11 99999-9999"',
    '"/api/backend/conversations/" +',
    '"/whatsapp?view=" +',
    "onOpen(d.conversationId)",
    "O histórico atual é preservado.",
  ]) {
    assert.ok(bridge.includes(token), `o bridge deve manter ${token}`);
  }
  for (const token of ["primary-button", "secondary-button"]) {
    assert.doesNotMatch(support, new RegExp(`\\b${token}\\b`));
    assert.doesNotMatch(track, new RegExp(`\\b${token}\\b`));
  }
});
