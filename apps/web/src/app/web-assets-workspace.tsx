"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClipboardList, Globe2, LayoutTemplate, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { VexoraDialog } from "./vexora-dialog";

export type WebAssetKind = "SITE" | "LANDING" | "FORM";
type WebAssetField = { id: string; label: string; type: string; required: boolean; options?: string[] };
type WebAsset = {
  id: string;
  kind: WebAssetKind;
  title: string;
  slug: string;
  summary: string;
  status: "DRAFT" | "READY";
  fields: WebAssetField[];
  createdAt: string;
  updatedAt: string;
};

const FIELD_TYPES = [
  ["text", "Texto curto"],
  ["textarea", "Texto longo"],
  ["email", "E-mail"],
  ["tel", "Telefone"],
  ["number", "Número"],
  ["date", "Data"],
  ["select", "Escolha"],
] as const;

const META: Record<WebAssetKind, { label: string; singular: string; description: string; hint: string; icon: typeof Globe2 }> = {
  SITE: {
    label: "Sites",
    singular: "site",
    description: "Estruture as páginas institucionais da sua empresa.",
    hint: "Um site reúne as páginas da marca. Aqui você cria a estrutura e o conteúdo; publicar em um domínio é uma ação separada e confirmada.",
    icon: Globe2,
  },
  LANDING: {
    label: "Landing Pages",
    singular: "landing page",
    description: "Páginas focadas em uma campanha ou oferta.",
    hint: "Landing pages têm um objetivo único. Monte a estrutura e revise o texto antes de qualquer publicação.",
    icon: LayoutTemplate,
  },
  FORM: {
    label: "Formulários",
    singular: "formulário",
    description: "Colete dados com campos organizados.",
    hint: "Os formulários guardam as respostas na sua empresa. Nenhum envio externo acontece sem uma integração configurada.",
    icon: ClipboardList,
  },
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/backend/" + path, { cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível concluir a operação.");
  return data as T;
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function blankField(): WebAssetField {
  return { id: crypto.randomUUID(), label: "", type: "text", required: false };
}

