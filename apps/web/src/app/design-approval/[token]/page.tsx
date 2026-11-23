"use client";
import { use, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Rocket, XCircle } from "lucide-react";

const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryDangerTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-red-600 shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const pageTw = "grid min-h-dvh place-items-center bg-surface-page p-4 text-ink";
const cardTw = "grid w-full max-w-3xl justify-items-center gap-4 rounded-token-lg border border-line bg-surface p-4 text-ink shadow-token-lg sm:p-5";
const headerTw = "grid w-full gap-1 rounded-token-sm bg-blue-600 px-4 py-5 text-white";
const slideTw = "grid gap-1.5 overflow-hidden rounded-token-sm border border-line bg-surface-2 p-1.5";
const channelBaseTw = "flex cursor-pointer items-start gap-2 rounded-token-sm border px-3 py-2.5 text-body transition-colors";
const channelOnTw = "border-blue-600 bg-blue-50 text-ink";
const channelOffTw = "border-line bg-surface-2 text-ink-secondary hover:border-line-strong";
const checkboxTw = "mt-0.5 h-4 w-4 flex-none accent-blue-600";
const alertTw = "m-0 rounded-token-sm border border-red-600 bg-red-100 p-3 text-body font-semibold text-danger";

type Channel = { id: string; name: string; platform: string; accountId: string; username: string };
type Payload = { title: string; caption: string; slides: number; format: string; brand: string; company: string; status: string; channels: Channel[] };

