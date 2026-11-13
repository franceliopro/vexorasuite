"use client";
import { use, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Rocket, XCircle } from "lucide-react";

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
      setDone(withPublish ? "Publicado com sucesso nas contas escolhidas! 🎉" : "Design aprovado! Ele espera por você em Marketing → Calendário editorial.");
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
    return <main className="design-approval-shell"><section className="design-approval-card" role="status">{error ? <><h1>Link inválido</h1><p>{error}</p></> : <><Loader2 size={28} className="vx-spin" aria-hidden="true" /><p>Carregando o design…</p></>}</section></main>;
  }
  const published = payload.status === "PUBLISHED";
  return (
    <main className="design-approval-shell">
      <section className="design-approval-card">
        <header className="design-approval-head" style={{ background: `linear-gradient(135deg, ${payload.brand}, color-mix(in srgb, ${payload.brand} 55%, #000))` }}>
          <small>{payload.company || "Véxora Design"} · {payload.format === "STORIES" ? "Stories" : "Carrossel"} · {payload.slides} lâminas</small>
          <h1>{payload.title}</h1>
          {published && <span className="design-approval-pill">Já publicado</span>}
        </header>
        <div className="design-approval-slides" aria-label="Lâminas do carrossel">
          {Array.from({ length: payload.slides }, (_, i) => (
            <figure key={i}>
              <img src={"/api/backend/public/design-approvals/" + encodeURIComponent(token) + "/slide/" + i + ".png"} alt={"Lâmina " + (i + 1) + ": " + payload.title} loading="lazy" />
              <figcaption>{i + 1}</figcaption>
            </figure>
          ))}
        </div>
        {payload.caption && <details className="design-approval-caption" open><summary>Legenda da publicação</summary><p>{payload.caption}</p></details>}
        {done ? (
          <div className="design-approval-done" role="status">{decision === "approve" ? <CheckCircle2 size={30} aria-hidden="true" /> : <XCircle size={30} aria-hidden="true" />}<h2>{done}</h2></div>
        ) : (
          <div className="design-approval-actions">
            <button className="secondary-button danger-button" disabled={busy} onClick={() => void reject()}><XCircle size={16} aria-hidden="true" /> Rejeitar</button>
            <div className="design-approval-publish">
              {payload.channels.length > 0 && (<>
                <p className="sites-field-label">Ao aprovar, publicar também em:</p>
                <div className="design-approval-channels">{payload.channels.map(c => (
                  <label key={c.id} className={"design-approval-channel" + (selected[c.id] ? " is-checked" : "")}><input type="checkbox" checked={!!selected[c.id]} onChange={e => setSelected(v => ({ ...v, [c.id]: e.target.checked }))} /><span><strong>{c.name}</strong><small>{c.platform}{c.username ? " · " + c.username : ""}</small></span></label>
                ))}</div>
                <label className="design-approval-publish-toggle"><input type="checkbox" checked={publishNow} disabled={Object.values(selected).every(v => !v)} onChange={e => setPublishNow(e.target.checked)} /> Publicar agora ao aprovar</label>
              </>)}
              {payload.channels.length === 0 && <p className="design-approval-nochannel">Nenhuma rede Zernio conectada ainda — a aprovação fica salva na véxora e você publica quando quiser.</p>}
              <button className="primary-button" disabled={busy || (publishNow && payload.channels.length > 0 && Object.values(selected).every(v => !v))} onClick={() => void approve(publishNow && payload.channels.length > 0 && Object.values(selected).some(Boolean))}>{busy ? <Loader2 size={16} className="vx-spin" aria-hidden="true" /> : <Rocket size={16} aria-hidden="true" />} {publishNow && payload.channels.length > 0 && Object.values(selected).some(Boolean) ? "Aprovar e publicar agora" : "Aprovar (publicar no sistema)"}</button>
            </div>
          </div>
        )}
        {error && !done && <p role="alert" className="design-approval-error">{error}</p>}
      </section>
    </main>
  );
}
