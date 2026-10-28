import { AiService } from './ai.service';
import { modelCatalog } from './model-catalog';
import { economicalProviders } from './economical-providers';
jest.mock('./provider-credentials',()=>({providerApiKey:(provider:string,root:any)=>root?.keys?.[provider]}));
describe('provider catalogs and execution',()=>{
 const env={...process.env};
 afterEach(()=>{process.env={...env};jest.restoreAllMocks();});
 it.each(['openai','gemini','deepseek','qwen'] as const)('executes %s with its own fixed endpoint and token budget',async provider=>{
  const fetcher=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'ok'}}],usage:{prompt_tokens:2,completion_tokens:3,total_tokens:5}})));
  const providers=economicalProviders({llm:{provider,model:'selected'}},undefined,{keys:{[provider]:'tenant-key'}},'tenant');
  const result=await new AiService().generate([{role:'user',content:'test'}],providers);
  const [url,init]=fetcher.mock.calls[0]!,body=JSON.parse(init?.body as string);
  expect(String(url)).toContain(({openai:'api.openai.com',gemini:'generativelanguage.googleapis.com',deepseek:'api.deepseek.com',qwen:'dashscope-intl.aliyuncs.com'})[provider]);
  expect((init?.headers as any).authorization).toBe('Bearer tenant-key');
  expect(body[provider==='openai'?'max_completion_tokens':'max_tokens']).toBe(1200);
  expect(init?.redirect).toBe('error');expect(result.provider).toBe(provider);expect(result.usage.totalTokens).toBe(5);
 });
 it('converts Claude system instructions, images and usage without dropping context',async()=>{
  const fetcher=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({content:[{type:'text',text:'hello'}],usage:{input_tokens:7,output_tokens:3}})));
  const result=await new AiService().generate([{role:'system',content:'Tenant rules'},{role:'user',content:[{type:'text',text:'look'},{type:'image_url',image_url:{url:'https://example.test/image.png'}}]}],[{provider:'anthropic',model:'selected',apiKey:'secret'}]);
  const [url,init]=fetcher.mock.calls[0]!,body=JSON.parse(init?.body as string);
  expect(url).toBe('https://api.anthropic.com/v1/messages');expect((init?.headers as any)['x-api-key']).toBe('secret');
  expect(body.system).toBe('Tenant rules');expect(body.messages).toHaveLength(1);expect(body.messages[0].content[1].source.url).toBe('https://example.test/image.png');
  expect(result.text).toBe('hello');expect(result.usage).toEqual({promptTokens:7,completionTokens:3,totalTokens:10});
 });
 it('does not bypass free-only policy for a newly supported provider',()=>{
  const root={keys:{gemini:'secret'},aiCostPolicy:{freeFirst:true,allowPaidFallback:false}};
  expect(economicalProviders({llm:{provider:'gemini',model:'selected'}},undefined,root,'tenant')).toEqual([]);
 });
 it('uses each tenant key for catalog requests and never shares catalog results',async()=>{
  const fetcher=jest.spyOn(global,'fetch').mockImplementation(async(url,init)=>{
   if(String(url).includes('api.openai.com'))return new Response(JSON.stringify({data:[{id:(init?.headers as any).authorization==='Bearer a'?'gpt-tenant-a':'gpt-tenant-b'}]}));
   return new Response(JSON.stringify({data:[]}));
  });
  delete process.env.OLLAMA_BASE_URL;delete process.env.LOCAL_VOICE_URL;
  const a=await modelCatalog({keys:{openai:'a'}},'a'),b=await modelCatalog({keys:{openai:'b'}},'b');
  expect(a.models.map(m=>m.id)).toEqual(['gpt-tenant-a']);expect(b.models.map(m=>m.id)).toEqual(['gpt-tenant-b']);
  expect(fetcher.mock.calls.filter(([url])=>String(url).includes('api.anthropic.com'))).toHaveLength(0);
  expect(a.services.find(s=>s.provider==='anthropic')?.available).toBe(false);
 });
 it('reads the native Qwen catalog pages and keeps a failing provider isolated',async()=>{
  jest.spyOn(global,'fetch').mockImplementation(async url=>{
   if(String(url).includes('api.openai.com'))return new Response('private provider error',{status:401});
   if(String(url).includes('dashscope-intl')){
    const second=String(url).includes('page_no=2');return new Response(JSON.stringify({output:{total:101,models:[{model:second?'qwen-second':'qwen-first',name:'Qwen'}]}}));
   }
   return new Response(JSON.stringify({data:[]}));
  });
  const result=await modelCatalog({keys:{qwen:'qwen-key',openai:'bad-key'}},'tenant');
  expect(result.models.filter(m=>m.provider==='qwen').map(m=>m.id)).toEqual(['qwen-first','qwen-second']);
  expect(result.services.find(s=>s.provider==='openai')?.available).toBe(false);
  expect(JSON.stringify(result)).not.toContain('bad-key');expect(JSON.stringify(result)).not.toContain('private provider error');
 });
});
