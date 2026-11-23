import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const workspace = read("src/app/sites-workspace.tsx");
const agents = read("src/app/ai-agents-workspace.tsx");
const home = read("src/app/page.tsx");

test("a entrada de Sites usa somente o HUB e não importa wizard ou editor visual", () => {
  assert.ok(workspace.includes("export function SitesWorkspace({ canManage }: { canManage: boolean })"));
  assert.ok(workspace.includes('import { useCallback, useEffect, useState } from "react"'));
  for (const legacy of [
    "wizard/wizard-shell", "site-editor-window", "sites/editor/", "sites/preview/",
    "/api/backend/sites/import/", "WizardShell", "SiteEditorWindow", "novo site pelo assistente",
  ]) {
    assert.ok(!workspace.includes(legacy), `o workspace ainda referencia ${legacy}`);
  }
  assert.ok(!workspace.includes('from "next/dynamic"'));
});

test("o workspace cobre pedido, preview, decisão e publicação com evidência", () => {
  const contract = [
    "/api/backend/sites/hub/requests",
    '`/${request.id}/preview`',
    '`/${request.id}/decision`',
    '`/${request.id}/publish-request`',
    '`/${request.id}/publish-confirm`',
    "STATUS_LABEL",
    "Versões",
    "Aprovações",
    "Auditoria",
    'aria-label={`Pedido ${request.name}`}',
    'aria-label="Novo pedido de site"',
    'role="status"',
    'role="alert"',
    "Tentar novamente",
  ];
  for (const token of contract) assert.ok(workspace.includes(token), `o HUB perdeu ${token}`);

  assert.ok(workspace.includes("Não gera HTML, não hospeda página e não publica por conta própria"));
  assert.ok(workspace.includes("A URL é evidência de versão, nunca uma publicação."));
  assert.ok(workspace.includes("Este botão apenas registra a solicitação. A publicação é executada fora da Véxora."));
  assert.ok(workspace.includes("A confirmação só é gravada se o domínio responder 2xx ao health-check."));
  assert.ok(!workspace.includes("Publicado</span>"));
});

test("o fluxo padrão de agentes não force a Rastreabem", () => {
  assert.ok(agents.includes('useState("Crie um fluxo de atendimento com financeiro, suporte, comercial e administrativo.")'));
  assert.ok(!agents.includes("Rastreabem"));
  assert.ok(!home.includes("vexora-chatbot-rastreabem-draft-v2"));
});
