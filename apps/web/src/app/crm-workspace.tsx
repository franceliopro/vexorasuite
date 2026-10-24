"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, Search, UsersRound, X } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  updatedAt: string;
};

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
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
      setName("");
      setPhone("");
      setEmail("");
      setFormOpen(false);
      setNotice("Contato cadastrado.");
      await loadContacts(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao cadastrar contato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-workspace crm-workspace">
      <header className="settings-heading">
        <div><p className="eyebrow">RELACIONAMENTO</p><h1>CRM</h1><p>Centralize seus contatos e construa o histórico de relacionamento da empresa.</p></div>
        <button className="primary-button" onClick={() => setFormOpen((value) => !value)}><Plus size={16} /> Novo contato</button>
      </header>

      {error ? <div className="settings-feedback error" role="alert">{error}<button onClick={() => setError("")} aria-label="Fechar erro"><X size={15} /></button></div> : null}
      {notice ? <div className="settings-feedback success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div> : null}

      {formOpen ? <form className="content-card settings-card crm-form" onSubmit={createContact}>
        <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18} /></span><div><h2>Novo contato</h2><p>Os dados ficam isolados na empresa da sua sessão.</p></div></div>
        <div className="crm-form-grid">
          <label className="settings-field">Nome *<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do contato" /></label>
          <label className="settings-field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+55 (00) 00000-0000" /></label>
          <label className="settings-field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com" /></label>
        </div>
        <div className="crm-form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Cadastrar contato"}</button></div>
      </form> : null}

      <section className="content-card settings-card">
        <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18} /></span><div><h2>Contatos</h2><p>{contacts.length} {contacts.length === 1 ? "contato carregado" : "contatos carregados"} · até 100 resultados por busca</p></div></div>
        <form className="crm-search" onSubmit={(event) => { event.preventDefault(); void loadContacts(query); }}>
          <Search size={17} aria-hidden="true" /><input aria-label="Buscar contatos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" /><button className="secondary-button" type="submit">Buscar</button>
        </form>
        {loading ? <p className="settings-muted">Carregando contatos...</p> : contacts.length ? <div className="crm-contact-list">
          {contacts.map((contact) => <article className="crm-contact-row" key={contact.id}>
            <span className="crm-contact-avatar">{contact.name.trim().slice(0, 1).toUpperCase() || "?"}</span>
            <div className="crm-contact-main"><strong>{contact.name}</strong><span>{contact.phone || "Sem telefone"}{contact.email ? " · " + contact.email : ""}</span></div>
            <span className="crm-contact-source">{contact.source || "Contato"}</span>
          </article>)}
        </div> : <div className="empty-state crm-empty"><span className="empty-illustration"><UsersRound size={24} /></span><h3>{query.trim() ? "Nenhum contato encontrado" : "Seu CRM começa aqui"}</h3><p>{query.trim() ? "Tente outro nome, telefone ou e-mail." : "Cadastre o primeiro contato. A base será o ponto de partida para oportunidades, histórico e automações."}</p>{!query.trim() ? <button className="secondary-button" onClick={() => setFormOpen(true)}><Plus size={15} /> Cadastrar primeiro contato</button> : null}</div>}
      </section>
    </section>
  );
}
