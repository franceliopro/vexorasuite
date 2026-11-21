import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const notifications = read("src/app/notification-settings.tsx");
const resources = read("src/app/department-resources.tsx");
const workflows = read("src/app/workflows-workspace.tsx");
const screens = [notifications, resources, workflows];

/** Só literais de className são classes — a expressão ao redor não conta. */
function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  return values.join("\n");
}
const classes = screens.map(classValues).join("\n");

test("as telas de configuração não usam classes componente legadas", () => {
  assert.doesNotMatch(classes, /\b(?:ov|vx|ib|rw|vx|ps)-[a-z][a-z0-9-]*/);
  assert.doesNotMatch(classes, /\b(?:content-card|settings-card|ai-toggle|primary-button|secondary-button|text-button|resource-fields|icon-button|dialog-close|chip)\b/);
});

test("as telas de configuração usam só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = screens.join("\n").match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "rounded-token-lg border border-line bg-surface",
    "text-body font-bold text-blue-50",
    "hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
    "border border-line bg-surface-2",
    "hover:border-line-strong hover:bg-hover",
    "hover:bg-surface hover:text-blue-700",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os ids dos filtros de workflow permanecem como alvo de getElementById", () => {
  assert.match(workflows, /document\.getElementById\("wf-"\+x\.value\)/);
  for (const id of [
    "wf-channelId", "wf-departmentId", "wf-assigneeId", "wf-tag",
    "wf-stage", "wf-conversationStatus", "wf-customerField", "wf-financialStatus",
  ]) {
    assert.ok(workflows.includes(`id="${id}"`), `o filtro ${id} perdeu o alvo de rolagem`);
  }
});

test("os contratos das telas permanecem intactos", () => {
  for (const token of [
    "/api/backend/notification-settings", "role=\"status\"", "Notificações de atendimento",
  ]) assert.ok(notifications.includes(token), `notificações perderam ${token}`);
  for (const token of [
    "api('department-resources')", "integrations/google/calendar/", "Google por departamento e atendente",
  ]) assert.ok(resources.includes(token), `recursos perderam ${token}`);
  for (const label of [
    "Nova conversa", "Mensagem recebida", "Cliente criado ou atualizado", "Pagamento criado ou alterado",
    "Mudança de etapa do CRM", "Horário agendado", "Inbox", "Departamento", "Atendente",
    "Situação financeira", "Criar tarefa", "Enviar mensagem", "Limite de tentativas",
    "Histórico de execuções",
  ]) assert.match(workflows, new RegExp(label), `workflow perdeu ${label}`);
});
