import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/chatbot-workspace.tsx");
const moduleSource = read("src/lib/guided-flow.ts");

const guided = await import("../src/lib/guided-flow.ts");

test("o exemplo de nome preferido é um rascunho executável, sem pseudo-tipo", () => {
  const flow = guided.preferredNameFlow([
    { key: "SUPORTE", name: "Suporte" },
    { key: "ADM", name: "Administrativo" },
  ]);
  assert.deepEqual(flow.steps.map((step) => step.id), [
    "nome",
    "nome-escolha",
    "nome-manter",
    "nome-digitar",
    "menu-triagem",
    "suporte",
    "administrativo",
  ]);
  assert.ok(flow.steps.every((step) => step.kind !== "preferred-name"));

  const byId = Object.fromEntries(flow.steps.map((step) => [step.id, step]));
  assert.equal(byId.nome.kind, "condition");
  assert.deepEqual(byId.nome.transitions, { Sim: "nome-digitar", Não: "nome-escolha" });
  assert.deepEqual(JSON.parse(byId["nome-digitar"].config), {
    variable: "novo_nome",
    validation: "preferred-name",
  });
  assert.deepEqual(JSON.parse(byId["nome-manter"].config), {
    variable: "novo_nome",
    value: "{{nome_identificado}}",
  });
  assert.deepEqual(byId["menu-triagem"].options, ["Suporte", "Administrativo"]);
  assert.deepEqual(JSON.parse(byId.suporte.config), {
    targetMode: "DEPARTMENT",
    departmentKey: "SUPORTE",
  });
  assert.deepEqual(JSON.parse(byId.administrativo.config), {
    targetMode: "DEPARTMENT",
    departmentKey: "ADM",
  });
  assert.match(byId["menu-triagem"].message, /\{\{novo_nome\}\}/);
});

test("sem departamentos correspondentes o exemplo continua publicável na fila", () => {
  const flow = guided.preferredNameFlow([{ key: "FINANCEIRO", name: "Financeiro" }]);
  const handoffs = flow.steps.filter((step) => step.kind === "human.handoff");
  assert.equal(handoffs.length, 2);
  for (const step of handoffs) {
    assert.deepEqual(JSON.parse(step.config), { targetMode: "QUEUE" });
  }
});

test("o guia explica quando usar, o que configurar e o que o cliente vê", () => {
  assert.ok(guided.flowGuide.length >= 8);
  for (const item of guided.flowGuide) {
    assert.ok(item.id && item.label);
    assert.match(item.when, /\S/);
    assert.match(item.configure, /\S/);
    assert.match(item.sees, /\S/);
  }
  const preferredName = guided.explainStep({
    kind: "input.text",
    config: JSON.stringify({ variable: "novo_nome", validation: "preferred-name" }),
  });
  assert.match(preferredName.what, /\{\{novo_nome\}\}/);
  assert.match(preferredName.configure, /não mexa no JSON/i);
  assert.equal(
    guided.guidedKindOptions.some(([kind]) => kind === "human.handoff"),
    true,
  );
  assert.deepEqual(guided.guidedKindDefaults("input.text").options, ["Continuar"]);
});

test("o editor mostra etapas nomeadas e esconde o formato interno", () => {
  for (const marker of [
    'import { explainStep, flowGuide, guidedKindDefaults, guidedKindOptions, preferredNameFlow',
    "function loadPreferredNameExample()",
    "Carregar exemplo: nome preferido",
    "Entenda os blocos",
    "{guideOpen?",
    'id="chatbot-guide-title"',
    "flowGuide.map(",
    "O que esta etapa faz",
    "explainStep(current).what",
    "guidedKindOptions.map(",
    "changeGuidedKind(e.target.value)",
    "Nome da etapa",
    'aria-label="Entenda os blocos do fluxo"',
  ]) {
    assert.ok(workspace.includes(marker), `editor perdeu ${marker}`);
  }
  for (const raw of ["Tipo de bloco", "Parâmetros da automação"]) {
    assert.equal(workspace.includes(raw), false, `controle cru voltou: ${raw}`);
  }
  assert.match(moduleSource, /JSON continua apenas como transporte interno/);
});

test("o assistente oferece o comando determinístico como exemplo clicável", () => {
  for (const marker of [
    "Crie um fluxo com nome preferido, Suporte e Administrativo",
    "setAiRequest(",
    "Nome preferido",
    "Ajustar uma etapa",
  ]) {
    assert.ok(workspace.includes(marker), `diálogo perdeu ${marker}`);
  }
});

test("o bloco de catálogo usa itemId persistido e não aceita preço digitado", () => {
  const defaults = guided.guidedKindDefaults("catalog.item");
  assert.deepEqual(JSON.parse(defaults.config), { itemId: "" });
  assert.deepEqual(defaults.options, ["Continuar"]);
  assert.equal(guided.guidedKindOptions.some(([kind]) => kind === "catalog.item"), true);

  const guide = guided.flowGuide.find((item) => item.id === "catalog.item");
  assert.ok(guide, "o guia deve explicar o item do catálogo");
  assert.match(guide.configure, /Escolha explicitamente o item/i);
  assert.match(guide.sees, /sem preço ou condição inventados/i);

  const explanation = guided.explainStep({ kind: "catalog.item" });
  assert.match(explanation.configure, /Não digite preço/i);
  assert.match(explanation.sees, /do item cadastrado/i);

  const io = guided.stepIO({ kind: "catalog.item", options: ["Continuar"] });
  assert.equal(io.input, "Item escolhido no cadastro da empresa");
  assert.equal(io.writes.length, 0);
  assert.match(io.note, /não inventa condições/i);
});

test("o editor carrega itens ativos do tenant e só seleciona item explícito", () => {
  for (const marker of [
    "/api/backend/catalog?limit=200&includeInactive=false",
    "Array.isArray(data?.items)",
    "setCatalogItems(data.items)",
    'catalog: "border-l-flow-tone-crm"',
    '["catalog.item","Item do catálogo"]',
    'JSON.stringify({itemId:""})',
    'data-testid="chatbot-catalog-item"',
    "changeDestination({itemId:e.target.value})",
    "values.itemId?catalogItems.find(item=>item.id===values.itemId)?.name",
    "nodeSummary(step,catalogItems)",
    "<summary>Catálogo</summary>",
    'add("catalog.item",item.name,{itemId:item.id})',
    '"catalog.item","Item do catálogo"',
  ]) {
    assert.ok(workspace.includes(marker), `editor perdeu ${marker}`);
  }
  for (const raw of ["catalogItemId", "priceCents:e.target.value", "digite o preço"]) {
    assert.equal(workspace.includes(raw), false, `editor voltou a aceitar dado manual: ${raw}`);
  }
});
