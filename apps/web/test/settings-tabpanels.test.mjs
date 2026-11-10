import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const operations=fs.readFileSync(new URL('../src/app/operations-settings.tsx',import.meta.url),'utf8');

test('operations settings tabs have deterministic bidirectional tabpanel associations',()=>{
  assert.match(operations,/\[["]Organização["],"Atendimento","Identidade visual","Técnico"\] as const/);
  assert.match(operations,/function settingsTabKey\(tab:string\)\{return tab\.normalize\(["]NFD["]\)/);
  assert.match(operations,/\.map\(tab=>\{const key=settingsTabKey\(tab\),selected=settingsTab===tab;/);
  assert.equal((operations.match(/role="tabpanel"/g)||[]).length,1);
  assert.match(operations,/id=\{"settings-tab-"\+key\}/);
  assert.match(operations,/aria-controls=\{"settings-panel-"\+key\}/);
  assert.match(operations,/id=\{"settings-panel-"\+key\}/);
  assert.match(operations,/aria-labelledby=\{"settings-tab-"\+key\}/);
  assert.match(operations,/role="tabpanel" aria-labelledby=\{"settings-tab-"\+key\} hidden=\{!selected\}/);
  assert.match(operations,/aria-selected=\{selected\}/);
  assert.match(operations,/tabIndex=\{selected\?0:-1\}/);
});


