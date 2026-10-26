"use client";
import { useEffect, useState } from "react";
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
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          <label>Nome do agente<input value={agent.name} onChange={e => update({ name: e.target.value })}/></label>
          <label>Função<input value={agent.role} onChange={e => update({ role: e.target.value })}/></label>
          <label>Perfil de custo<select value={agent.tier} onChange={e => update({ tier: e.target.value as Agent["tier"] })}><option>Econômico</option><option>Equilíbrio</option><option>Inteligente</option></select></label>
          <label>Instruções<textarea rows={5} value={agent.instructions} onChange={e => update({ instructions: e.target.value })}/></label>
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
