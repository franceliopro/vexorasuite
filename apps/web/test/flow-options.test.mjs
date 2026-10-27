import test from 'node:test';
import assert from 'node:assert/strict';
import {optionText,commitOptions} from '../src/lib/flow-options.ts';
test('Enter preserves an unfinished next option instead of resetting the field',()=>{let value='Financeiro';for(const part of ['\n','S','u','p','o','r','t','e','\n']){value=optionText(value+part).join('\n');}assert.equal(value,'Financeiro\nSuporte\n');assert.deepEqual(optionText(value),['Financeiro','Suporte','']);});
test('blank lines are normalized only when editing ends, preserving existing destinations',()=>{assert.deepEqual(commitOptions(['Financeiro','','Suporte',''],{Financeiro:'financeiro',Suporte:'suporte',Obsoleto:'old'}),{options:['Financeiro','Suporte'],transitions:{Financeiro:'financeiro',Suporte:'suporte'}});});
