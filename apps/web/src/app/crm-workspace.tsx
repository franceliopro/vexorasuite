"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type DragEvent } from "react";
import { Plus, Search, UsersRound, X, LayoutGrid, List, ArrowRight, GripVertical, CheckCircle2, CircleDollarSign, UserRound } from "lucide-react";

type PipelineStage = "lead" | "contacted" | "qualified" | "proposal" | "won" | "lost";
type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
};
type StageInfo = { id: PipelineStage; label: string; hint: string; color: string; tint: string };
const stages: StageInfo[] = [
  { id: "lead", label: "Novos leads", hint: "Entraram no radar", color: "#7567e8", tint: "#f0edff" },
  { id: "contacted", label: "Em contato", hint: "Primeira conversa", color: "#3987e8", tint: "#eaf3ff" },
  { id: "qualified", label: "Qualificados", hint: "Oportunidade real", color: "#159f9a", tint: "#e6f8f5" },
  { id: "proposal", label: "Proposta", hint: "Negociação ativa", color: "#d99a25", tint: "#fff5df" },
  { id: "won", label: "Ganhos", hint: "Negócios fechados", color: "#1caa75", tint: "#e7f8ef" },
  { id: "lost", label: "Perdidos", hint: "Não avançaram", color: "#df6d7b", tint: "#fff0f1" },
];
const validStages = new Set<string>(stages.map((stage) => stage.id));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message;
    throw new Error(Array.isArray(message) ? message.join(" ") : message || data?.error || "Não foi possível concluir a operação.");
  }
  return data as T;
}

