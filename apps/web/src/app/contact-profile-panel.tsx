"use client";

import { contactDisplayName, readablePhone } from "../lib/contact-identity";
import { WhatsAppGlyph } from "./brand-glyph";
import { tagForeground } from "../lib/tag-contrast";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Clock3,
  Compass,
  Link2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Save,
  StickyNote,
  UserRound,
  X,
  CheckCircle2,
  CalendarDays,
  Instagram,
  Facebook,
  Bot,
  Mail,
} from "lucide-react";

const pillTw = "inline-flex min-h-ib-profile-pill items-center gap-1 rounded-full px-2 text-ib-profile-pill font-bold tabular-nums";
const pillSmallTw = "inline-flex min-h-ib-profile-pill items-center gap-1 rounded-full px-1.5 text-ib-profile-pill font-bold tabular-nums";

function channelGlyph(channel?: string) {
  const value = (channel || "WHATSAPP").toUpperCase();
  if (value.includes("INSTAGRAM")) return <Instagram size={12} strokeWidth={2.25} className="text-ib-instagram" aria-hidden="true" />;
  if (value.includes("FACEBOOK") || value === "MESSENGER") return <Facebook size={12} strokeWidth={2.25} className="text-ib-facebook" aria-hidden="true" />;
  if (value.includes("EMAIL") || value.includes("E-MAIL")) return <Mail size={12} strokeWidth={2.25} className="text-ib-email" aria-hidden="true" />;
  if (value.includes("CHATBOT") || value.includes("WEBCHAT") || value.includes("WIDGET")) return <Bot size={12} aria-hidden="true" />;
  return <WhatsAppGlyph size={12} />;
}

