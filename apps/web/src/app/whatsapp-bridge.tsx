"use client";
import { useState } from "react";

const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

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
    <details data-testid="whatsapp-bridge" className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
      <summary className="cursor-pointer font-bold text-blue-600">Continuar no WhatsApp</summary>
      <form
        className="grid gap-2"
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
        <label className="grid min-w-0 gap-1">
          WhatsApp informado pelo cliente
          <input
            className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400"
            type="tel"
            autoComplete="off"
            required
            maxLength={60}
            placeholder="+55 11 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <button className={secondaryButton} disabled={busy || !phone.trim()}>
          {busy ? "Abrindo…" : "Abrir conversa"}
        </button>
        <small className="text-xs text-slate-600 dark:text-slate-300">
          O histórico atual é preservado. Revise e envie a primeira mensagem na
          conversa do WhatsApp.
        </small>
        {notice && <p className="m-0 text-xs text-red-600 dark:text-red-400" role="status">{notice}</p>}
      </form>
    </details>
  );
}
