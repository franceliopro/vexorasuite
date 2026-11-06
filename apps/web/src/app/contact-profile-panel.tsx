"use client";

import { contactDisplayName, readablePhone } from "../lib/contact-identity";
import { tagForeground } from "../lib/tag-contrast";
import { useEffect, useState, type FormEvent } from "react";
import {
  Clock3,
  Compass,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
  StickyNote,
  Tag,
  UserRound,
  X,
  CheckCircle2,
} from "lucide-react";

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
  if (!response.ok) throw new Error(data.message || "Não foi possível salvar a ficha.");
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
}: {
  contact: ContactProfileData;
  conversationId: string;
  status: string;
  createdAt?: string;
  channel?: string;
  expanded: boolean;
  displayName?: string;
  onExpandedChange: (expanded: boolean) => void;
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
              ? [{ name: v, color: "#eeecff" }]
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
                          : "#eeecff",
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
        ? "WhatsApp (WAHA)"
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
      setError("Essa etiqueta não está no catálogo. Um administrador deve cadastrá-la em Configurações de CRM.");
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
      setError(e instanceof Error ? e.message : "Falha ao salvar ficha.");
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
  const protocol = (id: string) => "VXS-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
  const statusLabel = (value: string) =>
    ({ OPEN: "Em atendimento", PENDING: "Pendente", RESOLVED: "Finalizado", CLOSED: "Encerrado" })[
      value
    ] || value;
  const finalization =
    contact.metadata?.crmFinalization && typeof contact.metadata.crmFinalization === "object"
      ? (contact.metadata.crmFinalization as { outcome?: string; reason?: string })
      : null;
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
  return (
    <aside className={"contact-profile content-card " + (!expanded ? "profile-collapsed" : "")}>
      <div className="contact-profile-heading">
        {expanded ? (
          <span className="contact-profile-avatar">
            {(displayName || contactDisplayName(contact)).slice(0, 1).toUpperCase()}
          </span>
        ) : null}
        {expanded ? (
          <div className="contact-profile-title">
            <strong>Ficha do contato</strong>
            <small>Lead / cliente</small>
          </div>
        ) : null}
        <button
          type="button"
          className="profile-toggle"
          aria-label={expanded ? "Recolher ficha" : "Expandir ficha"}
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </div>
      {expanded ? (
        <>
          <div className="contact-profile-identity">
            <h3>{displayName || contactDisplayName(contact)}</h3>
            <p>{readablePhone(contact.phone, contact.externalId)}</p>
            {contact.email ? <p>{contact.email}</p> : null}
            <span
              className={
                "profile-status-pill " + (["RESOLVED", "CLOSED"].includes(status) ? "done" : "")
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
            {finalization ? (
              <span
                className={"profile-status-pill " + (finalization.outcome === "WON" ? "done" : "")}
              >
                {finalization.outcome === "WON"
                  ? "Cliente · Ganho"
                  : "Perda · " + (finalization.reason || "Motivo registrado")}
              </span>
            ) : null}
          </div>
          <nav className="contact-profile-tabs">
            <button
              type="button"
              className={tab === "dados" ? "active" : ""}
              onClick={() => setTab("dados")}
            >
              Dados
            </button>
            <button
              type="button"
              className={tab === "notas" ? "active" : ""}
              onClick={() => setTab("notas")}
            >
              Anotações
            </button>
            <button
              type="button"
              className={tab === "protocolos" ? "active" : ""}
              onClick={() => setTab("protocolos")}
            >
              Protocolos
            </button>
            <button type="button" className={tab === "procedimentos" ? "active" : ""} onClick={() => setTab("procedimentos")}>Procedimentos</button>
          </nav>
          <div className="contact-profile-body">
            {tab === "dados" ? (
              <>
                <section className="profile-section">
                  <strong>
                    <Tag size={14} /> Etiquetas
                  </strong>
                  <div className="profile-tags">
                    {tags.map((tag, index) => (
                      <span
                        className="profile-tag"
                        key={index}
                        style={{
                          backgroundColor: tag.color,
                          color: tagForeground(tag.color),
                          borderColor: "color-mix(in srgb, " + tag.color + " 82%, #334155)",
                        }}
                      >
                        <span>{tag.name}</span>
                        <button
                          type="button"
                          aria-label={"Remover " + tag.name}
                          onClick={() => setTags(tags.filter((_, i) => i !== index))}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form className="profile-add-tag" onSubmit={addTag}>
                    <input
                      list={"crm-tag-catalog-" + contact.id}
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      placeholder="Escolha uma etiqueta cadastrada"
                      maxLength={40}
                    />
                    <datalist id={"crm-tag-catalog-" + contact.id}>
                      {tagCatalog.map((tag) => (
                        <option key={tag.id} value={tag.name} />
                      ))}
                    </datalist>
                    <button type="submit" aria-label="Adicionar etiqueta cadastrada">
                      <Plus size={14} />
                    </button>
                  </form>
                </section>
                <section className="profile-section contact-identities-section">
                  <strong><Link2 size={14} /> Identidades de atendimento</strong>
                  <p>Os números vinculados preservam o mesmo contato e todo o histórico.</p>
                  {identities.length ? <div className="contact-identity-list">{identities.map((identity) => <div className="contact-identity-item" key={identity.id}><span><b>{readablePhone(identity.phone, identity.externalId) || "Identidade vinculada"}</b><small>{identity.provider}{identity.displayName ? " · " + identity.displayName : ""}</small></span><small title={identity.lastSeenAt}>Ativo</small></div>)}</div> : <small>Nenhuma identidade sincronizada ainda.</small>}
                  <form className="contact-identity-form" onSubmit={bindIdentity}>
                    <label>Provedor<select value={identityProvider} onChange={(e) => setIdentityProvider(e.target.value)}><option value="WAHA">WhatsApp</option><option value="ZERNIO:INSTAGRAM">Instagram</option><option value="ZERNIO:FACEBOOK">Facebook</option></select></label>
                    <label>Número atual<input type="tel" inputMode="tel" value={identityPhone} onChange={(e) => setIdentityPhone(e.target.value)} placeholder="+55 (11) 99999-9999" /></label>
                    <label>Identificador do canal<input value={identityExternalId} onChange={(e) => setIdentityExternalId(e.target.value)} placeholder="Ex.: 5511999999999@c.us" /></label>
                    <button type="submit" className="secondary-button" disabled={identitySaving}>{identitySaving ? "Vinculando…" : "Vincular novo canal"}</button>
                  </form>
                </section>
                <section className="profile-section">
                  <strong>
                    <Compass size={14} /> Origem do lead
                  </strong>
                  <select
                    className="profile-origin-select"
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
                    <option>WhatsApp (WAHA)</option>
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
                      className="profile-origin-identifier"
                      value={leadOriginId}
                      onChange={(e) => setLeadOriginId(e.target.value)}
                      placeholder="Identificador da landing page/campanha"
                      maxLength={120}
                    />
                  ) : null}
                  <small>
                    Use o identificador criado na landing page ou campanha para atribuir
                    corretamente a origem. O canal de atendimento não define a origem.
                  </small>
                </section>
                <section className="profile-section">
                  <strong>
                    <UserRound size={14} /> Campos personalizados
                  </strong>
                  {fieldDefinitions.map((field) => (
                    <label className="profile-field-row" key={field.id}>
                      <span>{field.name}</span>
                      {field.type === "SELECT" ? (
                        <select
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
                        <input
                          type="checkbox"
                          checked={Boolean(fields[field.key])}
                          onChange={(e) =>
                            setFields((current) => ({ ...current, [field.key]: e.target.checked }))
                          }
                        />
                      ) : (
                        <input
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
                  <form className="profile-field-create" onSubmit={createField}>
                    <input
                      value={fieldDraftName}
                      onChange={(e) => setFieldDraftName(e.target.value)}
                      placeholder="Criar novo campo"
                      maxLength={80}
                    />
                    <select
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
                      <input
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
                  <small>
                    Os valores ficam na ficha do contato e podem ser usados por automações e
                    processos.
                  </small>
                </section>
                {asaas?.customerId ? (
                  <section className="profile-section">
                    <strong>
                      <UserRound size={14} /> Cadastro financeiro
                    </strong>
                    <span
                      className={"profile-status-pill " + (asaas.status === "ACTIVE" ? "done" : "")}
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
              </>
            ) : null}
            {tab === "notas" ? (
              <section className="profile-section">
                <strong>
                  <StickyNote size={14} /> Anotações internas
                </strong>
                <p>Visíveis à equipe, nunca enviadas ao cliente.</p>
                <textarea
                  className="profile-notes"
                  rows={10}
                  maxLength={10000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contexto importante para o próximo atendimento..."
                />
              </section>
            ) : null}
            {tab === "protocolos" ? (
              <section className="profile-section">
                <strong>
                  <Clock3 size={14} /> Jornada do cliente
                </strong>
                <p className="profile-section-hint">
                  Conversas, canais, responsáveis e etapas registradas para auditoria.
                </p>
                <div className="protocol-current">
                  <small>ATENDIMENTO ATUAL</small>
                  <b>{protocol(conversationId)}</b>
                  <span>
                    {new Date(createdAt || Date.now()).toLocaleString("pt-BR")} ·{" "}
                    {channel || "WhatsApp"}
                  </span>
                </div>
                {history.map((item) => (
                  <div className="protocol-history-item" key={item.id}>
                    <div>
                      <b>{protocol(item.id)}</b>
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
                {!history.length ? <p>Nenhuma conversa registrada para este contato.</p> : null}
              </section>
            ) : null}
            {tab === "procedimentos" ? (
              <section className="profile-section">
                <div className="profile-section-heading"><strong><CheckCircle2 size={14} /> Procedimentos do cliente</strong><button type="button" className="secondary-button" onClick={() => setProcedureForm((value) => !value)}><Plus size={13} /> Novo</button></div>
                <p className="profile-section-hint">Checklist operacional deste cliente. As tarefas internas da empresa ficam no módulo Tarefas.</p>
                {procedureForm ? <form className="profile-procedure-form" onSubmit={createProcedure}><label>Nome do procedimento<input value={procedureTitle} onChange={(event) => setProcedureTitle(event.target.value)} maxLength={180} placeholder="Ex.: Documentação de contratação" autoFocus /></label><label>Descrição<textarea value={procedureDescription} onChange={(event) => setProcedureDescription(event.target.value)} maxLength={5000} rows={3} placeholder="Contexto ou instruções para a equipe" /></label><label>Etapas — uma por linha<textarea value={procedureSteps} onChange={(event) => setProcedureSteps(event.target.value)} rows={5} placeholder={"Conferir documentos\nEnviar proposta\nRegistrar retorno"} /></label><label>Prazo<input type="datetime-local" value={procedureDueAt} onChange={(event) => setProcedureDueAt(event.target.value)} /></label><div className="calendar-modal-actions"><button type="button" className="secondary-button" onClick={() => setProcedureForm(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={procedureBusy}>{procedureBusy ? "Criando…" : "Criar procedimento"}</button></div></form> : null}
                {procedures.map((procedure) => (
                  <article className="profile-procedure" key={procedure.id}>
                    <div className="profile-procedure-heading"><b>{procedure.title}</b><span>{procedure.progress}%</span></div>
                    {procedure.description ? <p>{procedure.description}</p> : null}
                    <div className="profile-procedure-progress"><span style={{ width: procedure.progress + "%" }} /></div>
                    <div className="profile-procedure-steps">{procedure.steps.map((step) => <label key={step.id}><input type="checkbox" checked={step.done} disabled={procedureBusy || procedure.status === "DONE"} onChange={() => void toggleProcedure(procedure, step)} /><span>{step.label}</span></label>)}</div>
                    <div className="profile-procedure-footer">{procedure.status === "DONE" ? <span className="tasks-done"><CheckCircle2 size={14} /> Finalizado</span> : <button type="button" className="secondary-button" disabled={procedureBusy || procedure.progress < 100} onClick={() => void finishProcedure(procedure)}><CheckCircle2 size={14} /> Finalizar procedimento</button>}</div>
                  </article>
                ))}
                {!procedures.length ? <p>Nenhum procedimento personalizado registrado para este cliente.</p> : null}
              </section>
            ) : null}
          </div>
          {error ? (
            <p className="profile-error" role="alert">
              {error}
            </p>
          ) : null}
          <footer className="contact-profile-footer">
            <button type="button" onClick={() => void save()} disabled={saving}>
              <Save size={15} />
              {saving ? "Salvando..." : "Salvar ficha"}
            </button>
          </footer>
        </>
      ) : null}
    </aside>
  );
}

