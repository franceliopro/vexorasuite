import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appDir = new URL("../src/app/", import.meta.url);
const inbox = fs.readFileSync(new URL("inbox-workspace.tsx", appDir), "utf8");
const vexoraCss = fs.readFileSync(new URL("vexora.css", appDir), "utf8");

test("inbox queues expose the selected state to assistive technology", () => {
  assert.match(inbox, /aria-current=\{queueView === item\.id \? "page" : undefined\}/);
  assert.match(inbox, /aria-pressed=\{queueView === item\.id\}/);
  assert.match(inbox, /data-testid="inbox-queue-button" data-active=\{queueView === item\.id \? "true" : "false"\}/);
});

test("handoff controls have explicit accessible names", () => {
  assert.match(inbox, /<summary data-testid="thread-transfer-button"[^>]*aria-label="Direcionar conversa"/);
  assert.match(inbox, /<summary data-testid="inbox-invite-trigger"[^>]*aria-label="Convidar atendente"/);
});

test("human conversations expose the return-to-chatbot action", () => {
  assert.match(inbox, /selected\.handlingMode === "HUMAN"/);
  assert.match(inbox, /aria-label="Devolver ao chatbot"/);
  assert.match(inbox, /\/return-to-bot\?view=/);
});

test("mobile thread leaves room for the dock and the scrollable thread", () => {
  assert.match(vexoraCss, /\[data-testid='inbox-workspace'\]\[data-mobile-thread='true'\]\{[^}]*height:calc\(100dvh - var\(--top\) - var\(--dock\) - 24px\)/);
  assert.match(vexoraCss, /\[data-testid='inbox-workspace'\]\[data-mobile-thread='true'\] \[data-testid='inbox-thread'\]\{[^}]*height:100%/);
});

test("page content wraps long text and prevents overflow on narrow viewports", () => {
  assert.match(vexoraCss, /\.page-content :is\(h1,h2,h3,h4,p,strong,small,label,button,a\)\{overflow-wrap:anywhere\}/);
});

test("message history groups dates and exposes delivery status", () => {
  assert.match(inbox, /if \(days === 0\) return "Hoje";/);
  assert.match(inbox, /if \(days === 1\) return "Ontem";/);
  assert.match(inbox, /message-date-separator/);
  assert.match(inbox, /const marks = failed \? "!" : queued \? "◷" : delivered \? "✓✓" : "✓";/);
  assert.match(inbox, /className=\{messageStatusTw \+ " " \+ tone\}/);
});

test("message links are safe and remain readable inside bubbles", () => {
  assert.ok(inbox.includes("const MESSAGE_URL_PATTERN = /"));
  assert.match(inbox, /className=\{messageLinkTw\} href=\{href\} target="_blank" rel="noopener noreferrer"/);
  assert.match(inbox, /const messageLinkTw="break-words [^"]+"/);
});

test("inbox list tools stay outside the scrollable list and remain accessible", () => {
  const listMount = inbox.indexOf("<ConversationList conversations={visibleConversations}");
  const tools = inbox.indexOf('data-testid="inbox-list-tools"');
  assert.ok(listMount > 0 && tools > listMount, "o rodapé de ferramentas vem depois da lista rolável");
  assert.ok(inbox.indexOf("</aside>") > tools, "o rodapé permanece dentro do aside da lista");

  for (const hook of [
    'data-testid="inbox-phone-tools"',
    'data-testid="inbox-phone-trigger"',
    'aria-label="Iniciar conversa por telefone"',
    'title="Iniciar conversa por telefone"',
    'data-testid="inbox-phone-input"',
    'data-testid="inbox-phone-conversar"',
    'aria-label="Número para conversar"',
    'role="status"',
    'data-testid="inbox-search-filters"',
    'data-testid="inbox-search-trigger"',
    'aria-label="Buscar conversas"',
    'title="Buscar conversas"',
    'testId="inbox-search-popover"',
    'data-testid="inbox-filter-clear"',
  ]) {
    assert.ok(inbox.includes(hook), `ferramenta da lista sem ${hook}`);
  }

  for (const field of ["tag", "name", "phone", "network", "keyword", "protocol"]) {
    assert.ok(inbox.includes(`data-testid="inbox-filter-${field}"`), `filtro ${field} ausente`);
    const label = { tag: "tag", name: "nome", phone: "número", network: "rede social", keyword: "palavra-chave", protocol: "protocolo" }[field];
    assert.ok(inbox.includes(`aria-label="Filtrar por ${label}"`), `filtro ${field} sem nome acessível`);
  }

  assert.match(inbox, /<div data-testid="inbox-list-tools" className="flex flex-none shrink-0 flex-wrap items-center gap-1\.5 border-t border-gray-200 px-3 py-2">/);
  assert.match(inbox, /side="top" className="grid w-72 gap-2 rounded-lg border border-gray-200 bg-zinc-100 p-2\.5 shadow-xl"/);
});
