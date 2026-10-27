import { AiProvider } from './ai.service';
import { localServiceUrl } from './local-services';
let catalog:{expires:number;ids:Set<string>}|undefined;
/** Do not ask a text-only model to invent a caption for pixels it cannot see. */
export async function visionProviders(providers:AiProvider[]):Promise<AiProvider[]>{
 const output:AiProvider[]=[];
 for(const provider of providers){
  if(provider.provider==='openrouter'){
   if(provider.model==='openrouter/free'){output.push(provider);continue;}
   try{if(!catalog||catalog.expires<Date.now()){const r=await fetch('https://openrouter.ai/api/v1/models',{redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const data=await r.json() as any;catalog={expires:Date.now()+600000,ids:new Set((data.data||[]).filter((m:any)=>m.architecture?.input_modalities?.includes('image')).map((m:any)=>m.id))};}if(catalog.ids.has(provider.model))output.push(provider);}catch{/* Unknown capability is not assumed to support images. */}
  }else if(provider.provider==='ollama'){
   try{const r=await fetch(localServiceUrl('OLLAMA_BASE_URL','/api/show'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:provider.model}),redirect:'error',signal:AbortSignal.timeout(8000)});const data=await r.json() as any;if(r.ok&&data.capabilities?.includes('vision'))output.push(provider);}catch{}
  }else if(provider.provider==='openai'&&/^(gpt-4o|gpt-4\.1|gpt-5)([-.]|$)/.test(provider.model))output.push(provider);
 }
 return output;
}
