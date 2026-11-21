"use client";

/**
 * Endereço temporário do editor de Sites.
 *
 * Mostra o rascunho salvo em um iframe assinado, sem publicar nada. O próprio HTML
 * traz aviso de "não publicado" e formulários desativados; esta página só oferece
 * o enquadramento em tela cheia e o caminho de volta ao editor.
 */
import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, RotateCcw } from "lucide-react";

const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";

export default function SitePreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const previewPath = useMemo(
    () => `/api/backend/public/sites/preview/${encodeURIComponent(token)}`,
    [token],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100dvh",
        background: "var(--surface, #ffffff)",
        color: "var(--text, #161a17)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: "0 0 auto",
          minHeight: 52,
          padding: "8px 16px",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          background: "var(--surface, #ffffff)",
        }}
      >
        <button
          type="button"
          className={secondaryTw}
          onClick={() => router.back()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RotateCcw size={14} aria-hidden="true" /> Voltar
        </button>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <strong style={{ fontSize: "0.9375rem" }}>Prévia temporária</strong>
          <small style={{ fontSize: "0.75rem", opacity: 0.75 }}>
            Rascunho salvo · não publicado · formulários desativados · link expira em 2 horas
          </small>
        </div>
        <a
          className={secondaryTw}
          href={previewPath}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
        >
          <ExternalLink size={14} aria-hidden="true" /> Abrir em nova aba
        </a>
      </header>
      <iframe
        src={previewPath}
        title="Prévia temporária do site"
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        style={{ display: "block", flex: "1 1 auto", width: "100%", border: 0 }}
      />
    </div>
  );
}
