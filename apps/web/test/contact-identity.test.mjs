import test from 'node:test';
import assert from 'node:assert/strict';
import {contactDisplayName} from '../src/lib/contact-identity.ts';
test('conversation uses the name captured as novo_nome before the channel display name',()=>{assert.equal(contactDisplayName({name:'5511999999999',metadata:{}},{variables:{novo_nome:'Ana'}}),'Ana');assert.equal(contactDisplayName({name:'Number'},{novo_nome:'João'}),'João');});
test('preferred metadata and custom fields are honored without exposing unresolved tokens',()=>{assert.equal(contactDisplayName({name:'Original',metadata:{customFields:{nome_preferido:'Maria'}}}),'Maria');assert.equal(contactDisplayName({name:'Original',metadata:{preferredName:'{{novo_nome}}'}}),'Original');});
