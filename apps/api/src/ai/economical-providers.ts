import { AiProvider } from './ai.service';
/** Only explicitly configured models; no unbounded escalation or guessed model IDs. */
export function economicalProviders(assistant: any, override?: any): AiProvider[] {
 const selections = [override || assistant.llm, ...(Array.isArray(assistant.fallbackModels) ? assistant.fallbackModels : [])].filter(Boolean);
 const rank:Record<string,number>={'Econômico':0,'Equilíbrio':1,'Inteligente':2};
 const seen=new Set<string>();
 return selections.sort((a,b)=>(rank[a.tier]??9)-(rank[b.tier]??9)).flatMap(s=>{
  const apiKey=s.provider==='openrouter'?process.env.OPENROUTER_API_KEY:s.provider==='openai'?process.env.OPENAI_API_KEY:null;
  const id=s.provider+':'+s.model;
  if(!apiKey||!s.model||seen.has(id))return [];seen.add(id);
  return [{provider:s.provider,model:s.model,apiKey,timeoutMs:8000,maxTokens:1200} as AiProvider];
 }).slice(0,3);
}
