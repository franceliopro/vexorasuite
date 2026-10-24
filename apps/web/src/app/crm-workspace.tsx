"use client";

import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from "react";
import { ArrowRight, Check, ChartNoAxesCombined, LayoutGrid, List, Plus, Search, UsersRound, X } from "lucide-react";
import { LeadOriginsWorkspace } from "./lead-origins-workspace";

type CrmStage = "new" | "qualification" | "proposal" | "finalization";
type CrmFinalization = { outcome: "WON" | "LOST"; reason?: string; finalizedAt?: string };
type CrmTag = {name:string;color?:string};
type CrmFieldDefinition = {name:string;key:string};
type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  updatedAt: string;
  crmStage?: CrmStage | null;
  crmFinalization?: CrmFinalization | null;
  metadata?: Record<string, unknown> | null;
};
function isAsaasCustomer(contact: Contact) {
  const asaas = contact.metadata?.asaas;
  return !!asaas && typeof asaas === "object" && !Array.isArray(asaas) && typeof (asaas as Record<string, unknown>).customerId === "string";
}
function isCustomer(contact: Contact) { return contact.metadata?.contactType === "CUSTOMER" || isAsaasCustomer(contact); }
function contactTags(contact: Contact): CrmTag[] {
  const value = contact.metadata?.tags;
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw === "string") return [{ name: raw, color: "#eeecff" }];
    if (raw && typeof raw === "object" && "name" in raw && typeof (raw as {name?:unknown}).name === "string") return [{ name: (raw as {name:string}).name, color: typeof (raw as {color?:unknown}).color === "string" ? (raw as {color:string}).color : "#eeecff" }];
    return [];
  });
}
function contactFieldSummary(contact: Contact, definitions: CrmFieldDefinition[]) {
  const value = contact.metadata?.customFields;
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const values = value as Record<string, unknown>;
  return definitions.map(field => ({ field, value: values[field.key] })).filter(item => item.value !== undefined && item.value !== null && item.value !== "").slice(0, 3);
}

