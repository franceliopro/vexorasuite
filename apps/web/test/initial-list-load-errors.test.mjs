import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const operations = readFileSync(new URL("../src/app/operations-settings.tsx", import.meta.url), "utf8");
const inbox = readFileSync(new URL("../src/app/inbox-workspace.tsx", import.meta.url), "utf8");

test("operations settings reports initial list failures and offers retry", () => {
  assert.match(operations, /loadInitialSettings = useCallback/);
  assert.match(operations, /Não foi possível carregar os atendentes/);
  assert.match(operations, /Não foi possível carregar a identidade visual/);
  assert.match(operations, /onClick=\{\(\) => void loadInitialSettings\(\)\}/);
});

test("operations settings no longer silently swallows audited initial loads", () => {
  const initialEffect = operations.slice(operations.indexOf("const loadInitialSettings"), operations.indexOf("useEffect(()=>{if(!isPlatformAdmin"));
  assert.doesNotMatch(initialEffect, /catch\(\(\) => \{\}\)/);
  assert.match(initialEffect, /catch\(\) => report/);
});

test("inbox reports initial list failures and offers retry", () => {
  assert.match(inbox, /loadInitialLists = useCallback/);
  assert.match(inbox, /Não foi possível carregar: /);
  assert.match(inbox, /onClick=\{\(\) => void loadInitialLists\(\)\}/);
});

test("inbox initial pipeline, department and agent loads are explicit", () => {
  const initialLists = inbox.slice(inbox.indexOf("const loadInitialLists"), inbox.indexOf("const [handoffDepartment"));
  assert.match(initialLists, /crm\/pipelines/);
  assert.match(initialLists, /\/api\/backend\/departments/);
  assert.match(initialLists, /\/api\/backend\/conversations\/assignees/);
  assert.doesNotMatch(initialLists, /catch\(\(\) => \{\}\)/);
});
