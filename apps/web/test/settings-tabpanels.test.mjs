import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const operations=fs.readFileSync(new URL('../src/app/operations-settings.tsx',import.meta.url),'utf8');
const presentation=fs.readFileSync(new URL('../src/app/presentation-home.tsx',import.meta.url),'utf8');

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

test('presentation device tabs expose selected tabpanels consistently',()=>{
  for(const key of ['desktop','mobile']){
    assert.ok(presentation.includes('id="presentation-tab-'+key+'"'));
    assert.ok(presentation.includes('aria-controls="presentation-panel-'+key+'"'));
  }
  assert.equal((presentation.match(/role="tab"/g)||[]).length,2);
  assert.match(presentation,/id=\{"presentation-panel-"\+device\}/);
  assert.match(presentation,/role="tabpanel" aria-labelledby=\{"presentation-tab-"\+device\} hidden=\{false\}/);
  assert.match(presentation,/aria-selected=\{device==='desktop'\}/);
  assert.match(presentation,/aria-selected=\{device==='mobile'\}/);
  assert.match(presentation,/tabIndex=\{device==='desktop'\?0:-1\}/);
  assert.match(presentation,/tabIndex=\{device==='mobile'\?0:-1\}/);
});
