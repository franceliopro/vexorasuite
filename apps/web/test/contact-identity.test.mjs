import test from 'node:test';
import assert from 'node:assert/strict';
import {contactDisplayName, readablePhone} from '../src/lib/contact-identity.ts';
test('conversation uses the name captured as novo_nome before the channel display name',()=>{assert.equal(contactDisplayName({name:'5511999999999',metadata:{}},{variables:{novo_nome:'Ana'}}),'Ana');assert.equal(contactDisplayName({name:'Number'},{novo_nome:'João'}),'João');});
test('preferred metadata and custom fields are honored without exposing unresolved tokens',()=>{assert.equal(contactDisplayName({name:'Original',metadata:{customFields:{nome_preferido:'Maria'}}}),'Maria');assert.equal(contactDisplayName({name:'Original',metadata:{preferredName:'{{novo_nome}}'}}),'Original');});
test('a saved profile edit overrides a stale conversation variable',()=>{assert.equal(contactDisplayName({name:'Original',metadata:{novo_nome:'Aninha'}},{variables:{novo_nome:'Ana'}}),'Aninha');});
test('technical channel identifiers never appear as a phone number',()=>{assert.equal(readablePhone(undefined,'96394979@lid'),'Telefone não informado');assert.equal(readablePhone(undefined,'120363000000000000@g.us'),'Telefone não informado');assert.equal(readablePhone(undefined,'status@broadcast'),'Telefone não informado');});
test('real Brazilian numbers keep the friendly display format',()=>{assert.equal(readablePhone(undefined,'5566996394979@c.us'),'+55 (66) 99639-4979');assert.equal(readablePhone('+55 (66) 99639-4979'),'+55 (66) 99639-4979');});
