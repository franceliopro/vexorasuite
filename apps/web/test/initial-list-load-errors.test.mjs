import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const operations = readFileSync(new URL("../src/app/operations-settings.tsx", import.meta.url), "utf8");
const inbox = readFileSync(new URL("../src/app/inbox-workspace.tsx", import.meta.url), "utf8");

test("operations settings exposes a retry for initial list failures", () => {
  assert.match(operations, /loadInitialSettings = useCallback/);
  assert.ok(operations.includes("Tentar novamente"));
  assert.ok(operations.includes("void loadInitialSettings()"));
});

test("operations settings routes every audited initial-load failure to visible feedback", () => {
  const initialLoader = operations.slice(
    operations.indexOf("const loadInitialSettings"),
    operations.indexOf("useEffect(()=>{if(!isPlatformAdmin"),
  );
  assert.doesNotMatch(initialLoader, /catch\(\(\) => \{\}\)/);
  assert.equal((initialLoader.match(/\.catch\(\(\) => report\(/g) || []).length, 7);
  for (const endpoint of [
    "/api/backend/auth/organization",
    "/api/backend/channels",
    "/api/backend/departments",
    "/api/backend/conversations/assignees",
    "/api/backend/integrations/asaas",
    "/api/backend/conversations/distribution-settings",
    "/api/backend/contacts/brand-settings",
  ]) {
    const endpointIndex = initialLoader.indexOf(endpoint);
    assert.notEqual(endpointIndex, -1);
    const endpointLoad = initialLoader.slice(endpointIndex, endpointIndex + 320);
    assert.match(endpointLoad, /\.catch\(\(\) => report\(/);
  }
});

test("inbox reports initial list failures and offers retry", () => {
  assert.match(inbox, /loadInitialLists = useCallback/);
  assert.match(inbox, /Não foi possível carregar: /);
  assert.ok(inbox.includes("Tentar novamente"));
  assert.ok(inbox.includes("void loadInitialLists()"));
});

test("inbox initial pipeline, department and agent loads are explicit", () => {
  const initialLists = inbox.slice(inbox.indexOf("const loadInitialLists"), inbox.indexOf("const [handoffDepartment"));
  assert.equal((initialLists.match(/failures\.push\(/g) || []).length, 3);
  assert.match(initialLists, /crm\/pipelines/);
  assert.match(initialLists, /\/api\/backend\/departments/);
  assert.match(initialLists, /\/api\/backend\/conversations\/assignees/);
  assert.doesNotMatch(initialLists, /catch\(\(\) => \{\}\)/);
});
