import { modelPrice } from "./model-prices";
import { AiProvider } from './ai.service';
import { providerApiKey } from './provider-credentials';
/** Only explicitly configured models; no unbounded escalation or guessed model IDs. */
export function economicalProviders(assistant: any, override?: any, integrations?: unknown, tenantId?: string): AiProvider[] {
 const selections = [override || assistant.llm, ...(Array.isArray(assistant.fallbackModels) ? assistant.fallbackModels : [])].filter(Boolean);
 const policy=(integrations as any)?.aiCostPolicy;
 const free=(s:any)=>s.provider==='ollama'||s.provider==='openrouter'&&(s.model==='openrouter/free'||s.model?.endsWith(':free'));
 if(policy?.freeFirst&&process.env.OLLAMA_BASE_URL&&process.env.OLLAMA_DEFAULT_MODEL&&!selections.some(s=>s.provider==='ollama'))selections.push({provider:'ollama',model:process.env.OLLAMA_DEFAULT_MODEL,tier:'Econômico'});
 if(policy?.freeFirst&&!selections.some(s=>s.provider==='openrouter'&&free(s)))selections.push({provider:'openrouter',model:'openrouter/free',tier:'Econômico'});
 const rank:Record<string,number>={'Econômico':0,'Equilíbrio':1,'Inteligente':2};
 const seen=new Set<string>();
 return selections.filter(s=>!policy?.freeFirst||policy.allowPaidFallback||free(s)).sort((a,b)=>{
  const priority=(s:any)=>s.provider==='ollama'?0:free(s)?1:2;
  const costA=a.provider==='openrouter'?modelPrice(a.model):null,costB=b.provider==='openrouter'?modelPrice(b.model):null;
  return (policy?.freeFirst?priority(a)-priority(b):0)||(costA!==null&&costB!==null?costA-costB:0)||(rank[a.tier]??9)-(rank[b.tier]??9);
 }).flatMap(s=>{
  const apiKey=s.provider==='ollama'&&process.env.OLLAMA_BASE_URL?'local':['openrouter','openai'].includes(s.provider)?providerApiKey(s.provider,integrations,tenantId):undefined;
  const id=s.provider+':'+s.model;
  if(!apiKey||!s.model||seen.has(id))return [];seen.add(id);
  return [{provider:s.provider,model:s.model,apiKey,timeoutMs:s.provider==='ollama'?60000:20000,maxTokens:1200,...(s.provider==='openrouter'&&free(s)?{freeOnly:true}:{})} as AiProvider];
 }).slice(0,3);
}
