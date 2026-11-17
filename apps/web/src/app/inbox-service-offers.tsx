"use client";

import { useState, type FormEvent } from "react";
import "./service-offers.css";

type Order = { id: string; scheduledAt: string | null; completedAt: string | null; installation: string | null };
type Offer = { id: string; title: string; platform: string; state: string; expiresAt: string; customerReply: string | null; order: Order | null };
const labels: Record<string, string> = { OPEN: "Aguardando cliente", ACCEPTED: "Aceita", CHANGES_REQUESTED: "Alterações solicitadas", REVOKED: "Cancelada", EXPIRED: "Expirada" };

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Não foi possível concluir.");
  return data as T;
}

function cents(value: FormDataEntryValue | null) {
  return Math.round(Number(value) * 100);
}

export function InboxServiceOffers({ id, view, onLink }: { id: string; view: string; onLink: (link: string) => void }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const base = "/api/backend/conversations/" + id + "/service-offers";
  const query = "?view=" + encodeURIComponent(view);
  async function refresh() {
    setOffers(await request<Offer[]>(base + query));
  }
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : "Falha na operação."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    void run(async () => {
      const data = await request<{ path: string }>(base + query, {
        title: fields.get("title"), platform: fields.get("platform"), scope: fields.get("scope"),
        setupCents: cents(fields.get("setup")), monthlyCents: cents(fields.get("monthly")),
      });
      setLink(new URL(data.path, window.location.origin).toString());
      form.reset();
      await refresh();
    });
  }
  function update(event: FormEvent<HTMLFormElement>, offer: Offer) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const installation = fields.get("installation");
    const scheduledAt = fields.get("scheduledAt");
    void run(async () => {
      const body = installation ? { installation } : { scheduledAt: new Date(String(scheduledAt)).toISOString() };
      await request(base + "/" + offer.id + "/order" + query, body);
      await refresh();
    });
  }

  return <details className="vx-inbox-service-offers" onToggle={event => { if (event.currentTarget.open) void run(refresh); }}>
    <summary>Propostas e ordens de serviço</summary>
    <div className="vx-service-offer-panel">
      {error && <p role="alert">{error}</p>}
      {link && <div className="vx-service-offer-link">
        <label>Link da proposta <input value={link} readOnly onFocus={event => event.currentTarget.select()} /></label>
        <button type="button" className="secondary-button" onClick={() => onLink(link)}>Inserir link na mensagem</button>
      </div>}
      <details>
        <summary>Nova proposta</summary>
        <form onSubmit={create}>
          <label>Título <input name="title" maxLength={120} required /></label>
          <label>Plataforma <input name="platform" maxLength={120} required /></label>
          <label>Escopo e condições <textarea name="scope" maxLength={4000} required /></label>
          <div className="vx-service-offer-prices">
            <label>Instalação (R$) <input name="setup" type="number" min="0" max="1000000" step="0.01" defaultValue="0" required /></label>
            <label>Mensalidade (R$) <input name="monthly" type="number" min="0" max="1000000" step="0.01" defaultValue="0" required /></label>
          </div>
          <p>O aceite desta proposta abre a ordem de serviço. Use este fluxo quando o aceite for suficiente para liberar a execução.</p>
          <button className="primary-button" disabled={busy}>Gerar link de aprovação</button>
        </form>
      </details>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(refresh)}>Atualizar</button>
      {offers.map(offer => {
        const status = offer.state === "OPEN" && Date.parse(offer.expiresAt) <= Date.now() ? "EXPIRED" : offer.state;
        return <article className="vx-service-offer-record" key={offer.id}>
          <strong>{offer.title}</strong>
          <span>{offer.platform} · {labels[status] ?? status}</span>
          {offer.customerReply && <p>{offer.customerReply}</p>}
          {status === "OPEN" && <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(async () => {
            await request(base + "/" + offer.id + "/revoke" + query, {});
            setLink("");
            await refresh();
          })}>Cancelar proposta</button>}
          {offer.order && <>
            <strong>OS {offer.order.id.slice(0, 8).toUpperCase()}</strong>
            <span>{offer.order.completedAt ? "Concluída" : offer.order.scheduledAt ? "Agendada para " + new Date(offer.order.scheduledAt).toLocaleString("pt-BR") : "Aguardando agendamento"}</span>
            {offer.order.installation && <p>{offer.order.installation}</p>}
            {!offer.order.completedAt && <>
              <form onSubmit={event => update(event, offer)}>
                <label>Data e hora <input name="scheduledAt" type="datetime-local" required /></label>
                <button className="secondary-button" disabled={busy}>Agendar</button>
              </form>
              <form onSubmit={event => update(event, offer)}>
                <label>Veículos, equipamentos e testes <textarea name="installation" maxLength={4000} required /></label>
                <button className="secondary-button" disabled={busy}>Concluir instalação</button>
              </form>
            </>}
          </>}
        </article>;
      })}
    </div>
  </details>;
}
