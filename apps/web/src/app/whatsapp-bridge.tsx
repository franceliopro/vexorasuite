"use client";
import { useState } from "react";
export function WhatsappBridge({
  conversationId,
  view,
  onOpen,
}: {
  conversationId: string;
  view: string;
  onOpen: (id: string) => void;
}) {
  const [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <details className="whatsapp-bridge">
      <summary>Continuar no WhatsApp</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setNotice("");
          try {
            const r = await fetch(
              "/api/backend/conversations/" +
                conversationId +
                "/whatsapp?view=" +
                encodeURIComponent(view),
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ phone }),
              },
            );
            const d = await r.json();
            if (!r.ok)
              throw Error(d.message || "Não foi possível abrir a conversa.");
            setPhone("");
            onOpen(d.conversationId);
          } catch (e) {
            setNotice(
              e instanceof Error
                ? e.message
                : "Não foi possível abrir a conversa.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          WhatsApp informado pelo cliente
          <input
            type="tel"
            autoComplete="off"
            required
            maxLength={60}
            placeholder="+55 11 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <button className="secondary-button" disabled={busy || !phone.trim()}>
          {busy ? "Abrindo…" : "Abrir conversa"}
        </button>
        <small>
          O histórico atual é preservado. Revise e envie a primeira mensagem na
          conversa do WhatsApp.
        </small>
        {notice && <p role="status">{notice}</p>}
      </form>
    </details>
  );
}