export function CrmWorkspace() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStage | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useState<"pipeline" | "contacts">("pipeline");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const loadContacts = useCallback(async (search: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      setContacts(await api<Contact[]>("/api/backend/contacts" + (params.size ? "?" + params.toString() : "")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContacts(""); }, [loadContacts]);

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api<Contact>("/api/backend/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, source: "CRM" }),
      });
      setName(""); setPhone(""); setEmail(""); setFormOpen(false);
      setNotice("Contato cadastrado e adicionado ao pipeline.");
      await loadContacts(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao cadastrar contato.");
    } finally { setSaving(false); }
  }

  const stageFor = (contact: Contact): PipelineStage => {
    const value = contact.metadata?.pipelineStage;
    return typeof value === "string" && validStages.has(value) ? value as PipelineStage : "lead";
  };
  const grouped = useMemo(() => {
    const groups = Object.fromEntries(stages.map((stage) => [stage.id, [] as Contact[]])) as Record<PipelineStage, Contact[]>;
    contacts.forEach((contact) => groups[stageFor(contact)].push(contact));
    return groups;
  }, [contacts]);

  async function moveContact(contact: Contact, stage: PipelineStage) {
    const previousStage = stageFor(contact);
    if (previousStage === stage || movingId) return;
    setMovingId(contact.id); setError(""); setNotice("");
    setContacts((rows) => rows.map((row) => row.id === contact.id ? { ...row, metadata: { ...(row.metadata || {}), pipelineStage: stage } } : row));
    try {
      const updated = await api<Contact>("/api/backend/contacts/" + contact.id + "/pipeline-stage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      setContacts((rows) => rows.map((row) => row.id === contact.id ? updated : row));
      setNotice(contact.name + " movido para “" + stages.find((item) => item.id === stage)?.label + "”.");
    } catch (cause) {
      setContacts((rows) => rows.map((row) => row.id === contact.id ? { ...row, metadata: { ...(row.metadata || {}), pipelineStage: previousStage } } : row));
      setError(cause instanceof Error ? cause.message : "Não foi possível mover o contato.");
    } finally { setMovingId(null); }
  }

  function onDrop(event: DragEvent<HTMLElement>, stage: PipelineStage) {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/contact-id");
    const contact = contacts.find((row) => row.id === id);
    if (contact) void moveContact(contact, stage);
  }

  return (
    <section className="settings-workspace crm-workspace">
      <header className="settings-heading crm-heading">
        <div><p className="eyebrow">RELACIONAMENTO</p><h1>CRM</h1><p>Do primeiro contato ao negócio fechado — acompanhe cada oportunidade em um só lugar.</p></div>
        <div className="crm-heading-actions">
          <div className="crm-view-switch" role="group" aria-label="Visualização do CRM">
            <button type="button" className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")}><LayoutGrid size={15}/> Pipeline</button>
            <button type="button" className={view === "contacts" ? "active" : ""} onClick={() => setView("contacts")}><List size={15}/> Contatos</button>
          </div>
          <button className="primary-button" onClick={() => setFormOpen((value) => !value)}><Plus size={16}/> Novo contato</button>
        </div>
      </header>

      <div className="crm-overview">
        <div className="crm-overview-copy"><span className="crm-overview-mark"><CircleDollarSign size={19}/></span><div><strong>Pipeline comercial</strong><p>Arraste os contatos entre etapas. A mudança fica salva na sua empresa.</p></div></div>
        <div className="crm-overview-stats"><span><b>{contacts.length}</b> contatos</span><i/><span><b>{grouped.won.length}</b> ganhos</span><i/><span><b>{grouped.proposal.length + grouped.qualified.length}</b> em negociação</span></div>
      </div>

      {error ? <div className="settings-feedback error" role="alert">{error}<button onClick={() => setError("")} aria-label="Fechar erro"><X size={15}/></button></div> : null}
      {notice ? <div className="settings-feedback success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15}/></button></div> : null}

      {formOpen ? <form className="content-card settings-card crm-form" onSubmit={createContact}>
        <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18}/></span><div><h2>Novo contato</h2><p>Ele entrará automaticamente na primeira etapa do pipeline.</p></div></div>
        <div className="crm-form-grid">
          <label className="settings-field">Nome *<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do contato"/></label>
          <label className="settings-field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+55 (00) 00000-0000"/></label>
          <label className="settings-field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com"/></label>
        </div>
        <div className="crm-form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Cadastrar contato"}</button></div>
      </form> : null}

      {view === "pipeline" ? <section className="crm-pipeline-wrap" aria-label="Pipeline comercial">
        <div className="crm-pipeline-toolbar"><div><strong>Etapas do relacionamento</strong><span>Solte um cartão em outra coluna para atualizar a etapa</span></div><label className="crm-search crm-pipeline-search"><Search size={16}/><input aria-label="Buscar no pipeline" value={query} onChange={(event) => { setQuery(event.target.value); void loadContacts(event.target.value); }} placeholder="Buscar contatos..."/>{query ? <button type="button" className="crm-clear-search" aria-label="Limpar busca" onClick={() => { setQuery(""); void loadContacts(""); }}><X size={14}/></button> : null}</label></div>
        {loading ? <div className="crm-pipeline-loading"><span className="crm-loading-orb"/><p>Preparando seu pipeline…</p></div> : <div className="crm-pipeline">
          {stages.map((stage) => <section key={stage.id} className={"crm-stage crm-stage-" + stage.id + (dragOver === stage.id ? " is-drag-over" : "")} style={{ "--stage-color": stage.color, "--stage-tint": stage.tint } as import("react").CSSProperties} onDragOver={(event) => { event.preventDefault(); setDragOver(stage.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(null); }} onDrop={(event) => onDrop(event, stage.id)}>
            <header className="crm-stage-heading"><span className="crm-stage-dot"/><div><h3>{stage.label}</h3><p>{stage.hint}</p></div><span className="crm-stage-count">{grouped[stage.id].length}</span></header>
            <div className="crm-stage-cards">
              {grouped[stage.id].map((contact) => <article key={contact.id} className={"crm-deal-card" + (movingId === contact.id ? " is-moving" : "")} draggable={movingId !== contact.id} onDragStart={(event) => { event.dataTransfer.setData("text/contact-id", contact.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDragOver(null)}>
                <div className="crm-deal-topline"><span className="crm-deal-grip"><GripVertical size={14}/></span><span className="crm-deal-source">{contact.source || "Contato"}</span></div>
                <div className="crm-deal-person"><span className="crm-contact-avatar">{contact.name.trim().slice(0,1).toUpperCase() || "?"}</span><div><strong>{contact.name}</strong><small>{contact.phone || "Sem telefone"}</small></div></div>
                {contact.email ? <p className="crm-deal-email">{contact.email}</p> : null}
                <footer className="crm-deal-footer"><span><UserRound size={13}/> Contato</span><select aria-label={"Mover "+contact.name+" para outra etapa"} value={stage.id} disabled={movingId === contact.id} onChange={(event) => { if (validStages.has(event.target.value)) void moveContact(contact, event.target.value as PipelineStage); }}><option value={stage.id}>{stage.label}</option>{stages.filter((item) => item.id !== stage.id).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ArrowRight size={13}/></footer>
              </article>)}
              {!grouped[stage.id].length ? <div className="crm-stage-empty"><span>+</span><p>Solte um contato aqui</p></div> : null}
            </div>
          </section>)}
        </div>}
        {!loading && !contacts.length ? <div className="crm-pipeline-empty"><span className="empty-illustration"><UsersRound size={24}/></span><h3>Seu pipeline começa aqui</h3><p>Cadastre seu primeiro contato para começar a acompanhar as oportunidades por etapa.</p><button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={15}/> Criar primeiro contato</button></div> : null}
      </section> : <section className="content-card settings-card">
        <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18}/></span><div><h2>Contatos</h2><p>{contacts.length} {contacts.length === 1 ? "contato carregado" : "contatos carregados"} · até 100 resultados por busca</p></div></div>
        <form className="crm-search" onSubmit={(event) => { event.preventDefault(); void loadContacts(query); }}><Search size={17} aria-hidden="true"/><input aria-label="Buscar contatos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail"/><button className="secondary-button" type="submit">Buscar</button></form>
        {loading ? <p className="settings-muted">Carregando contatos...</p> : contacts.length ? <div className="crm-contact-list">{contacts.map((contact) => <article className="crm-contact-row" key={contact.id}><span className="crm-contact-avatar">{contact.name.trim().slice(0,1).toUpperCase() || "?"}</span><div className="crm-contact-main"><strong>{contact.name}</strong><span>{contact.phone || "Sem telefone"}{contact.email ? " · " + contact.email : ""}</span></div><span className="crm-contact-source">{contact.source || "Contato"}</span></article>)}</div> : <div className="empty-state crm-empty"><span className="empty-illustration"><UsersRound size={24}/></span><h3>{query.trim() ? "Nenhum contato encontrado" : "Seu CRM começa aqui"}</h3><p>{query.trim() ? "Tente outro nome, telefone ou e-mail." : "Cadastre o primeiro contato para iniciar o relacionamento."}</p>{!query.trim() ? <button className="secondary-button" onClick={() => setFormOpen(true)}><Plus size={15}/> Cadastrar primeiro contato</button> : null}</div>}
      </section>}
    </section>
  );
}