export function WebAssetsWorkspace({ kind }: { kind: WebAssetKind }) {
  const meta = META[kind];
  const Icon = meta.icon;
  const [items, setItems] = useState<WebAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<"create" | WebAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [fields, setFields] = useState<WebAssetField[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await api<WebAsset[]>(`marketing/web-assets?kind=${kind}`);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar os itens.");
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setTitle("");
    setSlug("");
    setSummary("");
    setFields(kind === "FORM" ? [blankField()] : []);
    setNotice("");
    setDialog("create");
  }

  function openEdit(asset: WebAsset) {
    setTitle(asset.title);
    setSlug(asset.slug);
    setSummary(asset.summary);
    setFields(asset.fields.length ? asset.fields : kind === "FORM" ? [blankField()] : []);
    setNotice("");
    setDialog(asset);
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        kind,
        title,
        slug: slug || slugify(title),
        summary,
        ...(kind === "FORM" ? { fields: fields.filter((field) => field.label.trim()) } : {}),
      };
      if (dialog === "create") await api("marketing/web-assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      else if (dialog) await api("marketing/web-assets/" + dialog.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      setDialog(null);
      setNotice(dialog === "create" ? `${meta.singular.charAt(0).toUpperCase()}${meta.singular.slice(1)} criado como rascunho.` : "Alterações salvas.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(asset: WebAsset) {
    setBusy(true);
    setError("");
    try {
      await api("marketing/web-assets/" + asset.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: asset.status === "READY" ? "DRAFT" : "READY" }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível alterar a situação.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: WebAsset) {
    if (!window.confirm(`Excluir "${asset.title}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    setError("");
    try {
      await api("marketing/web-assets/" + asset.id, { method: "DELETE" });
      setNotice("Item excluído.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  }

  function updateField(id: string, changes: Partial<WebAssetField>) {
    setFields((current) => current.map((field) => (field.id === id ? { ...field, ...changes } : field)));
  }

  return (
    <section className="simple-workspace vx-web-workspace">
      <header className="creative-heading">
        <div>
          <h1>{meta.label}</h1>
          <p>{meta.description}</p>
        </div>
        <div className="workspace-actions">
          <button className="secondary-button" type="button" onClick={() => void load()} aria-label="Atualizar lista"><RefreshCw size={16} /></button>
          <button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /> Novo {meta.singular}</button>
        </div>
      </header>

      <p className="vx-web-hint"><Icon size={16} aria-hidden="true" />{meta.hint}</p>
      {error && <p role="alert" className="creative-error">{error}</p>}
      {notice && <p role="status" className="vx-web-notice">{notice}</p>}

      {loading ? (
        <p role="status" className="vx-web-empty">Carregando {meta.label.toLowerCase()}…</p>
      ) : items.length ? (
        <div className="vx-web-grid">
          {items.map((asset) => (
            <article className="content-card vx-web-card" key={asset.id}>
              <div className="vx-web-card-top">
                <span className={`vx-web-badge tone-${asset.kind === "FORM" ? "violet" : asset.kind === "LANDING" ? "blue" : "mint"}`}><Icon size={16} aria-hidden="true" /></span>
                <span className={"status-pill " + (asset.status === "READY" ? "" : "is-muted")}>{asset.status === "READY" ? "Pronto" : "Rascunho"}</span>
              </div>
              <h2>{asset.title}</h2>
              <p className="vx-web-slug">/{asset.slug}</p>
              {asset.summary && <p className="vx-web-summary">{asset.summary}</p>}
              {asset.kind === "FORM" && <p className="vx-web-meta"><ClipboardList size={14} aria-hidden="true" />{asset.fields.length} {asset.fields.length === 1 ? "campo" : "campos"}</p>}
              <div className="vx-web-actions">
                <button className="secondary-button" type="button" disabled={busy} onClick={() => openEdit(asset)}><Pencil size={14} /> Editar</button>
                <button className="text-button" type="button" disabled={busy} onClick={() => void toggleStatus(asset)}>{asset.status === "READY" ? "Voltar a rascunho" : "Marcar pronto"}</button>
                <button className="text-button danger-text" type="button" disabled={busy} onClick={() => void remove(asset)} aria-label={`Excluir ${asset.title}`}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="content-card vx-web-empty">
          <span className="vx-web-empty-icon"><Icon size={26} aria-hidden="true" /></span>
          <h2>Nenhum {meta.singular} ainda</h2>
          <p>Comece criando um rascunho. Você revisa tudo antes de publicar.</p>
          <button className="primary-button" type="button" onClick={openCreate}><Plus size={16} /> Criar {meta.singular}</button>
        </div>
      )}

      <VexoraDialog
        open={dialog !== null}
        title={dialog === "create" ? `Novo ${meta.singular}` : "Editar"}
        subtitle={meta.label}
        icon={<Icon size={20} aria-hidden="true" />}
        onClose={closeDialog}
        wide={kind === "FORM"}
        footer={
          <>
            <button className="secondary-button" type="button" onClick={closeDialog} disabled={busy}>Cancelar</button>
            <button className="primary-button" type="submit" form="vx-web-form" disabled={busy || !title.trim() || (kind === "FORM" && !fields.some((field) => field.label.trim()))}>{busy ? "Salvando…" : "Salvar rascunho"}</button>
          </>
        }
      >
        <form id="vx-web-form" className="ai-admin-fields vx-web-form" onSubmit={submit}>
          <label>Título<input value={title} maxLength={160} onChange={(e) => { setTitle(e.target.value); if (dialog === "create") setSlug(slugify(e.target.value)); }} placeholder={`Nome do ${meta.singular}`} required /></label>
          <label>Endereço<input value={slug} maxLength={80} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="meu-endereco" /></label>
          <label>Resumo<textarea rows={3} maxLength={400} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Uma frase que explica o objetivo." /></label>

          {kind === "FORM" && (
            <div className="vx-web-fields">
              <div className="vx-web-fields-head"><strong>Campos do formulário</strong><button className="text-button" type="button" onClick={() => setFields((current) => [...current, blankField()])}><Plus size={14} /> Adicionar campo</button></div>
              {fields.map((field, index) => (
                <div className="vx-web-field-row" key={field.id}>
                  <label className="vx-web-field-label"><span>Campo {index + 1}</span><input value={field.label} maxLength={80} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="Ex.: Nome completo" /></label>
                  <label className="vx-web-field-type"><span>Tipo</span><select value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value })}>{FIELD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="vx-web-field-required"><input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} /><span>Obrigatório</span></label>
                  <button className="text-button danger-text vx-web-field-remove" type="button" onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))} aria-label={`Remover campo ${index + 1}`}><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </form>
      </VexoraDialog>
    </section>
  );
}

export const WEB_ASSET_META = META;
