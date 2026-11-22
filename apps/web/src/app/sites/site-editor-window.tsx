"use client";

/**
 * Janela do editor visual dentro da Véxora.
 *
 * Não é uma rota solta nem um modal de confirmação: cobre o viewport da aplicação,
 * mantém o estado do documento e reduz a um dock na própria interface quando minimizada.
 * Domínio e publicação usam endpoints reais; o ajuste por IA volta como patch para revisão
 * humana e só entra no documento depois que a pessoa aplica e salva.
 */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Copy, ExternalLink, Loader2, Maximize2, X } from "lucide-react";
import type { SiteDocument, SiteNode } from "@/shared-types/site-document";
import { EditorShell, findNodeById, replaceNodeById } from "./editor/editor-shell";

type DocumentRow = { document: SiteDocument; version: number };

type FormSubmission = {
  id: string;
  createdAt: string;
  formName: string;
  values: Record<string, unknown>;
};

type SubmissionsRow = { total: number; submissions: FormSubmission[] };

type SiteEditorWindowProps = {
  siteId: string;
  title: string;
  domain?: string | null;
  domainStatus?: string;
  canEdit?: boolean;
  onClose: () => void;
};

const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";

const editorWindowClass = "fixed inset-0 z-10000 flex flex-col bg-surface-page text-ink";
const editorDockClass = "fixed bottom-6 left-1/2 z-10001 flex -translate-x-1/2 items-center gap-2 rounded-token border border-line bg-surface p-1.5 shadow-token-lg";
const dockRestoreClass = "inline-flex items-center gap-1.5 rounded-token bg-brand px-4 py-2 text-body font-bold text-brand-contrast transition-colors hover:bg-brand-strong";
const dockLabelClass = "pl-1.5 text-body font-bold text-ink";
const dockCloseClass = "inline-flex h-9 w-9 items-center justify-center rounded-token border border-line bg-surface text-ink transition-colors hover:bg-hover";
const loadingClass = "flex items-center gap-2.5 p-6 text-ink-secondary";
const errorPanelClass = "m-4 rounded-token border border-red-600 p-4";
const errorCopyClass = "m-0 flex items-center gap-2";
const responseErrorPanelClass = "mx-4 mt-3 rounded-token border border-red-600 p-3";
const responseSuccessPanelClass = "mx-4 mt-3 rounded-token border border-emerald-600 p-3";
const responseSuccessCopyClass = "m-0 text-body";
const previewBarClass = "flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5";
const previewCopyClass = "mr-auto flex min-w-60 flex-col gap-0.5";
const previewTitleClass = "text-body font-bold text-ink";
const previewNoteClass = "text-small text-ink-secondary";
const previewExpiryClass = "text-small text-ink-secondary";
const previewErrorClass = "m-0 basis-full text-small text-red-600";
const aiStatusBaseClass = "mx-4 mt-0 rounded-token-sm border px-3 py-2 text-small";
const aiStatusOkClass = "border-emerald-600 bg-emerald-100 text-emerald-600";
const aiStatusErrorClass = "border-red-600 bg-red-100 text-red-600";
const detailsClass = "group/settings shrink-0 px-4 text-ink";
const detailsSummaryClass = "cursor-pointer list-none py-2 text-small font-bold text-ink-secondary group-open/settings:text-ink";
const settingsRowClass = "flex flex-wrap items-center gap-2 border-b border-line bg-surface py-2.5 group-open/settings:border-b-0";
const domainLabelClass = "text-body font-bold";
const domainInputClass = "min-w-56 rounded-token-sm border border-line bg-surface-page px-2.5 py-2 text-body text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none";
const domainStatusClass = "text-small opacity-75";
const domainOkClass = "basis-full text-small text-emerald-600";
const domainErrorClass = "basis-full text-small text-red-600";
const responsesClass = "group/responses shrink-0 px-4 text-ink";
const responsesBodyClass = "mb-2 flex max-h-42 flex-col gap-2 rounded-token-sm border border-line bg-surface p-3";
const responsesBodyTextClass = "m-0 text-body text-ink-secondary";
const responseCardClass = "rounded-token-sm border border-line p-2.5";
const responseHeaderClass = "flex justify-between gap-3 text-small";
const responseTimeClass = "text-ink-secondary";
const responseValuesClass = "mt-1 break-words text-body";

type Device = "desktop" | "tablet" | "mobile";

function isDocument(value: unknown): value is SiteDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<SiteDocument>;
  return !!doc.root && typeof doc.root === "object" && !!doc.meta && typeof doc.meta === "object";
}

/** O bloco pode estar na home ou em qualquer página secundária. */
function findNodeInDocument(doc: SiteDocument, nodeId: string): SiteNode | null {
  const home = findNodeById(doc.root, nodeId);
  if (home) return home;
  for (const page of doc.pages ?? []) {
    const found = findNodeById(page.root, nodeId);
    if (found) return found;
  }
  return null;
}

