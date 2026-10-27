import { RuntimeFlow, renderStep, selectedOption, validateRuntimeFlow } from './flow-runtime';
const flow = (): RuntimeFlow => ({ name: 'Teste', welcome: 'Olá', channelIds: ['channel'], triggers: [{ kind: 'message' }], steps: [{ id: 'menu', title: 'Menu', message: 'Escolha', options: ['Suporte'], transitions: { Suporte: 'human' } }, { id: 'human', title: 'Humano', message: '', options: [], action: 'human.handoff' }] });
describe('published flow contract', () => {
 it('accepts executable flows',()=>expect(validateRuntimeFlow(flow())).toEqual([]));
 it('blocks unsupported skills',()=>{const f=flow();f.steps[1]!.action='asaas.payment.pix';expect(validateRuntimeFlow(f).join()).toContain('ainda não executável');});
 it('rejects dangling transitions',()=>{const f=flow();f.steps[0]!.transitions={Suporte:'missing'};expect(validateRuntimeFlow(f).join()).toContain('destino inválido');});
 it('rejects malformed options without crashing',()=>{const f=flow();f.steps[0]!.options=[null] as any;expect(validateRuntimeFlow(f).length).toBeGreaterThan(0);});
 it('requires variables for input',()=>{const f=flow();f.steps[0]!.kind='input.text';expect(validateRuntimeFlow(f).join()).toContain('variável');f.steps[0]!.config='{"variable":"solicitacao"}';expect(validateRuntimeFlow(f)).toEqual([]);});
 it('matches exact numeric or textual choices',()=>{const s=flow().steps[0]!;expect(selectedOption(s,'1')).toBe('Suporte');expect(selectedOption(s,' SUPORTE ')).toBe('Suporte');expect(selectedOption(s,'não quero suporte')).toBeUndefined();});
 it('renders only named variables',()=>expect(renderStep({...flow().steps[1]!,message:'Olá {{nome}}'}, {nome:'Ana'})).toBe('Olá Ana'));
});
