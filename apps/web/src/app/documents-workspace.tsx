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
    <section className="documents-workspace">
      <header className="creative-heading">
        <div>
          <h1>Documentos</h1>
          <p>Orçamentos, contratos e ordens de serviço gerados a partir dos dados do cliente e enviados em um clique.</p>
        </div>
        <div className="workspace-actions">
          <button type="button" className="secondary-button" onClick={() => void load()} aria-label="Atualizar"><RefreshCw size={16} /></button>
          <button type="button" className="primary-button" onClick={() => setEditing("new")}><Plus size={16} /> Novo modelo</button>
        </div>
      </header>
      {error ? <p role="alert" className="docs-error">{error}</p> : null}
      {notice ? <p role="status" className="docs-notice">{notice}</p> : null}
      {loadErrors.length > 0 && <div className="docs-error" role="alert">
        Não foi possível carregar {loadErrors.join(", ")}. <button type="button" className="text-button" onClick={() => void load()}>Tentar novamente</button>
      </div>}

      <div className="docs-tabs" role="tablist" aria-label="Tipo de documento">
        {KINDS.map((item) => (
          <button key={item.id} role="tab" aria-selected={kind === item.id} className={kind === item.id ? "active" : ""} onClick={() => { setKind(item.id); setView("templates"); setGenerated(null); }}>
            {item.label}
          </button>
        ))}
        <button role="tab" aria-selected={view === "history"} className={view === "history" ? "active" : ""} onClick={() => setView("history")}>Gerados recentemente</button>
      </div>

      {view === "templates" ? (
        <div className="docs-grid">
          <div className="docs-list">
            <div className="docs-list-head">
              <strong>Modelos de {kindLabel.toLowerCase()}</strong>
              {!filtered.length && !loadErrors.includes("modelos") ? <button type="button" className="primary-button" disabled={busy} onClick={() => void seed()}><Sparkles size={16} /> Criar modelos iniciais</button> : null}
            </div>
            {filtered.map((template) => (
              <div key={template.id} role="button" tabIndex={0} className="docs-template-item" onClick={() => startGenerate(template)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startGenerate(template); } }}>
                <FileText size={18} aria-hidden="true" />
                <span><strong>{template.name}</strong><small>{template.description || "Modelo personalizado"}</small></span>
                <span className="docs-template-actions">
                  <button type="button" className="docs-icon-btn" aria-label="Editar modelo" onClick={(e) => { e.stopPropagation(); setEditing(template); }}><Pencil size={15} /></button>
                  <button type="button" className="docs-icon-btn danger" aria-label="Excluir modelo" onClick={(e) => { e.stopPropagation(); void removeTemplate(template); }}><Trash2 size={15} /></button>
                </span>
              </div>
            ))}
            {!filtered.length ? <p className="docs-empty">Nenhum modelo ainda. Use “Criar modelos iniciais” para partir de orçamentos, contratos e OS prontos.</p> : null}
          </div>
          <div className="docs-detail">
            <p className="docs-hint">Selecione um modelo para gerar o documento com os dados do cliente (nome, telefone, e-mail, CPF/CNPJ, endereço e documento sincronizados do Asaas).</p>
          </div>
        </div>
      ) : null}

      {view === "generate" && selected ? (
        <div className="docs-generate">
          <div className="docs-form">
            <header className="docs-form-head"><FileText size={18} aria-hidden="true" /><div><strong>{selected.name}</strong><small>{selected.description}</small></div></header>
            <label>Contato (opcional)<select value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">Sem contato (preencher manualmente)</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? " · " + c.phone : ""}</option>)}</select></label>
            {selected.variables.map((variable) => (
              <label key={variable.key}>{variable.label}{variable.required ? <b className="docs-required"> *</b> : null}
                {variable.type === "longtext"
                  ? <textarea rows={3} maxLength={4000} value={values[variable.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [variable.key]: e.target.value }))} />
                  : <input type={variable.type === "date" ? "date" : "text"} maxLength={4000} value={values[variable.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [variable.key]: e.target.value }))} placeholder={variable.type === "money" ? "Ex.: R$ 1.500,00" : ""} />}
              </label>
            ))}
            <div className="docs-actions">
              <button type="button" className="secondary-button" onClick={() => setView("templates")}>Voltar</button>
              <button type="button" className="primary-button" disabled={busy} onClick={() => void generate()}>{busy ? "Gerando…" : "Gerar documento"}</button>
            </div>
          </div>
          <div className="docs-preview">
            {generated ? (
              <>
                <div className="docs-preview-actions">
                  <a className="primary-button" href={`/api/backend/documents/${generated.id}/pdf`} download>Baixar PDF</a>
                  <button type="button" className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Imprimir</button>
                </div>
                <pre className="docs-document">{generated.content}</pre>
                <div className="docs-send">
                  <label>Enviar por e-mail<input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="e-mail do cliente" /></label>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => void sendEmail()}><Mail size={15} /> Enviar</button>
                </div>
                <div className="docs-send">
                  <label>Enviar pelo WhatsApp<input value={conversationTo} onChange={(e) => setConversationTo(e.target.value)} placeholder="ID da conversa (ou abra com ?conversationId=...)" /></label>
                  <button type="button" className="secondary-button" disabled={busy} onClick={() => void sendWhatsapp()}><Mail size={15} /> Enviar</button>
                </div>
              </>
            ) : <p className="docs-hint">O documento gerado aparece aqui. Preencha os campos e clique em “Gerar documento”.</p>}
          </div>
        </div>
      ) : null}

      {view === "history" ? (
        <div className="docs-history">
          <strong>Documentos gerados recentemente</strong>
          {recent.length ? recent.map((doc) => (
            <div key={doc.id} className="docs-history-item">
              <FileText size={16} aria-hidden="true" />
              <span><strong>{doc.name}</strong><small>{doc.contactName ?? "Sem contato"} · {new Date(doc.createdAt).toLocaleDateString("pt-BR")}{doc.sentAt ? " · enviado para " + doc.sentTo : ""}</small></span>
              <a className="text-button" href={`/api/backend/documents/${doc.id}/pdf`} download>PDF</a>
            </div>
          )) : <p className="docs-empty">Nenhum documento gerado ainda para este tipo.</p>}
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
    <div className="docs-editor-backdrop">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="docs-template-title" className="docs-editor-frame">
      <form className="docs-editor" onSubmit={submit}>
        <header className="docs-editor-head"><h2 id="docs-template-title">{template ? "Editar modelo" : "Novo modelo"}</h2><button type="button" className="text-button" onClick={onClose} disabled={busy}>Fechar</button></header>
        <div className="docs-editor-scroll" role="region" aria-label="Campos do modelo" tabIndex={0}>
        {error ? <p role="alert" className="docs-error">{error}</p> : null}
        {loadingBody && <p role="status">Carregando modelo…</p>}
        <label>Nome<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Orçamento de manutenção" /></label>
        <label>Descrição<textarea rows={2} maxLength={240} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <fieldset className="docs-variables">
          <legend>{"Variáveis (use {{chave}} no texto)"}</legend>
          {variables.map((variable, index) => (
            <div key={index} className="docs-variable-row">
              <input value={variable.label} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))} placeholder="Rótulo (ex.: Valor)" aria-label="Rótulo da variável" />
              <input value={variable.key} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, key: e.target.value } : item)))} placeholder="chave_ex: valor" aria-label="Chave da variável" />
              <select value={variable.type} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, type: e.target.value as Variable["type"] } : item)))} aria-label="Tipo">
                <option value="text">Texto</option>
                <option value="longtext">Texto longo</option>
                <option value="date">Data</option>
                <option value="money">Dinheiro</option>
              </select>
              <label className="docs-required-toggle"><input type="checkbox" checked={variable.required === true} onChange={(e) => setVariables((v) => v.map((item, i) => (i === index ? { ...item, required: e.target.checked } : item)))} /> Obrigatória</label>
              <button type="button" className="docs-icon-btn" aria-label="Remover variável" onClick={() => setVariables((v) => v.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="secondary-button" onClick={() => setVariables((v) => [...v, emptyVariable()])}><Plus size={14} /> Adicionar variável</button>
        </fieldset>
        <label>Conteúdo do modelo<textarea required rows={10} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} placeholder={"CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nContratante: {{nome_cliente}}\nObjeto: {{objetivo}}\nValor: {{valor}}"} /></label>
        </div>
        <div className="docs-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancelar</button><button type="submit" className="primary-button" disabled={busy || loadingBody}>{busy ? "Salvando…" : "Salvar modelo"}</button></div>
      </form>
      </div>
    </div>,
    document.body,
  );
}
