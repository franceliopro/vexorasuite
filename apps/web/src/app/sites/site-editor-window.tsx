"use client";

/**
 * Janela do editor visual dentro da Véxora.
 *
 * Não é uma rota solta nem um modal de confirmação: cobre o viewport da aplicação,
 * mantém o estado do documento e reduz a um dock na própria interface quando minimizada.
 * Publicação de domínio fica para a próxima fatia — o botão existe, mas está desabilitado
 * com aviso honesto em vez de simular um deploy.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Maximize2, X } from "lucide-react";
import type { SiteDocument } from "@/shared-types/site-document";
import { EditorShell, findNodeById, replaceNodeById } from "./editor/editor-shell";
import { aiEditNode } from "./[siteId]/edit/adapters/ai-generate";

type DocumentRow = { document: SiteDocument; version: number };

type SiteEditorWindowProps = {
  siteId: string;
  title: string;
  onClose: () => void;
};

type Device = "desktop" | "tablet" | "mobile";

function isDocument(value: unknown): value is SiteDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as Partial<SiteDocument>;
  return !!doc.root && typeof doc.root === "object" && !!doc.meta && typeof doc.meta === "object";
}

export default function SiteEditorWindow({ siteId, title, onClose }: SiteEditorWindowProps) {
  const [doc, setDoc] = useState<SiteDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
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

  const handleAIChange = useCallback(
    (prompt: string, nodeId: string) => {
      if (!doc || !prompt.trim()) return;
      const node = findNodeById(doc.root, nodeId);
      if (!node) return;
      setAiBusy(true);
      try {
        const edited = aiEditNode(node, prompt);
        setDoc((current) =>
          current ? { ...current, root: replaceNodeById(current.root, nodeId, edited) } : current,
        );
        setDirty(true);
      } finally {
        setAiBusy(false);
      }
    },
    [doc],
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
        <EditorShell
          siteId={siteId}
          doc={doc}
          onChange={(next) => {
            setDoc(next);
            setDirty(true);
          }}
          onSave={save}
          onPublish={() => undefined}
          publishDisabled
          onMinimize={() => setMinimized(true)}
          dirty={dirty}
          onSelectNode={() => undefined}
          onPropChange={() => undefined}
          onAIChange={handleAIChange}
          aiBusy={aiBusy}
          device={device}
          onDeviceChange={setDevice}
          disabled={saving}
          loading={loading}
          onClose={requestClose}
        />
      ) : null}
    </div>
  );
}
