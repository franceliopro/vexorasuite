import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/app/inbox-workspace.tsx", import.meta.url), "utf8");

test("inbox uses SSE as primary realtime path", () => {
  assert.match(source, /new EventSource\("\/api\/backend\/events"\)/);
  assert.match(source, /source\.onopen\s*=\s*\(\)\s*=>\s*window\.dispatchEvent/);
  assert.match(source, /vexora:events-offline/);
  assert.match(source, /setInterval\(refreshFallback, 15000\)/);
  assert.doesNotMatch(source, /setInterval\(\(\)\s*=>\s*\{\s*void loadConversations\(\)/);
});

const chatbot = fs.readFileSync(new URL("../src/app/chatbot-workspace.tsx", import.meta.url), "utf8");
test("chatbot flow serialization is memoized", () => {
  assert.match(chatbot, /useMemo/);
  assert.match(chatbot, /useMemo\(\(\) => JSON\.stringify\(flow\), \[flow\]\)/);
  assert.doesNotMatch(chatbot, /useEffect\(\(\)=>\{if\(!ready\|\|JSON\.stringify\(flow\)/);
});

const conversations = fs.readFileSync(new URL("../../api/src/operations/conversations.controller.ts", import.meta.url), "utf8");
test("inbox list does not load unused participant graphs", () => {
  assert.match(conversations, /const rows = await this\.prisma\.conversation\.findMany/);
  assert.doesNotMatch(conversations, /messages: \{[\s\S]*participants: \{ include:/);
});

test("inbox does not keep a duplicate assignee loader", () => {
  assert.doesNotMatch(source, /setAssignees|loadAssignees/);
});
