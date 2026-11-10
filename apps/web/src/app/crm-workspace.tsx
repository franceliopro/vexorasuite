"use client";
import { ContactPhoto } from "./contact-photo";
import { useModalDialog } from "../lib/use-modal-dialog";
import { WhatsAppGlyph } from "./brand-glyph";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Check, ChartNoAxesCombined, LayoutGrid, List, Mail, Phone, Plus, Search, UserRound, UsersRound, X, Clock3 } from "lucide-react";
import { LeadOriginsWorkspace } from "./lead-origins-workspace";
import { ReportsWorkspace } from "./reports-workspace";
import { ContactProfilePanel } from "./contact-profile-panel";
import { VexoraDialog } from "./vexora-dialog";
import { readablePhone, contactDisplayName } from "../lib/contact-identity";
import { socialPlatformOfContact, socialHandleLabel, tagForeground } from "../lib/social-identity";
import { PlatformIcon, platformLabel } from "./platform-icon";
function waLink(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return "https://wa.me/" + (digits.length <= 11 ? "55" + digits : digits);
}
/** Nome exibido no card, na lista e no perfil: novo_nome → nome real → “Sem nome”. Nunca dígitos. */
function contactName(contact: { name: string; metadata?: Record<string, unknown> | null }): string {
  const display = contactDisplayName(contact);
  if (display && display !== "Cliente") {
    const digits = display.replace(/\D/g, "");
    if (digits.length >= 8 && /^[\d\s()+.-]+$/.test(display)) return "Contato sem nome";
    return display;
  }
  return "Contato sem nome";
}
/** Linha secundária: @ da rede social (contatos de social) ou telefone/e-mail formatados. */
function contactSecondaryLine(contact: { phone: string | null; email: string | null; source: string | null; metadata?: Record<string, unknown> | null }): { social: boolean; platform: string; text: string } {
  const platform = socialPlatformOfContact(contact);
  if (platform) {
    const handle = socialHandleLabel(contact);
    return { social: true, platform, text: handle || platformLabel(platform) };
  }
  const phone = readablePhone(contact.phone);
  return { social: false, platform: "", text: phone || contact.email || "Sem telefone ou e-mail" };
}


type CrmStage = "new" | "qualification" | "proposal" | "finalization";
type CrmFinalization = { outcome: "WON" | "LOST"; reason?: string; finalizedAt?: string };
type CrmTag = {name:string;color?:string};
type CrmFieldDefinition = {name:string;key:string};
type Contact = {
  id: string;
  pipelineId?: string | null;
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
function contactLeadOrigin(contact: Contact): string {
  const metadata = contact.metadata;
  if (!metadata || typeof metadata !== "object") return "";
  const lead = (metadata as Record<string, unknown>).leadOrigin;
  if (lead && typeof lead === "object" && !Array.isArray(lead)) {
    const source = (lead as Record<string, unknown>).source;
    if (typeof source === "string" && source.trim()) return source.trim();
  }
  return "";
}
function relativeTime(value?: string | null): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const diff = Math.max(0, Date.now() - time);
  if (diff < 60_000) return "agora mesmo";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return "há " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "há " + hours + (hours === 1 ? " hora" : " horas");
  const days = Math.floor(hours / 24);
  if (days === 1) return "há 1 dia";
  if (days < 30) return "há " + days + " dias";
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : "há " + months + " meses";
}