type ContactProfileData = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};
type Protocol = {
  id: string;
  status: string;
  channel: string;
  provider: string;
  channelName: string | null;
  assignee: string | null;
  department: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  firstMessageAt: string;
};
type ProfileTagDef = { id: string; name: string; color: string; createdBy?: string };
type ProfileFieldDef = {
  id: string;
  name: string;
  key: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX";
  options: string[];
};
type ContactIdentity = { id: string; provider: string; externalId: string; phone?: string | null; displayName?: string | null; firstSeenAt: string; lastSeenAt: string; revokedAt?: string | null };
type ProcedureStep = { id: string; label: string; done: boolean };
type Procedure = { id: string; title: string; description: string; status: string; progress: number; steps: ProcedureStep[]; dueAt?: string | null };
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Não foi possível salvar a ficha agora. Tente novamente; se o problema continuar, avise a administração.");
  return data as T;
}
export function ContactProfilePanel({
  contact,
  conversationId,
  status,
  createdAt,
  channel,
  expanded,
  onExpandedChange,
  displayName,
  hideToggle = false,
  bare = false,
  statusPill,
}: {
  contact: ContactProfileData;
  conversationId: string;
  status?: string;
  createdAt?: string;
  channel?: string;
  expanded: boolean;
  displayName?: string;
  onExpandedChange: (expanded: boolean) => void;
  hideToggle?: boolean;
  bare?: boolean;
  statusPill?: ReactNode;
}) {
  const [tab, setTab] = useState<"dados" | "notas" | "protocolos" | "procedimentos">("dados");
  const [tags, setTags] = useState<Array<{ name: string; color: string }>>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [tagCatalog, setTagCatalog] = useState<ProfileTagDef[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<ProfileFieldDef[]>([]);
  const [fieldDraftName, setFieldDraftName] = useState("");
  const [fieldDraftType, setFieldDraftType] = useState<ProfileFieldDef["type"]>("TEXT");
  const [fieldDraftOptions, setFieldDraftOptions] = useState("");
  const [leadOrigin, setLeadOrigin] = useState("");
  const [leadOriginId, setLeadOriginId] = useState("");
  const [originEditing, setOriginEditing] = useState(false);
  const [history, setHistory] = useState<Protocol[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [identities, setIdentities] = useState<ContactIdentity[]>([]);
  const [identityProvider, setIdentityProvider] = useState("WAHA");
  const [identityExternalId, setIdentityExternalId] = useState("");
  const [identityPhone, setIdentityPhone] = useState("");
  const [identitySaving, setIdentitySaving] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureBusy, setProcedureBusy] = useState(false);
  const [procedureForm, setProcedureForm] = useState(false);
  const [procedureTitle, setProcedureTitle] = useState("");
  const [procedureDescription, setProcedureDescription] = useState("");
  const [procedureSteps, setProcedureSteps] = useState("");
  const [procedureDueAt, setProcedureDueAt] = useState("");
  useEffect(() => {
    const meta = contact.metadata || {};
    setTags(
      Array.isArray(meta.tags)
        ? meta.tags.flatMap((v) =>
            typeof v === "string"
              ? [{ name: v, color: "var(--primary-soft)" }]
              : v &&
                  typeof v === "object" &&
                  "name" in v &&
                  typeof (v as { name?: unknown }).name === "string"
                ? [
                    {
                      name: (v as { name: string }).name,
                      color:
                        typeof (v as { color?: unknown }).color === "string"
                          ? (v as { color: string }).color
                          : "var(--primary-soft)",
                    },
                  ]
                : [],
          )
        : [],
    );
    setNotes(typeof meta.notes === "string" ? meta.notes : "");
    setFields(
      meta.customFields &&
        typeof meta.customFields === "object" &&
        !Array.isArray(meta.customFields)
        ? (meta.customFields as Record<string, unknown>)
        : {},
    );
    const lead =
      meta.leadOrigin && typeof meta.leadOrigin === "object"
        ? (meta.leadOrigin as { source?: unknown; identifier?: unknown })
        : null;
    const savedOrigin = typeof lead?.source === "string" ? lead.source : "";
    const channelOrigin =
      contact.source && ["WHATSAPP", "WAHA"].includes(contact.source.toUpperCase())
        ? "WhatsApp"
        : "";
    setLeadOrigin(
      savedOrigin ||
        channelOrigin ||
        (contact.source &&
        !["CRM", "ASAAS", "WHATSAPP", "WAHA"].includes(contact.source.toUpperCase())
          ? contact.source
          : ""),
    );
    setLeadOriginId(typeof lead?.identifier === "string" ? lead.identifier : "");
    setTab("dados");
    setError("");
  }, [contact.id]);
  useEffect(() => {
    let live = true;
    void request<Procedure[]>("/api/backend/tasks?status=all&contactId=" + encodeURIComponent(contact.id))
      .then((items) => { if (live) setProcedures(items || []); })
      .catch(() => { if (live) setProcedures([]); });
    return () => { live = false; };
  }, [contact.id]);
  useEffect(() => {
    let live = true;
    void request<ContactIdentity[]>("/api/backend/contacts/" + contact.id + "/identities")
      .then((v) => { if (live) setIdentities(v || []); })
      .catch(() => { if (live) setIdentities([]); });
    return () => { live = false; };
  }, [contact.id]);
  useEffect(() => {
    let live = true;
    void request<Protocol[]>("/api/backend/contacts/" + contact.id + "/history")
      .then((v) => {
        if (live) setHistory(v);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [contact.id]);
  useEffect(() => {
    let live = true;
    void request<{ tags: ProfileTagDef[]; fields: ProfileFieldDef[] }>(
      "/api/backend/contacts/profile-config",
    )
      .then((v) => {
        if (live) {
          setTagCatalog(v.tags || []);
          setFieldDefinitions(v.fields || []);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  async function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = tagDraft.trim();
    if (!name || tags.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      setTagDraft("");
      return;
    }
    const definition = tagCatalog.find((v) => v.name.toLowerCase() === name.toLowerCase());
    if (!definition) {
      setError("Essa tag não está no catálogo. Um administrador deve cadastrá-la em Configurações de CRM.");
      return;
    }
    setError("");
    setTags((current) => [...current, { name: definition.name, color: definition.color }]);
    setTagDraft("");
  }
  async function createField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fieldDraftName.trim();
    if (!name) return;
    const options = fieldDraftOptions
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    setError("");
    try {
      const field = await request<ProfileFieldDef>("/api/backend/contacts/profile-config/fields", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, type: fieldDraftType, options }),
      });
      setFieldDefinitions((current) => [...current, field]);
      setFields((current) => ({ ...current, [field.key]: field.type === "CHECKBOX" ? false : "" }));
      setFieldDraftName("");
      setFieldDraftOptions("");
      setFieldDraftType("TEXT");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o campo.");
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      await request("/api/backend/contacts/" + contact.id + "/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tags,
          notes,
          customFields: fields,
          leadOrigin: { source: leadOrigin, identifier: leadOriginId.trim() || undefined },
        }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a ficha agora. Suas alterações continuam nesta tela; toque em Salvar ficha novamente.");
    } finally {
      setSaving(false);
    }
  }
  async function bindIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = identityPhone.replace(/\D/g, "");
    const externalId = identityExternalId.trim() || (identityProvider === "WAHA" && phone ? phone + "@c.us" : "");
    if (!externalId) { setError("Informe o identificador recebido do novo WhatsApp."); return; }
    setIdentitySaving(true); setError("");
    try {
      await request("/api/backend/contacts/" + contact.id + "/identities/rebind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: identityProvider, externalId, phone: phone || undefined }),
      });
      const refreshed = await request<ContactIdentity[]>("/api/backend/contacts/" + contact.id + "/identities");
      setIdentities(refreshed || []);
      setIdentityExternalId(""); setIdentityPhone("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível vincular o novo número.");
    } finally { setIdentitySaving(false); }
  }
  async function toggleProcedure(procedure: Procedure, step: ProcedureStep) {
    setProcedureBusy(true); setError("");
    try {
      await request("/api/backend/tasks/" + procedure.id + "/steps/" + step.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ done: !step.done }) });
      const next = await request<Procedure[]>("/api/backend/tasks?status=all&contactId=" + encodeURIComponent(contact.id));
      setProcedures(next || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o procedimento."); }
    finally { setProcedureBusy(false); }
  }
  async function createProcedure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!procedureTitle.trim()) { setError("Informe o nome do procedimento."); return; }
    const steps = procedureSteps.split("\n").map((value) => value.trim()).filter(Boolean);
    if (!steps.length) { setError("Inclua pelo menos uma etapa no procedimento."); return; }
    setProcedureBusy(true); setError("");
    try {
      await request("/api/backend/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: procedureTitle.trim(), description: procedureDescription.trim(), contactId: contact.id, dueAt: procedureDueAt ? new Date(procedureDueAt).toISOString() : null, steps }) });
      const next = await request<Procedure[]>("/api/backend/tasks?status=all&contactId=" + encodeURIComponent(contact.id));
      setProcedures(next || []); setProcedureForm(false); setProcedureTitle(""); setProcedureDescription(""); setProcedureSteps(""); setProcedureDueAt("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o procedimento."); }
    finally { setProcedureBusy(false); }
  }
  async function finishProcedure(procedure: Procedure) {
    setProcedureBusy(true); setError("");
    try {
      await request("/api/backend/tasks/" + procedure.id + "/complete", { method: "POST" });
      const next = await request<Procedure[]>("/api/backend/tasks?status=all&contactId=" + encodeURIComponent(contact.id));
      setProcedures(next || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível finalizar o procedimento."); }
    finally { setProcedureBusy(false); }
  }
  async function reopenProcedure(procedure: Procedure) {
    setProcedureBusy(true); setError("");
    try {
      await request("/api/backend/tasks/" + procedure.id + "/reopen", { method: "POST" });
      const next = await request<Procedure[]>("/api/backend/tasks?status=all&contactId=" + encodeURIComponent(contact.id));
      setProcedures(next || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível reabrir o procedimento."); }
    finally { setProcedureBusy(false); }
  }
  const protocol = (id: string) => "Atendimento " + id.replace(/-/g, "").slice(0, 6).toUpperCase();
  const statusLabel = (value: string) =>
    ({ OPEN: "Em atendimento", PENDING: "Pendente", RESOLVED: "Finalizado", CLOSED: "Encerrado" })[
      value
    ] || value;
  const finalization =
    contact.metadata?.crmFinalization && typeof contact.metadata.crmFinalization === "object"
      ? (contact.metadata.crmFinalization as { outcome?: string; reason?: string })
      : null;
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoAttempt, setPhotoAttempt] = useState(0);
  const photoTimer = useRef<number | null>(null);
  useEffect(() => { setPhotoFailed(false); setPhotoAttempt(0); }, [contact.id]);
  useEffect(() => () => { if (photoTimer.current) window.clearTimeout(photoTimer.current); }, []);
  const asaas =
    contact.metadata?.asaas && typeof contact.metadata.asaas === "object"
      ? (contact.metadata.asaas as {
          customerId?: string;
          environment?: string;
          syncedAt?: string;
          document?: string | null;
          address?: string | null;
          personType?: string | null;
          state?: string | null;
          status?: string | null;
        })
      : null;
  const maskedDocument = (value?: string | null) => {
    const digits = (value || "").replace(/\D/g, "");
    return digits.length > 4 ? "••••••••" + digits.slice(-4) : "Não informado";
  };
  const asaasStatusLabel = (value?: string | null) =>
    value === "DELETED"
      ? "Removido no Asaas"
      : value === "NOT_LISTED"
        ? "Não listado no Asaas"
        : value === "ACTIVE"
          ? "Ativo no Asaas"
          : "Status não informado";
  const initialsOf = (value: string) => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0]?.charAt(0) || "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) || "" : "";
    return (first + last).toUpperCase() || "?";
  };
  const profileLeadSubtitle = () => {
    if (leadOrigin.trim()) return `Novo contato · ${leadOrigin.trim()}`;
    return "Lead / cliente";
  };
  return (
    <aside
      data-testid="contact-profile"
      data-collapsed={expanded ? "false" : "true"}
      data-bare={bare ? "true" : "false"}
      className={"flex min-w-0 flex-col overflow-hidden " + (bare ? "" : "rounded-token border border-line bg-zinc-100 shadow-token") + (!expanded ? " w-ib-profile-collapsed" : "")}
    >
      {bare ? null : (
      <div data-testid="contact-profile-heading" className={"flex flex-none items-center gap-2.5 border-b border-line " + (expanded ? "px-3 pb-1.5 pt-3" : "justify-center p-2")}>
        {expanded ? (
          <>
            <span className="grid h-ib-profile-avatar w-ib-profile-avatar flex-none place-items-center overflow-hidden rounded-full bg-ib-avatar text-ib-avatar-fallback font-extrabold tracking-tight text-blue-950">
              {!photoFailed ? (
                <img key={photoAttempt} className="h-full w-full object-cover" src={"/api/backend/contacts/" + contact.id + "/avatar?v=" + photoAttempt} alt={"Foto de " + (displayName || contactDisplayName(contact))} loading="lazy" referrerPolicy="no-referrer" onError={() => { if (photoTimer.current) window.clearTimeout(photoTimer.current); if (photoAttempt < 2) { photoTimer.current = window.setTimeout(() => setPhotoAttempt(v => v + 1), 1500); } else { setPhotoFailed(true); } }} />
              ) : (
                initialsOf(displayName || contactDisplayName(contact))
              )}
            </span>
            <div className="grid min-w-0 gap-px">
              <strong className="flex min-w-0 items-center gap-1.5 truncate text-ib-profile-name font-bold text-slate-950">{displayName || contactDisplayName(contact)}<span className="inline-grid h-ib-mark w-ib-mark flex-none place-items-center rounded-ib-channel bg-blue-50 text-slate-600" title={channel || "WhatsApp"}>{channelGlyph(channel)}</span></strong>
              <small className="text-ib-profile-sub text-slate-600">{profileLeadSubtitle()}</small>
            </div>
          </>
        ) : null}
        {hideToggle ? null : (
          <button
            type="button"
            className="inline-grid h-ib-profile-toggle w-ib-profile-toggle flex-none place-items-center rounded-ib-profile-toggle border border-line-strong bg-zinc-100 p-0 text-slate-600 transition-colors hover:bg-zinc-300 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
            aria-label={expanded ? "Recolher ficha" : "Expandir ficha"}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? <ChevronRight size={18} strokeWidth={2.2} /> : <ChevronLeft size={18} strokeWidth={2.2} />}
          </button>
        )}
      </div>
      )}
      {expanded ? (
        <>
          <div data-testid="contact-profile-identity" className="grid gap-0.5 px-3 pb-1.5 pt-1">
            {contact.phone ? <p className="m-0 text-ib-profile-copy">{readablePhone(contact.phone, contact.externalId)}</p> : null}
            {contact.email ? <p className="m-0 text-ib-profile-copy">{contact.email}</p> : null}
            {statusPill ? statusPill : status ? (
              <span
                className={
                  pillTw + " " + (["RESOLVED", "CLOSED"].includes(status) ? "bg-blue-50 text-blue-800" : "bg-blue-50 text-blue-800")
                }
              >
                {status === "RESOLVED"
                  ? "Resolvido"
                  : status === "CLOSED"
                    ? "Encerrado"
                    : status === "PENDING"
                      ? "Pendente"
                      : "Em atendimento"}
              </span>
            ) : null}
            {finalization ? (
              <span
                className={pillTw + " " + (finalization.outcome === "WON" ? "bg-blue-50 text-blue-800" : "bg-blue-50 text-blue-800")}
              >
                {finalization.outcome === "WON"
                  ? "Cliente · Ganho"
                  : "Perda · " + (finalization.reason || "Motivo registrado")}
              </span>
            ) : null}
          </div>
          <nav className="flex gap-1 px-3 py-2">
            <button
              type="button"
              aria-pressed={tab === "dados"}
              className={tab === "dados" ? "min-h-ib-profile-tab rounded-ib-profile-tag bg-blue-50 px-1 text-ib-profile-tab font-bold text-blue-800" : "min-h-ib-profile-tab rounded-ib-profile-tag px-1 text-ib-profile-tab font-semibold text-slate-600 hover:bg-zinc-200"}
              onClick={() => setTab("dados")}
            >
              Dados
            </button>
            <button
              type="button"
              aria-pressed={tab === "notas"}
              className={tab === "notas" ? "min-h-ib-profile-tab rounded-ib-profile-tag bg-blue-50 px-1 text-ib-profile-tab font-bold text-blue-800" : "min-h-ib-profile-tab rounded-ib-profile-tag px-1 text-ib-profile-tab font-semibold text-slate-600 hover:bg-zinc-200"}
              onClick={() => setTab("notas")}
            >
              Anotações
            </button>
            <button
              type="button"
              aria-pressed={tab === "protocolos"}
              className={tab === "protocolos" ? "min-h-ib-profile-tab rounded-ib-profile-tag bg-blue-50 px-1 text-ib-profile-tab font-bold text-blue-800" : "min-h-ib-profile-tab rounded-ib-profile-tag px-1 text-ib-profile-tab font-semibold text-slate-600 hover:bg-zinc-200"}
              onClick={() => setTab("protocolos")}
            >
              Protocolos
            </button>
            <button type="button" aria-pressed={tab === "procedimentos"} className={tab === "procedimentos" ? "min-h-ib-profile-tab rounded-ib-profile-tag bg-blue-50 px-1 text-ib-profile-tab font-bold text-blue-800" : "min-h-ib-profile-tab rounded-ib-profile-tag px-1 text-ib-profile-tab font-semibold text-slate-600 hover:bg-zinc-200"} onClick={() => setTab("procedimentos")}>Procedimentos</button>
          </nav>
          <section className="grid gap-2 border-b border-line px-4 pb-3 pt-2.5" aria-label="Tags do contato">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, index) => (
                <span
                  className="inline-flex min-h-ib-profile-tag items-center gap-0.5 rounded-ib-profile-tag border px-1.5 text-ib-profile-tag font-semibold tabular-nums"
                  key={index}
                  style={{ backgroundColor: tag.color, color: tagForeground(tag.color), borderColor: tag.color }}
                >
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    aria-label={"Remover " + tag.name}
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
              {!tags.length ? <small className="text-ib-profile-copy text-slate-600">Sem tags neste contato.</small> : null}
            </div>
            <form className="flex items-center gap-1.5" onSubmit={addTag}>
              <input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                list={"crm-tag-catalog-" + contact.id}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="Adicionar tag"
                maxLength={40}
                aria-label="Tag do contato"
              />
              <datalist id={"crm-tag-catalog-" + contact.id}>
                {tagCatalog.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
              <button type="submit" aria-label="Adicionar tag cadastrada" className="inline-grid h-ib-profile-add w-ib-profile-add place-items-center rounded-ib-profile-add border border-line bg-transparent p-0 text-slate-600 transition-colors hover:bg-zinc-300 hover:text-slate-950">
                <Plus size={14} />
              </button>
            </form>
          </section>
          <div className={"grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4" + (bare ? " flex-none overflow-visible pt-3.5" : "")}>
            {tab === "dados" ? (
              <>
                                <div className="grid gap-4 ib-desktop:grid-cols-2">
                                  <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                  <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><UserRound size={12} /> Campos personalizados</strong>
                  {fieldDefinitions.map((field) => (
                    <label className="grid max-w-ib-profile-row grid-cols-ib-profile-field-row items-center gap-2.5 text-ib-profile-label text-slate-600" key={field.id}>
                      <span>{field.name}</span>
                      {field.type === "SELECT" ? (
                        <select className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                          value={String(fields[field.key] ?? "")}
                          onChange={(e) =>
                            setFields((current) => ({ ...current, [field.key]: e.target.value }))
                          }
                        >
                          <option value="">Selecione...</option>
                          {field.options.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : field.type === "CHECKBOX" ? (
                        <input className="h-4 w-4 flex-none accent-blue-600"
                          type="checkbox"
                          checked={Boolean(fields[field.key])}
                          onChange={(e) =>
                            setFields((current) => ({ ...current, [field.key]: e.target.checked }))
                          }
                        />
                      ) : (
                        <input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                          type={
                            field.type === "NUMBER"
                              ? "number"
                              : field.type === "DATE"
                                ? "date"
                                : "text"
                          }
                          value={String(fields[field.key] ?? "")}
                          onChange={(e) =>
                            setFields((current) => ({ ...current, [field.key]: e.target.value }))
                          }
                        />
                      )}
                    </label>
                  ))}
                  <form className="grid gap-2" onSubmit={createField}>
                    <input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                      value={fieldDraftName}
                      onChange={(e) => setFieldDraftName(e.target.value)}
                      placeholder="Criar novo campo"
                      maxLength={80}
                    />
                    <select className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                      value={fieldDraftType}
                      onChange={(e) => setFieldDraftType(e.target.value as ProfileFieldDef["type"])}
                    >
                      <option value="TEXT">Texto</option>
                      <option value="NUMBER">Número</option>
                      <option value="DATE">Data</option>
                      <option value="SELECT">Lista de opções</option>
                      <option value="CHECKBOX">Sim / não</option>
                    </select>
                    {fieldDraftType === "SELECT" ? (
                      <input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                        value={fieldDraftOptions}
                        onChange={(e) => setFieldDraftOptions(e.target.value)}
                        placeholder="Opções separadas por vírgula"
                      />
                    ) : null}
                    <button
                      type="submit"
                      disabled={
                        !fieldDraftName.trim() ||
                        (fieldDraftType === "SELECT" && !fieldDraftOptions.trim())
                      }
                    >
                      <Plus size={13} /> Criar campo
                    </button>
                  </form>
                  <small className="text-ib-profile-label text-slate-600">Os valores ficam na ficha do contato e podem ser usados por automações e processos.</small>
                </section>
                {asaas?.customerId ? (
                  <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                    <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><UserRound size={12} /> Cadastro financeiro</strong>
                    <span
                      className={pillTw + " " + (asaas.status === "ACTIVE" ? "bg-blue-50 text-blue-800" : "bg-blue-50 text-blue-800")}
                    >
                      {asaasStatusLabel(asaas.status)}
                    </span>
                    <p>Ambiente: {asaas.environment === "SANDBOX" ? "Sandbox" : "Produção"}</p>
                    <p>
                      Tipo:{" "}
                      {asaas.personType === "PJ"
                        ? "Pessoa jurídica"
                        : asaas.personType === "PF"
                          ? "Pessoa física"
                          : "Não identificado"}
                    </p>
                    <p>CPF/CNPJ: {maskedDocument(asaas.document)}</p>
                    {asaas.state ? <p>UF: {asaas.state}</p> : null}
                    {asaas.address ? <p>Endereço: {asaas.address}</p> : null}
                    <small>
                      Última sincronização:{" "}
                      {asaas.syncedAt
                        ? new Date(asaas.syncedAt).toLocaleString("pt-BR")
                        : "Não registrada"}
                    </small>
                  </section>
                ) : null}
                </div>
                <div className="grid gap-4">
                  <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                  <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><Link2 size={12} /> Identidades de atendimento</strong>
                  <p className="mb-2 mt-0.5 text-ib-profile-label text-slate-600">Os números vinculados preservam o mesmo contato e todo o histórico.</p>
                  {identities.length ? <div className="grid gap-2">{identities.map((identity) => {const isWaha = identity.provider.toUpperCase().startsWith("WAHA") || identity.provider.toUpperCase().includes("WHATSAPP"); return <div className="flex items-center gap-2 rounded-ib-profile-card border border-line bg-zinc-200 p-2" key={identity.id}><span className="grid h-ib-profile-icon w-ib-profile-icon flex-none place-items-center rounded-ib-entry bg-blue-50 text-blue-800" aria-hidden="true">{isWaha ? <WhatsAppGlyph size={18} /> : <Link2 size={18}/>}</span><span className="grid min-w-0 gap-0.5"><b className="truncate text-ib-profile-body text-slate-950">{readablePhone(identity.phone, identity.externalId) || "Identidade vinculada"}</b><small className="text-ib-profile-copy text-slate-600">{isWaha ? "WhatsApp" : identity.provider}{identity.displayName ? " · " + identity.displayName : ""}</small></span><span className={pillSmallTw + " bg-blue-50 text-blue-800"}>Ativo</span></div>})}</div> : <small className="text-ib-profile-copy text-slate-600">Nenhuma identidade sincronizada ainda.</small>}
                  <form className="grid max-w-ib-profile-copy grid-cols-ib-profile-identity gap-2.5 ib-narrow:grid-cols-1" onSubmit={bindIdentity}>
                    <label>Provedor<select className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" value={identityProvider} onChange={(e) => setIdentityProvider(e.target.value)}><option value="WAHA">WhatsApp</option><option value="ZERNIO:INSTAGRAM">Instagram</option><option value="ZERNIO:FACEBOOK">Facebook</option></select></label>
                    <label>Número atual<input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" type="tel" inputMode="tel" value={identityPhone} onChange={(e) => setIdentityPhone(e.target.value)} placeholder="+55 (11) 99999-9999" /></label>
                    <label>Identificador do canal<input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" value={identityExternalId} onChange={(e) => setIdentityExternalId(e.target.value)} placeholder="Ex.: 5511999999999@c.us" /></label>
                    <button type="submit" className="inline-flex min-h-ib-profile-field items-center justify-center gap-2 rounded-token-sm px-2.5 text-ib-profile-action font-bold text-slate-950 transition-colors hover:bg-zinc-200 disabled:opacity-50" disabled={identitySaving}>{identitySaving ? "Vinculando…" : "Vincular novo canal"}</button>
                  </form>
                </section>
                <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                  <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><Compass size={12} /> Origem do lead</strong>
                   {!leadOrigin || originEditing ? (
                     <>
                       <select
                         className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                         value={leadOrigin}
                         onChange={(e) => {
                           setLeadOrigin(e.target.value);
                           setLeadOriginId("");
                         }}
                       >
                         <option value="">Não identificada</option>
                         <option>Site/Formulário</option>
                         <option>Landing Page</option>
                         <option>Facebook</option>
                         <option>Instagram</option>
                         <option>Google</option>
                         <option>WhatsApp</option>
                         <option>Campanha de WhatsApp</option>
                         <option>Campanha de SMS</option>
                         <option>Campanha de Áudio</option>
                         <option>Indicação</option>
                         <option>Evento</option>
                         <option>Importação</option>
                         <option>Outra</option>
                       </select>
                       {[
                         "Landing Page",
                         "Facebook",
                         "Instagram",
                         "Google",
                         "Campanha de WhatsApp",
                         "Campanha de SMS",
                         "Campanha de Áudio",
                       ].includes(leadOrigin) ? (
                         <input
                           className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                           value={leadOriginId}
                           onChange={(e) => setLeadOriginId(e.target.value)}
                           placeholder="Identificador da landing page/campanha"
                           maxLength={120}
                         />
                       ) : null}
                       <small className="text-ib-profile-label text-slate-600">Use o identificador criado na landing page ou campanha para atribuir corretamente a origem. O canal de atendimento não define a origem.</small>
                       <button type="button" className="text-ib-profile-action font-bold text-blue-800 transition-colors hover:text-blue-700" onClick={() => setOriginEditing(false)}>Concluir</button>
                     </>
                   ) : (
                     <div className="flex items-center justify-between gap-2.5 rounded-ib-profile-origin border border-line bg-zinc-200 px-3 py-2.5">
                       <span className="min-w-0 truncate text-ib-profile-body font-bold text-slate-950">{leadOrigin}{leadOriginId ? ` · ${leadOriginId}` : ""}</span>
                       <button type="button" className="text-ib-profile-action font-bold text-blue-800 transition-colors hover:text-blue-700" onClick={() => setOriginEditing(true)}>Alterar</button>
                     </div>
                   )}
                 </section>
                 <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                   <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><CalendarDays size={12} /> Calendário e cobrança</strong>
                   <div className="grid justify-items-center gap-1.5 rounded-ib-profile-card border border-dashed border-line-strong px-3 py-5 text-center">
                     <b className="text-ib-profile-body">Nada agendado ainda</b>
                     <p className="m-0 max-w-ib-profile-agenda text-ib-profile-copy text-slate-600">Quando {leadOrigin ? "o cliente marcar um horário" : "este contato marcar um horário"} ou receber uma cobrança, aparece aqui.</p>
                   </div>
                 </section>
                </div>
              </>
            ) : null}
            {tab === "notas" ? (
              <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><StickyNote size={12} /> Anotações internas</strong>
                <p className="m-0 text-ib-profile-copy text-slate-600">Visíveis à equipe, nunca enviadas ao cliente.</p>
                <textarea
                  className="w-full max-w-ib-profile-copy rounded-ib-profile-field border border-line bg-zinc-100 p-2 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                  rows={10}
                  maxLength={10000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contexto importante para o próximo atendimento..."
                />
              </section>
            ) : null}
            {tab === "protocolos" ? (
              <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                <strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><Clock3 size={12} /> Jornada do cliente</strong>
                <p className="m-0 text-ib-profile-copy text-slate-600">
                  Conversas, canais, responsáveis e etapas registradas para auditoria.
                </p>
                {conversationId ? (
                  <div className="grid gap-1 rounded-ib-profile-card border border-line bg-zinc-200 p-3">
                    <small className="text-ib-profile-label font-bold tracking-widest text-slate-600">ATENDIMENTO ATUAL</small>
                    <b className="text-ib-profile-body text-slate-950">{protocol(conversationId)}</b>
                    <span>
                      {new Date(createdAt || Date.now()).toLocaleString("pt-BR")} ·{" "}
                      {channel || "WhatsApp"}
                    </span>
                  </div>
                ) : null}
                {history.map((item) => (
                  <div className="grid gap-1 border-b border-line pb-2" key={item.id}>
                    <div>
                      <b className="text-ib-profile-body text-slate-950">{protocol(item.id)}</b>
                      <small>
                        {new Date(item.createdAt).toLocaleString("pt-BR")} →{" "}
                        {new Date(item.updatedAt).toLocaleString("pt-BR")}
                      </small>
                    </div>
                    <span>
                      {item.channelName || item.provider || item.channel} ·{" "}
                      {statusLabel(item.status)} · {item.messageCount} mensagens
                    </span>
                    <small>
                      {item.department || "Sem departamento"} · {item.assignee || "Sem atendente"}
                    </small>
                  </div>
                ))}
                {!history.length ? <p className="m-0 text-ib-profile-copy text-slate-600">Nenhuma conversa registrada para este contato.</p> : null}
              </section>
            ) : null}
            {tab === "procedimentos" ? (
              <section className="grid min-w-0 gap-2 border-b border-line px-3 pb-4">
                <div className="flex items-center justify-between gap-2"><strong className="flex items-center gap-1.5 text-ib-profile-section font-bold text-slate-950"><CheckCircle2 size={12} /> Procedimentos do cliente</strong><button type="button" className="inline-flex min-h-ib-profile-field items-center justify-center gap-2 rounded-token-sm px-2.5 text-ib-profile-action font-bold text-slate-950 transition-colors hover:bg-zinc-200 disabled:opacity-50" onClick={() => setProcedureForm((value) => !value)}><Plus size={13} /> Novo</button></div>
                <p className="m-0 text-ib-profile-copy text-slate-600">Checklist operacional deste cliente. As tarefas internas da empresa ficam no módulo Tarefas.</p>
                {procedureForm ? <form className="grid gap-2" onSubmit={createProcedure}><label>Nome do procedimento<input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" value={procedureTitle} onChange={(event) => setProcedureTitle(event.target.value)} maxLength={180} placeholder="Ex.: Documentação de contratação" autoFocus /></label><label>Descrição<textarea className="w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 p-2 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" value={procedureDescription} onChange={(event) => setProcedureDescription(event.target.value)} maxLength={5000} rows={3} placeholder="Contexto ou instruções para a equipe" /></label><label>Etapas — uma por linha<textarea className="w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 p-2 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" value={procedureSteps} onChange={(event) => setProcedureSteps(event.target.value)} rows={5} placeholder={"Conferir documentos\nEnviar proposta\nRegistrar retorno"} /></label><label>Prazo<input className="min-h-ib-profile-field w-full max-w-ib-profile-control rounded-ib-profile-field border border-line bg-zinc-100 px-2 py-0.5 text-ib-profile-field text-slate-950 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" type="datetime-local" value={procedureDueAt} onChange={(event) => setProcedureDueAt(event.target.value)} /></label><div className="flex flex-wrap justify-end gap-2"><button type="button" className="inline-flex min-h-ib-profile-field items-center justify-center gap-2 rounded-token-sm px-2.5 text-ib-profile-action font-bold text-slate-950 transition-colors hover:bg-zinc-200 disabled:opacity-50" onClick={() => setProcedureForm(false)}>Cancelar</button><button type="submit" className="inline-flex min-h-ib-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-ib-profile-action font-bold text-blue-950 transition-colors hover:bg-blue-700 disabled:opacity-50" disabled={procedureBusy}>{procedureBusy ? "Criando…" : "Criar procedimento"}</button></div></form> : null}
                {procedures.map((procedure) => (
                  <article className="grid gap-2 rounded-ib-profile-card border border-line bg-zinc-100 p-3" key={procedure.id}>
                    <div className="flex items-center justify-between gap-2"><b className="text-ib-profile-body text-slate-950">{procedure.title}</b><span className="text-ib-profile-copy tabular-nums text-slate-600">{procedure.progress}%</span></div>
                    {procedure.description ? <p className="m-0 text-ib-profile-copy text-slate-600">{procedure.description}</p> : null}
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-300"><span className="block h-full bg-blue-600" style={{ width: procedure.progress + "%" }} /></div>
                    <div className="grid gap-1.5">{procedure.steps.map((step) => <label key={step.id} className="flex items-center gap-2 text-ib-profile-copy text-slate-950"><input type="checkbox" className="h-4 w-4 flex-none accent-blue-600" checked={step.done} disabled={procedureBusy || procedure.status === "DONE"} onChange={() => void toggleProcedure(procedure, step)} /><span>{step.label}</span></label>)}</div>
                    <div className="flex items-center justify-between gap-2">{procedure.status === "DONE" ? <><span className="inline-flex items-center gap-1.5 text-ib-profile-action font-bold text-blue-800"><CheckCircle2 size={12} /> Finalizado</span><button type="button" className="inline-flex min-h-ib-profile-field items-center justify-center gap-2 rounded-token-sm px-2.5 text-ib-profile-action font-bold text-slate-950 transition-colors hover:bg-zinc-200 disabled:opacity-50" disabled={procedureBusy} onClick={() => void reopenProcedure(procedure)}>Reabrir</button></> : <button type="button" className="inline-flex min-h-ib-profile-field items-center justify-center gap-2 rounded-token-sm px-2.5 text-ib-profile-action font-bold text-slate-950 transition-colors hover:bg-zinc-200 disabled:opacity-50" disabled={procedureBusy || procedure.progress < 100} onClick={() => void finishProcedure(procedure)}><CheckCircle2 size={14} /> Finalizar procedimento</button>}</div>
                  </article>
                ))}
                {!procedures.length ? <p className="m-0 text-ib-profile-copy text-slate-600">Nenhum procedimento personalizado registrado para este cliente.</p> : null}
              </section>
            ) : null}
          </div>
          {error ? (
            <p className="m-0 rounded-ib-entry border border-red-600 bg-red-100 p-2 text-ib-profile-copy font-bold text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <footer className="sticky bottom-0 z-10 flex flex-none items-center border-t border-line bg-zinc-100 px-4 py-3">
            <button type="button" className="inline-flex min-h-ib-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-ib-profile-action font-bold text-blue-950 transition-colors hover:bg-blue-700 disabled:opacity-50" onClick={() => void save()} disabled={saving}>
              <Save size={15} />
              {saving ? "Salvando..." : "Salvar ficha"}
            </button>
          </footer>
        </>
      ) : null}
    </aside>
  );
}
