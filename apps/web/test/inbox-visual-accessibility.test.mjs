import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appDir = new URL("../src/app/", import.meta.url);
const inbox = fs.readFileSync(new URL("inbox-workspace.tsx", appDir), "utf8");
const css = fs.readFileSync(new URL("globals.css", appDir), "utf8");

test("inbox queues expose the selected state to assistive technology", () => {
  assert.match(inbox, /aria-current=\{queueView === item\.id \? "page" : undefined\}/);
  assert.match(inbox, /aria-pressed=\{queueView === item\.id\}/);
  assert.match(inbox, /className=\{"inbox-queue-button " \+ \(queueView === item\.id \? "active" : ""\)\}/);
});

test("handoff controls have explicit accessible names", () => {
  assert.match(inbox, /className="handoff-invite-trigger handoff-direct-trigger" aria-label="Direcionar conversa"/);
  assert.match(inbox, /className="handoff-invite-trigger" aria-label="Convidar atendente"/);
});

test("human conversations expose the return-to-chatbot action", () => {
  assert.match(inbox, /selected\.handlingMode === "HUMAN"/);
  assert.match(inbox, /aria-label="Devolver ao chatbot"/);
  assert.match(inbox, /\/return-to-bot\?view=/);
});

test("tablet inbox uses two columns and a dedicated profile row", () => {
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 980px\) \{[\s\S]*?\.main-area:has\(\.inbox-workspace\) \.inbox-workspace \{[\s\S]*?grid-template-columns: minmax\(220px, 280px\) minmax\(0, 1fr\);[\s\S]*?grid-template-rows: minmax\(0, 1fr\) 220px;/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 980px\) \{[\s\S]*?\.main-area:has\(\.inbox-workspace\) \.contact-profile\.content-card \{[\s\S]*?grid-column: 1 \/ -1;/);
});

test("mobile profile and errors stay reachable instead of being clipped", () => {
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.main-area:has\(\.inbox-workspace\) > \.page-content \{[\s\S]*?overflow-y: auto;/);
  assert.match(css, /@media \(max-width: 760px\) \{[\s\S]*?\.inbox-workspace\.mobile-thread-open \{[\s\S]*?overflow: visible;/);
  assert.match(css, /\.inbox-workspace \.inbox-error \{[\s\S]*?position: absolute;[\s\S]*?z-index: 20;/);
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
