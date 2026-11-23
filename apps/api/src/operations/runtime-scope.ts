import {matchesChatbotTrigger, RuntimeFlow} from '../ai/flow-runtime';
export type RuntimeScope={departmentId?:string|null;userId?:string|null};
export type ScopedPublication={revision:string;active:boolean;publishedAt:string;flow:RuntimeFlow;scope?:RuntimeScope;source?:"ui"};
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
 if(candidate&&typeof candidate==='object'&&candidate.source==='ui'&&candidate.flow)return {key,publication:candidate as ScopedPublication};
 }
 return null;
}
export function scopedPresetInstructions(root:Record<string,any>,scope:RuntimeScope,category?:string|null){
 return Object.values(record(root.businessPresets)).map(record).filter(p=>
 p.userId ? p.userId===scope.userId&&(!scope.departmentId||p.preset===category) : !!scope.departmentId&&p.departmentId===scope.departmentId
 ).map(p=>String(p.agentInstructions||'').slice(0,6000)).filter(Boolean).join('\n').slice(0,10000);
}


export const automationPublicationKey = (id: string) => 'automation:' + id;
export const isAutomationPublicationKey = (key: string) => key.startsWith('automation:');

function automationScopePriority(publication: ScopedPublication, scope: RuntimeScope): number {
 const key = publicationKey(publication.scope);
 if (scope.userId && key === publicationKey(scope)) return 3;
 if (scope.departmentId && key === publicationKey({departmentId:scope.departmentId})) return 2;
 return key === 'default' && !scope.userId ? 1 : 0;
}

export function selectMessageAutomation(
 root: Record<string,any>, scope: RuntimeScope,
 event: {channelId:string;text:string;firstMessage:boolean;previousKey?:string;previousRevision?:string;requiredScopeKey?:string},
) {
 const candidates = Object.entries(record(root.intelligencePublications))
  .filter(([key]) => isAutomationPublicationKey(key))
  .flatMap(([key,raw]) => {
   const publication = raw as ScopedPublication | null;
   if (!publication?.active || publication.source !== 'ui' || !publication.flow?.channelIds?.includes(event.channelId)) return [];
   if (event.requiredScopeKey && publicationKey(publication.scope) !== event.requiredScopeKey) return [];
   const scopePriority = automationScopePriority(publication, scope);
   if (!scopePriority) return [];
   if (key === event.previousKey && publication.revision === event.previousRevision) return [{key,publication,scopePriority,priority:4}];
   const triggers = publication.flow.triggers ?? [];
   const priority = triggers.reduce((score, trigger) => matchesChatbotTrigger([trigger],event.text,true,event.firstMessage)
    ? Math.max(score,trigger.kind==='keyword'?3:trigger.kind==='first_message'?2:1) : score,0);
   return priority ? [{key,publication,scopePriority,priority}] : [];
  });
 return candidates.sort((a,b)=>b.priority-a.priority||b.scopePriority-a.scopePriority||a.key.localeCompare(b.key))[0] ?? null;
}
