import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appDir = new URL("../src/app/", import.meta.url);
const inbox = fs.readFileSync(new URL("inbox-workspace.tsx", appDir), "utf8");
const css = fs.readFileSync(new URL("vexora.css", appDir), "utf8");

test("inbox queues expose the selected state to assistive technology", () => {
  assert.match(inbox, /className=\{"inbox-queue-button .*aria-current=\{queueView === item\.id \? "page" : undefined\}/);
  assert.match(inbox, /aria-pressed=\{queueView === item\.id\}/);
  assert.match(inbox, /className=\{queueView === item\.id \? "active" : ""\} aria-current=/);
});

test("handoff controls have explicit accessible names", () => {
  assert.match(inbox, /className="handoff-invite-trigger handoff-direct-trigger" aria-label="Direcionar conversa"/);
  assert.match(inbox, /className="handoff-invite-trigger" aria-label="Convidar atendente"/);
});

test("tablet inbox uses two columns and a dedicated profile row", () => {
  const tablet = css.match(/@media\(max-width:980px\)\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(tablet, /\.inbox-workspace\{grid-template-columns:minmax\(220px,280px\) minmax\(0,1fr\)\}/);
  assert.match(tablet, /\.inbox-workspace>\.contact-profile\{grid-column:1\/-1\}/);
});

test("mobile switches between list and thread without clipping the conversation", () => {
  const mobile = css.match(/@media\(max-width:760px\)\{[\s\S]*\n\}/)?.[0] ?? "";
  assert.match(mobile, /\.inbox-workspace:not\(\.mobile-thread-open\) :is\(\.inbox-thread,\.contact-profile\),\.inbox-workspace\.mobile-thread-open \.inbox-list\{display:none\}/);
  assert.match(mobile, /\.inbox-workspace\.mobile-thread-open \.inbox-thread\{height:100%\}/);
  const singleColumn = (mobile.match(/\.inbox-workspace[^{]*\{[^}]*grid-template-columns:1fr[^}]*\}/g) ?? []);
  assert.ok(singleColumn.some(rule => /height:auto/.test(rule) && /min-height:0/.test(rule)));
  assert.ok(singleColumn.some(rule => /:has\(\.contact-profile\)/.test(rule)), "mobile grid must override the three-column profile layout");
});

test("message history groups dates and exposes WhatsApp-style delivery ticks", () => {
  assert.match(inbox, /function messageDateLabel\(value: string, now = new Date\(\)\)/);
  assert.match(inbox, /if \(days === 0\) return "Hoje";/);
  assert.match(inbox, /if \(days === 1\) return "Ontem";/);
  assert.match(inbox, /message-date-separator/);
  assert.match(inbox, /function MessageStatus\(\{ message \}: \{ message: Message \}\)/);
  assert.match(inbox, /const marks = failed \? "!" : queued \? "◷" : delivered \? "✓✓" : "✓";/);
  assert.match(inbox, /className=\{"message-status " \+/);
});

test("message links are safe and remain readable inside bubbles", () => {
  assert.ok(inbox.includes("const MESSAGE_URL_PATTERN = /"));
  assert.match(inbox, /className="message-link" href=\{href\} target="_blank" rel="noopener noreferrer"/);
  assert.match(css, /\.message-link\{[^}]*overflow-wrap:anywhere/);
});
