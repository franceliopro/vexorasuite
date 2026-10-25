"use client";

import { useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw, WandSparkles } from "lucide-react";

type NodeKind = "start" | "message" | "choice" | "transfer" | "asaas";
type BotNode = { id: string; kind: NodeKind; title: string; detail: string; x: number; y: number };
const initial: BotNode[] = [
  { id: "start", kind: "start", title: "Início", detail: "Novo atendimento · protocolo", x: 60, y: 170 },
  { id: "name", kind: "message", title: "Identificação", detail: "Cliente cadastrado ou {{novo_nome}}", x: 340, y: 170 },
  { id: "sector", kind: "choice", title: "Escolher setor", detail: "Financeiro · Suporte · Comercial · Administrativo", x: 620, y: 170 },
  { id: "platform", kind: "choice", title: "Escolher plataforma", detail: "Ceeb Vision · Link · Rastreabem", x: 900, y: 170 },
  { id: "finance", kind: "asaas", title: "Financeiro", detail: "Atendente ou pagamento Asaas", x: 1180, y: 60 },
  { id: "support", kind: "transfer", title: "Suporte", detail: "Encaminhar para equipe responsável", x: 1180, y: 300 },
];
const edges = [["start","name"],["name","sector"],["sector","platform"],["platform","finance"],["platform","support"]];
const palette: { kind: NodeKind; title: string; detail: string }[] = [
  {kind:"message",title:"Mensagem",detail:"Enviar texto ao cliente"},
  {kind:"choice",title:"Escolha",detail:"Opções e caminhos"},
  {kind:"transfer",title:"Transferência",detail:"Atendente ou equipe"},
  {kind:"asaas",title:"Asaas",detail:"Integração financeira"},
];
export function ChatbotWorkspace() {
  const [nodes,setNodes] = useState<BotNode[]>(initial);
  const [scale,setScale] = useState(0.78);
  const [selected,setSelected] = useState<string | null>("start");
  const [simulate,setSimulate] = useState(false);
  const [simulationStep,setSimulationStep] = useState(0);
  const drag = useRef<{id:string;pointerX:number;pointerY:number;x:number;y:number}|null>(null);
  const active = nodes.find(n=>n.id===selected);
  const zoom=(delta:number)=>setScale(s=>Math.min(1.5,Math.max(0.45,Math.round((s+delta)*100)/100)));
  const add=(kind:NodeKind,title:string,detail:string)=>{
    const id=`node-${Date.now()}`;
    setNodes(ns=>[...ns,{id,kind,title,detail,x:340+(ns.length%4)*240,y:440+Math.floor(ns.length/4)*160}]);
    setSelected(id);
  };
  return <section className="module-workspace chatbot-workspace">
    <header className="page-heading"><div><h1>Chatbots</h1><p className="page-subtitle">Construtor visual de fluxos e integrações.</p></div></header>
    <div className="chatbot-editor-toolbar">
      <span className="chatbot-draft-label">Rastreabem · Fluxo de referência</span>
      <span className="chatbot-status">Prévia local · não publicado</span>
      <button type="button" onClick={()=>setSimulate(v=>!v)}>{simulate?"Fechar simulação":"Simular fluxo"}</button>
      <button type="button" onClick={()=>{setNodes(initial);setSelected("start");setScale(0.78);}}><RotateCcw size={15}/> Restaurar</button>
    </div>
    <div className="chatbot-editor-layout">
      <aside className="chatbot-palette content-card"><strong>Blocos</strong><p>Adicione elementos à área de trabalho.</p>{palette.map(item=><button key={item.kind} type="button" onClick={()=>add(item.kind,item.title,item.detail)}><Plus size={16}/><span><b>{item.title}</b><small>{item.detail}</small></span></button>)}</aside>
      <div className="chatbot-canvas-wrap content-card">
        <div className="chatbot-canvas-controls">
          <button aria-label="Diminuir zoom" onClick={()=>zoom(-0.1)}><Minus size={16}/></button>
          <span>{Math.round(scale*100)}%</span>
          <button aria-label="Aumentar zoom" onClick={()=>zoom(0.1)}><Plus size={16}/></button>
          <button title="Ajustar zoom" aria-label="Ajustar zoom" onClick={()=>setScale(0.78)}><Maximize2 size={16}/></button>
          <button title="Organizar blocos" onClick={()=>setNodes(ns=>ns.map((n,i)=>({...n,x:60+(i%4)*280,y:70+Math.floor(i/4)*220})))}><WandSparkles size={16}/> Organizar</button>
        </div>
        <div className="chatbot-canvas-viewport">
          <div className="chatbot-canvas-surface" style={{transform:`scale(${scale})`}}>
            <svg className="chatbot-connections" width="1700" height="1000" aria-hidden="true">
              {edges.map(([from,to])=>{const a=nodes.find(n=>n.id===from),b=nodes.find(n=>n.id===to);if(!a||!b)return null;const x1=a.x+218,y1=a.y+42,x2=b.x,y2=b.y+42;return <path key={from+to} d={`M${x1} ${y1} C${x1+65} ${y1} ${x2-65} ${y2} ${x2} ${y2}`} fill="none" stroke="var(--primary)" strokeWidth="2" opacity=".5"/>;})}
            </svg>
            {nodes.map(node=><button key={node.id} type="button" className={`chatbot-node ${selected===node.id?"selected":""}`} style={{left:node.x,top:node.y}} onClick={()=>setSelected(node.id)} onPointerDown={event=>{if(event.button!==0)return;drag.current={id:node.id,pointerX:event.clientX,pointerY:event.clientY,x:node.x,y:node.y};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const d=drag.current;if(!d||d.id!==node.id)return;setNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:Math.max(0,Math.round(d.x+(event.clientX-d.pointerX)/scale)),y:Math.max(0,Math.round(d.y+(event.clientY-d.pointerY)/scale))}:n));}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
              <span className="chatbot-node-kind">{node.kind}</span><strong>{node.title}</strong><small>{node.detail}</small>
            </button>)}
          </div>
        </div>
      </div>
      <aside className="chatbot-inspector content-card"><strong>{simulate?"Simulação":"Propriedades"}</strong>{simulate?<><p>Prévia ilustrativa; nenhuma mensagem é enviada.</p><div className="chatbot-simulation-bubble">{["Olá! Seu protocolo será gerado ao iniciar o atendimento real.","Como você prefere ser chamado?","Escolha: Financeiro, Suporte, Comercial ou Administrativo.","Selecione Ceeb Vision, Link ou Rastreabem."][simulationStep%4]}</div><button onClick={()=>setSimulationStep(s=>s+1)}>Próxima etapa</button></>:active?<><p>Selecione e arraste blocos para organizar.</p><label htmlFor="bot-node-title">Título</label><input id="bot-node-title" value={active.title} onChange={e=>setNodes(ns=>ns.map(n=>n.id===active.id?{...n,title:e.target.value}:n))}/><label htmlFor="bot-node-detail">Descrição</label><textarea id="bot-node-detail" value={active.detail} onChange={e=>setNodes(ns=>ns.map(n=>n.id===active.id?{...n,detail:e.target.value}:n))}/><small>As alterações desta prévia não são salvas nem publicadas.</small></>:<p>Selecione um bloco.</p>}</aside>
    </div>
  </section>;
}
