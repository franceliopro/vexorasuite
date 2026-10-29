"use client";
import {useEffect,useRef,useState} from "react";
type Note={id:string;content:string;senderName?:string|null;occurredAt:string};
export function InboxInternalChat({conversationId,view,draft,onDraftChange,onClose,onSent}:{conversationId:string;view:string;draft:string;onDraftChange:(text:string)=>void;onClose:()=>void;onSent:()=>void}){
 const [notes,setNotes]=useState<Note[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const input=useRef<HTMLTextAreaElement>(null),sequence=useRef(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  const refresh=async()=>{const version=++sequence.current;try{const r=await fetch("/api/backend/conversations/"+conversationId+"/internal-notes?view="+encodeURIComponent(view),{cache:"no-store",signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.message||"Não foi possível carregar o chat interno.");if(active&&version===sequence.current){setNotes(data);setError("");}}catch(e){if(active)setError(e instanceof Error?e.message:"Falha de conexão.");}};
  void refresh();input.current?.focus();const timer=setInterval(()=>void refresh(),5000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[conversationId,view]);
 async function send(){
  if(busy||!draft.trim())return;setBusy(true);setError("");
  try{const r=await fetch("/api/backend/conversations/"+conversationId+"/internal-notes?view="+encodeURIComponent(view),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:draft.trim()})});const data=await r.json();if(!r.ok)throw Error(data.message||"Não foi possível salvar a nota.");sequence.current++;setNotes(current=>[...current.filter(n=>n.id!==data.id),data].slice(-100));onDraftChange("");onSent();}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar a nota.");}finally{setBusy(false);}
 }
 return <section className="inbox-internal-chat" aria-label="Chat interno">
  <header><div><strong>Chat interno</strong><small>Visível à equipe com acesso ao atendimento. O cliente não recebe estas mensagens.</small></div><button type="button" onClick={onClose} aria-label="Fechar chat interno">×</button></header>
  <div className="inbox-internal-history" role="log" aria-label="Notas internas recentes">{notes.map(note=><article key={note.id}><strong>{note.senderName||"Equipe"}</strong><time>{new Date(note.occurredAt).toLocaleString("pt-BR")}</time><p>{note.content}</p></article>)}{!notes.length&&!error&&<p>Nenhuma nota interna neste atendimento.</p>}</div>
  <form onSubmit={e=>{e.preventDefault();void send();}}><label>Mensagem interna<textarea ref={input} value={draft} disabled={busy} onChange={e=>onDraftChange(e.target.value)} rows={3} maxLength={4000} placeholder="Compartilhe contexto com a equipe…" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();void send();}}}/></label><button type="submit" className="secondary-button" disabled={busy||!draft.trim()}>{busy?"Salvando…":"Enviar nota interna"}</button></form>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
