import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const operations=fs.readFileSync(new URL('../src/app/operations-settings.tsx',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
const service=fs.readFileSync(new URL('../../api/src/operations/test-environment-reset.service.ts',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../../api/src/operations/test-environment.controller.ts',import.meta.url),'utf8');

test('company deletion lives only in Véxora platform settings',()=>{
  assert.match(operations,/const platformManagement=isPlatformAdmin&&platformContext;/);
  assert.match(operations,/\{platformManagement&&settingsTab==="Organização"\?/);
  assert.match(operations,/\{platformManagement&&settingsTab==="Técnico"\?/);
  assert.match(operations,/>Excluir Empresa</);
  assert.doesNotMatch(operations,/Ambiente de testes/);
  assert.doesNotMatch(operations,/>Excluir empresa</);
  assert.doesNotMatch(operations,/setTestClientSlug\(first\.slug\)/);
  assert.match(operations,/<option value="">Selecione uma empresa<\/option>/);
  assert.match(operations,/confirmation:"EXCLUIR EMPRESA"/);
  assert.match(operations,/confirmSlug/);
  assert.match(operations,/resetPlatformConversations:true,deleteCompany:true/);
  assert.match(page,/platformContext=\{platformPanel\}/);
});

test('backend requires the current platform tenant and an exact slug confirmation',()=>{
  assert.match(service,/isPlatformAdmin !== true/);
  assert.match(service,/\["OWNER", "ADMIN"\]\.includes\(request\.user\.role\)/);
  assert.match(service,/id: request\.user\.tenantId, kind: "PLATFORM", status: "ACTIVE"/);
  assert.match(service,/body\.confirmation !== "EXCLUIR EMPRESA"/);
  assert.match(service,/typeof body\.confirmSlug === "string"/);
  assert.match(service,/confirmSlug !== client\.slug/);
  assert.match(controller,/confirmSlug\?: unknown/);
});