function replaceNodeInDocument(doc: SiteDocument, nodeId: string, next: SiteNode): SiteDocument {
  const root = findNodeById(doc.root, nodeId) ? replaceNodeById(doc.root, nodeId, next) : doc.root;
  const pages = (doc.pages ?? []).map((page) =>
    findNodeById(page.root, nodeId) ? { ...page, root: replaceNodeById(page.root, nodeId, next) } : page,
  );
  return { ...doc, root, pages };
}

export default function SiteEditorWindow({
  siteId,
  title,
  domain,
  domainStatus,
  canEdit = true,
  onClose,
}: SiteEditorWindowProps) {
  const [doc, setDoc] = useState<SiteDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLink, setPreviewLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ url: string; idempotent: boolean } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionsRow | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState(domain ?? "");
  const [domainState, setDomainState] = useState(domainStatus ?? "NONE");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainMessage, setDomainMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch(`/api/backend/sites/${siteId}/document`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message || "Não foi possível abrir o documento deste site.");
        }
        return payload as DocumentRow;
      })
      .then((row) => {
        if (!live) return;
        if (!isDocument(row.document)) throw new Error("O documento salvo está em um formato não reconhecido.");
        setDoc(row.document);
      })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : "Não foi possível abrir o documento.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [siteId]);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm("Existem alterações não salvas. Fechar mesmo assim?")) return;
    onClose();
  }, [dirty, onClose]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!doc || saving) return false;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/backend/sites/${siteId}/document`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Não foi possível salvar o documento.");
      }
      setDirty(false);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível salvar o documento.";
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [doc, saving, siteId]);

  // O link aponta para o rascunho salvo: salvar antes evita mostrar um estado que
  // não existe no servidor. Nada aqui publica, cria deployment ou mexe em domínio.
  const createPreview = useCallback(async (): Promise<void> => {
    if (previewBusy || saving) return;
    setPreviewError(null);
    if (dirty && !(await save())) {
      setPreviewError("Salve as alterações antes de gerar a prévia temporária.");
      return;
    }
    setPreviewBusy(true);
    try {
      const response = await fetch(`/api/backend/sites/${siteId}/document/preview`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Não foi possível gerar a prévia temporária.");
      const path = String(payload?.path || "");
      if (!path.startsWith("/api/public/sites/preview/")) throw new Error("Endereço de prévia inválido.");
      const token = path.slice("/api/public/sites/preview/".length);
      if (!token || /[/?#]/.test(token)) throw new Error("Endereço de prévia inválido.");
      // O token voltou do caminho público da API; a pessoa abre a página da Véxora,
      // que busca o HTML pelo proxy /api/backend (sem expor a URL da API).
      setPreviewLink({
        url: new URL(`/sites/preview/${encodeURIComponent(token)}`, window.location.origin).toString(),
        expiresAt: String(payload?.expiresAt || ""),
      });
    } catch (cause) {
      setPreviewError(cause instanceof Error ? cause.message : "Não foi possível gerar a prévia temporária.");
    } finally {
      setPreviewBusy(false);
    }
  }, [dirty, previewBusy, save, saving, siteId]);

  const copyPreviewLink = useCallback(async (): Promise<void> => {
    if (!previewLink) return;
    try {
      await navigator.clipboard.writeText(previewLink.url);
      setPreviewError(null);
    } catch {
      setPreviewError("Não foi possível copiar o link. Selecione o endereço exibido e copie manualmente.");
    }
  }, [previewLink]);

  const bindDomain = useCallback(async (): Promise<void> => {
    const value = domainInput.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
      setDomainError("Informe um domínio válido, como www.exemplo.com.br.");
      return;
    }
    setDomainBusy(true);
    setDomainError(null);
    setDomainMessage(null);
    try {
      const response = await fetch(`/api/backend/sites/${siteId}/domain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Não foi possível vincular o domínio.");
      setDomainState("PENDING_DNS");
      setDomainMessage(payload?.instructions || `CNAME: ${value} -> ${payload?.cnameTarget || "projeto.pages.dev"}`);
    } catch (cause) {
      setDomainError(cause instanceof Error ? cause.message : "Não foi possível vincular o domínio.");
    } finally {
      setDomainBusy(false);
    }
  }, [domainInput, siteId]);

  const verifyDomain = useCallback(async (): Promise<void> => {
    setDomainBusy(true);
    setDomainError(null);
    setDomainMessage(null);
    try {
      const response = await fetch(`/api/backend/sites/${siteId}/domain/verify`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Não foi possível verificar o domínio.");
      setDomainState(String(payload?.status || "VERIFYING"));
      setDomainMessage(
        payload?.verified
          ? "Domínio ativo e SSL emitido."
          : "Domínio ainda não ativo. Confira o CNAME no seu provedor de DNS e tente novamente.",
      );
    } catch (cause) {
      setDomainError(cause instanceof Error ? cause.message : "Não foi possível verificar o domínio.");
    } finally {
      setDomainBusy(false);
    }
  }, [siteId]);

  const publish = useCallback(async (): Promise<void> => {
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);
    try {
      const response = await fetch(`/api/backend/sites/${siteId}/deploy`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Não foi possível publicar o site.");
      }
      setPublishResult({
        url: String(payload?.url || ""),
        idempotent: payload?.idempotent === true,
      });
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : "Não foi possível publicar o site.");
    } finally {
      setPublishing(false);
    }
  }, [siteId]);

  const handleAIChange = useCallback(
    async (prompt: string, nodeId: string): Promise<void> => {
      if (!doc || !prompt.trim() || aiBusy) return;
      const node = findNodeInDocument(doc, nodeId);
      if (!node) return;
      setAiBusy(true);
      setAiMessage(null);
      try {
        const response = await fetch(`/api/backend/sites/${siteId}/document/ai-edit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ node, prompt }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.message || "Não foi possível ajustar o bloco.");
        }
        setDoc((current) =>
          current ? replaceNodeInDocument(current, nodeId, payload.node as SiteNode) : current,
        );
        setDirty(true);
        setAiMessage({
          text: payload.appliedBy === "model"
            ? `IA aplicou o ajuste${payload.model ? ` (${String(payload.model)})` : ""}. Revise e salve.`
            : "Ajuste rápido aplicado. Revise e salve.",
          error: false,
        });
      } catch (cause) {
        setAiMessage({ text: cause instanceof Error ? cause.message : "Não foi possível ajustar o bloco.", error: true });
      } finally {
        setAiBusy(false);
      }
    },
    [doc, aiBusy, siteId],
  );

  const loadSubmissions = useCallback(async (): Promise<void> => {
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const response = await fetch(`/api/backend/sites/${siteId}/forms/submissions?limit=50`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Não foi possível carregar as respostas.");
      setSubmissions(payload as SubmissionsRow);
    } catch (cause) {
      setSubmissionsError(cause instanceof Error ? cause.message : "Não foi possível carregar as respostas.");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [siteId]);

  // O workspace anima a entrada dos filhos de .page-content; o transform
  // resultante vira containing block de position: fixed. O portal em document.body
  // garante que a janela do editor cubra o viewport de verdade.
  if (typeof document === "undefined") return null;

  if (minimized) {
    return createPortal(
      <div className={editorDockClass} role="region" aria-label="Editor minimizado">
        <button type="button" className={dockRestoreClass} onClick={() => setMinimized(false)} title="Restaurar editor">
          <Maximize2 size={16} aria-hidden="true" />
          <span className={dockLabelClass}>Editando: {title}{dirty ? " • não salvo" : ""}</span>
        </button>
        <button type="button" className={dockCloseClass} onClick={requestClose} aria-label="Fechar editor" title="Fechar editor">
          <X size={16} aria-hidden="true" />
        </button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className={editorWindowClass} role="region" aria-label={`Editor do site ${title}`}>
      {loading ? (
        <div className={loadingClass} role="status">
          <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Abrindo editor…
        </div>
      ) : null}

      {error ? (
        <div className={errorPanelClass} role="alert">
          <p className={errorCopyClass}>
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </p>
          <button type="button" className={`${secondaryTw} mt-3`} onClick={requestClose}>
            Voltar para Sites
          </button>
        </div>
      ) : null}

      {!loading && !error && doc ? (
        <>
          <section className={previewBarClass} aria-label="Prévia temporária">
            <div className={previewCopyClass}>
              <strong className={previewTitleClass}>Ver antes de publicar</strong>
              <small className={previewNoteClass}>
                Prévia temporária do rascunho salvo · não é publicação · o link expira em 2 horas
              </small>
            </div>
            <button
              type="button"
              className={secondaryTw}
              onClick={() => void createPreview()}
              disabled={previewBusy || saving || loading}
            >
              {previewBusy ? <Loader2 className="animate-spin" size={14} aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />}
              {previewBusy ? "Gerando…" : previewLink ? "Atualizar prévia" : "Ver prévia temporária"}
            </button>
            {previewLink ? (
              <>
                <a className={secondaryTw} href={previewLink.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} aria-hidden="true" /> Abrir link
                </a>
                <button type="button" className={secondaryTw} onClick={() => void copyPreviewLink()}>
                  <Copy size={14} aria-hidden="true" /> Copiar
                </button>
                <small className={previewExpiryClass}>
                  Válido até {new Date(previewLink.expiresAt).toLocaleString("pt-BR")}
                </small>
              </>
            ) : null}
            {previewError ? <p role="alert" className={previewErrorClass}>{previewError}</p> : null}
          </section>

          {aiMessage ? (
            <div
              className={`${aiStatusBaseClass} ${aiMessage.error ? aiStatusErrorClass : aiStatusOkClass}`}
              role={aiMessage.error ? "alert" : "status"}
            >
              {aiMessage.text}
            </div>
          ) : null}
        </>
      ) : null}

      {!loading && !error && doc ? (
        <details className={detailsClass}>
          <summary className={detailsSummaryClass}>Domínio, publicação e respostas</summary>
          <div className={settingsRowClass}>
            <label htmlFor={`domain-${siteId}`} className={domainLabelClass}>
              Domínio próprio
            </label>
            <input
              id={`domain-${siteId}`}
              type="text"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              placeholder="www.seusite.com.br"
              aria-label="Domínio do site"
              className={domainInputClass}
            />
            <button type="button" className={secondaryTw} onClick={() => void bindDomain()} disabled={domainBusy}>
              Vincular
            </button>
            <button type="button" className={secondaryTw} onClick={() => void verifyDomain()} disabled={domainBusy || !domainInput}>
              Verificar
            </button>
            <span className={domainStatusClass}>Status: {domainState}</span>
            {domainMessage ? (
              <small role="status" className={domainOkClass}>
                {domainMessage}
              </small>
            ) : null}
            {domainError ? (
              <small role="alert" className={domainErrorClass}>
                {domainError}
              </small>
            ) : null}
          </div>

          {publishError ? (
            <div className={responseErrorPanelClass} role="alert">
              <p className={errorCopyClass}>
                <AlertCircle size={16} aria-hidden="true" /> {publishError}
              </p>
            </div>
          ) : null}

          {publishResult ? (
            <div className={responseSuccessPanelClass} role="status">
              <p className={responseSuccessCopyClass}>
                {publishResult.idempotent ? "Este conteúdo já estava publicado. " : "Publicação concluída. "}
                {publishResult.url ? (
                  <a href={publishResult.url} target="_blank" rel="noopener noreferrer">
                    Abrir site publicado
                  </a>
                ) : null}
              </p>
            </div>
          ) : null}

          <details
            className={responsesClass}
            onToggle={(event) => {
              if (event.currentTarget.open && !submissions && !submissionsLoading) void loadSubmissions();
            }}
          >
            <summary className={detailsSummaryClass}>Respostas do formulário{submissions ? ` (${submissions.total})` : ""}</summary>
            <div className={responsesBodyClass}>
              <button
                type="button"
                className={secondaryTw}
                onClick={() => void loadSubmissions()}
                disabled={submissionsLoading}
              >
                {submissionsLoading ? "Atualizando…" : "Atualizar"}
              </button>
              {submissionsError ? <p role="alert" className={`${responsesBodyTextClass} text-red-600`}>{submissionsError}</p> : null}
              {!submissions && !submissionsError && !submissionsLoading ? (
                <p className={responsesBodyTextClass}>As respostas enviadas pelo site publicado aparecem aqui.</p>
              ) : null}
              {submissions && !submissions.submissions.length ? (
                <p className={responsesBodyTextClass}>Nenhuma resposta recebida ainda.</p>
              ) : null}
              {submissions?.submissions.map((row) => (
                <article key={row.id} className={responseCardClass}>
                  <header className={responseHeaderClass}>
                    <strong>{row.formName}</strong>
                    <time dateTime={row.createdAt} className={responseTimeClass}>{new Date(row.createdAt).toLocaleString("pt-BR")}</time>
                  </header>
                  <p className={responseValuesClass}>
                    {Object.entries(row.values ?? {})
                      .map(([key, value]) => `${key}: ${String(value ?? "")}`)
                      .join(" · ")}
                  </p>
                </article>
              ))}
            </div>
          </details>
        </details>
      ) : null}

      {!loading && !error && doc ? (
        <EditorShell
          siteId={siteId}
          doc={doc}
          onChange={(next) => {
            setDoc(next);
            setDirty(true);
          }}
          onSave={save}
          onPublish={() => void publish()}
          onMinimize={() => setMinimized(true)}
          dirty={dirty}
          onSelectNode={() => undefined}
          onPropChange={() => undefined}
          onAIChange={handleAIChange}
          aiBusy={aiBusy}
          aiFeedback={aiMessage}
          device={device}
          onDeviceChange={setDevice}
          readOnly={!canEdit}
          saving={saving}
          publishing={publishing}
          loading={loading}
          onClose={requestClose}
        />
      ) : null}
    </div>,
    document.body,
  );
}
