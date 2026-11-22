"use client";
import { ContactPhoto } from "./contact-photo";
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

/** Utilities TW da fatia de formulário, lista e diálogos do CRM. */
const primaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonMt = "mt-2 inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const cardTw = "grid min-w-0 gap-2.5 rounded-token border border-gray-200 bg-zinc-100 p-pad shadow-token";
const cardHeadingTw = "flex min-w-0 items-center justify-start gap-3";
const formHeadingTw = "mb-1 flex min-w-0 items-center justify-start gap-3";
const iconTw = "grid h-crm-icon w-crm-icon flex-none place-items-center rounded-crm-icon bg-blue-50 text-blue-800";
const formGridTw = "grid grid-cols-crm-form gap-3 max-w-crm-form";
const fieldTw = "grid gap-1.5 text-crm-field font-semibold text-slate-600";
const fieldControlTw = "min-h-9 w-full min-w-0 rounded-token-sm border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-small text-slate-950 outline-hidden focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30";
const formActionsTw = "mt-4 flex flex-wrap items-center justify-end gap-2";
const finalWonTw = "flex min-h-crm-outcome items-center gap-3 rounded-brand border-2 border-gray-200 bg-zinc-200 px-3.5 py-3 text-left transition-colors hover:border-emerald-600";
const finalWonSelectedTw = "flex min-h-crm-outcome items-center gap-3 rounded-brand border-2 border-emerald-600 bg-emerald-100 px-3.5 py-3 text-left transition-colors";
const finalLostTw = "flex min-h-crm-outcome items-center gap-3 rounded-brand border-2 border-gray-200 bg-zinc-200 px-3.5 py-3 text-left transition-colors hover:border-red-600";
const finalLostSelectedTw = "flex min-h-crm-outcome items-center gap-3 rounded-brand border-2 border-red-600 bg-red-100 px-3.5 py-3 text-left transition-colors";

const defaultStages: { id: CrmStage; label: string; hint: string; tone: string }[] = [
  { id: "new", label: "Novos", hint: "Entraram no CRM", tone: "violet" },
  { id: "qualification", label: "Qualificação", hint: "Entenda a oportunidade", tone: "rose" },
  { id: "proposal", label: "Proposta", hint: "Em negociação", tone: "amber" },
  { id: "finalization", label: "Finalização", hint: "Registrar o resultado", tone: "green" },
];

