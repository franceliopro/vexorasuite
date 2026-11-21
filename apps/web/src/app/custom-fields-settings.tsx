"use client";

import { useEffect, useState } from "react";

type FieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT" | "BOOLEAN";
type CustomField = { id: string; label: string; type: FieldType; pipelineIds: string[]; options: string[]; enabled: boolean };
type CrmTag = { id: string; name: string; color: string };
const emptyField = (): CustomField => ({ id: "", label: "", type: "TEXT", pipelineIds: [], options: [], enabled: true });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Falha ao carregar campos.");
  return data as T;
}

const cardTw = "grid gap-4 self-start rounded-token border border-gray-200 bg-zinc-200 p-pad";
const headingTw = "mb-4 flex min-w-0 items-center gap-3";
const headingTitleTw = "m-0 text-asaas-title font-extrabold text-ink";
const headingCopyTw = "mt-0.5 text-small text-ink-secondary";
const feedbackErrorTw = "rounded-token-sm border border-red-600 bg-red-100 px-3 py-2.5 text-small text-red-600";
const feedbackSuccessTw = "rounded-token-sm border border-emerald-600 bg-emerald-100 px-3 py-2.5 text-small text-emerald-600";
const listTw = "grid gap-3";
const fieldGridTw = "grid grid-cols-cf-fields gap-3 ov-tablet:grid-cols-1";
const fieldTw = "grid gap-1.5 text-asaas-label font-semibold text-ink-secondary";
const inputTw = "min-h-control w-full min-w-0 rounded-lg border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-small text-ink focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25";
const tagRowTw = "grid grid-cols-cf-tag-row items-center gap-2 ov-tablet:grid-cols-1";
const tagPillTw = "inline-flex min-h-cf-tag items-center rounded-cf-tag px-cf-tag-x text-2xs font-bold";
const mutedTw = "text-asaas-muted text-ink-secondary";
const toggleTw = "flex cursor-pointer items-center gap-2.5 text-small";
const checkTw = "h-4 w-4 flex-none accent-blue-600";
const fieldRowTw = "grid grid-cols-cf-field-row items-center gap-2 ov-tablet:grid-cols-1";
const fieldNameTw = "text-body font-bold text-ink";
const fieldTypeTw = "text-asaas-label text-ink-secondary";
const primaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-ink transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const textButton = "inline-flex min-h-8 items-center justify-center px-1.5 font-bold text-blue-600 transition-colors hover:bg-blue-50";

