"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "../lib/use-modal-dialog";
import {
  FileText, Plus, RefreshCw, Printer, Mail, Trash2, Pencil, Sparkles,
} from "lucide-react";

type Variable = { key: string; label: string; type: "text" | "longtext" | "date" | "money"; required?: boolean };
type Template = { id: string; kind: string; name: string; description: string; variables: Variable[] };
type Generated = { id: string; name: string; kind: string; contactName?: string | null; sentAt?: string | null; sentTo?: string | null; createdAt: string; content?: string };
type Contact = { id: string; name: string; phone?: string | null; email?: string | null };

/* TW utility-first: cores do preset, azul só por tokens blue-*. */
const rootTw = "grid min-w-0 content-start gap-token";
const headingTw = "flex flex-wrap items-center justify-between gap-4 rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface px-5 py-4 shadow-token-sm";
const headingActionsTw = "flex flex-none items-center gap-2.5";
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-brand-pad text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-brand-pad text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const secondaryIconTw = "inline-grid size-docs-icon place-items-center rounded-xl border border-line bg-surface-2 text-ink shadow-token-sm transition-colors hover:bg-hover";
const textButtonTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-surface hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const errorTw = "m-0 rounded-docs-alert border border-red-600 bg-red-100 px-3 py-2.5 text-docs-hint text-red-600";
const noticeTw = "m-0 rounded-docs-alert border border-emerald-600 bg-emerald-100 px-3 py-2.5 text-docs-hint text-emerald-600";
const tabsTw = "flex flex-wrap gap-1.5 print:hidden";
const tabTw = "rounded-full border border-line bg-surface px-4 py-2 text-body font-semibold text-ink-secondary transition-colors";
const tabStateTw: Record<string, string> = { on: "border-blue-600 bg-blue-600 text-blue-50", off: "border-line bg-surface text-ink-secondary" };
const tabClass = (active: boolean) => `${tabTw} ${tabStateTw[active ? "on" : "off"]}`;
const gridTw = "grid grid-cols-docs-grid items-start gap-4 rw-wide:grid-cols-1";
const listTw = "grid content-start gap-2.5";
const listHeadTw = "flex items-center justify-between gap-2.5 px-0.5 py-1";
const listHeadTitleTw = "font-display text-body font-extrabold tracking-wide text-ink-secondary";
const templateItemTw = "flex w-full items-center gap-3 rounded-docs-card border border-line bg-surface px-3.5 py-3 text-left text-ink transition-colors hover:border-blue-600 hover:shadow-token-sm";
const templateCopyTw = "grid min-w-0 gap-0.5";
const templateNameTw = "text-docs-name font-bold";
const templateDescTw = "block max-w-full truncate text-docs-meta text-ink-secondary";
const templateActionsTw = "ml-auto flex flex-none items-center gap-1.5";
const iconBtnTw = "inline-grid size-docs-icon place-items-center rounded-lg border border-line bg-transparent text-ink-secondary transition-colors hover:bg-hover hover:text-ink";
const iconBtnDangerTw = "inline-grid size-docs-icon place-items-center rounded-lg border border-line bg-transparent text-red-600 transition-colors hover:bg-red-100 hover:text-red-600";
const emptyTw = "rounded-docs-empty border border-dashed border-line-strong px-3.5 py-3.5 text-docs-hint text-ink-secondary";
const detailTw = "rounded-docs-card border border-dashed border-line-strong p-docs-pad text-body leading-normal text-ink-secondary";
const hintTw = "text-docs-hint leading-normal text-ink-secondary";
const generateTw = "grid grid-cols-docs-generate items-start gap-4 rw-wide:grid-cols-1";
const formTw = "grid gap-3 rounded-docs-card border border-line bg-surface p-4";
const formHeadTw = "flex items-center gap-3 border-b border-line pb-2";
const requiredTw = "text-red-600";
const labelTw = "grid gap-1.5 text-small font-bold text-ink-secondary";
const controlTw = "min-h-9 rounded-docs-field border border-line bg-surface-2 px-2.5 py-2 font-inherit text-ink transition-colors focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-blue-600";
const editorControlTw = `${controlTw} w-full min-w-0`;
const actionsTw = "flex justify-end gap-2.5 border-t border-line pt-3";
const previewTw = "grid content-start gap-3";
const previewActionsTw = "flex flex-wrap gap-2.5 print:hidden";
const documentTw = "m-0 max-h-docs-document overflow-auto whitespace-pre-wrap rounded-docs-card border border-line bg-surface p-docs-pad font-ui text-docs-document text-ink print:max-h-none print:border-0 print:shadow-none";
const sendTw = "flex flex-wrap items-end gap-2.5 print:hidden";
const sendLabelTw = "grid min-w-docs-send flex-1 gap-1.5 text-small font-bold text-ink-secondary";
const historyTw = "grid gap-2";
const historyItemTw = "flex items-center gap-3 rounded-docs-empty border border-line bg-surface px-3.5 py-3";
const historyMetaTw = "block text-2xs text-ink-secondary";
const editorWindowTw = "fixed inset-0 z-docs-editor bg-surface";
const editorFrameTw = "h-docs-frame w-docs-frame min-w-0";
const editorTw = "grid h-full w-full grid-rows-docs-editor bg-surface";
const editorHeadTw = "flex items-center justify-between gap-2.5 border-b border-line bg-surface px-docs-editor-x pb-3 pt-docs-safe-top";
const editorTitleTw = "m-0";
const editorScrollTw = "grid min-h-0 min-w-0 content-start gap-4 overflow-auto overscroll-contain bg-surface px-docs-editor-x pb-7 pt-4";
const editorActionsTw = "flex justify-end gap-2.5 border-t border-line bg-surface px-docs-editor-x pb-docs-safe-bottom pt-3";
const variablesTw = "mt-3 grid gap-2 rounded-docs-empty border border-line p-3";
const variablesLegendTw = "px-1.5 text-2xs font-extrabold uppercase tracking-wider text-ink-secondary";
const variableRowTw = "grid grid-cols-docs-variable items-center gap-1.5 ov-tablet:grid-cols-2";
const requiredToggleTw = "inline-flex items-center gap-1.5 text-2xs font-semibold text-ink-secondary";
const KINDS = [
  { id: "QUOTE", label: "Orçamentos" },
  { id: "CONTRACT", label: "Contratos" },
  { id: "WORK_ORDER", label: "Ordens de serviço" },
  { id: "RECEIPT", label: "Recibos" },
] as const;

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch("/api/backend/" + path, { cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Não foi possível concluir a operação.");
  return data as T;
};

const emptyVariable = (): Variable => ({ key: "", label: "", type: "text", required: false });

export function DocumentsWorkspace() {
  const [kind, setKind] = useState<string>("QUOTE");
  const [view, setView] = useState<"templates" | "generate" | "history">("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Generated[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [editing, setEditing] = useState<Template | null | "new">(null);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [contactId, setContactId] = useState("");
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [conversationTo, setConversationTo] = useState("");

  useEffect(() => {
    try { const preset = new URLSearchParams(window.location.search).get("conversationId"); if (preset) setConversationTo(preset); } catch {}
  }, []);

  async function sendWhatsapp() {
    if (!generated) return;
    const conversationId = conversationTo.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) { setError("Informe o ID de uma conversa válida (ou abra pelo atendimento)."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/backend/documents/${generated.id}/send-whatsapp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "Não foi possível enviar.");
      setNotice("Documento enviado pelo WhatsApp e registrado na conversa.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar."); } finally { setBusy(false); }
  }

  const load = useCallback(async () => {
    setError("");
    const [list, recent, contactList] = await Promise.allSettled([
      api<{ templates: Template[] }>("documents/templates"),
      api<{ documents: Generated[] }>("documents/recent"),
      api<Contact[]>("contacts"),
    ]);
    if (list.status === "fulfilled") setTemplates(list.value.templates);
    if (recent.status === "fulfilled") setDocuments(recent.value.documents);
    if (contactList.status === "fulfilled") setContacts(contactList.value);
    const failures: string[] = [];
    if (list.status === "rejected") failures.push("modelos");
    if (recent.status === "rejected") failures.push("documentos recentes");
    if (contactList.status === "rejected") failures.push("contatos");
    setLoadErrors(failures);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = templates.filter((t) => t.kind === kind);
  const recent = documents.filter((d) => d.kind === kind);

  async function seed() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ created: Array<{ kind: string; name: string; skipped: boolean }> }>("documents/templates/seed", { method: "POST" });
      setNotice(result.created.some((item) => !item.skipped) ? "Modelos iniciais criados. Selecione um para gerar o primeiro documento." : "Os modelos iniciais já existiam.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao criar os modelos."); } finally { setBusy(false); }
  }

  async function removeTemplate(template: Template) {
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;
    setBusy(true); setError("");
    try {
      await api(`documents/templates/${template.id}`, { method: "DELETE" });
      setNotice("Modelo excluído.");
      setSelected(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir."); } finally { setBusy(false); }
  }

  function startGenerate(template: Template) {
    setSelected(template);
    setValues(Object.fromEntries(template.variables.map((v) => [v.key, ""])));
    setContactId("");
    setGenerated(null);
    setView("generate");
  }

  async function generate() {
    if (!selected) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ document: Generated }>("documents/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: selected.id, values, contactId: contactId || undefined }),
      });
      setGenerated(result.document);
      setNotice("Documento gerado. Baixe o PDF ou envie por e-mail.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao gerar."); } finally { setBusy(false); }
  }

  async function sendEmail() {
    if (!generated) return;
    const to = emailTo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { setError("Informe um e-mail válido."); return; }
    setBusy(true); setError("");
    try {
      const result = await api<{ sent: boolean; reason?: string }>(`documents/${generated.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: to }),
      });
      setNotice(result.sent ? `E-mail enviado para ${to}.` : `Não foi possível enviar: ${result.reason ?? "verifique o e-mail."}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao enviar."); } finally { setBusy(false); }
  }

  const kindLabel = KINDS.find((k) => k.id === kind)?.label ?? "Documentos";

  return (
    <section className={rootTw}>
      <header className={headingTw}>
        <div>
          <h1>Documentos</h1>
          <p>Orçamentos, contratos e ordens de serviço gerados a partir dos dados do cliente e enviados em um clique.</p>
        </div>
        <div className={headingActionsTw}>
          <button type="button" className={secondaryIconTw} onClick={() => void load()} aria-label="Atualizar"><RefreshCw size={16} /></button>
          <button type="button" className={primaryTw} onClick={() => setEditing("new")}><Plus size={16} /> Novo modelo</button>
        </div>
      </header>
      {error ? <p role="alert" className={errorTw}>{error}</p> : null}
      {notice ? <p role="status" className={noticeTw}>{notice}</p> : null}
      {loadErrors.length > 0 && <div className={errorTw} role="alert">
        Não foi possível carregar {loadErrors.join(", ")}. <button type="button" className={textButtonTw} onClick={() => void load()}>Tentar novamente</button>
      </div>}

      <div className={tabsTw} role="tablist" aria-label="Tipo de documento">
        {KINDS.map((item) => (
          <button key={item.id} role="tab" aria-selected={kind === item.id} className={tabClass(kind === item.id)} onClick={() => { setKind(item.id); setView("templates"); setGenerated(null); }}>
            {item.label}
          </button>
        ))}
        <button role="tab" aria-selected={view === "history"} className={tabClass(view === "history")} onClick={() => setView("history")}>Gerados recentemente</button>
      </div>

      {view === "templates" ? (
        <div className={gridTw}>
          <div className={listTw}>
            <div className={listHeadTw}>
              <strong className={listHeadTitleTw}>Modelos de {kindLabel.toLowerCase()}</strong>
              {!filtered.length && !loadErrors.includes("modelos") ? <button type="button" className={primaryTw} disabled={busy} onClick={() => void seed()}><Sparkles size={16} /> Criar modelos iniciais</button> : null}
            </div>
            {filtered.map((template) => (
              <div key={template.id} role="button" tabIndex={0} className={templateItemTw} onClick={() => startGenerate(template)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startGenerate(template); } }}>
                <FileText size={18} aria-hidden="true" />
                <span className={templateCopyTw}><strong className={templateNameTw}>{template.name}</strong><small className={templateDescTw}>{template.description || "Modelo personalizado"}</small></span>
                <span className={templateActionsTw}>
                  <button type="button" className={iconBtnTw} aria-label="Editar modelo" onClick={(e) => { e.stopPropagation(); setEditing(template); }}><Pencil size={15} /></button>
                  <button type="button" className={iconBtnDangerTw} aria-label="Excluir modelo" onClick={(e) => { e.stopPropagation(); void removeTemplate(template); }}><Trash2 size={15} /></button>
                </span>
              </div>
            ))}
            {!filtered.length ? <p className={emptyTw}>Nenhum modelo ainda. Use “Criar modelos iniciais” para partir de orçamentos, contratos e OS prontos.</p> : null}
          </div>
          <div className={detailTw}>
            <p className={hintTw}>Selecione um modelo para gerar o documento com os dados do cliente (nome, telefone, e-mail, CPF/CNPJ, endereço e documento sincronizados do Asaas).</p>
          </div>
        </div>
      ) : null}

      {view === "generate" && selected ? (
        <div className={generateTw}>
          <div className={formTw}>
            <header className={formHeadTw}><FileText size={18} aria-hidden="true" /><div className={templateCopyTw}><strong className={templateNameTw}>{selected.name}</strong><small className={templateDescTw}>{selected.description}</small></div></header>
            <label className={labelTw}>Contato (opcional)<select className={controlTw} value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">Sem contato (preencher manualmente)</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? " · " + c.phone : ""}</option>)}</select></label>
            {selected.variables.map((variable) => (
              <label key={variable.key} className={labelTw}>{variable.label}{variable.required ? <b className={requiredTw}> *</b> : null}
                {variable.type === "longtext"
                  ? <textarea className={controlTw} rows={3} maxLength={4000} value={values[variable.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [variable.key]: e.target.value }))} />
                  : <input className={controlTw} type={variable.type === "date" ? "date" : "text"} maxLength={4000} value={values[variable.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [variable.key]: e.target.value }))} placeholder={variable.type === "money" ? "Ex.: R$ 1.500,00" : ""} />}
              </label>
            ))}
            <div className={actionsTw}>
              <button type="button" className={secondaryTw} onClick={() => setView("templates")}>Voltar</button>
              <button type="button" className={primaryTw} disabled={busy} onClick={() => void generate()}>{busy ? "Gerando…" : "Gerar documento"}</button>
            </div>
          </div>
          <div className={previewTw}>
            {generated ? (
              <>
                <div className={previewActionsTw}>
                  <a className={primaryTw} href={`/api/backend/documents/${generated.id}/pdf`} download>Baixar PDF</a>
                  <button type="button" className={secondaryTw} onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
                </div>
                <pre className={documentTw}>{generated.content}</pre>
                <div className={sendTw}>
                  <label className={sendLabelTw}>Enviar por e-mail<input className={controlTw} type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="e-mail do cliente" /></label>
                  <button type="button" className={secondaryTw} disabled={busy} onClick={() => void sendEmail()}><Mail size={15} /> Enviar</button>
                </div>
                <div className={sendTw}>
                  <label className={sendLabelTw}>Enviar pelo WhatsApp<input className={controlTw} value={conversationTo} onChange={(e) => setConversationTo(e.target.value)} placeholder="ID da conversa (ou abra com ?conversationId=...)" /></label>
                  <button type="button" className={secondaryTw} disabled={busy} onClick={() => void sendWhatsapp()}><Mail size={15} /> Enviar</button>
                </div>
              </>
            ) : <p className={hintTw}>O documento gerado aparece aqui. Preencha os campos e clique em “Gerar documento”.</p>}
          </div>
        </div>
      ) : null}

      {view === "history" ? (
        <div className={historyTw}>
          <strong className={listHeadTitleTw}>Documentos gerados recentemente</strong>
          {recent.length ? recent.map((doc) => (
            <div key={doc.id} className={historyItemTw}>
              <FileText size={16} aria-hidden="true" />
              <span className={templateCopyTw}><strong className={templateNameTw}>{doc.name}</strong><small className={historyMetaTw}>{doc.contactName ?? "Sem contato"} · {new Date(doc.createdAt).toLocaleDateString("pt-BR")}{doc.sentAt ? " · enviado para " + doc.sentTo : ""}</small></span>
              <a className={textButtonTw} href={`/api/backend/documents/${doc.id}/pdf`} download>PDF</a>
            </div>
          )) : <p className={emptyTw}>Nenhum documento gerado ainda para este tipo.</p>}
        </div>
      ) : null}

      {editing ? <TemplateEditor key={editing === "new" ? "new" : editing.id} kind={kind} template={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} /> : null}
    </section>
  );
}