/** Tons das etapas em utilities TW. A marca continua vinda de --primary. */
const stageTones = {
  violet: {
    dot: "bg-violet-500",
    halo: "ring-4 ring-violet-500/20",
    count: "bg-violet-500/15 text-violet-700 ring-1 ring-inset ring-violet-500/25 dark:text-violet-300",
    title: "text-violet-700 dark:text-violet-300",
    empty: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  rose: {
    dot: "bg-rose-500",
    halo: "ring-4 ring-rose-500/20",
    count: "bg-rose-500/15 text-rose-700 ring-1 ring-inset ring-rose-500/25 dark:text-rose-300",
    title: "text-rose-700 dark:text-rose-300",
    empty: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  amber: {
    dot: "bg-amber-500",
    halo: "ring-4 ring-amber-500/20",
    count: "bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300",
    title: "text-amber-700 dark:text-amber-300",
    empty: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  /* O contrato mantém a chave "green"; o tom visual é azul-700 (verde só em WhatsApp/dados). */
  green: {
    dot: "bg-blue-700",
    halo: "ring-4 ring-blue-700/20",
    count: "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-700/25",
    title: "text-blue-800",
    empty: "bg-blue-50 text-blue-800",
  },
  blue: {
    dot: "bg-blue-600",
    halo: "ring-4 ring-blue-600/20",
    count: "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-600/25",
    title: "text-blue-800",
    empty: "bg-blue-50 text-blue-800",
  },
} as const;

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
    <section className="grid min-w-0 grid-cols-1 content-start gap-token">
      <header data-testid="crm-header" className="flex flex-wrap items-center justify-between gap-4 pb-1.5 print:hidden">
        <div><h1 className="text-h1 font-heading text-slate-950">CRM</h1><p className="mt-0.5 max-w-crm-copy text-small text-slate-600">Acompanhe cada oportunidade e mova os contatos pelo funil comercial.</p></div>
        <div className="flex w-full flex-wrap items-center justify-start gap-3 md:w-auto md:justify-end"><div className="grid min-w-0 gap-1"><label htmlFor="crm-pipeline" className="grid gap-1.5"><span className="text-2xs font-extrabold uppercase tracking-nav-section text-slate-600">CRM do departamento</span><select id="crm-pipeline" value={pipelineId} onChange={e=>setPipelineId(e.target.value)} className="min-h-control min-w-crm-select max-w-crm-select appearance-none rounded-token-sm border border-gray-200 bg-zinc-100 px-3 pr-8 text-body font-semibold text-slate-950">{isAdmin&&<option value="">Todos os contatos · administração</option>}{pipelines.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{!pipelines.length&&<small className="max-w-crm-select text-small text-slate-600">{isAdmin?'Ative o CRM nos setores em Atendentes → Setores e permissões.':'Nenhum CRM está habilitado para seu perfil e departamento.'}</small>}</div><button className={primaryButton} onClick={() => { setPendingStage(null); setFormOpen((value) => !value); }}><Plus size={16} aria-hidden="true" /> Novo contato</button></div>
      </header>
      <div data-testid="crm-command-bar" className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 py-2.5 print:hidden">
        <div role="tablist" aria-label="Visualização do CRM" className="inline-flex gap-1 rounded-full border border-gray-200 bg-zinc-100 p-1">
          <button id="crm-tab-pipeline" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "pipeline"} className={"inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-small font-bold transition-colors duration-control " + (view === "pipeline" ? "bg-blue-600 text-blue-900" : "text-slate-600 hover:bg-zinc-300 hover:text-slate-950")} onClick={() => setView("pipeline")}><LayoutGrid size={15}/> Pipeline</button>
          <button id="crm-tab-customers" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "customers"} className={"inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-small font-bold transition-colors duration-control " + (view === "customers" ? "bg-blue-600 text-blue-900" : "text-slate-600 hover:bg-zinc-300 hover:text-slate-950")} onClick={() => setView("customers")}><UsersRound size={15}/> Clientes <span className={(view === "customers" ? "bg-blue-50 text-blue-800" : "bg-zinc-300 text-slate-600") + " inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-2xs font-extrabold"}>{contacts.filter(isCustomer).length}</span></button>
          <button id="crm-tab-contacts" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "contacts"} className={"inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-small font-bold transition-colors duration-control " + (view === "contacts" ? "bg-blue-600 text-blue-900" : "text-slate-600 hover:bg-zinc-300 hover:text-slate-950")} onClick={() => setView("contacts")}><List size={15}/> Contatos <span className={(view === "contacts" ? "bg-blue-50 text-blue-800" : "bg-zinc-300 text-slate-600") + " inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-2xs font-extrabold"}>{contacts.filter((contact) => !isCustomer(contact)).length}</span></button>
          <button id="crm-tab-origins" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "origins"} className={"inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-small font-bold transition-colors duration-control " + (view === "origins" ? "bg-blue-600 text-blue-900" : "text-slate-600 hover:bg-zinc-300 hover:text-slate-950")} onClick={() => setView("origins")}><ChartNoAxesCombined size={15}/> Inteligência Comercial</button>
          <button id="crm-tab-reports" role="tab" aria-controls="crm-tabpanel" aria-selected={view === "reports"} className={"inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-small font-bold transition-colors duration-control " + (view === "reports" ? "bg-blue-600 text-blue-900" : "text-slate-600 hover:bg-zinc-300 hover:text-slate-950")} onClick={() => setView("reports")}><ChartNoAxesCombined size={15}/> Inteligência Operacional</button>
        </div>
        {view !== "origins" && view !== "reports" ? <label className="ml-0 flex w-full max-w-crm-search items-center gap-2.5 rounded-token-sm border border-gray-200 bg-zinc-100 px-3.5 md:ml-auto"><Search size={17} aria-hidden="true" /><input aria-label="Buscar contatos" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contato, telefone, tag…" className="min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-slate-950 shadow-none outline-hidden" />{query ? <button type="button" className="grid h-4 w-4 flex-none place-items-center rounded-token-sm text-slate-600 hover:bg-zinc-300" onClick={() => setQuery("")} aria-label="Limpar busca"><X size={14}/></button> : null}</label> : null}
      </div>

      {error ? <div role="alert" className="mb-token flex items-center justify-between gap-3 rounded-token-sm border border-red-600 bg-red-100 px-3 py-2.5 text-small text-red-600">{error}<button type="button" onClick={() => setError("")} aria-label="Fechar erro" className="grid h-5 w-5 flex-none place-items-center rounded-token-sm transition-colors hover:bg-red-600/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><X size={15} aria-hidden="true" /></button></div> : null}
      {notice ? <div role="status" className="mb-token flex items-center justify-between gap-3 rounded-token-sm border border-emerald-600 bg-emerald-100 px-3 py-2.5 text-small text-emerald-600">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso" className="grid h-5 w-5 flex-none place-items-center rounded-token-sm transition-colors hover:bg-emerald-600/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><X size={15} aria-hidden="true" /></button></div> : null}

      {formOpen ? <form className={cardTw} onSubmit={createContact}>
        <div className={formHeadingTw}><span className={iconTw}><UsersRound size={18} aria-hidden="true" /></span><div className="min-w-0"><h2 className="m-0 text-h4 font-extrabold text-slate-950">Novo contato</h2><p className="mt-0.5 text-small leading-relaxed text-slate-600">Os dados ficam isolados na empresa da sua sessão.</p></div></div>
        <div className={formGridTw}>
          <label className={fieldTw}>Nome *<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do contato" className={fieldControlTw} /></label>
          <label className={fieldTw}>Telefone<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" className={fieldControlTw} /></label>
          <label className={fieldTw}>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@empresa.com" className={fieldControlTw} /></label>
          <label className={fieldTw}>Origem do lead<select value={leadOrigin} onChange={(event) => { setLeadOrigin(event.target.value); setLeadOriginId(""); }} className={fieldControlTw}><option value="">Não identificada</option><option value="Site/Formulário">Site/Formulário</option><option value="Landing Page">Landing Page</option><option value="Facebook">Facebook</option><option value="Instagram">Instagram</option><option value="Google">Google</option><option value="Campanha de WhatsApp">Campanha de WhatsApp</option><option value="Campanha de SMS">Campanha de SMS</option><option value="Campanha de Áudio">Campanha de Áudio</option><option value="Indicação">Indicação</option><option value="Evento">Evento</option><option value="Importação">Importação</option><option value="Outra">Outra</option></select>{["Landing Page","Facebook","Instagram","Google","Campanha de WhatsApp","Campanha de SMS","Campanha de Áudio"].includes(leadOrigin) ? <input value={leadOriginId} onChange={(event) => setLeadOriginId(event.target.value)} placeholder="Identificador da landing page/campanha" maxLength={120} className={fieldControlTw} /> : null}<small className="text-2xs leading-relaxed text-slate-600">Landing pages e campanhas usam um identificador próprio para atribuição. O canal de atendimento não define a origem automaticamente.</small></label>
        </div>
        <div className={formActionsTw}><button className={secondaryButton} type="button" onClick={() => { setPendingStage(null); setFormOpen(false); }}>Cancelar</button><button className={primaryButton} type="submit" disabled={saving}>{saving ? "Salvando..." : pendingStage && pendingStage !== "new" ? `Cadastrar e mover para ${stages.find(item => item.id === pendingStage)?.label}` : "Cadastrar contato"}</button></div>
      </form> : null}

      <div id="crm-tabpanel" role="tabpanel" aria-labelledby={`crm-tab-${view}`}>
      {loading ? <section data-testid="crm-loading" className="flex flex-col items-center gap-3 px-5 py-crm-loading-y text-center text-slate-600">
        <span aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        <strong className="text-h4 text-slate-950">Preparando seu pipeline</strong>
        <p className="text-small">Carregando os contatos da empresa…</p>
      </section> : view === "pipeline" ? (
        <section data-testid="crm-pipeline" aria-label="Pipeline comercial" className="grid snap-x snap-proximity grid-flow-col auto-cols-crm-stage items-start gap-3.5 overflow-x-auto p-1 pb-3.5">
          {stages.map((stage) => {
            const columnContacts = stage.id === "finalization" ? [] : visibleContacts.filter((contact) => !isCustomer(contact) && !contact.crmFinalization && (!contact.metadata?.crmRemoved || !!contact.pipelineId) && (contact.crmStage || "new") === stage.id);
            const activeDrop = dropTarget === stage.id;
            const tone = stageTones[stage.tone as keyof typeof stageTones] ?? stageTones.blue;
            return <div key={stage.id}
              className={"flex min-h-crm-column max-h-crm-column snap-start flex-col gap-2.5 rounded-token-lg border border-transparent border-t-crm-stage bg-linear-to-b from-blue-50 to-zinc-200 p-3.5 shadow-token transition-shadow duration-control " + (activeDrop ? "border-blue-600 border-t-blue-600 shadow-token-lg ring-4 ring-blue-600/30" : "")}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(stage.id); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(""); }}
              onDrop={(event) => dropOnStage(event, stage.id)}>
              <header className="flex min-h-crm-heading items-start gap-2 border-b border-dashed border-gray-200 pb-2.5 text-left">
                <span aria-hidden="true" className={"mt-1 h-2.5 w-2.5 flex-none rounded-full " + tone.dot + " " + tone.halo} />
                <div className="min-w-0 flex-1">
                  <h2 className={"truncate text-h4 font-extrabold tracking-tight " + tone.title}>{stage.label}</h2>
                  <p className="mt-0.5 truncate text-small text-slate-600">{stage.hint}</p>
                </div>
                <span className={"inline-grid h-6 min-w-6 flex-none place-items-center rounded-full px-2 text-2xs font-extrabold " + tone.count}>{columnContacts.length}</span>
                <button type="button" className="grid h-7 w-7 flex-none place-items-center rounded-full border border-gray-200 bg-zinc-100 text-slate-600 transition-transform duration-control hover:rotate-90 hover:border-blue-600 hover:bg-blue-600 hover:text-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={()=>openNewContact(stage.id as CrmStage)} aria-label={"Adicionar contato em "+stage.label} title={"Adicionar contato em "+stage.label}><Plus size={15} aria-hidden="true"/></button>
              </header>
              <div className="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto p-0.5">
                {columnContacts.map((contact) => <article key={contact.id} draggable onDragStart={(event) => startDrag(event, contact)} onDragEnd={() => { setDraggingId(""); setDropTarget(""); }} className={"group relative grid min-h-crm-card min-w-0 gap-2 overflow-hidden rounded-2xl border border-gray-200 bg-zinc-100 p-3 shadow-token-sm transition-all duration-control hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-token-lg " + (draggingId === contact.id ? "scale-105 cursor-grabbing opacity-60" : "cursor-grab")}>
                  <span aria-hidden="true" className={"pointer-events-none absolute inset-y-0 left-0 w-crm-accent bg-linear-to-b to-transparent opacity-0 transition-opacity group-hover:opacity-100 " + tone.dot} />
                  <button type="button" className="flex w-full min-w-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={()=>setFichaContact(contact)} aria-label={"Abrir ficha de " + contactName(contact)}>
                    <ContactPhoto id={contact.id} name={contactName(contact)} version={contact.metadata?.avatarUrl} className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full bg-blue-600 text-body font-extrabold text-white shadow-token-sm ring-2 ring-zinc-100" />
                    <span className="grid min-w-0 gap-0.5">
                      <strong className="truncate text-h4 font-extrabold tracking-tight text-slate-950 group-hover:text-blue-800">{socialPlatformOfContact(contact) ? <PlatformIcon platform={socialPlatformOfContact(contact)} size={13} /> : null}{contactName(contact)}</strong>
                      <span className="mt-0.5 block max-w-full truncate text-2xs font-extrabold uppercase tracking-wide text-slate-600">{contact.source || "Contato"}</span>
                    </span>
                  </button>
                  {contactTags(contact).length?<span className="flex flex-wrap gap-1">{contactTags(contact).map((tag,index)=>{const color=tag.color||"#eeecff";return <span key={tag.name+index} style={{backgroundColor:color,borderColor:color,color:tagForeground(color)}} className="rounded-full border px-2 py-0.5 text-2xs font-extrabold uppercase">{tag.name}</span>})}</span>:null}
                  {contactFieldSummary(contact,fieldDefinitions).length?<span className="flex flex-wrap gap-3 text-small text-slate-600">{contactFieldSummary(contact,fieldDefinitions).map(item=><span key={item.field.key}><b className="font-extrabold text-slate-950">{item.field.name}:</b> {String(item.value)}</span>)}</span>:null}
                  {(contact.updatedAt||contactLeadOrigin(contact))?<span className="flex min-w-0 items-center gap-1.5 truncate text-2xs tabular-nums text-slate-600"><Clock3 size={11} aria-hidden="true" className="flex-none"/>Atualizado {relativeTime(contact.updatedAt)}{contactLeadOrigin(contact)?" · "+contactLeadOrigin(contact):""}</span>:null}
                  {(()=>{const order=stages.filter(s=>s.id!=="finalization");const index=Math.max(0,order.findIndex(s=>s.id===(contact.crmStage||"new")));return <div className="mt-px flex gap-1" role="img" aria-label={"Progresso no pipeline — etapa "+(index+1)+" de "+order.length}>{order.map((s,i)=><i key={s.id} className={"h-0.5 flex-1 rounded-full " + (i<=index ? tone.dot : "bg-gray-300")}/>)}</div>;})()}
                  {(()=>{const s=contactSecondaryLine(contact);return <span className="flex items-center gap-1.5 text-small tabular-nums text-slate-600"><span aria-hidden="true" className="h-1 w-1 flex-none rounded-full bg-emerald-600 opacity-90"/>{s.social ? <PlatformIcon platform={s.platform} size={11}/> : <Phone size={11} aria-hidden="true" className="flex-none"/>}{s.text}</span>})()}
                  {contact.phone && contact.email ? <span className="flex items-center gap-1.5 text-small tabular-nums text-slate-600"><span aria-hidden="true" className="h-1 w-1 flex-none rounded-full bg-emerald-600 opacity-90"/><Mail size={11} aria-hidden="true" className="flex-none"/>{contact.email}</span> : null}
                  <div className="mt-0.5 flex items-center justify-between gap-2 border-t border-dashed border-gray-200 pt-2.5"><div className="flex flex-none items-center gap-1.5" role="group" aria-label={"Ações rápidas para " + contact.name}>
                    {contact.phone?<a className="grid h-7 w-7 place-items-center rounded-full border border-blue-600/40 bg-blue-50 text-blue-800 transition-all hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-100 hover:shadow-token-sm" href={waLink(contact.phone)} target="_blank" rel="noopener noreferrer" title="Conversar no WhatsApp" aria-label={"Chamar " + contact.name + " no WhatsApp"}><WhatsAppGlyph size={14}/></a>:null}
                    {contact.phone?<a className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 bg-zinc-200 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:shadow-token-sm" href={"tel:" + contact.phone} title="Ligar" aria-label={"Ligar para " + contact.name}><Phone size={12} aria-hidden="true"/></a>:null}
                    {contact.email?<a className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 bg-zinc-200 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:shadow-token-sm" href={"mailto:" + contact.email} title="Enviar e-mail" aria-label={"Enviar e-mail para " + contact.name}><Mail size={12} aria-hidden="true"/></a>:null}
                    <button type="button" className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 bg-zinc-200 text-slate-600 transition-all hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-800 hover:shadow-token-sm" onClick={()=>setFichaContact(contact)} title="Abrir ficha" aria-label={"Abrir ficha de " + contactName(contact)}><UserRound size={12} aria-hidden="true"/></button>
                  </div><label className="min-w-0 flex-1"><select aria-label={"Mover " + contactName(contact) + " para outra etapa"} value={stage.id} disabled={movingId === contact.id} onChange={(event) => void moveContact(contact, event.target.value as CrmStage)} className="min-h-8 w-full min-w-0 appearance-none rounded-lg border border-gray-200 bg-zinc-200 px-2.5 text-small font-bold text-slate-950">{stages.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>{pipelineId?<button type="button" className="grid h-8 w-8 flex-none place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={!!movingId} onClick={()=>void removeFromPipeline(contact)} aria-label={"Retirar "+contact.name+" do pipeline"} title="Retirar do pipeline"><X size={14} aria-hidden="true" /></button>:null}</div>
                </article>)}
                {!columnContacts.length ? <button type="button" className={"group/empty flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 px-3.5 py-6 text-center text-slate-600 transition-all hover:-translate-y-px hover:border-blue-600/40 hover:bg-blue-50 " + (activeDrop ? "border-solid border-blue-600 bg-blue-50" : "")} onClick={()=>openNewContact(stage.id as CrmStage)} aria-label={"Adicionar contato em " + stage.label}><span className={"grid h-10 w-10 place-items-center rounded-full ring-1 ring-inset ring-gray-200 transition-transform group-hover/empty:rotate-90 " + tone.empty}>{activeDrop ? <Check size={17}/> : <Plus size={17}/>}</span><strong className="text-h4 text-slate-950">{activeDrop ? "Solte para mover" : "Sem contatos nesta etapa"}</strong><small className="text-2xs leading-relaxed text-slate-600">{activeDrop ? (stage.id === "finalization" ? "Escolha ganho ou perda" : "O pipeline será atualizado") : (stage.id === "finalization" ? "Arraste um contato para registrar o resultado" : "Clique em + para cadastrar ou arraste um cartão para cá")}</small></button> : null}
              </div>
            </div>;
          })}
        </section>
      ) : view === "origins" ? <LeadOriginsWorkspace /> : view === "reports" ? <ReportsWorkspace /> : (() => {
        const customerView = view === "customers";
        const rows = visibleContacts.filter((contact) => customerView ? isCustomer(contact) : !isCustomer(contact));
        const heading = customerView ? "Clientes" : "Contatos";
        return <section className={cardTw}>
          <div className={cardHeadingTw}><span className={iconTw}><UsersRound size={18} aria-hidden="true" /></span><div className="min-w-0"><h2 className="m-0 text-h4 font-extrabold text-slate-950">{heading}</h2><p className="mt-0.5 text-small leading-relaxed text-slate-600">{rows.length} {rows.length === 1 ? (customerView ? "cliente encontrado" : "contato encontrado") : (customerView ? "clientes encontrados" : "contatos encontrados")}</p></div></div>
          {customerView ? <div className="mb-4 flex items-center gap-3 rounded-brand border border-emerald-600/30 bg-emerald-100 px-3.5 py-3"><strong className="flex-none text-2xs font-extrabold uppercase tracking-wider text-blue-700">Cadastro de clientes</strong><span className="text-channels-meta text-slate-600">Clientes vinculados ao Asaas são sincronizados e protegidos contra exclusão pela Véxora. Atualizações financeiras devem respeitar o cadastro de origem.</span></div> : null}
          {rows.length ? <div className="mt-2.5 grid gap-2">{rows.map((contact) => { const asaasCustomer = isAsaasCustomer(contact); return <article className="flex items-center gap-3 rounded-brand border border-gray-200 bg-zinc-200 px-3.5 py-3 transition-all duration-control hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-token-sm" key={contact.id}>
            <button type="button" className="group flex min-w-0 flex-1 items-center gap-3 rounded-token-sm p-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={()=>setFichaContact(contact)} aria-label={"Abrir ficha de " + contactName(contact)}>
            <ContactPhoto id={contact.id} name={contactName(contact)} version={contact.metadata?.avatarUrl} className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-full bg-blue-600 text-h4 font-extrabold text-white shadow-token-sm ring-2 ring-zinc-100"/><div className="grid min-w-0 flex-1 gap-0.5"><strong className="text-h4 transition-colors group-hover:text-blue-800">{socialPlatformOfContact(contact) ? <PlatformIcon platform={socialPlatformOfContact(contact)} size={13}/> : null}{contactName(contact)}</strong><span className="text-small text-slate-600">{(()=>{const s=contactSecondaryLine(contact);return s.social ? <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600"><PlatformIcon platform={s.platform} size={12}/>{s.text}</span> : (readablePhone(contact.phone) || "Sem telefone") + (contact.email ? " · " + contact.email : "");})()}</span>{contactTags(contact).length?<span className="mt-0.5 flex flex-wrap gap-1">{contactTags(contact).map((tag,index)=>{const color=tag.color||"#eeecff";return <span key={tag.name+index} style={{backgroundColor:color,borderColor:color,color:tagForeground(color)}} className="rounded-token-sm border px-1.5 py-0.5 text-2xs font-extrabold uppercase">{tag.name}</span>})}</span>:null}{contactFieldSummary(contact,fieldDefinitions).length?<span className="mt-0.5 flex flex-wrap gap-3 text-2xs text-slate-600">{contactFieldSummary(contact,fieldDefinitions).map(item=><span key={item.field.key}><b className="font-bold text-slate-950">{item.field.name}:</b> {String(item.value)}</span>)}</span>:null}{contact.updatedAt?<span className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-asaas-muted tabular-nums text-slate-600"><Clock3 size={11} aria-hidden="true"/>Atualizado {relativeTime(contact.updatedAt)}{contactLeadOrigin(contact)?" · "+contactLeadOrigin(contact):""}</span>:null}</div>
            </button>
            {customerView ? <span className={"inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-extrabold uppercase tracking-wide " + (asaasCustomer ? "border-blue-600/30 bg-blue-50 text-blue-600" : "border-gray-200 bg-zinc-300 text-slate-600") + ((contact.metadata?.asaasSync && typeof contact.metadata.asaasSync === "object" && (contact.metadata.asaasSync as Record<string, unknown>).status === "PENDING") ? " border-amber-600/35 bg-amber-100 text-amber-600" : "")}>{contact.metadata?.asaasSync && typeof contact.metadata.asaasSync === "object" && (contact.metadata.asaasSync as Record<string, unknown>).status === "PENDING" ? "Asaas pendente" : asaasCustomer ? "Asaas sincronizado" : "Cliente Véxora"}</span> : contact.crmFinalization ? <span className="inline-flex flex-none items-center gap-2"><span className="inline-flex items-center text-2xs font-extrabold uppercase tracking-wide text-rose-700">{"Perda · " + (contact.crmFinalization.reason || "Motivo registrado")}</span></span> : <label className="inline-flex flex-none items-center gap-2"><span className="inline-flex items-center text-2xs font-extrabold uppercase tracking-wide text-slate-600">{stages.find((stage) => stage.id === (contact.crmStage || "new"))?.label}</span><select aria-label={"Etapa de " + contactName(contact)} value={contact.crmStage || "new"} onChange={(event) => void moveContact(contact, event.target.value as CrmStage)}>{stages.filter((stage) => stage.id !== "finalization").map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label>}
          </article>; })}</div> : <div className="grid content-center justify-items-center gap-2 px-4 py-7 text-center text-slate-600"><span className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-800"><UsersRound size={24} aria-hidden="true" /></span><h3 className="text-h3 font-extrabold text-slate-950">{query.trim() ? "Nenhum registro encontrado" : customerView ? "Nenhum cliente cadastrado" : "Nenhum contato cadastrado"}</h3><p className="mt-0.5 text-small text-slate-600">{query.trim() ? "Tente outro nome, telefone ou e-mail." : customerView ? "Clientes convertidos pelo CRM ou sincronizados do Asaas aparecerão aqui." : "Cadastre um contato para começar a organizar seu relacionamento comercial."}</p>{!customerView ? <button className={secondaryButtonMt} onClick={() => setFormOpen(true)}><Plus size={15} aria-hidden="true" /> Cadastrar contato</button> : null}</div>}
        </section>;
      })()}

      </div>

      {fichaContact ? <VexoraDialog open wide title={fichaContact.name} subtitle={fichaContact.crmFinalization ? (fichaContact.crmFinalization.outcome === "WON" ? "Cliente · Ganho" : "Perda · " + (fichaContact.crmFinalization.reason || "Motivo registrado")) : "Lead · etapa " + (stages.find((stage) => stage.id === (fichaContact.crmStage || "new"))?.label || "Novos")} icon={<ContactPhoto id={fichaContact.id} name={fichaContact.name} version={fichaContact.metadata?.avatarUrl} className="grid h-crm-ficha-avatar w-crm-ficha-avatar flex-none place-items-center overflow-hidden rounded-full bg-blue-600 text-h4 font-extrabold text-white ring-2 ring-zinc-100"/>} onClose={() => { setFichaContact(null); void loadContacts(query); }} footer={<button type="button" className={primaryButton} onClick={() => { setFichaContact(null); void loadContacts(query); }}>Concluir</button>}>
        <ContactProfilePanel key={fichaContact.id} contact={{ id: fichaContact.id, name: fichaContact.name, phone: fichaContact.phone, email: fichaContact.email, source: fichaContact.source, metadata: fichaContact.metadata }} conversationId="" channel={fichaContact.source || undefined} bare hideToggle expanded onExpandedChange={() => {}} statusPill={fichaContact.crmFinalization ? <span className={"inline-flex min-h-4 items-center gap-1 rounded-full px-2 text-2xs font-bold tabular-nums " + (fichaContact.crmFinalization.outcome === "WON" ? "bg-emerald-100 text-emerald-600" : "bg-blue-50 text-blue-800")}>{fichaContact.crmFinalization.outcome === "WON" ? "Cliente · Ganho" : "Perda · " + (fichaContact.crmFinalization.reason || "Motivo registrado")}</span> : <span className="inline-flex min-h-4 items-center gap-1 rounded-full bg-blue-50 px-2 text-2xs font-bold tabular-nums text-blue-800">{"Etapa · " + (stages.find((stage) => stage.id === (fichaContact.crmStage || "new"))?.label || "Novos")}</span>} />
      </VexoraDialog> : null}
      {finalizingContact ? <VexoraDialog open title="Finalizar oportunidade" subtitle={`Qual foi o resultado comercial de ${finalizingContact.name}?`} icon={<Check size={22}/>} onClose={() => { if (!movingId) setFinalizingContact(null); }} footer={<><button type="button" className={secondaryButton} disabled={!!movingId} onClick={() => setFinalizingContact(null)}>Cancelar</button><button type="button" className={primaryButton} disabled={!finalOutcome || (finalOutcome === "LOST" && !lossReason) || !!movingId} onClick={() => void confirmFinalization()}>{movingId ? "Finalizando…" : "Confirmar finalização"}</button></>}><div data-testid="finalization-outcomes" className="grid grid-cols-2 gap-2.5"><button type="button" data-testid="finalization-outcome" data-outcome="WON" data-selected={finalOutcome === "WON"} className={finalOutcome === "WON" ? finalWonSelectedTw : finalWonTw} onClick={() => { setFinalOutcome("WON"); setLossReason(""); }}><Check size={17} aria-hidden="true" className="flex-none text-emerald-600"/><span className="grid gap-0.5"><strong className="text-body font-extrabold text-slate-950">Ganho</strong><small className="text-2xs text-slate-600">Concluir o item</small></span></button><button type="button" data-testid="finalization-outcome" data-outcome="LOST" data-selected={finalOutcome === "LOST"} className={finalOutcome === "LOST" ? finalLostSelectedTw : finalLostTw} onClick={() => setFinalOutcome("LOST")}><X size={17} aria-hidden="true" className="flex-none text-red-600"/><span className="grid gap-0.5"><strong className="text-body font-extrabold text-slate-950">Perda</strong><small className="text-2xs text-slate-600">Registrar motivo da perda</small></span></button></div>{finalOutcome === "LOST" ? <label className="mt-3 grid gap-1.5 text-small font-bold text-slate-950">Motivo da perda<select required value={lossReason} onChange={(event) => setLossReason(event.target.value)} className="min-h-11 w-full rounded-token-sm border border-gray-200 bg-zinc-100 px-3 text-body text-slate-950 outline-hidden focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30"><option value="">Selecione o motivo…</option>{lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label> : null}<p className="mt-2.5 text-2xs leading-relaxed text-slate-600">A finalização remove o contato do Kanban e encerra as conversas abertas. O histórico permanece em Contatos.</p></VexoraDialog> : null}
    </section>
  );
}

