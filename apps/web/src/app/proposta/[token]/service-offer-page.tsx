"use client";

import { useEffect, useState, type FormEvent } from "react";
import "../../service-offers.css";

type Offer = { sellerName: string; title: string; scope: string; platform: string; setupCents: number; monthlyCents: number; requiresContract: boolean; depositCents: number; state: string; expiresAt: string };
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statuses: Record<string, string> = { ACCEPTED: "Proposta aprovada", CHANGES_REQUESTED: "Pedido de alteração recebido", EXPIRED: "Esta proposta expirou" };

export function ServiceOfferPage({ token }: { token: string }) {
  const [offer, setOffer] = useState<Offer>();
  const [decision, setDecision] = useState<"accept" | "changes">("accept");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = "/api/backend/public/service-offers/" + token;

  useEffect(() => {
    const abort = new AbortController();
    void fetch(url, { cache: "no-store", signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error("Proposta indisponível.");
      setOffer(await response.json() as Offer);
    }).catch(() => { if (!abort.signal.aborted) setError("Proposta indisponível no momento."); });
    return () => abort.abort();
  }, [url]);

  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url + "/respond", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, name: form.get("name"), reason: form.get("reason") }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "Não foi possível registrar sua resposta.");
      setOffer(body as Offer);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível registrar sua resposta.");
    } finally { setBusy(false); }
  }

  return <main className="vx-public-offer">
    <article>
      {error && <p role="alert">{error}</p>}
      {!offer && !error && <p role="status">Carregando proposta…</p>}
      {offer && <>
        <p>{offer.sellerName} · {offer.platform}</p>
        <h1>{offer.title}</h1>
        <dl className="vx-service-offer-prices">
          <div><dt>Instalação</dt><dd>{brl.format(offer.setupCents / 100)}</dd></div>
          <div><dt>Mensalidade</dt><dd>{brl.format(offer.monthlyCents / 100)}</dd></div>
        </dl>
        {offer.depositCents > 0 && <p>Sinal da instalação: {brl.format(offer.depositCents / 100)}.</p>}
        {offer.requiresContract && <p>A instalação depende da assinatura do contrato.</p>}
        <h2>Escopo e condições</h2>
        <p className="vx-public-offer-scope">{offer.scope}</p>
        {offer.state === "OPEN" ? <>
          <p>Válida até {new Date(offer.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
          <div className="vx-public-offer-actions">
            <button type="button" aria-pressed={decision === "accept"} onClick={() => setDecision("accept")}>Aprovar</button>
            <button type="button" aria-pressed={decision === "changes"} onClick={() => setDecision("changes")}>Pedir alterações</button>
          </div>
          <form onSubmit={respond}>
            {decision === "accept" ?
              <label>Seu nome <input name="name" maxLength={120} autoComplete="name" required /></label> :
              <label>O que precisa mudar? <textarea name="reason" maxLength={1000} required /></label>}
            <button disabled={busy}>{decision === "accept" ? "Confirmar aprovação" : "Enviar pedido de alteração"}</button>
          </form>
        </> : <p role="status">{statuses[offer.state] ?? "Proposta indisponível."}</p>}
      </>}
    </article>
  </main>;
}
