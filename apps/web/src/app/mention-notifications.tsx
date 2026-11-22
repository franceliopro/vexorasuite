"use client";
import { X } from "lucide-react";
import {useEffect,useRef,useState} from "react";
type Mention={id:string;conversationId:string;authorName:string;departmentName:string;createdAt:string;readAt:string|null};

const primaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3.5 text-xs font-bold bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60";
/* Duas literais completas: o toast e o painel aberto não compartilham altura. */
const panelTw = "fixed bottom-4 right-4 grid max-w-full gap-2 w-80 rounded-xl border border-slate-700 bg-slate-900 p-3.5 shadow-2xl";
const panelOpenTw = "fixed bottom-4 right-4 grid w-80 max-w-full gap-2 overflow-y-auto max-h-60 rounded-xl border border-slate-700 bg-slate-900 p-3.5 shadow-2xl";

export function MentionNotifications({tenantId,userId}:{tenantId:string;userId:string}){
  const [items,setItems]=useState<Mention[]>([]),[open,setOpen]=useState(false),[toast,setToast]=useState<Mention|null>(null),[error,setError]=useState("");
  const seen=useRef(new Set<string>());
  useEffect(()=>{
   let live=true,version=0;setItems([]);setToast(null);seen.current=new Set();
   const refresh=async()=>{const seq=++version;try{const response=await fetch("/api/backend/conversations/mentions",{cache:"no-store"});if(!response.ok)return;const body=await response.json();const data:Mention[]=Array.isArray(body)?body:Array.isArray(body?.items)?body.items:[];if(!live||seq!==version)return;setItems(data);const incoming=data.find(item=>!item.readAt&&!seen.current.has(item.id));data.forEach(item=>seen.current.add(item.id));if(incoming)setToast(incoming);}catch{}};
   void refresh();const timer=setInterval(()=>void refresh(),10000);const events=new EventSource("/api/backend/events");events.addEventListener("conversation.updated",refresh);events.addEventListener("team.updated",()=>{window.dispatchEvent(new Event("vexora:team-updated"));void refresh();});
   return()=>{live=false;clearInterval(timer);events.close();};
  },[tenantId,userId]);
  async function read(item:Mention,go=false){try{const response=await fetch("/api/backend/conversations/mentions/"+item.id+"/read",{method:"POST"});if(!response.ok)throw Error("Não foi possível marcar a menção.");setItems(values=>values.map(value=>value.id===item.id?{...value,readAt:new Date().toISOString()}:value));if(toast?.id===item.id)setToast(null);if(go)window.location.assign("/?module=Atendimento&conversation="+encodeURIComponent(item.conversationId));}catch(e){setError(e instanceof Error?e.message:"Falha de conexão.");}}
  const count=items.filter(item=>!item.readAt).length;
  return <div data-testid="mention-notifications" className="relative grid gap-2">
    <button type="button" data-testid="mention-trigger" className="grid place-items-center size-9 rounded-lg border border-slate-700 bg-slate-900 text-slate-50 shadow-lg transition-colors hover:bg-slate-800" aria-label={"Menções"+(count?" · "+count+" não lidas":"")} aria-expanded={open} onClick={()=>{setOpen(v=>!v);setToast(null);}}><b>@</b>{count>0&&<span data-testid="mention-count" className="inline-grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-2xs font-extrabold text-white">{count}</span>}</button>
    {toast&&<aside data-testid="mention-toast" className={panelTw} style={{ zIndex: 65 }} role="status"><strong>{toast.authorName}{toast.departmentName?" · "+toast.departmentName:""}</strong><p className="m-0 text-xs text-slate-300">Mencionou você em um atendimento.</p><button type="button" className={primaryButton} onClick={()=>void read(toast,true)}>Participar da conversa</button><button type="button" className="grid place-items-center size-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700" aria-label="Fechar aviso de menção" onClick={()=>setToast(null)}><X size={16} aria-hidden="true" /></button></aside>}
    {open&&<section data-testid="mention-panel" className={panelOpenTw} style={{ zIndex: 65 }} aria-label="Suas menções"><header className="flex items-center justify-between gap-3"><strong>Menções no Atendimento</strong><button type="button" className="grid place-items-center size-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700" onClick={()=>setOpen(false)} aria-label="Fechar menções"><X size={16} aria-hidden="true" /></button></header>{items.map(item=><article key={item.id} className="grid gap-1 rounded-lg border border-slate-700 bg-slate-800 p-2.5"><strong>{item.authorName}{item.departmentName?" · "+item.departmentName:""}</strong><small className="text-xs text-slate-300">{new Date(item.createdAt).toLocaleString("pt-BR")}{!item.readAt?" · Nova":""}</small><p className="m-0 text-xs text-slate-300">Mencionou você na conversa.</p><button type="button" className={primaryButton} onClick={()=>void read(item,true)}>Abrir atendimento</button>{!item.readAt&&<button type="button" className={secondaryButton} onClick={()=>void read(item)}>Marcar como lida</button>}</article>)}{!items.length&&<p className="m-0 text-xs text-slate-300">Nenhuma menção disponível.</p>}</section>}
    {error&&<p className="m-0 text-xs text-red-400" role="alert">{error}</p>}
  </div>;
}
