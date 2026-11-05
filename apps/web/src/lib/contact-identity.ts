type ContactIdentity={name:string;metadata?:Record<string,unknown>|null};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
/** Formats a real WhatsApp number without exposing LID/JID identifiers as phone numbers. */
export function readablePhone(phone?: string|null, externalId?: string|null): string {
 const raw=String(phone||"").trim();
 const candidate=raw||String(externalId||"").trim();
 if (!candidate || /@(lid|g\.us|broadcast)$/i.test(candidate)) return "Telefone não informado";
 const normalizedCandidate=candidate.replace(/@[^@]+$/i,"");
 const digits=normalizedCandidate.replace(/\D/g,"");
 if (digits.length===13 && digits.startsWith("55")) return `+55 (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
 if (digits.length===12 && digits.startsWith("55")) return `+55 (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
 if (digits.length===11 && digits[2]==="9") return `+55 (${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
 if (digits.length===10) return `+55 (${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
 return digits.length>=10 ? `+${digits}` : (raw||"Telefone não informado");
}
export function contactDisplayName(contact:ContactIdentity,state?:Record<string,unknown>){
 const metadata=object(contact.metadata),variables=object(state?.variables),fields=object(metadata.customFields);
 const names=[metadata.novo_nome,variables.novo_nome,state?.novo_nome,metadata.preferredName,metadata.newName,metadata.triageName,metadata.nomePreferido,...Object.entries(fields).filter(([key])=>['novonome','nomepreferido','nomedepreferencia','preferredname','triagename'].includes(key.toLowerCase().replace(/[\s_-]/g,''))).map(([,value])=>value),contact.name];
 return names.find((value):value is string=>typeof value==='string'&&!!value.trim()&&!value.includes('{{'))?.trim().slice(0,120)||'Cliente';
}