export function CustomFieldsSettings() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#6258df");
  const [draft, setDraft] = useState<CustomField>(emptyField());
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      api<CustomField[]>("/api/backend/crm/custom-fields"),
      api<{ tags?: CrmTag[] }>("/api/backend/contacts/profile-config"),
    ]).then(([savedFields, profile]) => { setFields(savedFields); setTags(Array.isArray(profile.tags) ? profile.tags : []); }).catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar configurações do CRM."));
  }, []);

  function addField() {
    const id = draft.id.trim();
    const label = draft.label.trim();
    if (!id || !label) {
      setError("Informe um nome interno e um nome amigável.");
      return;
    }
    if (fields.some((field) => field.id === id)) {
      setError("Já existe um campo com esse identificador.");
      return;
    }
    const next = { ...draft, id, label, options: draft.type === "SELECT" ? optionsText.split(",").map((value) => value.trim()).filter(Boolean) : [] };
    setFields((current) => [...current, next]);
    setDraft(emptyField());
    setOptionsText("");
    setError("");
  }

  async function createTag() {
    const name = tagName.trim();
    if (!name || !/^#[0-9a-fA-F]{6}$/.test(tagColor)) { setError("Informe nome e uma cor hexadecimal válida."); return; }
    if (tags.some((tag) => tag.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) { setError("Já existe uma tag com esse nome."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await api<CrmTag>("/api/backend/contacts/profile-config/tags", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, color: tagColor }) });
      setTags((current) => [...current, created]); setTagName(""); setNotice("Tag criada no catálogo.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao criar tag."); } finally { setBusy(false); }
  }

  async function updateTag(tag: CrmTag) {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await api<CrmTag>("/api/backend/contacts/profile-config/tags/" + encodeURIComponent(tag.id), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: tag.name, color: tag.color }) });
      setTags((current) => current.map((item) => item.id === saved.id ? saved : item)); setNotice("Tag atualizada. Os contatos mantêm o histórico.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar tag."); } finally { setBusy(false); }
  }

  async function deleteTag(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/backend/contacts/profile-config/tags/" + encodeURIComponent(id), { method: "DELETE" });
      setTags((current) => current.filter((tag) => tag.id !== id)); setNotice("Tag removida do catálogo. Valores históricos foram preservados.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao remover tag."); } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api<CustomField[]>("/api/backend/crm/custom-fields", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      setFields(saved);
      setNotice("Campos personalizados salvos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar campos.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={cardTw}>
    <div className={headingTw}>
      <div><h2 className={headingTitleTw}>Campos personalizados</h2><p className={headingCopyTw}>Crie informações próprias da sua empresa para usar no CRM e nos workflows.</p></div>
    </div>
    {error ? <div className={feedbackErrorTw} role="alert">{error}</div> : null}
    {notice ? <div className={feedbackSuccessTw} role="status">{notice}</div> : null}
    <div className={listTw}><div className={headingTw}><div><h3 className={headingTitleTw}>Tags do CRM</h3><p className={headingCopyTw}>Edite o catálogo sem apagar tags já usadas nos contatos.</p></div></div><div className={fieldGridTw}><label className={fieldTw}><span>Nome da tag</span><input className={inputTw} value={tagName} maxLength={40} placeholder="ex.: Cliente VIP" onChange={(event) => setTagName(event.target.value)} /></label><label className={fieldTw}><span>Cor</span><input className={inputTw} type="color" value={tagColor} onChange={(event) => setTagColor(event.target.value)} /></label></div><button type="button" className={secondaryButton} onClick={() => void createTag()} disabled={busy}>Adicionar tag</button>{tags.length ? <div className={listTw}>{tags.map((tag, index) => <div className={tagRowTw} key={tag.id}><input className={inputTw} value={tag.name} maxLength={40} onChange={(event) => setTags((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input className={inputTw} type="color" value={tag.color} onChange={(event) => setTags((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, color: event.target.value } : item))} /><span className={tagPillTw} style={{ backgroundColor: tag.color, color: "#111827" }}>{tag.name}</span><button type="button" className={textButton} onClick={() => void updateTag(tag)} disabled={busy}>Salvar</button><button type="button" className={textButton} onClick={() => void deleteTag(tag.id)} disabled={busy}>Remover</button></div>)}</div> : <p className={mutedTw}>Nenhuma tag cadastrada.</p>}</div>
    <div className={fieldGridTw}>
      <label className={fieldTw}><span>Nome técnico</span><input className={inputTw} value={draft.id} maxLength={80} placeholder="ex.: tipo_cliente" onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} /></label>
      <label className={fieldTw}><span>Nome exibido</span><input className={inputTw} value={draft.label} maxLength={120} placeholder="Tipo de cliente" onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} /></label>
      <label className={fieldTw}><span>Tipo</span><select className={inputTw} value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as FieldType }))}><option value="TEXT">Texto</option><option value="NUMBER">Número</option><option value="DATE">Data</option><option value="SELECT">Lista</option><option value="BOOLEAN">Sim ou não</option></select></label>
      {draft.type === "SELECT" ? <label className={fieldTw}><span>Opções</span><input className={inputTw} value={optionsText} placeholder="Ex.: Novo, Ativo, Inativo" onChange={(event) => setOptionsText(event.target.value)} /></label> : null}
    </div>
    <button type="button" className={secondaryButton} onClick={addField}>Adicionar campo</button>
    {fields.length ? <div className={listTw}>{fields.map((field, index) => <div className={fieldRowTw} key={field.id}>
      <div><strong className={fieldNameTw}>{field.label}</strong><small className={fieldTypeTw}>{field.type === "SELECT" ? "Lista" : field.type === "BOOLEAN" ? "Sim ou não" : field.type === "NUMBER" ? "Número" : field.type === "DATE" ? "Data" : "Texto"}</small></div>
      <label className={toggleTw}><input type="checkbox" className={checkTw} checked={field.enabled} onChange={(event) => setFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} /><span>{field.enabled ? "Ativo" : "Desativado"}</span></label>
      <button type="button" className={textButton} onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
    </div>)}</div> : <p className={mutedTw}>Nenhum campo personalizado criado.</p>}
    <button type="button" className={primaryButton} onClick={() => void save()} disabled={busy}>{busy ? "Salvando..." : "Salvar campos"}</button>
  </section>;
}
