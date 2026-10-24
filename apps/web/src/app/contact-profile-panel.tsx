"use client";

import { useEffect, useState } from "react";
import { Clock3, PanelRightClose, PanelRightOpen, Plus, Save, StickyNote, Tag, UserRound, X } from "lucide-react";

type ContactProfileData = { id:string; name:string; phone?:string|null; email?:string|null; metadata?:Record<string,unknown> };
type Protocol = { id:string; status:string; createdAt:string };
async function request<T>(url:string, init?:RequestInit):Promise<T> {
  const response=await fetch(url,{...init,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message||"Não foi possível salvar a ficha.");
  return data as T;
}
export function ContactProfilePanel({contact,conversationId,status,createdAt,channel}:{contact:ContactProfileData;conversationId:string;status:string;createdAt?:string;channel?:string}) {
  const [expanded,setExpanded]=useState(true);
  const [tab,setTab]=useState<"dados"|"notas"|"protocolos">("dados");
  const [tags,setTags]=useState<string[]>([]);
  const [tagDraft,setTagDraft]=useState("");
  const [notes,setNotes]=useState("");
  const [fields,setFields]=useState("{}");
  const [history,setHistory]=useState<Protocol[]>([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    const meta=contact.metadata||{};
    setTags(Array.isArray(meta.tags)?meta.tags.filter((v):v is string=>typeof v==="string"):[]);
    setNotes(typeof meta.notes==="string"?meta.notes:"");
    setFields(meta.customFields&&typeof meta.customFields==="object"?JSON.stringify(meta.customFields,null,2):"{}");
    setTab("dados");setError("");
  },[contact.id]);
  useEffect(()=>{let live=true;void request<Protocol[]>("/api/backend/contacts/"+contact.id+"/history").then(v=>{if(live)setHistory(v)}).catch(()=>{});return()=>{live=false}},[contact.id]);
  async function save(){
    let customFields:Record<string,unknown>;
    try{const value:unknown=JSON.parse(fields||"{}");if(!value||typeof value!=="object"||Array.isArray(value))throw new Error();customFields=value as Record<string,unknown>}catch{setError("Campos personalizados precisam estar em JSON válido.");setTab("dados");return}
    setSaving(true);setError("");
    try{await request("/api/backend/contacts/"+contact.id+"/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({tags,notes,customFields})})}
    catch(e){setError(e instanceof Error?e.message:"Falha ao salvar ficha.")}finally{setSaving(false)}
  }
  const protocol=(id:string)=>"VXS-"+id.replace(/-/g,"").slice(0,8).toUpperCase();
  const statusLabel=(value:string)=>({OPEN:"Em atendimento",PENDING:"Pendente",RESOLVED:"Finalizado",CLOSED:"Encerrado"}[value]||value);
  const finalization=contact.metadata?.crmFinalization&&typeof contact.metadata.crmFinalization==="object"?contact.metadata.crmFinalization as {outcome?:string;reason?:string}:null;
  const asaas=contact.metadata?.asaas&&typeof contact.metadata.asaas==="object"?contact.metadata.asaas as {customerId?:string;environment?:string;syncedAt?:string;document?:string|null;address?:string|null}:null;
  const maskedDocument=(value?:string|null)=>{const digits=(value||"").replace(/\D/g,"");return digits.length>4?"••••••••"+digits.slice(-4):"Não informado"};
  return <aside className={"contact-profile content-card "+(!expanded?"profile-collapsed":"")}>
    <div className="contact-profile-heading"><span className="contact-profile-avatar">{contact.name.slice(0,1).toUpperCase()}</span>{expanded?<div className="contact-profile-title"><strong>Ficha do contato</strong><small>Lead / cliente</small></div>:null}<button type="button" className="profile-toggle" aria-label={expanded?"Recolher ficha":"Expandir ficha"} onClick={()=>setExpanded(!expanded)}>{expanded?<PanelRightClose size={17}/>:<PanelRightOpen size={17}/>}</button></div>
    {expanded?<><div className="contact-profile-identity"><h3>{contact.name}</h3><p>{contact.phone||"Telefone não informado"}</p>{contact.email?<p>{contact.email}</p>:null}<span className={"profile-status-pill "+(["RESOLVED","CLOSED"].includes(status)?"done":"")}>{status==="RESOLVED"?"Resolvido":status==="CLOSED"?"Encerrado":status==="PENDING"?"Pendente":"Em atendimento"}</span>{finalization?<span className={"profile-status-pill "+(finalization.outcome==="WON"?"done":"")}>{finalization.outcome==="WON"?"Cliente · Ganho":"Perda · "+(finalization.reason||"Motivo registrado")}</span>:null}</div>
    <nav className="contact-profile-tabs"><button type="button" className={tab==="dados"?"active":""} onClick={()=>setTab("dados")}>Dados</button><button type="button" className={tab==="notas"?"active":""} onClick={()=>setTab("notas")}>Anotações</button><button type="button" className={tab==="protocolos"?"active":""} onClick={()=>setTab("protocolos")}>Protocolos</button></nav>
    <div className="contact-profile-body">{tab==="dados"?<><section className="profile-section"><strong><Tag size={14}/> Etiquetas</strong><div className="profile-tags">{tags.map(tag=><span className="profile-tag" key={tag}>{tag}<button type="button" aria-label={"Remover "+tag} onClick={()=>setTags(tags.filter(v=>v!==tag))}><X size={12}/></button></span>)}</div><form className="profile-add-tag" onSubmit={e=>{e.preventDefault();const value=tagDraft.trim();if(value&&!tags.some(v=>v.toLowerCase()===value.toLowerCase()))setTags([...tags,value]);setTagDraft("")}}><input value={tagDraft} onChange={e=>setTagDraft(e.target.value)} placeholder="Adicionar etiqueta" maxLength={40}/><button type="submit" aria-label="Adicionar etiqueta"><Plus size={14}/></button></form></section><section className="profile-section"><strong><UserRound size={14}/> Campos personalizados</strong><textarea className="profile-custom-fields" value={fields} onChange={e=>setFields(e.target.value)} rows={6} spellCheck={false}/><small>JSON flexível para empresa, documento, origem do lead e outros campos.</small></section>{asaas?.customerId?<section className="profile-section"><strong><UserRound size={14}/> Cadastro financeiro</strong><span className="profile-status-pill done">Vinculado ao Asaas</span><p>Ambiente: {asaas.environment==="SANDBOX"?"Sandbox":"Produção"}</p><p>CPF/CNPJ: {maskedDocument(asaas.document)}</p>{asaas.address?<p>Endereço: {asaas.address}</p>:null}<small>Última sincronização: {asaas.syncedAt?new Date(asaas.syncedAt).toLocaleString("pt-BR"):"Não registrada"}</small></section>:null}</>:null}
    {tab==="notas"?<section className="profile-section"><strong><StickyNote size={14}/> Anotações internas</strong><p>Visíveis à equipe, nunca enviadas ao cliente.</p><textarea className="profile-notes" rows={10} maxLength={10000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Contexto importante para o próximo atendimento..."/></section>:null}
    {tab==="protocolos"?<section className="profile-section"><strong><Clock3 size={14}/> Histórico de protocolos</strong><div className="protocol-current"><small>PROTOCOLO ATUAL</small><b>{protocol(conversationId)}</b><span>{new Date(createdAt||Date.now()).toLocaleDateString("pt-BR")} · {channel||"WhatsApp"}</span></div>{history.map(item=><div className="protocol-history-item" key={item.id}><b>{protocol(item.id)}</b><small>{new Date(item.createdAt).toLocaleDateString("pt-BR")} · {statusLabel(item.status)}</small></div>)}{!history.length?<p>Nenhum outro protocolo registrado.</p>:null}</section>:null}</div>
    {error?<p className="profile-error" role="alert">{error}</p>:null}<footer className="contact-profile-footer"><button type="button" onClick={()=>void save()} disabled={saving}><Save size={15}/>{saving?"Salvando...":"Salvar ficha"}</button></footer></>:null}
  </aside>;
}
