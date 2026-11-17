"use client";

import { useState, type FormEvent } from "react";
import "./service-offers.css";

type Order = { id: string; scheduledAt: string | null; completedAt: string | null; installation: string | null };
type Offer = { id: string; title: string; platform: string; state: string; expiresAt: string; customerReply: string | null; requiresContract: boolean; signedAt: string | null; depositCents: number; depositReceivedAt: string | null; order: Order | null };
type Asset = { id: string; vehicle: string; equipment: string; order: { id: string; installation: string | null; offer: { platform: string } } };
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const base = "/api/backend/conversations/" + id + "/service-offers";
  const query = "?view=" + encodeURIComponent(view);
  async function refresh() {
    const [proposals, installations] = await Promise.all([request<Offer[]>(base + query), request<Asset[]>("/api/backend/conversations/" + id + "/service-assets" + query)]);
    setOffers(proposals);
    setAssets(installations);
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
        setupCents: cents(fields.get("setup")), monthlyCents: cents(fields.get("monthly")), depositCents: cents(fields.get("deposit")), requiresContract: fields.get("requiresContract") === "on",
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
      const assets = String(fields.get("assets") || "").split(/\r?\n/).filter(line => line.trim()).map(line => {
        const parts = line.split("|");
        if (parts.length !== 2 || parts.some(part => !part.trim())) throw new Error("Use uma linha por instalação no formato veículo | equipamento.");
        return { vehicle: parts[0], equipment: parts[1] };
      });
      const body = installation ? { installation, assets } : { scheduledAt: new Date(String(scheduledAt)).toISOString() };
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
          <label>Sinal (R$) <input name="deposit" type="number" min="0" max="1000000" step="0.01" defaultValue="0" required /></label>
          <label>Exigir contrato antes de agendar <input name="requiresContract" type="checkbox" /></label>
          <button className="primary-button" disabled={busy}>Gerar link de aprovação</button>
        </form>
      </details>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run(refresh)}>Atualizar</button>
      {assets.length > 0 && <details>
        <summary>Equipamentos do cliente</summary>
        {assets.map(asset => <article className="vx-service-offer-record" key={asset.id}>
          <strong>{asset.vehicle} · {asset.equipment}</strong>
          <span>{asset.order.offer.platform} · OS {asset.order.id.slice(0, 8).toUpperCase()}</span>
          {asset.order.installation && <p>{asset.order.installation}</p>}
        </article>)}
      </details>}
      {offers.map(offer => {
        const status = offer.state === "OPEN" && Date.parse(offer.expiresAt) <= Date.now() ? "EXPIRED" : offer.state;
        const contractPending = offer.requiresContract && !offer.signedAt;
        const depositPending = offer.depositCents > 0 && !offer.depositReceivedAt;
        const blocked = contractPending || depositPending;
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
            {blocked && <p>Instalação bloqueada. {contractPending && "Contrato pendente. "}{depositPending && "Sinal pendente."}</p>}
            {!offer.order.completedAt && !blocked && <>
              <form onSubmit={event => update(event, offer)}>
                <label>Data e hora <input name="scheduledAt" type="datetime-local" required /></label>
                <button className="secondary-button" disabled={busy}>Agendar</button>
              </form>
              <form onSubmit={event => update(event, offer)}>
                <label>Veículo e equipamento · um par por linha <textarea name="assets" placeholder="ABC1D23 | código do equipamento" maxLength={3600} required /></label>
                <label>Serviço executado e testes <textarea name="installation" maxLength={4000} required /></label>
                <button className="secondary-button" disabled={busy}>Concluir instalação</button>
              </form>
            </>}
          </>}
        </article>;
      })}
    </div>
  </details>;
}
