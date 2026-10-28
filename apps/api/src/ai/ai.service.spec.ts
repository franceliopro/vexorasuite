import { AiService } from './ai.service';
describe('bounded model fallback',()=>{
 const providers:any=[{provider:'openrouter',model:'cheap',apiKey:'test'},{provider:'openrouter',model:'large',apiKey:'test'}];
 afterEach(()=>jest.restoreAllMocks());
 it('never escalates after valid economical output',async()=>{const fetcher=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'ok'}}],usage:{total_tokens:3}})));const result=await new AiService().generate([{role:'user',content:'teste'}],providers);expect(result.model).toBe('cheap');expect(fetcher).toHaveBeenCalledTimes(1);});
 it('escalates only after execution/format failure',async()=>{const fetcher=jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:'invalid'}}]}))).mockResolvedValueOnce(new Response(JSON.stringify({choices:[{message:{content:'valid'}}]})));expect((await new AiService().generate([{role:'user',content:'teste'}],providers,t=>t==='valid')).model).toBe('large');expect(fetcher).toHaveBeenCalledTimes(2);});
});
