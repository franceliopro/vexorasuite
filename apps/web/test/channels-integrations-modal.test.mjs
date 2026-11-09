import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/app/channels-integrations.tsx', import.meta.url), 'utf8');

test('WhatsApp QR flow delegates modal semantics and keyboard behavior to VexoraDialog', () => {
  assert.match(source, /import \{ VexoraDialog \} from "\.\/vexora-dialog";/);
  assert.match(source, /<VexoraDialog open title="Conectar WhatsApp"/);
  assert.match(source, /onClose=\{\(\)=>\{if\(!inboxBusy\)setWahaSetup\(null\);\}\}/);
  assert.match(source, /alt="QR Code para conectar o WhatsApp"/);
});

test('QR loading and failure states remain visible to assistive technology', () => {
  assert.match(source, /status==="LOADING"/);
  assert.match(source, /role="status">Preparando a conexão/);
  assert.match(source, /status==="ERROR"/);
  assert.match(source, /role="alert">\{wahaSetup\.error\}/);
  assert.match(source, /setWahaSetup\(\{id,name,status:"ERROR",error:message\}\)/);
});

test('integration response parsing does not silently swallow successful invalid responses', () => {
  assert.doesNotMatch(source, /response\.json\(\)\.catch\(\(\)=>\(\{\}\)\)/);
  assert.match(source, /if\(response\.ok\)throw new Error\("A Véxora recebeu uma resposta inválida do servidor\."\)/);
});