export default function DesignApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [publishNow, setPublishNow] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>("");

  useEffect(() => {
    fetch("/api/backend/public/design-approvals/" + encodeURIComponent(token), { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data?.message || "Este link não é válido."); return data as Payload; })
      .then(setPayload)
      .catch(e => setError(e instanceof Error ? e.message : "Não foi possível abrir este design."));
  }, [token]);

  const approve = async (withPublish: boolean) => {
    if (!payload || busy) return;
    setBusy(true);
    try {
      const channelIds = publishNow ? Object.keys(selected).filter(id => selected[id]) : [];
      const r = await fetch("/api/backend/public/design-approvals/" + encodeURIComponent(token) + "/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve", publish: withPublish, channelIds: withPublish ? channelIds : undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || "Não foi possível aprovar.");
      const status = String(data?.status || "");
      if (status === "PUBLISHED") setDone("Publicação confirmada nas contas escolhidas.");
      else if (status === "PUBLISH_REQUESTED") setDone("Solicitação de publicação enviada. A confirmação da rede ainda não chegou; acompanhe em Marketing → Calendário editorial.");
      else setDone("Design aprovado! Ele espera por você em Marketing → Calendário editorial.");
      setDecision("approve");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível aprovar."); } finally { setBusy(false); }
  };

  const reject = async () => {
    if (!payload || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/backend/public/design-approvals/" + encodeURIComponent(token) + "/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: "reject" }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || "Não foi possível rejeitar.");
      setDone("Design rejeitado. Você pode pedir um novo a qualquer momento.");
      setDecision("reject");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível rejeitar."); } finally { setBusy(false); }
  };

  if (!payload) {
    return <main className={pageTw}><section className="grid w-full max-w-md justify-items-center gap-2 rounded-token-lg border border-line bg-surface p-8 text-center text-ink shadow-token-lg" role="status">{error ? <><h1 className="text-h2 font-extrabold">Link inválido</h1><p className="m-0 text-body text-ink-secondary">{error}</p></> : <><Loader2 size={28} className="animate-spin text-blue-600" aria-hidden="true" /><p className="m-0 text-body text-ink-secondary">Carregando o design…</p></>}</section></main>;
  }
  const published = payload.status === "PUBLISHED";
  return (
    <main className={pageTw}>
      <section className={cardTw}>
        <header className={headerTw}>
          <small className="text-2xs font-bold uppercase tracking-wide">{payload.company || "Véxora Design"} · {payload.format === "STORIES" ? "Stories" : "Carrossel"} · {payload.slides} lâminas</small>
          <h1 className="text-h1 font-extrabold tracking-tight">{payload.title}</h1>
          {published && <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-2xs font-bold text-emerald-600">Já publicado</span>}
        </header>
        <div className="grid w-full grid-cols-2 justify-items-center gap-3 sm:grid-cols-3" aria-label="Lâminas do carrossel">
          {Array.from({ length: payload.slides }, (_, i) => (
            <figure key={i} className="m-0 grid w-full gap-1.5">
              <span className={slideTw}><img className="block w-full rounded-token-sm bg-surface-page object-cover" src={"/api/backend/public/design-approvals/" + encodeURIComponent(token) + "/slide/" + i + ".png"} alt={"Lâmina " + (i + 1) + ": " + payload.title} loading="lazy" /></span>
              <figcaption className="text-center text-2xs font-bold tabular-nums text-ink-secondary">{i + 1}</figcaption>
            </figure>
          ))}
        </div>
        {payload.caption && <details className="w-full rounded-token-sm border border-line bg-surface-2 p-3 text-body text-ink" open><summary className="cursor-pointer text-xs font-bold text-ink">Legenda da publicação</summary><p className="mb-0 mt-2 whitespace-pre-wrap text-ink-secondary">{payload.caption}</p></details>}
        {done ? (
          <div className="grid w-full justify-items-center gap-2 rounded-token-sm border border-emerald-600 bg-emerald-100 p-5 text-center text-emerald-600" role="status">{decision === "approve" ? <CheckCircle2 size={30} aria-hidden="true" /> : <XCircle size={30} aria-hidden="true" />}<h2 className="text-h2 font-extrabold">{done}</h2></div>
        ) : (
          <div className="flex w-full flex-wrap items-start justify-between gap-3">
            <button className={secondaryDangerTw} disabled={busy} onClick={() => void reject()}><XCircle size={16} aria-hidden="true" /> Rejeitar</button>
            <div className="grid w-full min-w-0 gap-3 sm:max-w-md">
              {payload.channels.length > 0 && (<>
                <p className="m-0 text-2xs font-extrabold uppercase tracking-wide text-ink-secondary">Ao aprovar, publicar também em:</p>
                <div className="grid gap-2 sm:grid-cols-2">{payload.channels.map(c => (
                  <label key={c.id} className={channelBaseTw + " " + (selected[c.id] ? channelOnTw : channelOffTw)}><input type="checkbox" className={checkboxTw} checked={!!selected[c.id]} onChange={e => setSelected(v => ({ ...v, [c.id]: e.target.checked }))} /><span className="grid min-w-0 gap-0.5"><strong className="truncate text-body font-bold">{c.name}</strong><small className="text-2xs uppercase text-ink-secondary">{c.platform}{c.username ? " · " + c.username : ""}</small></span></label>
                ))}</div>
                <label className="flex items-center gap-2 text-2xs font-bold text-ink-secondary"><input type="checkbox" className={checkboxTw} checked={publishNow} disabled={Object.values(selected).every(v => !v)} onChange={e => setPublishNow(e.target.checked)} /> Publicar agora ao aprovar</label>
              </>)}
              {payload.channels.length === 0 && <p className="m-0 rounded-token-sm border border-line bg-surface-2 p-3 text-2xs leading-relaxed text-ink-secondary">Nenhuma rede Zernio conectada ainda — a aprovação fica salva na véxora e você publica quando quiser.</p>}
              <button className={primaryTw} disabled={busy || (publishNow && payload.channels.length > 0 && Object.values(selected).every(v => !v))} onClick={() => void approve(publishNow && payload.channels.length > 0 && Object.values(selected).some(Boolean))}>{busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Rocket size={16} aria-hidden="true" />} {publishNow && payload.channels.length > 0 && Object.values(selected).some(Boolean) ? "Aprovar e publicar agora" : "Aprovar (publicar no sistema)"}</button>
            </div>
          </div>
        )}
        {error && !done && <p role="alert" className={alertTw}>{error}</p>}
      </section>
    </main>
  );
}
