"use client";
import { useEffect, useState } from "react";
import { Bot, Plus, Trash2, Play, Save } from "lucide-react";

type Step = { id:string; title:string; message:string; options:string[] };
type Flow = { name:string; welcome:string; steps:Step[] };
const initial:Flow={name:"Triagem Rastreabem",welcome:"Olá! 👋 Bem-vindo à Rastreabem. Como podemos ajudar?",steps:[
{id:"financeiro",title:"Financeiro",message:"Qual plataforma você utiliza?",options:["Ceeb Vision","Link","Rastreabem"]},
{id:"suporte",title:"Suporte Técnico",message:"Em qual plataforma precisa de suporte?",options:["Ceeb Vision","Link","Rastreabem"]},
{id:"comercial",title:"Comercial",message:"Você é pessoa física ou jurídica?",options:["Pessoa Física","Pessoa Jurídica"]},
{id:"administrativo",title:"Administrativo",message:"Vou direcionar você ao contato administrativo.",options:["Falar com atendente"]}
]};
const key="vexora-chatbot-draft-v1";
export function ChatbotWorkspace(){
 const [flow,setFlow]=useState<Flow>(initial),[selected,setSelected]=useState("financeiro"),[preview,setPreview]=useState<string[]>([]),[notice,setNotice]=useState("");
 useEffect(()=>{try{const raw=window.localStorage.getItem(key);if(raw){const v=JSON.parse(raw) as Flow;if(v&&typeof v.name==="string"&&Array.isArray(v.steps))setFlow(v)}}catch{}},[]);
 const current=flow.steps.find(x=>x.id===selected);
 function updateStep(changes:Partial<Step>){setFlow(f=>({...f,steps:f.steps.map(x=>x.id===selected?{...x,...changes}:x)}));setNotice("")}
 function save(){try{window.localStorage.setItem(key,JSON.stringify(flow));setNotice("Rascunho salvo neste navegador. Ainda não está publicado no WhatsApp.")}catch{setNotice("Não foi possível salvar neste navegador.")}}
 function add(){const id="etapa-"+Date.now();setFlow(f=>({...f,steps:[...f.steps,{id,title:"Nova opção",message:"Como podemos ajudar?",options:["Falar com atendente"]}]}));setSelected(id);setNotice("")}
 return <section className="chatbot-workspace">
 <header className="page-heading"><div><h1>Chatbots</h1><p className="page-subtitle">Monte a triagem e teste as mensagens antes de conectar aos canais.</p></div></header>
 <div className="chatbot-status" role="status"><Bot size={17}/> Editor inicial · rascunho local, sem envio automático ou publicação</div>
 <div className="chatbot-actions"><label>Nome do fluxo <input value={flow.name} onChange={e=>setFlow(f=>({...f,name:e.target.value}))}/></label><button type="button" className="secondary-button" onClick={add}><Plus size={16}/> Nova opção</button><button type="button" className="primary-button" onClick={save}><Save size={16}/> Salvar rascunho</button></div>
 <div className="chatbot-builder">
 <section className="content-card chatbot-panel"><h2>Menu principal</h2><label>Saudação inicial<textarea rows={4} value={flow.welcome} onChange={e=>setFlow(f=>({...f,welcome:e.target.value}))}/></label><div className="chatbot-step-list">{flow.steps.map((s,i)=><button key={s.id} type="button" className={selected===s.id?"selected":""} onClick={()=>setSelected(s.id)}><span>{i+1}. {s.title}</span><span>Editar</span></button>)}</div><small>Os setores são opções do menu inicial. O encaminhamento real por equipe e atendente será conectado ao backend.</small></section>
 <section className="content-card chatbot-panel"><h2>Editar opção</h2>{current?<><label>Nome exibido no menu<input value={current.title} onChange={e=>updateStep({title:e.target.value})}/></label><label>Resposta do bot<textarea rows={5} value={current.message} onChange={e=>updateStep({message:e.target.value})}/></label><label>Respostas disponíveis (uma por linha)<textarea rows={5} value={current.options.join("\n")} onChange={e=>updateStep({options:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)})}/></label><button type="button" className="secondary-button" onClick={()=>{setFlow(f=>({...f,steps:f.steps.filter(x=>x.id!==selected)}));setSelected(flow.steps.find(x=>x.id!==selected)?.id||"")}}><Trash2 size={15}/> Excluir opção</button></>:<p>Selecione ou crie uma opção para editar.</p>}</section>
 <section className="content-card chatbot-panel"><h2>Simulador</h2><div className="chatbot-preview"><div className="chatbot-bubble">{flow.welcome}</div>{preview.map((t,i)=><div className={i%2===0?"chatbot-bubble user":"chatbot-bubble"} key={i}>{t}</div>)}</div><div className="chatbot-preview-actions">{flow.steps.map(s=><button type="button" key={s.id} onClick={()=>setPreview(p=>[...p,s.title,s.message])}>{s.title}</button>)}</div><button type="button" className="secondary-button" onClick={()=>setPreview([])}><Play size={15}/> Reiniciar teste</button><small>Simulação local: nenhuma mensagem é enviada a clientes.</small></section>
 </div>{notice?<p role="status">{notice}</p>:null}
 </section>;
}
