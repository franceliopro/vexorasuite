import {RuntimeFlow} from '../ai/flow-runtime';
export type RuntimeScope={departmentId?:string|null;userId?:string|null};
export type ScopedPublication={revision:string;active:boolean;publishedAt:string;flow:RuntimeFlow;scope?:RuntimeScope};
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};
export function publicationKey(scope:RuntimeScope={}):string{
 if(scope.userId)return 'user:'+scope.userId+(scope.departmentId?':department:'+scope.departmentId:'');
 return scope.departmentId?'department:'+scope.departmentId:'default';
}
/** Explicit pauses shadow defaults. Personal configuration only applies in its own department context. */
export function selectPublication(root:Record<string,any>,scope:RuntimeScope){
 const publications=record(root.intelligencePublications);
 const keys=[...(scope.userId?[publicationKey(scope)]:[]),...(scope.departmentId?['department:'+scope.departmentId]:[]),'default'];
 for(const key of keys){
 const candidate=key==='default'?root.intelligencePublished:publications[key];
 if(candidate&&typeof candidate==='object'&&candidate.flow)return {key,publication:candidate as ScopedPublication};
 }
 return null;
}
export function scopedPresetInstructions(root:Record<string,any>,scope:RuntimeScope,category?:string|null){
 return Object.values(record(root.businessPresets)).map(record).filter(p=>
 p.userId ? p.userId===scope.userId&&(!scope.departmentId||p.preset===category) : !!scope.departmentId&&p.departmentId===scope.departmentId
 ).map(p=>String(p.agentInstructions||'').slice(0,6000)).filter(Boolean).join('\n').slice(0,10000);
}

