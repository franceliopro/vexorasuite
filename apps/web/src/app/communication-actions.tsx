"use client";
import { useEffect, useState } from "react";
export function CommunicationActions({ contactId }: { contactId: string }) {
  const [status, setStatus] = useState<any>(null),
    [content, setContent] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  useEffect(() => {
    void fetch("/api/backend/communications/gateways")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
    setKey(crypto.randomUUID());
    setNotice("");
  }, [contactId]);
  async function act(kind: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/backend/communications/gateways/" + kind, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId, content, requestKey: key }),
      });
      const d = await r.json();
      setNotice(d.message || "Solicitação registrada.");
      if (r.ok) {
        setKey(crypto.randomUUID());
        setContent("");
      }
    } catch {
      setNotice(
        "Não foi possível confirmar. Confira o gateway antes de repetir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="workspace-disclosure">
      <summary>SMS e ligação</summary>
      {!status?.sms.configured && !status?.voice.configured ? (
        <p>
          Para habilitar, conecte uma rota SMS ou um ramal de telefonia da
          empresa em Canais e integrações.
        </p>
      ) : (
        <>
          <label>
            Mensagem SMS
            <textarea
              rows={3}
              maxLength={480}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
          <button
            className="secondary-button"
            disabled={busy || !status?.sms.configured || !content.trim()}
            onClick={() => void act("sms")}
          >
            Enviar SMS
          </button>
          <button
            className="secondary-button"
            disabled={busy || !status?.voice.configured}
            onClick={() => void act("call")}
          >
            Ligar pelo meu ramal
          </button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
