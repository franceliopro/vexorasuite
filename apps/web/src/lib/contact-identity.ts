type ContactIdentity={name:string;metadata?:Record<string,unknown>};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export function contactDisplayName(contact:ContactIdentity,state?:Record<string,unknown>){
 const metadata=object(contact.metadata),variables=object(state?.variables),fields=object(metadata.customFields);
 const names=[variables.novo_nome,state?.novo_nome,metadata.preferredName,metadata.newName,metadata.triageName,metadata.nomePreferido,metadata.novo_nome,...Object.entries(fields).filter(([key])=>['novonome','nomepreferido','nomedepreferencia','preferredname','triagename'].includes(key.toLowerCase().replace(/[\s_-]/g,''))).map(([,value])=>value),contact.name];
 return names.find((value):value is string=>typeof value==='string'&&!!value.trim()&&!value.includes('{{'))?.trim().slice(0,120)||'Cliente';
}
