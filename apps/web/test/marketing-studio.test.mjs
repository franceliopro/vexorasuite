import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(fileURLToPath(new URL("..",import.meta.url)));
const workspace=fs.readFileSync(path.join(root,"src/app/manual-content-workspace.tsx"),"utf8");

test("marketing studio has a single AI creation entry point",()=>{
  for(const text of ["Publicar manualmente","Criação com IA","Rotina da pasta","Calendário editorial","Redes de destino","Google Drive","Salvar rascunho","Marcar como pronta","Somente automação, sem IA","Usar criação com IA quando entrar arquivo novo","Gerar rascunho pronto","Capas geradas","Lâminas do rascunho"])assert.match(workspace,new RegExp(text));
  assert.doesNotMatch(workspace,/Agente Marketing/);
  assert.doesNotMatch(workspace,/mode==="agent"/);
  assert.doesNotMatch(workspace,/autoPublish/);
});

test("wizard saves the generated images in the ready draft",()=>{
  assert.match(workspace,/marketing\/drafts",\{question,format,useBrandOnly:brandOnly,publish:false,wizard:true\}/);
  assert.match(workspace,/mediaItems=slides\.map/);
  assert.match(workspace,/"marketing\/manual-drafts\/"\+savedDraftId/);
});
