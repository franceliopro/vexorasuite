export type VoiceOption={id:string;model:string;name:string;language:string;gender:string};
export function validVoiceId(value:unknown):value is string{
 return typeof value==='string'&&!/\s/.test(value)&&/^[a-zA-Z0-9][a-zA-Z0-9._:/+-]{0,179}$/.test(value);
}
/** Only voices declared by an installed model; never mix Kokoro and Piper voice IDs. */
export function installedVoiceOptions(model:string,items:unknown):VoiceOption[]{
 if(!Array.isArray(items))return [];
 const seen=new Set<string>();
 return items.slice(0,500).flatMap(item=>{
  if(!item||!validVoiceId(item.id)||seen.has(item.id))return [];
  seen.add(item.id);
  return [{id:item.id,model,name:String(item.name||item.id).slice(0,100),language:String(item.language||'').replace(/_/g,'-').toLowerCase().slice(0,40),gender:['female','male'].includes(item.gender)?item.gender:''}];
 });
}
