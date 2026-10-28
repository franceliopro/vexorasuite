import { economicalProviders } from './economical-providers';
jest.mock('./provider-credentials',()=>({providerApiKey:()=> 'test-key'}));
describe('explicit AI providers',()=>{
 const original={...process.env};
 afterEach(()=>{process.env={...original};});
 it('keeps local-only configurations local even with a remote key',()=>{
  process.env.OLLAMA_BASE_URL='http://ollama:11434';
  const providers=economicalProviders({llm:{provider:'ollama',model:'installed-model'}},undefined,{aiCostPolicy:{freeFirst:true}},'tenant');
  expect(providers.map(p=>p.provider)).toEqual(['ollama']);
 });
 it('does not invent an OpenRouter model when none is selected',()=>{
  delete process.env.OLLAMA_BASE_URL;delete process.env.OLLAMA_DEFAULT_MODEL;
  expect(economicalProviders({},undefined,{aiCostPolicy:{freeFirst:true}},'tenant')).toEqual([]);
 });
 it('uses the global model when an override has no model',()=>{
  process.env.OLLAMA_BASE_URL='http://ollama:11434';
  expect(economicalProviders({llm:{provider:'ollama',model:'installed-model'}},{provider:'openrouter'},{} ,'tenant')[0]?.provider).toBe('ollama');
 });
});
