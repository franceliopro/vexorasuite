"use client";
import {useEffect,useRef,useState} from "react";
type Attendant={id:string;name:string;email:string};
type Note={id:string;content:string;senderName?:string|null;metadata?:{departmentName?:string};occurredAt:string};
export function InboxInternalChat({conversationId,view,draft,onDraftChange,onClose,onSent,attendants,open}:{open:boolean;attendants:Attendant[];conversationId:string;view:string;draft:string;onDraftChange:(text:string)=>void;onClose:()=>void;onSent:()=>void}){
 const [notes,setNotes]=useState<Note[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [mentions,setMentions]=useState<Attendant[]>([]),[mentionQuery,setMentionQuery]=useState<{start:number;end:number;text:string}|null>(null),[activeMention,setActiveMention]=useState(0);
 const suggestions=mentionQuery?attendants.filter(a=>!mentions.some(m=>m.id===a.id)&&(a.name+" "+a.email).toLocaleLowerCase("pt-BR").includes(mentionQuery.text.toLocaleLowerCase("pt-BR"))).slice(0,8):[];
 function change(text:string,caret:number){onDraftChange(text);const match=text.slice(0,caret).match(/(?:^|\s)@([^\s@]*)$/u);setMentionQuery(match?{start:caret-match[1]!.length-1,end:caret,text:match[1]!}:null);setActiveMention(0);}
 function mention(person:Attendant){if(!mentionQuery||mentions.length>=10)return;const next=draft.slice(0,mentionQuery.start)+"@"+person.name+" "+draft.slice(mentionQuery.end);onDraftChange(next);setMentions(current=>[...current,person]);setMentionQuery(null);requestAnimationFrame(()=>input.current?.focus());}
 const input=useRef<HTMLTextAreaElement>(null),sequence=useRef(0);
 useEffect(()=>{
  if(!open)return;
  let active=true;const controller=new AbortController();
  const refresh=async()=>{const version=++sequence.current;try{const r=await fetch("/api/backend/conversations/"+conversationId+"/internal-notes?view="+encodeURIComponent(view),{cache:"no-store",signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.message||"Não foi possível carregar o chat interno.");if(active&&version===sequence.current){setNotes(data);setError("");}}catch(e){if(active)setError(e instanceof Error?e.message:"Falha de conexão.");}};
  void refresh();input.current?.focus();const timer=setInterval(()=>void refresh(),5000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[conversationId,view,open]);
 async function send(){
  if(busy||!draft.trim())return;setBusy(true);setError("");
  try{const r=await fetch("/api/backend/conversations/"+conversationId+"/internal-notes?view="+encodeURIComponent(view),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:draft.trim(),mentionedUserIds:mentions.map(m=>m.id)})});const data=await r.json();if(!r.ok)throw Error(data.message||"Não foi possível salvar a nota.");sequence.current++;setNotes(current=>[...current.filter(n=>n.id!==data.id),data].slice(-100));onDraftChange("");setMentions([]);setMentionQuery(null);onSent();}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar a nota.");}finally{setBusy(false);}
 }
 return <section className="inbox-internal-chat" aria-label="Chat interno">
  <header><div><strong>Chat interno</strong><small>Visível à equipe com acesso ao atendimento. O cliente não recebe estas mensagens.</small></div><button type="button" onClick={onClose} aria-label="Fechar chat interno">×</button></header>
  <div className="inbox-internal-history" role="log" aria-label="Notas internas recentes">{notes.map(note=><article key={note.id}><strong>{note.senderName||"Equipe"}{note.metadata?.departmentName?" · "+note.metadata.departmentName:""}</strong><time>{new Date(note.occurredAt).toLocaleString("pt-BR")}</time><p>{note.content}</p></article>)}{!notes.length&&!error&&<p>Nenhuma nota interna neste atendimento.</p>}</div>
  <form onSubmit={e=>{e.preventDefault();void send();}}><label>Mensagem interna<textarea ref={input} value={draft} disabled={busy} onChange={e=>change(e.target.value,e.target.selectionStart)} rows={3} maxLength={4000} placeholder="Compartilhe contexto ou digite @ para convidar um atendente…" onKeyDown={e=>{if(mentionQuery&&e.key==="Escape"){e.preventDefault();setMentionQuery(null);}if(suggestions.length&&["ArrowDown","ArrowUp","Enter"].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();if(e.key==="Enter")mention(suggestions[activeMention]||suggestions[0]!);else setActiveMention(i=>(i+(e.key==="ArrowDown"?1:suggestions.length-1))%suggestions.length);return;}if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();void send();}}}/></label>{mentionQuery&&<div className="internal-mentions" aria-label="Sugestões de atendentes">{suggestions.map((person,index)=><button type="button" className={activeMention===index?"active":""} key={person.id} onClick={()=>mention(person)}><strong>@{person.name}</strong><small>{person.email}</small></button>)}{!suggestions.length&&<small>Nenhum atendente encontrado.</small>}</div>}{mentions.length>0&&<div className="internal-mention-chips"><small>Serão incluídos na conversa ao enviar:</small>{mentions.map(person=><button type="button" key={person.id} onClick={()=>setMentions(items=>items.filter(p=>p.id!==person.id))} aria-label={"Remover menção a "+person.name}>@{person.name} ×</button>)}</div>}<button type="submit" className="secondary-button" disabled={busy||!draft.trim()}>{busy?"Salvando…":"Enviar nota interna"}</button></form>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
