"use client";
import { useState } from "react";
import { Bot, Plus, Save, Trash2, ShieldCheck, Sparkles } from "lucide-react";

type Agent = { id: number; name: string; role: string; tier: "Econômico" | "Equilíbrio" | "Inteligente"; enabled: boolean; instructions: string };
const starter: Agent[] = [{ id: 1, name: "Assistente pessoal", role: "Consultas e relatórios", tier: "Econômico", enabled: false, instructions: "Consulte apenas dados autorizados. Priorize regras e consultas determinísticas. Peça confirmação antes de ações sensíveis." }];
export function AiAgentsWorkspace() {
  const [agents, setAgents] = useState<Agent[]>(starter);
  const [selected, setSelected] = useState(1);
  const [assistantName, setAssistantName] = useState("Véxora");
  const [wakeWord, setWakeWord] = useState("Olá Véxora");
  const [activation, setActivation] = useState("Clique ou texto");
  const [notice, setNotice] = useState("");
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
          <label>Nome do agente<input value={agent.name} onChange={e => update({ name: e.target.value })}/></label>
          <label>Função<input value={agent.role} onChange={e => update({ role: e.target.value })}/></label>
          <label>Perfil de custo<select value={agent.tier} onChange={e => update({ tier: e.target.value as Agent["tier"] })}><option>Econômico</option><option>Equilíbrio</option><option>Inteligente</option></select></label>
          <label>Instruções<textarea rows={5} value={agent.instructions} onChange={e => update({ instructions: e.target.value })}/></label>
          <label className="ai-toggle"><input type="checkbox" checked={agent.enabled} onChange={e => update({ enabled: e.target.checked })}/> Habilitar agente neste rascunho</label>
          <div className="ai-admin-actions"><button type="button" className="secondary-button" onClick={() => { setAgents(items => items.filter(a => a.id !== selected)); setSelected(agents.find(a => a.id !== selected)?.id ?? 0); }}><Trash2 size={15}/> Excluir</button></div>
        </div> : <p>Crie um agente para configurar.</p>}
      </section>
      <section className="content-card ai-admin-card">
        <h2><Sparkles size={19}/> Assistente pessoal</h2>
        <div className="ai-admin-fields">
          <label>Nome padrão<input value={assistantName} onChange={e => setAssistantName(e.target.value)}/></label>
          <label>Comando de ativação<input value={wakeWord} onChange={e => setWakeWord(e.target.value)}/></label>
          <label>Ativação<select value={activation} onChange={e => setActivation(e.target.value)}><option>Clique ou texto</option><option>Voz (futuro)</option></select></label>
          <p className="ai-admin-note">Escuta contínua e microfone permanecem desligados. O comando de voz ainda não está disponível.</p>
          <button type="button" className="primary-button" onClick={() => setNotice("Prévia atualizada. Persistência e ativação reais dependem da API por empresa.")}><Save size={15}/> Revisar configuração</button>
        </div>
      </section>
    </div>
    {notice && <p role="status">{notice}</p>}
    <p className="ai-admin-note">Interface inicial de configuração: alterações são temporárias e não ativam agentes reais. Credenciais, permissões, salvamento por empresa e execução serão conectados à API.</p>
  </section>;
}

export function PersonalAssistantPanel({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [requests, setRequests] = useState<string[]>([]);
  return <aside className="ai-assistant-panel" aria-label="Assistente pessoal">
    <div className="ai-assistant-head"><div><strong><Sparkles size={18}/> Véxora</strong><small>Em repouso · sem escuta de microfone</small></div><button type="button" aria-label="Fechar assistente" onClick={onClose}>×</button></div>
    <div className="ai-assistant-content"><p>Olá! Posso ajudar com relatórios, financeiro, agenda e operações quando as integrações estiverem disponíveis.</p>{requests.map((q,i) => <div key={i} className="ai-assistant-message"><strong>Você:</strong> {q}<p>Solicitação registrada apenas nesta prévia. A consulta segura à API ainda será implementada.</p></div>)}</div>
    <form className="ai-assistant-form" onSubmit={e => { e.preventDefault(); if (question.trim()) { setRequests(items => [...items, question.trim()]); setQuestion(""); } }}><input aria-label="Solicitação para a assistente" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Peça um relatório ou consulta..." /><button type="submit" disabled={!question.trim()}>Enviar</button></form>
  </aside>;
}
