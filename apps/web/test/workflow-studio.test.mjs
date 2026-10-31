import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(fileURLToPath(new URL("..",import.meta.url)));
const workspace=fs.readFileSync(path.join(root,"src/app/workflows-workspace.tsx"),"utf8");
const design=fs.readFileSync(path.join(root,"src/app/vexora-design-system.css"),"utf8");

test("workflow studio exposes the requested operating model",()=>{
  for(const label of ["Nova conversa","Mensagem recebida","Cliente criado ou atualizado","Pagamento criado ou alterado","Mudança de etapa do CRM","Horário agendado","Inbox","Departamento","Atendente","Situação financeira","Criar tarefa","Enviar mensagem","Limite de tentativas","Histórico de execuções"]) assert.match(workspace,new RegExp(label));
  assert.match(design,/workflow-builder-grid/);
  assert.match(design,/workflow-template-card/);
});
