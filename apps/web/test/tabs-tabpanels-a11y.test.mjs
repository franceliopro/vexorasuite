import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const ai = fs.readFileSync(new URL("../src/app/ai-agents-workspace.tsx", import.meta.url), "utf8");
const crm = fs.readFileSync(new URL("../src/app/crm-workspace.tsx", import.meta.url), "utf8");

function assertTabContract(source, { tablistLabel, panelIds }) {
  assert.match(source, new RegExp(`role=\\"tablist\\"[^>]*aria-label=\\"${tablistLabel}\\"`));
  for (const panelId of panelIds) {
    assert.match(source, new RegExp(`id=\\"${panelId}\\"[^>]*role=\\"tabpanel\\"`));
    assert.match(source, new RegExp(`role=\\"tabpanel\\"[^>]*aria-labelledby=`));
  }
}

test("AI workspace tabs point to deterministic tabpanels", () => {
  assertTabContract(ai, {
    tablistLabel: "Áreas de configuração da inteligência",
    panelIds: ["ai-workspace-tabpanel", "ai-agent-tabpanel"],
  });
  assert.match(ai, /id=\{tabId\}/);
  assert.match(ai, /aria-controls=\"ai-workspace-tabpanel\"/);
  assert.match(ai, /aria-controls=\"ai-agent-tabpanel\"/);
  assert.match(ai, /hidden=\{!agent\}/);
});

test("CRM tabs point to one selected tabpanel without duplicate roles", () => {
  assertTabContract(crm, { tablistLabel: "Visualização do CRM", panelIds: ["crm-tabpanel"] });
  assert.equal((crm.match(/id=\"crm-tab-(?:pipeline|customers|contacts|origins|reports)\"/g) || []).length, 5);
  assert.equal((crm.match(/aria-controls=\"crm-tabpanel\"/g) || []).length, 5);
  assert.equal((crm.match(/role=\"tab\"/g) || []).length, 5);
  assert.match(crm, /aria-labelledby=\{`crm-tab-\$\{view\}`\}/);
});