const stages: { id: CrmStage; label: string; hint: string; tone: string }[] = [
  { id: "new", label: "Novos", hint: "Entraram no CRM", tone: "violet" },
  { id: "qualification", label: "Qualificação", hint: "Entenda a oportunidade", tone: "blue" },
  { id: "proposal", label: "Proposta", hint: "Em negociação", tone: "amber" },
  { id: "finalization", label: "Finalização", hint: "Registrar o resultado comercial", tone: "green" },
];

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
  const [fieldDefinitions, setFieldDefinitions] = useState<CrmFieldDefinition[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [dropTarget, setDropTarget] = useState<CrmStage | "">("");
  const [view, setView] = useState<"pipeline" | "customers" | "contacts" | "origins">("pipeline");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [leadOrigin, setLeadOrigin] = useState("");
  const [finalizingContact, setFinalizingContact] = useState<Contact | null>(null);
  const [finalOutcome, setFinalOutcome] = useState<"WON" | "LOST" | "">("");
  const [lossReason, setLossReason] = useState("");
  const lossReasons = ["Preço/Condição", "Sem interesse", "Sem retorno", "Concorrência", "Inatividade"];

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

  useEffect(() => { void loadContacts(""); void api<{fields:CrmFieldDefinition[]}>("/api/backend/contacts/profile-config").then(v=>setFieldDefinitions(v.fields||[])).catch(()=>{}); }, [loadContacts]);

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api<Contact>("/api/backend/contacts", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, source: leadOrigin || undefined }),
      });
      setName(""); setPhone(""); setEmail(""); setLeadOrigin(""); setFormOpen(false);
      setNotice("Contato cadastrado e adicionado à etapa Novos.");
      await loadContacts(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao cadastrar contato.");
    } finally { setSaving(false); }
  }

  async function moveContact(contact: Contact, stage: CrmStage) {
    if (stage === "finalization") { setFinalizingContact(contact); setFinalOutcome(""); setLossReason(""); return; }
    if (contact.crmFinalization || (contact.crmStage || "new") === stage || movingId) return;
    const previousStage = contact.crmStage || "new";
    setMovingId(contact.id); setError(""); setNotice("");
    setContacts((items) => items.map((item) => item.id === contact.id ? { ...item, crmStage: stage } : item));
    try {
      await api<Contact>("/api/backend/contacts/" + contact.id + "/stage", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage }),
      });
      setNotice(contact.name + " movido para " + stages.find((item) => item.id === stage)?.label + ".");
    } catch (cause) {
      setContacts((items) => items.map((item) => item.id === contact.id ? { ...item, crmStage: previousStage } : item));
      setError(cause instanceof Error ? cause.message : "Não foi possível mover o contato.");
    } finally { setMovingId(""); setDraggingId(""); setDropTarget(""); }
  }


  async function confirmFinalization() {
    if (!finalizingContact || !finalOutcome || (finalOutcome === "LOST" && !lossReason) || movingId) return;
    const contact = finalizingContact;
    setMovingId(contact.id); setError(""); setNotice("");
    try {
      const result = await api<{ contact: Contact; finalizedConversations: number }>("/api/backend/contacts/" + contact.id + "/finalize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: finalOutcome, reason: finalOutcome === "LOST" ? lossReason : undefined }),
      });
      setContacts((items) => items.map((item) => item.id === contact.id ? { ...item, crmStage: null, crmFinalization: { outcome: finalOutcome, ...(finalOutcome === "LOST" ? { reason: lossReason } : {}) } } : item));
      setNotice(finalOutcome === "WON" ? contact.name + " convertido em cliente e finalizado." : contact.name + " finalizado como perda: " + lossReason + ".");
      setFinalizingContact(null); setFinalOutcome(""); setLossReason("");
      if (result.finalizedConversations) setNotice((value) => value + " " + result.finalizedConversations + (result.finalizedConversations === 1 ? " conversa foi encerrada." : " conversas foram encerradas."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível finalizar este contato.");
    } finally { setMovingId(""); setDraggingId(""); setDropTarget(""); }
  }

  function startDrag(event: DragEvent<HTMLElement>, contact: Contact) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", contact.id);
    setDraggingId(contact.id);
  }

  function dropOnStage(event: DragEvent<HTMLDivElement>, stage: CrmStage) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    const contact = contacts.find((item) => item.id === id);
    setDropTarget("");
    if (contact) void moveContact(contact, stage);
  }

  const visibleContacts = contacts.filter((contact) => !query.trim() || [contact.name, contact.phone || "", contact.email || ""].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <section className="settings-workspace crm-workspace">
      <header className="settings-heading crm-heading">
        <div><p className="eyebrow">RELACIONAMENTO</p><h1>CRM</h1><p>Acompanhe cada oportunidade e mova os contatos pelo funil comercial.</p></div>
        <button className="primary-button" onClick={() => setFormOpen((value) => !value)}><Plus size={16} /> Novo contato</button>
      </header>

      <div className="crm-toolbar">
        <div className="crm-view-switch" role="tablist" aria-label="Visualização do CRM">
          <button role="tab" aria-selected={view === "pipeline"} className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")}><LayoutGrid size={15}/> Pipeline</button>
          <button role="tab" aria-selected={view === "customers"} className={view === "customers" ? "active" : ""} onClick={() => setView("customers")}><UsersRound size={15}/> Clientes <span className="crm-tab-count">{contacts.filter(isCustomer).length}</span></button>
          <button role="tab" aria-selected={view === "contacts"} className={view === "contacts" ? "active" : ""} onClick={() => setView("contacts")}><List size={15}/> Contatos <span className="crm-tab-count">{contacts.filter((contact) => !isCustomer(contact)).length}</span></button>
          <button role="tab" aria-selected={view === "origins"} className={view === "origins" ? "active" : ""} onClick={() => setView("origins")}><ChartNoAxesCombined size={15}/> Inteligência Comercial</button>
        </div>
        {view !== "origins" ? <label className="crm-search crm-toolbar-search"><Search size={17} aria-hidden="true" /><input aria-label="Buscar contatos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contato..." />{query ? <button type="button" className="crm-clear-search" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={14}/></button> : null}</label> : null}
      </div>

      {error ? <div className="settings-feedback error" role="alert">{error}<button onClick={() => setError("")} aria-label="Fechar erro"><X size={15} /></button></div> : null}
      {notice ? <div className="settings-feedback success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div> : null}

      {formOpen ? <form className="content-card settings-card crm-form" onSubmit={createContact}>
        <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18} /></span><div><h2>Novo contato</h2><p>Os dados ficam isolados na empresa da sua sessão.</p></div></div>
        <div className="crm-form-grid">
          <label className="settings-field">Nome *<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do contato" /></label>
          <label className="settings-field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+55 (00) 00000-0000" /></label>
          <label className="settings-field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com" /></label>
          <label className="settings-field">Origem do lead<select value={leadOrigin} onChange={(event) => setLeadOrigin(event.target.value)}><option value="">Não identificada</option><option value="Site/Formulário">Site/Formulário</option><option value="Indicação">Indicação</option><option value="Redes sociais">Redes sociais</option><option value="Anúncio">Anúncio</option><option value="Evento">Evento</option><option value="Importação">Importação</option><option value="Outra">Outra</option></select><small>O canal de atendimento não será considerado origem de aquisição automaticamente.</small></label>
        </div>
        <div className="crm-form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Cadastrar contato"}</button></div>
      </form> : null}

      {loading ? <section className="content-card crm-loading"><span className="crm-loading-orbit"/><strong>Preparando seu pipeline</strong><p>Carregando os contatos da empresa…</p></section> : view === "pipeline" ? (
        <section className="crm-pipeline" aria-label="Pipeline comercial">
          {stages.map((stage) => {
            const columnContacts = stage.id === "finalization" ? [] : visibleContacts.filter((contact) => !contact.crmFinalization && (contact.crmStage || "new") === stage.id);
            const activeDrop = dropTarget === stage.id;
            return <div key={stage.id} className={"crm-pipeline-column tone-" + stage.tone + (activeDrop ? " drop-active" : "")}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(stage.id); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(""); }}
              onDrop={(event) => dropOnStage(event, stage.id)}>
              <header className="crm-stage-heading"><span className="crm-stage-indicator"/><div><h2>{stage.label}</h2><p>{stage.hint}</p></div><span className="crm-stage-count">{columnContacts.length}</span></header>
              <div className="crm-stage-cards">
                {columnContacts.map((contact) => <article key={contact.id} draggable onDragStart={(event) => startDrag(event, contact)} onDragEnd={() => { setDraggingId(""); setDropTarget(""); }} className={"crm-pipeline-card" + (draggingId === contact.id ? " is-dragging" : "")}>
                  <div className="crm-card-top"><span className="crm-contact-avatar">{contact.name.trim().slice(0, 1).toUpperCase() || "?"}</span><span className="crm-card-source">{contact.source || "Contato"}</span></div>
                  <strong className="crm-card-name">{contact.name}</strong>
                  {contactTags(contact).length?<span className="crm-contact-tags">{contactTags(contact).map((tag,index)=><span key={tag.name+index} style={{backgroundColor:tag.color||"#eeecff"}}>{tag.name}</span>)}</span>:null}
                  {contactFieldSummary(contact,fieldDefinitions).length?<span className="crm-custom-field-summary">{contactFieldSummary(contact,fieldDefinitions).map(item=><span key={item.field.key}><b>{item.field.name}:</b> {String(item.value)}</span>)}</span>:null}
                  <span className="crm-card-detail">{contact.phone || contact.email || "Sem telefone ou e-mail"}</span>
                  {contact.phone && contact.email ? <span className="crm-card-detail">{contact.email}</span> : null}
                  <div className="crm-card-footer"><label className="crm-move-label">Mover para<select aria-label={"Mover " + contact.name + " para outra etapa"} value={stage.id} disabled={movingId === contact.id} onChange={(event) => void moveContact(contact, event.target.value as CrmStage)}>{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><ArrowRight size={14} aria-hidden="true"/></div>
                </article>)}
                {!columnContacts.length ? <div className={"crm-stage-empty" + (activeDrop ? " is-lit" : "")}><span>{activeDrop ? <Check size={17}/> : <Plus size={17}/>}</span><strong>{activeDrop ? "Solte para mover" : "Sem contatos nesta etapa"}</strong><small>{activeDrop ? (stage.id === "finalization" ? "Escolha ganho ou perda" : "O pipeline será atualizado") : (stage.id === "finalization" ? "Arraste um contato para registrar o resultado" : "Arraste um cartão para cá")}</small></div> : null}
              </div>
            </div>;
          })}
        </section>
      ) : view === "origins" ? <LeadOriginsWorkspace /> : (() => {
        const customerView = view === "customers";
        const rows = visibleContacts.filter((contact) => customerView ? isCustomer(contact) : !isCustomer(contact));
        const heading = customerView ? "Clientes" : "Contatos";
        return <section className="content-card settings-card crm-contacts-card">
          <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18} /></span><div><h2>{heading}</h2><p>{rows.length} {rows.length === 1 ? (customerView ? "cliente" : "contato") : (customerView ? "clientes" : "contatos")} encontrados</p></div></div>
          {customerView ? <div className="crm-customer-note"><strong>Cadastro de clientes</strong><span>Clientes vinculados ao Asaas são sincronizados e protegidos contra exclusão pela Véxora. Atualizações financeiras devem respeitar o cadastro de origem.</span></div> : null}
          {rows.length ? <div className="crm-contact-list">{rows.map((contact) => { const asaasCustomer = isAsaasCustomer(contact); return <article className="crm-contact-row" key={contact.id}>
            <span className="crm-contact-avatar">{contact.name.trim().slice(0, 1).toUpperCase() || "?"}</span><div className="crm-contact-main"><strong>{contact.name}</strong><span>{contact.phone || "Sem telefone"}{contact.email ? " · " + contact.email : ""}</span>{contactTags(contact).length?<span className="crm-contact-tags">{contactTags(contact).map((tag,index)=><span key={tag.name+index} style={{backgroundColor:tag.color||"#eeecff"}}>{tag.name}</span>)}</span>:null}{contactFieldSummary(contact,fieldDefinitions).length?<span className="crm-custom-field-summary">{contactFieldSummary(contact,fieldDefinitions).map(item=><span key={item.field.key}><b>{item.field.name}:</b> {String(item.value)}</span>)}</span>:null}</div>
            {customerView ? <span className={"crm-customer-origin" + (asaasCustomer ? " is-asaas" : "")}>{asaasCustomer ? "Asaas sincronizado" : "Cliente Véxora"}</span> : contact.crmFinalization ? <span className={"crm-stage-pill tone-rose"}><span>{"Perda · " + (contact.crmFinalization.reason || "Motivo registrado")}</span></span> : <label className={"crm-stage-pill tone-" + stages.find((stage) => stage.id === (contact.crmStage || "new"))?.tone}><span>{stages.find((stage) => stage.id === (contact.crmStage || "new"))?.label}</span><select aria-label={"Etapa de " + contact.name} value={contact.crmStage || "new"} onChange={(event) => void moveContact(contact, event.target.value as CrmStage)}>{stages.filter((stage) => stage.id !== "finalization").map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>}
          </article>; })}</div> : <div className="empty-state crm-empty"><span className="empty-illustration"><UsersRound size={24} /></span><h3>{query.trim() ? "Nenhum registro encontrado" : customerView ? "Nenhum cliente cadastrado" : "Nenhum contato cadastrado"}</h3><p>{query.trim() ? "Tente outro nome, telefone ou e-mail." : customerView ? "Clientes convertidos pelo CRM ou sincronizados do Asaas aparecerão aqui." : "Cadastre um contato para começar a organizar seu relacionamento comercial."}</p>{!customerView ? <button className="secondary-button" onClick={() => setFormOpen(true)}><Plus size={15} /> Cadastrar contato</button> : null}</div>}
        </section>;
      })()}

      {finalizingContact ? <div className="finalization-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !movingId) setFinalizingContact(null); }}><section className="finalization-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-finalization-title"><button type="button" className="finalization-close" aria-label="Fechar" disabled={!!movingId} onClick={() => setFinalizingContact(null)}><X size={18}/></button><span className="finalization-icon"><Check size={22}/></span><h2 id="crm-finalization-title">Finalizar oportunidade</h2><p>Qual foi o resultado comercial de <strong>{finalizingContact.name}</strong>?</p><div className="finalization-outcomes"><button type="button" className={finalOutcome === "WON" ? "selected won" : "won"} onClick={() => { setFinalOutcome("WON"); setLossReason(""); }}><Check size={17}/><span><strong>Ganho</strong><small>Converter lead em cliente</small></span></button><button type="button" className={finalOutcome === "LOST" ? "selected lost" : "lost"} onClick={() => setFinalOutcome("LOST")}><X size={17}/><span><strong>Perda</strong><small>Registrar motivo da perda</small></span></button></div>{finalOutcome === "LOST" ? <label className="finalization-reason">Motivo da perda<select required value={lossReason} onChange={(event) => setLossReason(event.target.value)}><option value="">Selecione o motivo…</option>{lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label> : null}<p className="finalization-note">A finalização remove o contato do Kanban e encerra as conversas abertas. O histórico permanece em Contatos.</p><div className="finalization-actions"><button type="button" className="secondary-button" disabled={!!movingId} onClick={() => setFinalizingContact(null)}>Cancelar</button><button type="button" className="primary-button" disabled={!finalOutcome || (finalOutcome === "LOST" && !lossReason) || !!movingId} onClick={() => void confirmFinalization()}>{movingId ? "Finalizando…" : "Confirmar finalização"}</button></div></section></div> : null}
    </section>
  );
}
