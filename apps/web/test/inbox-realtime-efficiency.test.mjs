import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/app/inbox-workspace.tsx", import.meta.url), "utf8");

test("inbox uses SSE as primary realtime path", () => {
  assert.match(source, /new EventSource\("\/api\/backend\/events"\)/);
  assert.match(source, /source\.onopen\s*=\s*\(\)\s*=>\s*window\.dispatchEvent/);
  assert.match(source, /source\.onerror\s*=\s*\(\)\s*=>\s*window\.dispatchEvent\(new Event\("vexora:events-offline"\)\)/);
  assert.match(source, /vexora:events-offline/);
  assert.match(source, /setInterval\(refreshFallback, 15000\)/);
  assert.doesNotMatch(source, /setInterval\(\(\)\s*=>\s*\{\s*void loadConversations\(\)/);
});

test("inbox guards message responses and older-message pagination", () => {
  assert.match(source, /const messageRequest = useRef\(0\)/);
  assert.match(source, /request !== messageRequest\.current \|\| selectedRef\.current !== id/);
  assert.match(source, /const olderMessagesInFlight = useRef\(false\)/);
  assert.match(source, /if \(olderMessagesInFlight\.current \|\| !selectedId \|\| !messages\.length \|\| !hasOlderMessages\) return/);
  assert.match(source, /disabled=\{olderMessagesLoading\}/);
});

test("inbox separates loading states from empty states", () => {
  assert.match(source, /const \[conversationsLoading, setConversationsLoading\] = useState\(true\)/);
  assert.match(source, /const \[messagesLoading, setMessagesLoading\] = useState\(false\)/);
  assert.match(source, /Carregando conversas…/);
  assert.match(source, /Carregando mensagens…/);
  assert.match(source, /!conversationsLoading && !conversations\.length/);
  assert.match(source, /!messagesLoading && !messages\.length/);
});

test("conversation load failures stop loading and expose a retry", () => {
  assert.match(source, /const \[conversationLoadError, setConversationLoadError\] = useState\(""\)/);
  assert.match(source, /setConversationLoadError\(e instanceof Error \? e\.message : "Falha ao carregar conversas\."\)/);
  assert.match(source, /className="inbox-list-error" role="alert"/);
  assert.match(source, /onClick=\{\(\) => void loadConversations\(\)\}/);
});

const chatbot = fs.readFileSync(new URL("../src/app/chatbot-workspace.tsx", import.meta.url), "utf8");
test("chatbot flow serialization is memoized", () => {
  assert.match(chatbot, /useMemo/);
  assert.match(chatbot, /useMemo\(\(\) => JSON\.stringify\(flow\), \[flow\]\)/);
  assert.doesNotMatch(chatbot, /if\(!ready\|\|JSON\.stringify\(flow\)===lastSaved/);
});

const conversations = fs.readFileSync(new URL("../../api/src/operations/conversations.controller.ts", import.meta.url), "utf8");
test("inbox list does not load unused participant graphs", () => {
  assert.match(conversations, /const rows = await this\.prisma\.conversation\.findMany/);
  assert.doesNotMatch(conversations, /messages: \{[\s\S]*participants: \{ include:/);
});

test("inbox does not keep a duplicate assignee loader", () => {
  assert.doesNotMatch(source, /setAssignees|loadAssignees/);
});