function TemplateEditor({ kind, template, onClose, onSaved }: { kind: string; template: Template | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [variables, setVariables] = useState<Variable[]>(template?.variables?.length ? template.variables : [emptyVariable()]);
  const [body, setBody] = useState("");
  const [loadingBody, setLoadingBody] = useState(template !== null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useModalDialog(true, dialogRef, () => { if (!busy) onClose(); });
  useEffect(() => {
    if (!template) return;
    let live = true;
    api<{ template: Template & { body?: string } }>(`documents/templates/${template.id}`)
      .then((res) => {
        if (!live) return;
        setBody(typeof res.template.body === "string" ? res.template.body : "");
        const fetched = Array.isArray(res.template.variables) ? res.template.variables : [];
        setVariables(fetched.length ? fetched : [emptyVariable()]);
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "Não foi possível abrir o modelo.");
      })
      .finally(() => {
        if (live) setLoadingBody(false);
      });
    return () => {
      live = false;
    };
  }, [template]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (!body.trim()) throw new Error("Escreva o conteúdo do modelo.");
      const cleanVars = variables.filter((v) => v.label.trim());
      const seen = new Set<string>();
      for (const variable of cleanVars) {
        const key = variable.key.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) throw new Error(`Variável "${variable.label}" precisa de uma chave válida (minúsculas, números, _ — ex.: nome_cliente).`);
        if (seen.has(key)) throw new Error(`Variável duplicada: ${key}`);
        seen.add(key);
      }
      await api(`documents/templates${template ? "/" + template.id : ""}`, {
        method: template ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, name: name.trim(), description: description.trim(), variables: cleanVars, body }),
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao salvar."); } finally { setBusy(false); }
  }

  return createPortal(
    <div className={editorWindowTw}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="docs-template-title" className={editorFrameTw}>
      <form className={editorTw} onSubmit={submit}>
        <header className={editorHeadTw}><h2 id="docs-template-title" className={editorTitleTw}>{template ? "Editar modelo" : "Novo modelo"}</h2><button type="button" className={textButtonTw} onClick={onClose} disabled={busy}>Fechar</button></header>
        <div className={editorScrollTw} role="region" aria-label="Campos do modelo" tabIndex={0}>
        {error ? <p role="alert" className={errorTw}>{error}</p> : null}
        {loadingBody && <p role="status">Carregando modelo…</p>}
        <label className={labelTw}>Nome<input className={editorControlTw} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Orçamento de manutenção" /></label>
        <label className={labelTw}>Descrição<textarea className={editorControlTw} rows={2} maxLength={240} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <fieldset className={variablesTw}>
          <legend className={variablesLegendTw}>{"Variáveis (use {{chave}} no texto)"}</legend>
          {variables.map((variable, index) => (
            <div key={index} className={variableRowTw}>
              <input className={editorControlTw} value={variable.label} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))} placeholder="Rótulo (ex.: Valor)" aria-label="Rótulo da variável" />
              <input className={editorControlTw} value={variable.key} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, key: e.target.value } : item)))} placeholder="chave_ex: valor" aria-label="Chave da variável" />
              <select className={editorControlTw} value={variable.type} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, type: e.target.value as Variable["type"] } : item)))} aria-label="Tipo">
                <option value="text">Texto</option>
                <option value="longtext">Texto longo</option>
                <option value="date">Data</option>
                <option value="money">Dinheiro</option>
              </select>
              <label className={requiredToggleTw}><input type="checkbox" checked={variable.required === true} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, required: e.target.checked } : item)))} /> Obrigatória</label>
              <button type="button" className={iconBtnTw} aria-label="Remover variável" onClick={() => setVariables((v) => v.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className={secondaryTw} onClick={() => setVariables((v) => [...v, emptyVariable()])}><Plus size={14} /> Adicionar variável</button>
        </fieldset>
        <label className={labelTw}>Conteúdo do modelo<textarea className={editorControlTw} required rows={10} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} placeholder={"CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nContratante: {{nome_cliente}}\nObjeto: {{objetivo}}\nValor: {{valor}}"} /></label>
        </div>
        <div className={actionsTw}><button type="button" className={secondaryTw} onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className={primaryTw} disabled={busy || loadingBody}>{busy ? "Salvando…" : "Salvar modelo"}</button></div>
      </form>
      </div>
    </div>,
    document.body,
  );
}
