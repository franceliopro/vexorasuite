import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(fileURLToPath(new URL("..",import.meta.url)));
const workspace=fs.readFileSync(path.join(root,"src/app/manual-content-workspace.tsx"),"utf8");
const design=fs.readFileSync(path.join(root,"src/app/vexora-design-system.css"),"utf8");

test("marketing studio has manual, assisted and calendar paths",()=>{
  for(const text of ["Publicar manualmente","Agente Marketing","Rotina da pasta","Calendário editorial","Redes de destino","Google Drive","Salvar rascunho","Marcar como pronta","Somente automação, sem IA","Usar Agente Marketing quando entrar arquivo novo"])assert.match(workspace,new RegExp(text));
  assert.match(design,/marketing-network-grid/);
  assert.match(design,/marketing-draft-row/);\n  assert.match(design,/marketing-automation-note/);
});
