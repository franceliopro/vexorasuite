"use client";

import { useEffect, useState } from "react";

type FieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT" | "BOOLEAN";
type CustomField = { id: string; label: string; type: FieldType; pipelineIds: string[]; options: string[]; enabled: boolean };
const emptyField = (): CustomField => ({ id: "", label: "", type: "TEXT", pipelineIds: [], options: [], enabled: true });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Falha ao carregar campos.");
  return data as T;
}

export function CustomFieldsSettings() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [draft, setDraft] = useState<CustomField>(emptyField());
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<CustomField[]>("/api/backend/crm/custom-fields").then(setFields).catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar campos."));
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

  return <section className="content-card settings-card">
    <div className="settings-card-heading">
      <div><h2>Campos personalizados</h2><p>Crie informações próprias da sua empresa para usar no CRM e nos workflows.</p></div>
    </div>
    {error ? <div className="settings-feedback error" role="alert">{error}</div> : null}
    {notice ? <div className="settings-feedback success" role="status">{notice}</div> : null}
    <div className="settings-field-grid">
      <label className="settings-field"><span>Nome técnico</span><input value={draft.id} maxLength={80} placeholder="ex.: tipo_cliente" onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} /></label>
      <label className="settings-field"><span>Nome exibido</span><input value={draft.label} maxLength={120} placeholder="Tipo de cliente" onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} /></label>
      <label className="settings-field"><span>Tipo</span><select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as FieldType }))}><option value="TEXT">Texto</option><option value="NUMBER">Número</option><option value="DATE">Data</option><option value="SELECT">Lista</option><option value="BOOLEAN">Sim ou não</option></select></label>
      {draft.type === "SELECT" ? <label className="settings-field"><span>Opções</span><input value={optionsText} placeholder="Ex.: Novo, Ativo, Inativo" onChange={(event) => setOptionsText(event.target.value)} /></label> : null}
    </div>
    <button type="button" className="secondary-button" onClick={addField}>Adicionar campo</button>
    {fields.length ? <div className="settings-list">{fields.map((field, index) => <div className="settings-list-row" key={field.id}>
      <div><strong>{field.label}</strong><small>{field.type === "SELECT" ? "Lista" : field.type === "BOOLEAN" ? "Sim ou não" : field.type === "NUMBER" ? "Número" : field.type === "DATE" ? "Data" : "Texto"}</small></div>
      <label className="settings-toggle compact"><input type="checkbox" checked={field.enabled} onChange={(event) => setFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} /><span>{field.enabled ? "Ativo" : "Desativado"}</span></label>
      <button type="button" className="text-button" onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
    </div>)}</div> : <p className="settings-muted">Nenhum campo personalizado criado.</p>}
    <button type="button" className="primary-button" onClick={() => void save()} disabled={busy}>{busy ? "Salvando..." : "Salvar campos"}</button>
  </section>;
}
