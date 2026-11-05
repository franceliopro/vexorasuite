import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/app/chatbot-workspace.tsx", import.meta.url), "utf8");

test("chatbot data loads expose loading, error, and retry states", () => {
  for (const resource of ["crmPipelines", "aiAgents", "runtime"]) {
    assert.match(source, new RegExp(`${resource}Loading`));
    assert.match(source, new RegExp(`${resource}Error`));
  }
  assert.match(source, /loadCrmPipelines\(\)/);
  assert.match(source, /loadAiAgents\(\)/);
  assert.match(source, /loadRuntime\(\)/);
  assert.match(source, /Tentar novamente/);
});

test("chatbot data loaders do not discard request failures silently", () => {
  assert.match(source, /async function loadCrmPipelines\(\)[\s\S]*?catch\(error\)\{/);
  assert.match(source, /async function loadAiAgents\(\)[\s\S]*?catch\(error\)\{/);
  assert.match(source, /async function loadRuntime\(\)[\s\S]*?catch\(error\)\{/);
});
