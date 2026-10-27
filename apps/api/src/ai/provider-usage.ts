import { createHash } from 'node:crypto';
const incidents=new Map<string,{status:number;at:string}>();
export function recordProviderLimit(key:string,status:number){
 if(status!==402&&status!==429)return;
 if(incidents.size>2000)incidents.clear();
 incidents.set(createHash('sha256').update(key).digest('hex'),{status,at:new Date().toISOString()});
}
export function providerLimit(key:string){const value=incidents.get(createHash('sha256').update(key).digest('hex'));return value&&Date.parse(value.at)>Date.now()-3600000?value:null;}
export function usageView(data:any){
 const number=(v:any)=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const free=data?.free_model_daily_requests;
 const budget=data?.effective_budget;
 const remaining=number(data?.limit_remaining),limit=number(data?.limit);
 const freeRemaining=number(free?.remaining),freeLimit=number(free?.limit);
 const budgetRemaining=number(budget?.remaining_usd);
 return {keyCreditLimit:limit,keyCreditsRemaining:remaining,usageDaily:number(data?.usage_daily),
  free:freeRemaining!==null&&freeLimit!==null?{remaining:freeRemaining,limit:freeLimit,used:number(free?.used)}:null,
  budget:budgetRemaining!==null?{remaining:budgetRemaining,limit:number(budget.limit_usd),resetsAt:typeof budget.resets_at==='string'?budget.resets_at:null}:null,
  low:(remaining!==null&&limit!==null&&remaining<=Math.max(0.1,limit*.2))||(freeRemaining!==null&&freeLimit!==null&&freeRemaining<=Math.max(2,freeLimit*.2))||(budgetRemaining!==null&&budgetRemaining<=0.1)};
}
