"use client";
import { useEffect, useState } from "react";
import { Bot, Plus, Save, Trash2, ShieldCheck, Sparkles } from "lucide-react";

type Agent = { profile?: { tone: string; channels: string[] }; behavior?: { rules: string; prohibitions: string }; allowedActions?: string[]; customActions?: string[]; bindings?: { mode: string; specialists: string[]; flows: string[]; pipelines: string[]; externalSystems: string[]; modules: string[] }; knowledgeUrls?: string[]; llm?: {provider:string;model:string;tier:string;endpoint?:string}; stt?: {provider:string;model:string;endpoint?:string}; tts?: {provider:string;model:string;endpoint?:string}; id: number; name: string; role: string; tier: "Econômico" | "Equilíbrio" | "Inteligente"; enabled: boolean; instructions: string };
const starter: Agent[] = [{ id: 1, name: "Assistente pessoal", role: "Consultas e relatórios", tier: "Econômico", enabled: false, instructions: "Consulte apenas dados autorizados. Priorize regras e consultas determinísticas. Peça confirmação antes de ações sensíveis." }];
export function AiAgentsWorkspace() {
  const [agents, setAgents] = useState<Agent[]>(starter);
  const [selected, setSelected] = useState(1);
  const [assistantName, setAssistantName] = useState("Véxora");
  const [wakeWord, setWakeWord] = useState("Olá Véxora");
  const [activation, setActivation] = useState("Clique ou texto");
  const [notice, setNotice] = useState("");
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("Perfil");
  const [newAction, setNewAction] = useState("");
  const [customSkills, setCustomSkills] = useState<{id:string;name:string;description:string;instructions:string}[]>([]);
  const [skillDraft, setSkillDraft] = useState({id:"",name:"",description:"",instructions:""});
  const [skillNotice,setSkillNotice] = useState("");
  useEffect(()=>{fetch("/api/backend/assistant/custom-skills").then(r=>r.ok?r.json():null).then(d=>{if(Array.isArray(d?.skills))setCustomSkills(d.skills)}).catch(()=>{});},[]);
  const [skills, setSkills] = useState<{id:string;name:string;category:string;cost:string;implemented:boolean;permission:string}[]>([]);
  useEffect(()=>{fetch("/api/backend/assistant/skills").then(r=>r.ok?r.json():null).then(data=>{if(Array.isArray(data?.skills))setSkills(data.skills)}).catch(()=>{});},[]);
  const [catalog, setCatalog] = useState<{models?:{id:string;name:string;pricePerMillionInputUsd:number}[]}>({});
  useEffect(() => { fetch("/api/backend/assistant/model-catalog").then(r => r.ok ? r.json() : {}).then(setCatalog).catch(() => {}); }, []);
  useEffect(() => {
    let mounted = true;
    fetch("/api/backend/assistant/config", { cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.message || "Falha ao carregar"); return data; })
      .then(data => {
        if (!mounted) return;
        setAssistantName(data.name); setWakeWord(data.wakeWord); setAssistantEnabled(data.enabled);
        if (Array.isArray(data.agents)) {
          const items: Agent[] = data.agents.map((a: Agent & { id: string }) => ({ ...a, id: Number(a.id) })).filter((a: Agent) => Number.isSafeInteger(a.id) && a.id > 0);
          setAgents(items); setSelected(items[0]?.id ?? 0);
        }
      })
      .catch(error => { if (mounted) setNotice(error instanceof Error ? error.message : "Erro ao carregar"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const save = async () => {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/backend/assistant/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: assistantName, wakeWord, enabled: assistantEnabled, agents: agents.map(a => ({ ...a, id: String(a.id) })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Não foi possível salvar");
      setNotice("Configuração salva para esta empresa.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };
  const agent = agents.find(a => a.id === selected);
  const update = (patch: Partial<Agent>) => setAgents(items => items.map(a => a.id === selected ? { ...a, ...patch } : a));
  const add = () => { const id = Math.max(0, ...agents.map(a => a.id)) + 1; setAgents(items => [...items, { id, name: "Novo agente", role: "Atendimento", tier: "Econômico", enabled: false, instructions: "" }]); setSelected(id); setNotice("Novo agente criado neste rascunho."); };
  return <section className="module-workspace">
    <header className="page-heading"><div><h1>Agentes de IA</h1><p className="page-subtitle">Automação primeiro. Inteligência artificial apenas quando necessária.</p></div></header>
    <div className="ai-admin-grid">
      <section className="content-card ai-admin-card">
        <div className="ai-admin-heading"><h2><Bot size={19}/> Agentes</h2><button className="primary-button" type="button" onClick={add}><Plus size={15}/> Novo</button></div>
        {agents.map(a => <button key={a.id} type="button" className={selected === a.id ? "ai-agent-row selected" : "ai-agent-row"} onClick={() => setSelected(a.id)}><span><strong>{a.name}</strong><small>{a.role}</small></span><span>{a.enabled ? "Ligado" : "Off"}</span></button>)}
      </section>
      <section className="content-card ai-admin-card">
        <h2><ShieldCheck size={19}/> Configuração</h2>
        {agent ? <div className="ai-admin-fields">
          <nav className="ai-agent-tabs" aria-label="Configurações do agente" style={{display:"flex",gap:8,flexWrap:"wrap"}}>{["Perfil","Modelos e Voz","Conhecimento","Comportamento","Skills","Papel e vínculos"].map(t => <button key={t} type="button" className={tab===t?"primary-button":"secondary-button"} onClick={()=>setTab(t)}>{t}</button>)}</nav>
          {tab==="Perfil" && <>
            <label>Nome do agente<input value={agent.name} onChange={e=>update({name:e.target.value})}/></label>
            <label>Papel na operação<select value={agent.role} onChange={e=>update({role:e.target.value})}>{["Assistente virtual","Supervisor","SDR · qualificação","Vendedor online","Parceiro comercial","Funcionário","Coordenador"].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Tom de fala<select value={agent.profile?.tone||"Cordial e objetivo"} onChange={e=>update({profile:{...agent.profile,channels:agent.profile?.channels||[],tone:e.target.value}})}>{["Cordial e objetivo","Consultivo e acolhedor","Neutro e equilibrado","Formal e institucional"].map(x=><option key={x}>{x}</option>)}</select></label>
            <strong>Canais habilitados</strong>{["WhatsApp","Instagram","Facebook","Telegram","Chat do site","Interface interna"].map(x=><label key={x} className="ai-toggle"><input type="checkbox" checked={(agent.profile?.channels||[]).includes(x)} onChange={e=>update({profile:{tone:agent.profile?.tone||"Cordial e objetivo",channels:e.target.checked?[...(agent.profile?.channels||[]),x]:(agent.profile?.channels||[]).filter(y=>y!==x)}})}/>{x}</label>)}
          </>}
          {tab==="Modelos e Voz" && <>{(["llm","stt","tts"] as const).map(kind=>{const value=agent[kind];const title=kind==="llm"?"LLM — Inteligência":kind==="stt"?"STT — Transcrição de voz":"TTS — Síntese de voz";const patch=(v:Partial<NonNullable<typeof value>>)=>update({[kind]:{provider:value?.provider||"openrouter",model:value?.model||"",...(kind==="llm"?{tier:agent.tier}:{}),...value,...v}});return <fieldset key={kind} style={{border:"1px solid var(--border-color, #ddd)",borderRadius:10,padding:12,marginBottom:12}}><legend><strong>{title}</strong></legend><label>Provedor<select value={value?.provider||"openrouter"} onChange={e=>patch({provider:e.target.value})}>{(kind==="llm"?["openrouter","openai","gemini","anthropic","deepseek","ollama","vllm","openai-compatible"]:kind==="stt"?["whisper-local","openai","deepgram","openai-compatible"]:["piper-local","openai","gemini","openai-compatible"]).map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Endereço API<input value={value?.endpoint||""} placeholder="https://..." onChange={e=>patch({endpoint:e.target.value})}/></label><label>Nome do modelo<input list={kind==="llm"?"openrouter-models":undefined} value={value?.model||""} onChange={e=>patch({model:e.target.value})}/></label>{kind==="llm"&&<label>Perfil de custo<select value={agent.tier} onChange={e=>{update({tier:e.target.value as Agent["tier"],llm:{provider:value?.provider||"openrouter",model:value?.model||"",tier:e.target.value,endpoint:value?.endpoint}})}}><option>Econômico</option><option>Equilíbrio</option><option>Inteligente</option></select></label>}{kind==="tts"&&<p className="ai-admin-note">Seleção de voz e credenciais seguras serão integradas na próxima etapa. Nenhuma chave deve ser inserida em texto livre.</p>}</fieldset>})}<datalist id="openrouter-models">{(catalog.models||[]).map(m=><option key={m.id} value={m.id}>{m.name} · US$ {m.pricePerMillionInputUsd}/1M entrada</option>)}</datalist></>}
          {tab==="Conhecimento"&&<><label>URLs de conhecimento (uma por linha)<textarea rows={6} value={(agent.knowledgeUrls||[]).join("\n")} onChange={e=>update({knowledgeUrls:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)})}/></label><p className="ai-admin-note">Upload múltiplo e indexação de arquivos ainda não estão ativos. URLs são apenas cadastradas, não consultadas automaticamente.</p></>}
          {tab==="Comportamento"&&<><label>Prompt principal (Markdown)<textarea rows={7} value={agent.instructions} onChange={e=>update({instructions:e.target.value})}/></label><label>Regras de atendimento<textarea rows={4} value={agent.behavior?.rules||""} onChange={e=>update({behavior:{rules:e.target.value,prohibitions:agent.behavior?.prohibitions||""}})}/></label><label>O que NÃO pode fazer?<textarea rows={4} value={agent.behavior?.prohibitions||""} onChange={e=>update({behavior:{rules:agent.behavior?.rules||"",prohibitions:e.target.value}})}/></label><strong>Prévia do comportamento</strong><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{[agent.instructions,agent.behavior?.rules&&"Regras de atendimento:\n"+agent.behavior.rules,agent.behavior?.prohibitions&&"Proibições:\n"+agent.behavior.prohibitions].filter(Boolean).join("\n\n")}</pre></>}
          {tab==="Skills"&&<><h3>Biblioteca de Skills</h3><details><summary><strong>+ Criar Skill personalizada</strong></summary><div className="ai-admin-fields" style={{paddingTop:12}}><label>Nome<input value={skillDraft.name} onChange={e=>setSkillDraft(v=>({...v,name:e.target.value,id:v.id||e.target.value.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}))}/></label><label>ID técnico<input value={skillDraft.id} onChange={e=>setSkillDraft(v=>({...v,id:e.target.value}))}/></label><label>Descrição<textarea rows={3} value={skillDraft.description} onChange={e=>setSkillDraft(v=>({...v,description:e.target.value}))}/></label><label>Instruções (Markdown)<textarea rows={7} value={skillDraft.instructions} onChange={e=>setSkillDraft(v=>({...v,instructions:e.target.value}))}/></label><label>Importar arquivo .md<input type="file" accept=".md,text/markdown,text/plain" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>50000){setSkillNotice("Arquivo muito grande");return;}const content=await file.text();setSkillDraft(v=>({...v,name:v.name||file.name.replace(/\\.md$/i,""),instructions:content}));}}/></label><button type="button" className="primary-button" onClick={async()=>{const next=[...customSkills,skillDraft];try{const response=await fetch("/api/backend/assistant/custom-skills",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({skills:next})});const data=await response.json();if(!response.ok)throw Error(data.message||"Falha ao salvar");setCustomSkills(data.skills);setSkillDraft({id:"",name:"",description:"",instructions:""});setSkillNotice("Skill salva como rascunho; não executável.");}catch(error){setSkillNotice(error instanceof Error?error.message:"Erro ao salvar");}}}><Save size={15}/> Salvar Skill</button>{skillNotice&&<p role="status">{skillNotice}</p>}</div></details><p className="ai-admin-note">Skills personalizadas são rascunhos não executáveis. Para executar ações, é necessária uma implementação revisada e autorizada.</p>{customSkills.map(skill=><p key={skill.id}><strong>{skill.name}</strong> · Rascunho <small>{skill.description}</small></p>)}<p className="ai-admin-note">Habilidades compartilhadas, priorizando custo zero. Selecionar uma Skill não a executa nem ultrapassa permissões do usuário. Recursos ainda não implementados são exibidos desabilitados.</p>{skills.length===0?<p>Catálogo indisponível. Verifique a conexão com a API.</p>:skills.map(skill=><label key={skill.id} className="ai-toggle" style={{opacity:skill.implemented?1:0.65}}><input type="checkbox" disabled={!skill.implemented} checked={(agent.allowedActions||[]).includes(skill.id)} onChange={e=>update({allowedActions:e.target.checked?[...(agent.allowedActions||[]),skill.id]:(agent.allowedActions||[]).filter(x=>x!==skill.id)})}/><span><strong>{skill.name}</strong><small style={{display:"block"}}>{skill.category} · {skill.cost==="zero"?"Sem custo de LLM":skill.cost==="model"?"Depende do modelo":"Pode consumir API externa"} · {skill.implemented?"Disponível para configuração":"Em desenvolvimento"}</small></span></label>)}</>}
          {tab==="Papel e vínculos"&&<><label>Como este agente entra no atendimento<select value={agent.bindings?.mode||"principal"} onChange={e=>update({bindings:{mode:e.target.value,specialists:agent.bindings?.specialists||[],flows:agent.bindings?.flows||[],pipelines:agent.bindings?.pipelines||[],externalSystems:agent.bindings?.externalSystems||[],modules:agent.bindings?.modules||[]}})}><option value="principal">Principal · pode iniciar atendimentos</option><option value="specialist">Especialista · somente por encaminhamento</option></select></label><p className="ai-admin-note">O papel orienta o comportamento; as ações e os vínculos determinam as habilidades. Destinos reais exigem cadastro e autorização.</p>{(["specialists","flows","pipelines","externalSystems","modules"] as const).map((key,i)=><label key={key}>{["Especialistas para encaminhamento","Fluxos que pode acionar","Painéis onde pode criar oportunidades","Sistemas externos que pode consultar ou acionar","Módulos onde pode atuar"][i]} (um por linha)<textarea rows={3} value={(agent.bindings?.[key]||[]).join("\n")} onChange={e=>update({bindings:{mode:agent.bindings?.mode||"principal",specialists:agent.bindings?.specialists||[],flows:agent.bindings?.flows||[],pipelines:agent.bindings?.pipelines||[],externalSystems:agent.bindings?.externalSystems||[],modules:agent.bindings?.modules||[],[key]:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)}})}/></label>)}</>}
                    <label className="ai-toggle"><input type="checkbox" checked={agent.enabled} onChange={e => update({ enabled: e.target.checked })}/> Habilitar agente</label>
          <div className="ai-admin-actions"><button type="button" className="secondary-button" onClick={() => { setAgents(items => items.filter(a => a.id !== selected)); setSelected(agents.find(a => a.id !== selected)?.id ?? 0); }}><Trash2 size={15}/> Excluir</button></div>
        </div> : <p>Crie um agente para configurar.</p>}
      </section>
      <section className="content-card ai-admin-card">
        <h2><Sparkles size={19}/> Assistente pessoal</h2>
        <div className="ai-admin-fields">
          <label>Nome padrão<input value={assistantName} onChange={e => setAssistantName(e.target.value)}/></label>
          <label>Comando de ativação<input value={wakeWord} onChange={e => setWakeWord(e.target.value)}/></label>
          <label>Ativação<select value={activation} onChange={e => setActivation(e.target.value)}><option>Clique ou texto</option><option>Voz (futuro)</option></select></label>
          <label className="ai-toggle"><input type="checkbox" checked={assistantEnabled} onChange={e => setAssistantEnabled(e.target.checked)}/> Habilitar assistente para esta empresa</label><p className="ai-admin-note">Escuta contínua e microfone permanecem desligados. O comando de voz ainda não está disponível.</p>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={saving || loading}><Save size={15}/> Salvar configuração</button>
        </div>
      </section>
    </div>
    {notice && <p role="status">{notice}</p>}
    <p className="ai-admin-note">Configurações armazenadas por empresa. Agentes generativos ainda não executam tarefas; consultas determinísticas não utilizam tokens.</p>
  </section>;
}

export function PersonalAssistantPanel({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [requests, setRequests] = useState<{ question: string; answer: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Véxora");
  useEffect(() => { fetch("/api/backend/assistant/config", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (data?.name) setName(data.name); }).catch(() => {}); }, []);
  const ask = async (question: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/backend/assistant/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await response.json();
      setRequests(items => [...items, { question, answer: response.ok ? data.answer : (Array.isArray(data.message) ? data.message.join(" ") : data.message || "Consulta indisponível") }]);
    } catch { setRequests(items => [...items, { question, answer: "Falha de conexão com a API." }]); }
    finally { setBusy(false); }
  };
  return <aside className="ai-assistant-panel" aria-label="Assistente pessoal">
    <div className="ai-assistant-head"><div><strong><Sparkles size={18}/> {name}</strong><small>Em repouso · sem escuta de microfone</small></div><button type="button" aria-label="Fechar assistente" onClick={onClose}>×</button></div>
    <div className="ai-assistant-content"><p>Olá! Posso ajudar com relatórios, financeiro, agenda e operações utilizando consultas disponíveis, sem ativar IA automaticamente.</p>{requests.map((q,i) => <div key={i} className="ai-assistant-message"><strong>Você:</strong> {q.question}<p>{q.answer}</p></div>)}</div>
    <form className="ai-assistant-form" onSubmit={e => { e.preventDefault(); if (question.trim()) { void ask(question.trim()); setQuestion(""); } }}><input aria-label="Solicitação para a assistente" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Peça um relatório ou consulta..." /><button type="submit" disabled={!question.trim() || busy}>Enviar</button></form>
  </aside>;
}
