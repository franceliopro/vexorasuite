import { visionProviders } from './vision-providers';
describe('visual captions use a vision-capable model',()=>{
 const original=global.fetch,old=process.env.OLLAMA_BASE_URL;
 afterEach(()=>{global.fetch=original;if(old===undefined)delete process.env.OLLAMA_BASE_URL;else process.env.OLLAMA_BASE_URL=old;});
 it('skips a text-only local model while retaining the free multimodal router',async()=>{
  process.env.OLLAMA_BASE_URL='http://ollama:11434';global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({capabilities:['completion']})});
  const providers:any=[{provider:'ollama',model:'text-only',apiKey:'local'},{provider:'openrouter',model:'openrouter/free',apiKey:'test',freeOnly:true}];
  expect((await visionProviders(providers)).map(p=>p.model)).toEqual(['openrouter/free']);
 });
 it('retains a local model only when the server advertises vision',async()=>{
  process.env.OLLAMA_BASE_URL='http://ollama:11434';global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({capabilities:['completion','vision']})});
  expect((await visionProviders([{provider:'ollama',model:'vision',apiKey:'local'}])).length).toBe(1);
 });
});
