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
import { AlertCircle, Loader2, Maximize2, X } from "lucide-react";
import type { SiteDocument } from "@/shared-types/site-document";
import { EditorShell, findNodeById, replaceNodeById } from "./editor/editor-shell";

type DocumentRow = { document: SiteDocument; version: number };

type SiteEditorWindowProps = {
  siteId: string;
  title: string;
  domain?: string | null;
  domainStatus?: string;
  onClose: () => void;
};

type Device = "desktop" | "tablet" | "mobile";

function isDocument(value: unknown): value is SiteDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<SiteDocument>;
  return !!doc.root && typeof doc.root === "object" && !!doc.meta && typeof doc.meta === "object";
}

export default function SiteEditorWindow({
  siteId,
  title,
  domain,
  domainStatus,
  onClose,
}: SiteEditorWindowProps) {
  const [doc, setDoc] = useState<SiteDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ url: string; idempotent: boolean } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ text: string; error: boolean } | null>(null);
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
      const node = findNodeById(doc.root, nodeId);
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
          current ? { ...current, root: replaceNodeById(current.root, nodeId, payload.node) } : current,
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

  if (minimized) {
    return (
      <div className="vx-editor-editor-dock" role="region" aria-label="Editor minimizado">
        <button type="button" className="vx-wizard-dock-btn" onClick={() => setMinimized(false)} title="Restaurar editor">
          <Maximize2 size={16} aria-hidden="true" />
          <span>Editando: {title}{dirty ? " • não salvo" : ""}</span>
        </button>
        <button type="button" className="vx-wizard-dock-close" onClick={requestClose} aria-label="Fechar editor" title="Fechar editor">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="vx-editor-window" role="region" aria-label={`Editor do site ${title}`}>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 24, color: "var(--text-secondary)" }} role="status">
          <Loader2 className="spin" size={18} aria-hidden="true" /> Abrindo editor…
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: 16, margin: 16, border: "1px solid var(--bad)", borderRadius: "var(--r)" }} role="alert">
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <AlertCircle size={16} aria-hidden="true" /> {error}
          </p>
          <button type="button" className="secondary-button" style={{ marginTop: 12 }} onClick={requestClose}>
            Voltar para Sites
          </button>
        </div>
      ) : null}

      {!loading && !error && doc ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <label htmlFor={`domain-${siteId}`} style={{ fontSize: "0.8125rem", fontWeight: 700 }}>
            Domínio próprio
          </label>
          <input
            id={`domain-${siteId}`}
            type="text"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="www.seusite.com.br"
            aria-label="Domínio do site"
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              background: "var(--background)",
              color: "var(--text)",
              minWidth: 220,
            }}
          />
          <button type="button" className="secondary-button" onClick={() => void bindDomain()} disabled={domainBusy}>
            Vincular
          </button>
          <button type="button" className="secondary-button" onClick={() => void verifyDomain()} disabled={domainBusy || !domainInput}>
            Verificar
          </button>
          <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>Status: {domainState}</span>
          {domainMessage ? (
            <small role="status" style={{ flexBasis: "100%", fontSize: "0.75rem", color: "var(--ok)" }}>
              {domainMessage}
            </small>
          ) : null}
          {domainError ? (
            <small role="alert" style={{ flexBasis: "100%", fontSize: "0.75rem", color: "var(--bad)" }}>
              {domainError}
            </small>
          ) : null}
        </div>
      ) : null}

      {publishError ? (
        <div style={{ padding: 12, margin: "0 16px", border: "1px solid var(--bad)", borderRadius: "var(--r)" }} role="alert">
          <p style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <AlertCircle size={16} aria-hidden="true" /> {publishError}
          </p>
        </div>
      ) : null}

      {publishResult ? (
        <div style={{ padding: 12, margin: "0 16px", border: "1px solid var(--ok)", borderRadius: "var(--r)" }} role="status">
          <p style={{ margin: 0, fontSize: "0.875rem" }}>
            {publishResult.idempotent ? "Este conteúdo já estava publicado. " : "Publicação concluída. "}
            {publishResult.url ? (
              <a href={publishResult.url} target="_blank" rel="noopener noreferrer">
                Abrir site publicado
              </a>
            ) : null}
          </p>
        </div>
      ) : null}

      {aiMessage ? (
        <div
          role={aiMessage.error ? "alert" : "status"}
          style={{
            margin: "0 16px",
            padding: "8px 12px",
            fontSize: "0.8125rem",
            borderRadius: "var(--r)",
            border: `1px solid ${aiMessage.error ? "var(--bad)" : "var(--ok)"}`,
            color: aiMessage.error ? "var(--bad)" : "var(--ok)",
          }}
        >
          {aiMessage.text}
        </div>
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
          publishDisabled={publishing}
          onMinimize={() => setMinimized(true)}
          dirty={dirty}
          onSelectNode={() => undefined}
          onPropChange={() => undefined}
          onAIChange={handleAIChange}
          aiBusy={aiBusy}
          device={device}
          onDeviceChange={setDevice}
          disabled={saving || publishing}
          loading={loading}
          onClose={requestClose}
        />
      ) : null}
    </div>
  );
}
