import { AiService } from './ai.service';
import { economicalProviders } from './economical-providers';
import { localServiceUrl, searxngSearch } from './local-services';
import { AssistantAutomationService } from './assistant-automation.service';
import { VoiceService } from './voice.service';
import { ProviderConnectionsController } from './provider-connections.controller';

describe('free and local execution policy',()=>{
 const names=['OPENROUTER_API_KEY','OPENAI_API_KEY','OLLAMA_BASE_URL','OLLAMA_DEFAULT_MODEL','LOCAL_VOICE_URL','SEARXNG_URL'];
 let old:Record<string,string|undefined>={};
 beforeEach(()=>{old=Object.fromEntries(names.map(name=>[name,process.env[name]]));for(const name of names)delete process.env[name];process.env.OPENROUTER_API_KEY='fixture-router-key';process.env.OPENAI_API_KEY='fixture-openai-key';});
 afterEach(()=>{jest.restoreAllMocks();for(const name of names){if(old[name]===undefined)delete process.env[name];else process.env[name]=old[name];}});
 const root={aiCostPolicy:{freeFirst:true,allowPaidFallback:false}};
 const assistant={llm:{provider:'openai',model:'paid-model',tier:'Econômico'}};
 it('excludes paid providers and selects the explicit free-router preset',()=>{
  expect(economicalProviders(assistant,undefined,root).map(p=>[p.provider,p.model,p.freeOnly])).toEqual([['openrouter','openrouter/free',true]]);
 });
 it('prioritizes the configured local model and permits paid fallback only when opted in',()=>{
  process.env.OLLAMA_BASE_URL='http://ollama:11434';process.env.OLLAMA_DEFAULT_MODEL='installed-model';
  const providers=economicalProviders(assistant,undefined,{aiCostPolicy:{freeFirst:true,allowPaidFallback:true}});
  expect(providers.map(p=>p.provider)).toEqual(['ollama','openrouter','openai']);expect(providers[0]!.model).toBe('installed-model');
 });
 it('pins free OpenRouter token prices to zero and disables the paid web plugin',async()=>{
  const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'ok'}}]})));
  await new AiService().generate([{role:'user',content:'Teste'}],economicalProviders(assistant,undefined,root));
  const body=JSON.parse(String(fetch.mock.calls[0]![1]?.body));expect(body.provider.max_price).toEqual({prompt:0,completion:0});expect(body.provider.data_collection).toBe('deny');expect(body.plugins).toEqual([{id:'web',enabled:false}]);
 });
 it('does not transmit a cloud credential to Ollama',async()=>{
  process.env.OLLAMA_BASE_URL='http://ollama:11434';
  const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'ok'}}]})));
  await new AiService().generate([{role:'user',content:'Teste'}],[{provider:'ollama',model:'installed',apiKey:'local'}]);
  expect(String(fetch.mock.calls[0]![0])).toBe('http://ollama:11434/v1/chat/completions');expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('authorization');expect(fetch.mock.calls[0]![1]?.redirect).toBe('error');
 });
 it('rejects malformed operator endpoints instead of using arbitrary paths or credentials',()=>{
  for(const url of ['file:///etc/passwd','http://user:pass@host','http://host/private?x=1']){process.env.OLLAMA_BASE_URL=url;expect(()=>localServiceUrl('OLLAMA_BASE_URL','/v1/chat/completions')).toThrow();}
 });
 it('sanitizes and bounds the SearXNG result set without an API key',async()=>{
  process.env.SEARXNG_URL='http://searxng:8080';
  const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({results:[{url:'javascript:evil()',title:'bad'},{url:'https://source.test/page',title:'Fonte',content:'<b>Resumo</b>'},...Array.from({length:10},()=>({url:'https://source.test',content:'x'.repeat(1000)}))]})));
  const sources=await searxngSearch('Rastreamento de frotas');expect(sources).toHaveLength(5);expect(sources[0]).toEqual({url:'https://source.test/page',title:'Fonte',description:'Resumo'});expect(sources[1]!.description).toHaveLength(600);expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('authorization');
 });
 it('does not switch to a paid search after a local failure',async()=>{
  process.env.SEARXNG_URL='http://searxng:8080';const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response('unavailable',{status:503}));
  await expect(new AssistantAutomationService({} as any,{} as any,{} as any,{} as any).search('Frotas')).rejects.toThrow('pesquisa local');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('blocks the paid search connector when free-only mode has no local search configured',async()=>{
  const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root})}};
  const fetch=jest.spyOn(global,'fetch');await expect(new AssistantAutomationService(prisma,{} as any,{} as any,{} as any).search('Frotas','tenant')).rejects.toThrow('política gratuita');expect(fetch).not.toHaveBeenCalled();
 });
 it('rejects oversized and non-JSON search responses',async()=>{
  process.env.SEARXNG_URL='http://searxng:8080';jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response('x'.repeat(512*1024+1))).mockResolvedValueOnce(new Response('<html>blocked</html>'));
  await expect(searxngSearch('Frotas')).rejects.toThrow('excedeu');await expect(searxngSearch('Frotas')).rejects.toThrow('JSON');
 });
 it('rejects unauthorized or malformed cost-policy updates before persistence',async()=>{
  const controller=new ProviderConnectionsController({} as any);
  await expect(controller.policy({user:{role:'AGENT'}} as any,{freeFirst:true,allowPaidFallback:false})).rejects.toThrow('administradores');
  await expect(controller.policy({user:{role:'OWNER'}} as any,{freeFirst:'true',allowPaidFallback:false} as any)).rejects.toThrow('inválida');
 });
 it('blocks paid voice when the free-only policy is active',async()=>{
  const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:{...root,assistant:{enabled:true,tts:{provider:'openai',model:'paid-voice'}}}})}};
  const fetch=jest.spyOn(global,'fetch');await expect(new VoiceService(prisma).speak({user:{role:'OWNER',tenantId:'tenant'}} as any,'Olá')).rejects.toThrow('política gratuita');expect(fetch).not.toHaveBeenCalled();
 });
 it('uses the local voice endpoint without sending the OpenAI key',async()=>{
  process.env.LOCAL_VOICE_URL='http://speaches:8000';const tx:any={$queryRaw:jest.fn(),auditLog:{count:jest.fn().mockResolvedValue(0),create:jest.fn()}};
  const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:{...root,assistant:{enabled:true,tts:{provider:'local',model:'local-voice'}}}})},$transaction:(callback:any)=>callback(tx)};
  const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(new Uint8Array([1,2])));
  await new VoiceService(prisma).speak({user:{role:'OWNER',tenantId:'tenant'}} as any,'Olá');expect(String(fetch.mock.calls[0]![0])).toBe('http://speaches:8000/v1/audio/speech');expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('authorization');
 });
});
