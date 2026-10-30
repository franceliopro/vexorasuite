export type InboxRouting={mode:"INHERIT"|"AUTOMATION"|"HUMAN";departmentId:string|null;targetType:"DEPARTMENT"|"USER"|"AI"|"AUTOMATION";targetId:string|null;revision:string|null};
const object=(v:unknown):Record<string,any>=>v&&typeof v==="object"&&!Array.isArray(v)?v as any:{};
export function inboxRouting(settings:unknown):InboxRouting{
 const data=object(object(settings).inboxRouting);
 return {mode:["AUTOMATION","HUMAN"].includes(data.mode)?data.mode:"INHERIT",departmentId:typeof data.departmentId==="string"?data.departmentId:null,targetType:["DEPARTMENT","USER","AI","AUTOMATION"].includes(data.targetType)?data.targetType:"DEPARTMENT",targetId:typeof data.targetId==="string"?data.targetId:null,revision:typeof data.revision==="string"?data.revision:null};
}
