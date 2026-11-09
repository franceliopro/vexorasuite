import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appDir = new URL("../src/app/", import.meta.url);
const inbox = fs.readFileSync(new URL("inbox-workspace.tsx", appDir), "utf8");
const vexoraCss = fs.readFileSync(new URL("vexora.css", appDir), "utf8");

test("inbox queues expose the selected state to assistive technology", () => {
  assert.match(inbox, /aria-current=\{queueView === item\.id \? "page" : undefined\}/);
  assert.match(inbox, /aria-pressed=\{queueView === item\.id\}/);
  assert.match(inbox, /className=\{"inbox-queue-button " \+ \(queueView === item\.id \? "active" : ""\)\}/);
});

test("handoff controls have explicit accessible names", () => {
  assert.match(inbox, /className="handoff-invite-trigger handoff-direct-trigger[^"]*" aria-label="Direcionar conversa"/);
  assert.match(inbox, /className="handoff-invite-trigger" aria-label="Convidar atendente"/);
});

test("human conversations expose the return-to-chatbot action", () => {
  assert.match(inbox, /selected\.handlingMode === "HUMAN"/);
  assert.match(inbox, /aria-label="Devolver ao chatbot"/);
  assert.match(inbox, /\/return-to-bot\?view=/);
});

test("mobile thread leaves room for the dock and the scrollable thread", () => {
  assert.match(vexoraCss, /\.inbox-workspace\.mobile-thread-open\{[^}]*height:calc\(100dvh - var\(--top\) - var\(--dock\) - 24px\)/);
  assert.match(vexoraCss, /\.inbox-workspace\.mobile-thread-open \.inbox-thread\{[^}]*height:100%/);
});

test("page content wraps long text and prevents overflow on narrow viewports", () => {
  assert.match(vexoraCss, /\.page-content :is\(h1,h2,h3,h4,p,strong,small,label,button,a\)\{overflow-wrap:anywhere\}/);
});

test("message history groups dates and exposes delivery status", () => {
  assert.match(inbox, /if \(days === 0\) return "Hoje";/);
  assert.match(inbox, /if \(days === 1\) return "Ontem";/);
  assert.match(inbox, /message-date-separator/);
  assert.match(inbox, /const marks = failed \? "!" : queued \? "◷" : delivered \? "✓✓" : "✓";/);
  assert.match(inbox, /className=\{"message-status " \+/);
});

test("message links are safe and remain readable inside bubbles", () => {
  assert.ok(inbox.includes("const MESSAGE_URL_PATTERN = /"));
  assert.match(inbox, /className="message-link" href=\{href\} target="_blank" rel="noopener noreferrer"/);
  assert.match(vexoraCss, /\.message-link\{[^}]*overflow-wrap:anywhere/);
});
