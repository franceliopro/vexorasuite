import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(fileURLToPath(new URL("..",import.meta.url)));
const read=(file)=>fs.readFileSync(path.join(root,file),"utf8");
const workspace=read("src/app/workflows-workspace.tsx");
const styles=read("src/app/vexora.css");
const packageJson=read("package.json");

test("workflow mostra uma linha do tempo sequencial e reordenável",()=>{
  for(const token of [
    "data-workflow-timeline",
    "data-workflow-step={i+1}",
    "Passo {i+1}",
    "O passo 1 acontece primeiro",
    "moveStep(i,-1)",
    "moveStep(i,1)",
    "aria-label={`Subir passo ${i+1}`}",
    "aria-label={`Descer passo ${i+1}`}",
    "+ Adicionar próximo passo",
    "Tempo em minutos",
  ]) assert.ok(workspace.includes(token),`a linha do tempo perdeu ${token}`);
});

test("a linha do tempo preserva o contrato atual do workflow",()=>{
  for(const label of [
    "Nova conversa","Mensagem recebida","Cliente criado ou atualizado","Pagamento criado ou alterado",
    "Mudança de etapa do CRM","Horário agendado","Inbox","Departamento","Atendente",
    "Situação financeira","Criar tarefa","Enviar mensagem","Limite de tentativas",
    "Histórico de execuções",
  ]) assert.match(workspace,new RegExp(label),`workflow perdeu ${label}`);
  for(const id of [
    "wf-channelId","wf-departmentId","wf-assigneeId","wf-tag",
    "wf-stage","wf-conversationStatus","wf-customerField","wf-financialStatus",
  ]) assert.ok(workspace.includes(`id="${id}"`),`o filtro ${id} perdeu o alvo de rolagem`);
  assert.match(workspace,/document\.getElementById\("wf-"\+x\.value\)/);
  assert.match(workspace,/steps,filters:\{\.\.\.filters,workflowKind:trigger,stopOnReply,cancelClosed,maxAttempts,retryFailed,reviewUnsafe\},enabled:false/);
});

test("a linha do tempo continua linear, sem grafo ou dependência de canvas",()=>{
  assert.doesNotMatch(workspace,/\btransitions\b/);
  assert.doesNotMatch(workspace,/<svg|onDrag|onDrop|setPointerCapture|data-flow-node-id|autoArrange|minimap/);
  for(const library of ["reactflow","@xyflow/react"]) assert.ok(!packageJson.includes(library),`dependência de grafo inesperada: ${library}`);
});

test("a linha do tempo tem estilos próprios e responsivos",()=>{
  for(const selector of [
    ".workflow-guide",".workflow-timeline-panel",".workflow-timeline-list",
    ".workflow-step-marker",".workflow-step-line",".workflow-step-head",
    ".workflow-step-fields",".workflow-step-actions",".workflow-wait-field",
  ]) assert.ok(styles.includes(selector),`falta o estilo ${selector}`);
  assert.match(styles,/@media \(max-width:760px\)\{[\s\S]*?\.workflow-step-fields\{grid-template-columns:1fr\}/);
});

test("o editor mantém o catálogo à esquerda e a sequência em uma área maior à direita",()=>{
  assert.match(styles,/\.workflow-builder-grid\{grid-template-columns:250px minmax\(0,1fr\);grid-template-areas:"catalog canvas" "catalog settings"/);
  for(const selector of [
    ".workflow-builder-header{",
    ".workflow-catalog{grid-area:catalog",
    ".workflow-canvas{grid-area:canvas",
    ".workflow-settings{grid-area:settings",
    ".workflow-name-field{",
    ".workflow-condition-grid{",
    ".workflow-panel{display:grid;gap:14px;padding:18px",
  ]) assert.ok(styles.includes(selector),`falta o estilo ${selector}`);
  assert.match(styles,/\.workflow-timeline-list \.workflow-step-card\{background-color:var\(--s1\)!important\}/);
  assert.match(styles,/\.workflow-builder input,\.workflow-builder select,\.workflow-builder textarea\{background-color:var\(--s1\)!important\}/);
});
