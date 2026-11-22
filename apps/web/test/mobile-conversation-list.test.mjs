import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../src/app/", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

test("mobile Conversa returns to the conversation list", () => {
  const page = read("page.tsx");
  assert.match(page, /window\.dispatchEvent\(new CustomEvent\("vexora:mobile-conversation-list"\)\)/);
  assert.match(page, /<span>Conversa<\/span><\/button>/);

  const inbox = read("inbox-workspace.tsx");
  assert.match(inbox, /const conversationList = \(\) => setMobileThreadOpen\(false\);/);
  assert.match(inbox, /window\.addEventListener\("vexora:mobile-conversation-list", conversationList\);/);
  assert.match(inbox, /window\.removeEventListener\("vexora:mobile-conversation-list", conversationList\);/);
});