const defaultStages: { id: CrmStage; label: string; hint: string; tone: string }[] = [
  { id: "new", label: "Novos", hint: "Entraram no CRM", tone: "violet" },
  { id: "qualification", label: "Qualificação", hint: "Entenda a oportunidade", tone: "blue" },
  { id: "proposal", label: "Proposta", hint: "Em negociação", tone: "amber" },
  { id: "finalization", label: "Finalização", hint: "Registrar o resultado", tone: "green" },
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


export function CrmWorkspace({initialSearch=""}:{initialSearch?:string}={}) {
  const [pipelines,setPipelines]=useState<any[]>([]),[pipelineId,setPipelineId]=useState(''),[pipelineReady,setPipelineReady]=useState(false),[isAdmin,setIsAdmin]=useState(false);
  const salesPipeline=!pipelineId||pipelines.find(p=>p.id===pipelineId)?.template==='SALES';
  const stages=(pipelines.find(p=>p.id===pipelineId)?.stages||defaultStages) as typeof defaultStages;
  useEffect(()=>{void Promise.all([api<any>('/api/backend/crm/pipelines'),api<any>('/api/backend/auth/me')]).then(([data,me])=>{const admin=['OWNER','ADMIN'].includes(me.role);setIsAdmin(admin);setPipelines(data.pipelines);setPipelineId(data.pipelines[0]?.id||'');setPipelineReady(true);}).catch(e=>{setError(e.message);setPipelineReady(true)});},[]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<CrmFieldDefinition[]>([]);
  const [query, setQuery] = useState("");
  const queryRef=useRef(query);queryRef.current=query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState("");
  const [draggingId, setDraggingId] = useState("");
  const [dropTarget, setDropTarget] = useState<CrmStage | "">("");
  const [view, setView] = useState<"pipeline" | "customers" | "contacts" | "origins" | "reports">("pipeline");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [leadOrigin, setLeadOrigin] = useState("");
  const [leadOriginId, setLeadOriginId] = useState("");
  const [finalizingContact, setFinalizingContact] = useState<Contact | null>(null);
  const [fichaContact, setFichaContact] = useState<Contact | null>(null);
  const [pendingStage, setPendingStage] = useState<CrmStage | null>(null);
 const modalRef=useRef<HTMLElement|null>(null);
 useModalDialog(!!finalizingContact,modalRef,()=>{if(!movingId)setFinalizingContact(null)});
  const [finalOutcome, setFinalOutcome] = useState<"WON" | "LOST" | "">("");
  const [lossReason, setLossReason] = useState("");
  const lossReasons = ["Preço/Condição", "Sem interesse", "Sem retorno", "Concorrência", "Inatividade"];

  const loadContacts = useCallback(async (search: string) => {
    if (!pipelineReady) return;
    const customerMode = view === "customers";
    if (!pipelineId && !isAdmin && !customerMode) { setContacts([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (pipelineId && !customerMode) params.set("pipelineId", pipelineId);
      if (customerMode) params.set("customerOnly", "1");
      if (search.trim()) params.set("q", search.trim());
      setContacts(await api<Contact[]>("/api/backend/contacts" + (params.size ? "?" + params.toString() : "")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }, [pipelineId, pipelineReady, isAdmin, view]);

  useEffect(() => { void loadContacts(initialSearch);if(initialSearch){setQuery(initialSearch);setView("contacts")} void api<{fields:CrmFieldDefinition[]}>("/api/backend/contacts/profile-config").then(v=>setFieldDefinitions(v.fields||[])).catch(()=>{}); if(!initialSearch&&new URLSearchParams(window.location.search).get("crmTab")==="reports") setView("reports"); }, [loadContacts,initialSearch]);

  useEffect(()=>{if(!pipelineReady)return;const source=new EventSource("/api/backend/events",{withCredentials:true});const onStage=(event:Event)=>{try{const data=JSON.parse((event as MessageEvent<string>).data) as {pipelineId?:string};if(data.pipelineId===pipelineId)void loadContacts(queryRef.current)}catch{}};const onContact=()=>{void loadContacts(queryRef.current)};source.addEventListener("contact.stage_changed",onStage);source.addEventListener("contact.updated",onContact);source.addEventListener("contact.created",onContact);return()=>{source.removeEventListener("contact.stage_changed",onStage);source.removeEventListener("contact.updated",onContact);source.removeEventListener("contact.created",onContact);source.close()}},[loadContacts,pipelineId,pipelineReady]);

  function openNewContact(stage?: CrmStage) {
    setPendingStage(stage && stage !== "new" ? stage : null);
    setFormOpen(true);
    setNotice(stage && stage !== "new" ? `O contato será criado em Novos e movido para ${stages.find(item => item.id === stage)?.label}.` : "");
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const created = await api<Contact>("/api/backend/contacts"+(pipelineId?"?pipelineId="+pipelineId:""), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, source: leadOrigin || undefined }),
      });
      if (leadOrigin) await api("/api/backend/contacts/" + created.id + "/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadOrigin: { source: leadOrigin, identifier: leadOriginId.trim() || undefined } }) });
      setName(""); setPhone(""); setEmail(""); setLeadOrigin(""); setLeadOriginId(""); setFormOpen(false);
      setNotice("Contato cadastrado e adicionado à etapa Novos.");
      if (pendingStage && pendingStage !== "new") {
        const target = pendingStage;
        setPendingStage(null);
        try {
          await moveContact({ ...created, crmStage: "new" }, target);
        } catch {
          setNotice("Contato cadastrado em Novos. Mova-o para a etapa desejada pelo cartão.");
        }
      } else {
        setPendingStage(null);
      }
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


  async function removeFromPipeline(contact:Contact) {
    if(!pipelineId||movingId||!window.confirm("Retirar "+contact.name+" deste pipeline? O cadastro e o histórico serão preservados."))return;
    setMovingId(contact.id);setError("");
    try {
      await api("/api/backend/contacts/"+contact.id+"/remove-from-pipeline",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pipelineId})});
      setContacts(items=>items.filter(item=>item.id!==contact.id));setNotice(contact.name+" retirado do pipeline.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível retirar o contato.");}
    finally{setMovingId("");}
  }

  async function confirmFinalization() {
    if (!finalizingContact || !finalOutcome || (finalOutcome === "LOST" && !lossReason) || movingId) return;
    const contact = finalizingContact;
    setMovingId(contact.id); setError(""); setNotice("");
    try {
      const result = await api<{ contact: Contact; finalizedConversations: number; asaasSync?: { status: "SYNCED" | "PENDING"; customerId?: string; message?: string } }>("/api/backend/contacts/" + contact.id + "/finalize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: finalOutcome, reason: finalOutcome === "LOST" ? lossReason : undefined }),
      });
      setContacts((items) => items.map((item) => item.id === contact.id ? { ...item, crmStage: null, crmFinalization: { outcome: finalOutcome, ...(finalOutcome === "LOST" ? { reason: lossReason } : {}) }, ...(result.asaasSync ? { metadata: { ...(item.metadata || {}), asaasSync: { status: result.asaasSync.status, lastError: result.asaasSync.message || null }, ...(result.asaasSync.customerId ? { asaas: { ...((item.metadata?.asaas && typeof item.metadata.asaas === "object") ? item.metadata.asaas as Record<string, unknown> : {}), customerId: result.asaasSync.customerId } } : {}) } } : {}) } : item));
      const customerNotice = finalOutcome === "WON"
        ? result.asaasSync?.status === "SYNCED" ? contact.name + " convertido em cliente e sincronizado com o Asaas."
          : contact.name + " convertido em cliente; envio ao Asaas pendente. " + (result.asaasSync?.message || "A Véxora tentará novamente automaticamente.")
        : contact.name + " finalizado como perda: " + lossReason + ".";
      setNotice(customerNotice);
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

  const visibleContacts = contacts.filter((contact) => !query.trim() || [contact.name, contact.phone || "", contact.email || "", ...contactTags(contact).map(tag => tag.name), ...contactFieldSummary(contact, fieldDefinitions).map(item => item.field.name + " " + String(item.value))].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <section className="settings-workspace crm-workspace">
      <header className="settings-heading crm-heading">
        <div><h1>CRM</h1><p>Acompanhe cada oportunidade e mova os contatos pelo funil comercial.</p></div>
        <div className="crm-heading-actions"><div className="crm-pipeline-selector"><label htmlFor="crm-pipeline"><span>CRM do departamento</span><select id="crm-pipeline" value={pipelineId} onChange={e=>setPipelineId(e.target.value)}>{isAdmin&&<option value="">Todos os contatos · administração</option>}{pipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{!pipelines.length&&<small>{isAdmin?'Ative o CRM nos setores em Atendentes → Setores e permissões.':'Nenhum CRM está habilitado para seu perfil e departamento.'}</small>}</div><button className="primary-button crm-new-contact" onClick={() => { setPendingStage(null); setFormOpen((value) => !value); }}><Plus size={16} /> Novo contato</button></div>
      </header>
      <div className="crm-command-bar">
        <div className="crm-view-switch" role="tablist" aria-label="Visualização do CRM">
          <button id="crm-tab-pipeline" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "pipeline"} className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")}><LayoutGrid size={15}/> Pipeline</button>
          <button id="crm-tab-customers" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "customers"} className={view === "customers" ? "active" : ""} onClick={() => setView("customers")}><UsersRound size={15}/> Clientes <span className="crm-tab-count">{contacts.filter(isCustomer).length}</span></button>
          <button id="crm-tab-contacts" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "contacts"} className={view === "contacts" ? "active" : ""} onClick={() => setView("contacts")}><List size={15}/> Contatos <span className="crm-tab-count">{contacts.filter((contact) => !isCustomer(contact)).length}</span></button>
          <button id="crm-tab-origins" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "origins"} className={view === "origins" ? "active" : ""} onClick={() => setView("origins")}><ChartNoAxesCombined size={15}/> Inteligência Comercial</button>
          <button id="crm-tab-reports" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "reports"} className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}><ChartNoAxesCombined size={15}/> Inteligência Operacional</button>
        </div>
        {view !== "origins" && view !== "reports" ? <label className="crm-search crm-toolbar-search"><Search size={17} aria-hidden="true" /><input aria-label="Buscar contatos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contato, telefone, tag…" />{query ? <button type="button" className="crm-clear-search" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={14}/></button> : null}</label> : null}
      </div>

      {error ? <div className="settings-feedback error" role="alert">{error}<button onClick={() => setError("")} aria-label="Fechar erro"><X size={15} /></button></div> : null}
      {notice ? <div className="settings-feedback success" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div> : null}

      {formOpen ? <form className="content-card settings-card crm-form" onSubmit={createContact}>
        <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18} /></span><div><h2>Novo contato</h2><p>Os dados ficam isolados na empresa da sua sessão.</p></div></div>
        <div className="crm-form-grid">
          <label className="settings-field">Nome *<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do contato" /></label>
          <label className="settings-field">Telefone<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+55 (00) 00000-0000" /></label>
          <label className="settings-field">E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com" /></label>
          <label className="settings-field">Origem do lead<select value={leadOrigin} onChange={(event) => { setLeadOrigin(event.target.value); setLeadOriginId(""); }}><option value="">Não identificada</option><option value="Site/Formulário">Site/Formulário</option><option value="Landing Page">Landing Page</option><option value="Facebook">Facebook</option><option value="Instagram">Instagram</option><option value="Google">Google</option><option value="Campanha de WhatsApp">Campanha de WhatsApp</option><option value="Campanha de SMS">Campanha de SMS</option><option value="Campanha de Áudio">Campanha de Áudio</option><option value="Indicação">Indicação</option><option value="Evento">Evento</option><option value="Importação">Importação</option><option value="Outra">Outra</option></select>{["Landing Page","Facebook","Instagram","Google","Campanha de WhatsApp","Campanha de SMS","Campanha de Áudio"].includes(leadOrigin) ? <input value={leadOriginId} onChange={(event) => setLeadOriginId(event.target.value)} placeholder="Identificador da landing page/campanha" maxLength={120}/> : null}<small>Landing pages e campanhas usam um identificador próprio para atribuição. O canal de atendimento não define a origem automaticamente.</small></label>
        </div>
        <div className="crm-form-actions"><button className="secondary-button" type="button" onClick={() => { setPendingStage(null); setFormOpen(false); }}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : pendingStage && pendingStage !== "new" ? `Cadastrar e mover para ${stages.find(item => item.id === pendingStage)?.label}` : "Cadastrar contato"}</button></div>
      </form> : null}

      <div id="crm-tabpanel" role="tabpanel" aria-labelledby={`crm-tab-${view}`}>
      {loading ? <section className="content-card crm-loading"><span className="crm-loading-orbit"/><strong>Preparando seu pipeline</strong><p>Carregando os contatos da empresa…</p></section> : view === "pipeline" ? (
        <section className="crm-pipeline" aria-label="Pipeline comercial">
          {stages.map((stage) => {
            const columnContacts = stage.id === "finalization" ? [] : visibleContacts.filter((contact) => !isCustomer(contact) && !contact.crmFinalization && (!contact.metadata?.crmRemoved || !!contact.pipelineId) && (contact.crmStage || "new") === stage.id);
            const activeDrop = dropTarget === stage.id;
            return <div key={stage.id} className={"crm-pipeline-column tone-" + stage.tone + (activeDrop ? " drop-active" : "")}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(stage.id); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(""); }}
              onDrop={(event) => dropOnStage(event, stage.id)}>
              <header className="crm-stage-heading"><span className="crm-stage-indicator"/><div><h2>{stage.label}</h2><p>{stage.hint}</p></div><span className="crm-stage-count">{columnContacts.length}</span><button type="button" className="crm-stage-add" onClick={()=>openNewContact(stage.id as CrmStage)} aria-label={"Adicionar contato em "+stage.label} title={"Adicionar contato em "+stage.label}><Plus size={15} aria-hidden="true"/></button></header>
              <div className="crm-stage-cards">
                {columnContacts.map((contact) => <article key={contact.id} draggable onDragStart={(event) => startDrag(event, contact)} onDragEnd={() => { setDraggingId(""); setDropTarget(""); }} className={"crm-pipeline-card" + (draggingId === contact.id ? " is-dragging" : "")}>
                  <button type="button" className="crm-card-open" onClick={()=>setFichaContact(contact)} aria-label={"Abrir ficha de " + contactName(contact)}>
                    <ContactPhoto id={contact.id} name={contactName(contact)} version={contact.metadata?.avatarUrl} className="crm-contact-avatar"/>
                    <span className="crm-card-identity"><strong className="crm-card-name">{socialPlatformOfContact(contact) ? <PlatformIcon platform={socialPlatformOfContact(contact)} size={13} /> : null}{contactName(contact)}</strong><span className="crm-card-source">{contact.source || "Contato"}</span></span>
                  </button>
                  {contactTags(contact).length?<span className="crm-contact-tags">{contactTags(contact).map((tag,index)=>{const color=tag.color||"#eeecff";return <span key={tag.name+index} style={{backgroundColor:color,borderColor:color,color:tagForeground(color)}}>{tag.name}</span>})}</span>:null}
                  {contactFieldSummary(contact,fieldDefinitions).length?<span className="crm-custom-field-summary">{contactFieldSummary(contact,fieldDefinitions).map(item=><span key={item.field.key}><b>{item.field.name}:</b> {String(item.value)}</span>)}</span>:null}
                  {(contact.updatedAt||contactLeadOrigin(contact))?<span className="crm-card-meta"><Clock3 size={11} aria-hidden="true"/>Atualizado {relativeTime(contact.updatedAt)}{contactLeadOrigin(contact)?" · "+contactLeadOrigin(contact):""}</span>:null}
                  {(()=>{const order=stages.filter(s=>s.id!=="finalization");const index=Math.max(0,order.findIndex(s=>s.id===(contact.crmStage||"new")));return <div className="crm-card-progress" role="img" aria-label={"Progresso no pipeline — etapa "+(index+1)+" de "+order.length}>{order.map((s,i)=><i key={s.id} className={i<=index?"filled":""}/>)}</div>;})()}
                  {(()=>{const s=contactSecondaryLine(contact);return <span className="crm-card-detail">{s.social ? <PlatformIcon platform={s.platform} size={11}/> : <Phone size={11} aria-hidden="true"/>}{s.text}</span>})()}
                  {contact.phone && contact.email ? <span className="crm-card-detail"><Mail size={11} aria-hidden="true"/>{contact.email}</span> : null}
                  <div className="crm-card-footer"><div className="crm-card-quick" role="group" aria-label={"Ações rápidas para " + contact.name}>
                    {contact.phone?<a className="crm-quick-action is-whatsapp" href={waLink(contact.phone)} target="_blank" rel="noopener noreferrer" title="Conversar no WhatsApp" aria-label={"Chamar " + contact.name + " no WhatsApp"}><WhatsAppGlyph size={14}/></a>:null}
                    {contact.phone?<a className="crm-quick-action" href={"tel:" + contact.phone} title="Ligar" aria-label={"Ligar para " + contact.name}><Phone size={12} aria-hidden="true"/></a>:null}
                    {contact.email?<a className="crm-quick-action" href={"mailto:" + contact.email} title="Enviar e-mail" aria-label={"Enviar e-mail para " + contact.name}><Mail size={12} aria-hidden="true"/></a>:null}
                    <button type="button" className="crm-quick-action" onClick={()=>setFichaContact(contact)} title="Abrir ficha" aria-label={"Abrir ficha de " + contactName(contact)}><UserRound size={12} aria-hidden="true"/></button>
                  </div><label className="crm-move-label"><select aria-label={"Mover " + contactName(contact) + " para outra etapa"} value={stage.id} disabled={movingId === contact.id} onChange={(event) => void moveContact(contact, event.target.value as CrmStage)}>{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>{pipelineId?<button type="button" className="crm-remove-button" disabled={!!movingId} onClick={()=>void removeFromPipeline(contact)} aria-label={"Retirar "+contact.name+" do pipeline"} title="Retirar do pipeline"><X size={14} aria-hidden="true" /></button>:null}</div>
                </article>)}
                {!columnContacts.length ? <button type="button" className={"crm-stage-empty" + (activeDrop ? " is-lit" : "")} onClick={()=>openNewContact(stage.id as CrmStage)} aria-label={"Adicionar contato em " + stage.label}><span>{activeDrop ? <Check size={17}/> : <Plus size={17}/>}</span><strong>{activeDrop ? "Solte para mover" : "Sem contatos nesta etapa"}</strong><small>{activeDrop ? (stage.id === "finalization" ? "Escolha ganho ou perda" : "O pipeline será atualizado") : (stage.id === "finalization" ? "Arraste um contato para registrar o resultado" : "Clique em + para cadastrar ou arraste um cartão para cá")}</small></button> : null}
              </div>
            </div>;
          })}
        </section>
      ) : view === "origins" ? <LeadOriginsWorkspace /> : view === "reports" ? <ReportsWorkspace /> : (() => {
        const customerView = view === "customers";
        const rows = visibleContacts.filter((contact) => customerView ? isCustomer(contact) : !isCustomer(contact));
        const heading = customerView ? "Clientes" : "Contatos";
        return <section className="content-card settings-card crm-contacts-card">
          <div className="settings-card-heading"><span className="settings-icon"><UsersRound size={18} /></span><div><h2>{heading}</h2><p>{rows.length} {rows.length === 1 ? (customerView ? "cliente encontrado" : "contato encontrado") : (customerView ? "clientes encontrados" : "contatos encontrados")}</p></div></div>
          {customerView ? <div className="crm-customer-note"><strong>Cadastro de clientes</strong><span>Clientes vinculados ao Asaas são sincronizados e protegidos contra exclusão pela Véxora. Atualizações financeiras devem respeitar o cadastro de origem.</span></div> : null}
          {rows.length ? <div className="crm-contact-list">{rows.map((contact) => { const asaasCustomer = isAsaasCustomer(contact); return <article className="crm-contact-row" key={contact.id}>
            <button type="button" className="crm-contact-row-open" onClick={()=>setFichaContact(contact)} aria-label={"Abrir ficha de " + contactName(contact)}>
            <ContactPhoto id={contact.id} name={contactName(contact)} version={contact.metadata?.avatarUrl} className="crm-contact-avatar"/><div className="crm-contact-main"><strong>{socialPlatformOfContact(contact) ? <PlatformIcon platform={socialPlatformOfContact(contact)} size={13}/> : null}{contactName(contact)}</strong><span>{(()=>{const s=contactSecondaryLine(contact);return s.social ? <span className="crm-social-line"><PlatformIcon platform={s.platform} size={12}/>{s.text}</span> : (readablePhone(contact.phone) || "Sem telefone") + (contact.email ? " · " + contact.email : "");})()}</span>{contactTags(contact).length?<span className="crm-contact-tags">{contactTags(contact).map((tag,index)=>{const color=tag.color||"#eeecff";return <span key={tag.name+index} style={{backgroundColor:color,borderColor:color,color:tagForeground(color)}}>{tag.name}</span>})}</span>:null}{contactFieldSummary(contact,fieldDefinitions).length?<span className="crm-custom-field-summary">{contactFieldSummary(contact,fieldDefinitions).map(item=><span key={item.field.key}><b>{item.field.name}:</b> {String(item.value)}</span>)}</span>:null}{contact.updatedAt?<span className="crm-card-meta"><Clock3 size={11} aria-hidden="true"/>Atualizado {relativeTime(contact.updatedAt)}{contactLeadOrigin(contact)?" · "+contactLeadOrigin(contact):""}</span>:null}</div>
            </button>
            {customerView ? <span className={"crm-customer-origin" + (asaasCustomer ? " is-asaas" : "") + ((contact.metadata?.asaasSync && typeof contact.metadata.asaasSync === "object" && (contact.metadata.asaasSync as Record<string, unknown>).status === "PENDING") ? " is-pending" : "")}>{contact.metadata?.asaasSync && typeof contact.metadata.asaasSync === "object" && (contact.metadata.asaasSync as Record<string, unknown>).status === "PENDING" ? "Asaas pendente" : asaasCustomer ? "Asaas sincronizado" : "Cliente Véxora"}</span> : contact.crmFinalization ? <span className={"crm-stage-pill tone-rose"}><span>{"Perda · " + (contact.crmFinalization.reason || "Motivo registrado")}</span></span> : <label className={"crm-stage-pill tone-" + stages.find((stage) => stage.id === (contact.crmStage || "new"))?.tone}><span>{stages.find((stage) => stage.id === (contact.crmStage || "new"))?.label}</span><select aria-label={"Etapa de " + contactName(contact)} value={contact.crmStage || "new"} onChange={(event) => void moveContact(contact, event.target.value as CrmStage)}>{stages.filter((stage) => stage.id !== "finalization").map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>}
          </article>; })}</div> : <div className="empty-state crm-empty"><span className="empty-illustration"><UsersRound size={24} /></span><h3>{query.trim() ? "Nenhum registro encontrado" : customerView ? "Nenhum cliente cadastrado" : "Nenhum contato cadastrado"}</h3><p>{query.trim() ? "Tente outro nome, telefone ou e-mail." : customerView ? "Clientes convertidos pelo CRM ou sincronizados do Asaas aparecerão aqui." : "Cadastre um contato para começar a organizar seu relacionamento comercial."}</p>{!customerView ? <button className="secondary-button" onClick={() => setFormOpen(true)}><Plus size={15} /> Cadastrar contato</button> : null}</div>}
        </section>;
      })()}

      </div>

      {fichaContact ? <VexoraDialog open wide title={fichaContact.name} subtitle={fichaContact.crmFinalization ? (fichaContact.crmFinalization.outcome === "WON" ? "Cliente · Ganho" : "Perda · " + (fichaContact.crmFinalization.reason || "Motivo registrado")) : "Lead · etapa " + (stages.find((stage) => stage.id === (fichaContact.crmStage || "new"))?.label || "Novos")} icon={<ContactPhoto id={fichaContact.id} name={fichaContact.name} version={fichaContact.metadata?.avatarUrl} className="crm-contact-avatar crm-ficha-avatar"/>} onClose={() => { setFichaContact(null); void loadContacts(query); }} footer={<button type="button" className="primary-button" onClick={() => { setFichaContact(null); void loadContacts(query); }}>Concluir</button>}>
        <ContactProfilePanel key={fichaContact.id} contact={{ id: fichaContact.id, name: fichaContact.name, phone: fichaContact.phone, email: fichaContact.email, source: fichaContact.source, metadata: fichaContact.metadata }} conversationId="" channel={fichaContact.source || undefined} bare hideToggle expanded onExpandedChange={() => {}} statusPill={fichaContact.crmFinalization ? <span className={"profile-status-pill " + (fichaContact.crmFinalization.outcome === "WON" ? "done" : "")}>{fichaContact.crmFinalization.outcome === "WON" ? "Cliente · Ganho" : "Perda · " + (fichaContact.crmFinalization.reason || "Motivo registrado")}</span> : <span className="profile-status-pill">{"Etapa · " + (stages.find((stage) => stage.id === (fichaContact.crmStage || "new"))?.label || "Novos")}</span>} />
      </VexoraDialog> : null}
      {finalizingContact ? <div className="finalization-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !movingId) setFinalizingContact(null); }}><section ref={modalRef} tabIndex={-1} className="finalization-dialog" role="dialog" aria-modal="true" aria-labelledby="crm-finalization-title"><button type="button" className="finalization-close" aria-label="Fechar" disabled={!!movingId} onClick={() => setFinalizingContact(null)}><X size={18}/></button><span className="finalization-icon"><Check size={22}/></span><h2 id="crm-finalization-title">Finalizar oportunidade</h2><p>Qual foi o resultado comercial de <strong>{finalizingContact.name}</strong>?</p><div className="finalization-outcomes"><button type="button" className={finalOutcome === "WON" ? "selected won" : "won"} onClick={() => { setFinalOutcome("WON"); setLossReason(""); }}><Check size={17}/><span><strong>Ganho</strong><small>Concluir o item</small></span></button><button type="button" className={finalOutcome === "LOST" ? "selected lost" : "lost"} onClick={() => setFinalOutcome("LOST")}><X size={17}/><span><strong>Perda</strong><small>Registrar motivo da perda</small></span></button></div>{finalOutcome === "LOST" ? <label className="finalization-reason">Motivo da perda<select required value={lossReason} onChange={(event) => setLossReason(event.target.value)}><option value="">Selecione o motivo…</option>{lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label> : null}<p className="finalization-note">A finalização remove o contato do Kanban e encerra as conversas abertas. O histórico permanece em Contatos.</p><div className="finalization-actions"><button type="button" className="secondary-button" disabled={!!movingId} onClick={() => setFinalizingContact(null)}>Cancelar</button><button type="button" className="primary-button" disabled={!finalOutcome || (finalOutcome === "LOST" && !lossReason) || !!movingId} onClick={() => void confirmFinalization()}>{movingId ? "Finalizando…" : "Confirmar finalização"}</button></div></section></div> : null}
    </section>
  );
}

