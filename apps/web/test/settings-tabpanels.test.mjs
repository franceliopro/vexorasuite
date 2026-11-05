import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const operations=fs.readFileSync(new URL('../src/app/operations-settings.tsx',import.meta.url),'utf8');
const presentation=fs.readFileSync(new URL('../src/app/presentation-home.tsx',import.meta.url),'utf8');

test('operations settings tabs have deterministic bidirectional tabpanel associations',()=>{
  for(const key of ['organizacao','atendimento','identidade-visual','tecnico']){
    assert.match(operations,new RegExp('id=\\{"settings-tab-'+key+'"\\}'));
    assert.match(operations,new RegExp('aria-controls=\\{"settings-panel-'+key+'"\\}'));
    assert.match(operations,new RegExp('id=\\{"settings-panel-'+key+'"\\}'));
    assert.match(operations,new RegExp('aria-labelledby=\\{"settings-tab-'+key+'"\\}'));
  }
  assert.match(operations,/role="tabpanel" aria-labelledby=\{\{"settings-tab-"\+key\}\} hidden=\{!selected\}/);
  assert.match(operations,/tabIndex=\{selected\?0:-1\}/);
});

test('presentation device tabs expose selected tabpanels consistently',()=>{
  for(const key of ['desktop','mobile']){
    assert.match(presentation,new RegExp('id="presentation-tab-'+key+'"'));
    assert.match(presentation,new RegExp('aria-controls="presentation-panel-'+key+'"'));
    assert.match(presentation,new RegExp('id=\{\"presentation-panel-\"\+device\}'));
    assert.match(presentation,new RegExp('aria-labelledby=\{\"presentation-tab-\"\+device\}'));
  }
  assert.match(presentation,/role="tabpanel" aria-labelledby=\{\{"presentation-tab-"\+device\}\} hidden=\{false\}/);
  assert.match(presentation,/aria-selected=\{device==='desktop'\}/);
});
