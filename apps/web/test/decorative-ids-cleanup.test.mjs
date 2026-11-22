import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const aiAgents = read("src/app/ai-agents-workspace.tsx");
const crm = read("src/app/crm-workspace.tsx");
const reports = read("src/app/reports-workspace.tsx");
const workflows = read("src/app/workflows-workspace.tsx");
const sources = [aiAgents, crm, reports, workflows].join("\n");

/**
 * REMOVIDOS (decorativos confirmados): os três <datalist> de ai-agents-workspace
 * não têm nenhum `list=`, aria-*, getElementById, querySelector, url(#...), CSS
 * ou asserção de teste apontando para eles. Eram resquícios do picker legado
 * (hoje AiModelPicker usa <select>, sem datalist).
 */
const REMOVED_IDS = ["local-voice-models", "ollama-models", "openrouter-models"];

test("ids decorativos removidos não podem reaparecer nas quatro telas", () => {
  // Regex dura: qualquer reintrodução literal (inclusive em id dinâmico) falha.
  assert.doesNotMatch(
    sources,
    /\blocal-voice-models\b|\bollama-models\b|\bopenrouter-models\b/,
    "id decorativo reintroduzido",
  );
  assert.doesNotMatch(
    sources,
    /\bid\s*=\s*(?:"|'|\{["'])(?:local-voice-models|ollama-models|openrouter-models)(?:["']\}|"|')/,
  );
  for (const id of REMOVED_IDS) {
    assert.equal(new RegExp(`\\b${id}\\b`).test(sources), false, `${id} voltou`);
  }
});

/**
 * PRESERVADOS (funcionais): os 5 ids de aba do CRM são alvo do
 * `aria-labelledby={\`crm-tab-${view}\`}` do tabpanel e de guards de a11y.
 */
test("ids funcionais do CRM permanecem como alvo do aria-labelledby dinâmico", () => {
  for (const id of [
    "crm-tab-contacts",
    "crm-tab-customers",
    "crm-tab-origins",
    "crm-tab-pipeline",
    "crm-tab-reports",
  ]) {
    assert.match(crm, new RegExp(`id="${id}"`), `perdeu ${id}`);
  }
  assert.match(crm, /aria-labelledby=\{`crm-tab-\$\{view\}`\}/);
  assert.equal((crm.match(/aria-controls="crm-tabpanel"/g) ?? []).length, 5);
  assert.equal((crm.match(/role="tab"/g) ?? []).length, 5);
});

/** PRESERVADO (funcional): rw-instagram é referenciado por url(#rw-instagram). */
test("gradiente rw-instagram permanece referenciado pelo SVG", () => {
  assert.match(reports, /id="rw-instagram"/);
  assert.match(reports, /return "url\(#rw-instagram\)"/);
});

/**
 * PRESERVADOS (funcionais): os 8 ids wf-* são alvo do scroll por
 * `document.getElementById("wf-"+x.value)`, com x.value vindo de `conditions`.
 */
test("ids funcionais dos filtros de workflow permanecem como alvo de getElementById", () => {
  const inicio = workflows.indexOf("const conditions:Item[]=[");
  const fim = workflows.indexOf("const actions:Item[]=[");
  assert.ok(inicio >= 0 && fim > inicio);
  const keys = [...workflows.slice(inicio, fim).matchAll(/\{value:"([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.match(workflows, /document\.getElementById\("wf-"\+x\.value\)/);
  for (const key of keys) {
    assert.ok(workflows.includes(`id="wf-${key}"`), `perdeu o alvo de rolagem wf-${key}`);
  }
  for (const id of [
    "wf-assigneeId",
    "wf-channelId",
    "wf-conversationStatus",
    "wf-customerField",
    "wf-departmentId",
    "wf-financialStatus",
    "wf-stage",
    "wf-tag",
  ]) {
    assert.ok(keys.includes(id.slice("wf-".length)), `condição ${id} saiu de conditions`);
    assert.ok(workflows.includes(`id="${id}"`), `perdeu ${id}`);
  }
});

test("guards existentes continuam cobrindo os ids funcionais", () => {
  const guards = [
    "test/tabs-tabpanels-a11y.test.mjs",
    "test/tailwind-crm-header.test.mjs",
    "test/tailwind-reports.test.mjs",
    "test/tailwind-reports-overview.test.mjs",
    "test/tailwind-settings-cleanup.test.mjs",
  ].map(read).join("\n");
  assert.match(guards, /crm-tab-pipeline/);
  assert.match(guards, /url\(#rw-instagram\)/);
  assert.match(guards, /wf-financialStatus/);
});
