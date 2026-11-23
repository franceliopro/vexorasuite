"use client";

import { useEffect, useState } from "react";

type Campaign = {
  id: string;
  name: string;
  channelName: string;
  trigger: string;
  postTitle: string | null;
  keywords: string[];
  active: boolean;
  delaySeconds: number;
  stats: { sent: number | null; read: number | null; clicks: number | null };
};
type Campaigns = { accounts: { id: string; name: string }[]; campaigns: Campaign[] };

const labels: Record<string, string> = {
  comment: "Comentário em post ou Reel",
  story_reply: "Resposta a Story",
  live_comment: "Comentário em Live",
  story_mention: "Menção em Story",
};

export function InstagramCampaigns() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Campaigns | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError(false);
    void fetch("/api/backend/chatbot/instagram/campaigns", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error("Campanhas indisponíveis");
        const result = await response.json();
        if (!Array.isArray(result?.campaigns) || !Array.isArray(result?.accounts)) throw Error("Resposta inválida");
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, attempt]);

  return <details onToggle={event => setOpen(event.currentTarget.open)} className="rounded-xl border border-line bg-surface p-3 text-ink">
    <summary className="cursor-pointer font-bold">Campanhas do Instagram</summary>
    <div className="mt-3 grid gap-3">
      <button type="button" className="w-fit rounded-token-sm border border-line bg-surface-2 px-3 py-2 font-semibold text-ink hover:bg-hover" onClick={() => setAttempt(value => value + 1)}>Atualizar campanhas</button>
      {error ? <p role="alert">Não foi possível consultar as campanhas do Instagram.</p> : !data ? <p role="status">Carregando campanhas…</p> : null}
      {data && !data.accounts.length ? <p>Conecte uma conta profissional do Instagram para ver as campanhas.</p> : null}
      {data?.accounts.length && !data.campaigns.length ? <p>Nenhuma campanha encontrada nas contas conectadas.</p> : null}
      {data?.campaigns.length ? <ul className="grid gap-2">{data.campaigns.map(campaign => <li key={campaign.id} className="grid gap-2 rounded-token-sm border border-line bg-surface-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{campaign.name}</strong><span className="text-small text-ink-secondary">{campaign.active ? "Ativa" : "Pausada"}</span></div>
        <p className="text-small text-ink-secondary">{campaign.channelName} · {labels[campaign.trigger] || campaign.trigger}{campaign.postTitle ? " · " + campaign.postTitle : ""}</p>
        <p className="text-small">{campaign.keywords.length ? campaign.keywords.join(", ") : "Sem filtro de palavra-chave"} · {campaign.delaySeconds ? "Atraso de " + campaign.delaySeconds + " s" : "Resposta imediata"}</p>
        <dl className="flex flex-wrap gap-4 text-small">
          <div><dt>Enviadas</dt><dd>{campaign.stats.sent ?? "—"}</dd></div>
          <div><dt>Lidas</dt><dd>{campaign.stats.read ?? "—"}</dd></div>
          <div><dt>Cliques</dt><dd>{campaign.stats.clicks ?? "—"}</dd></div>
        </dl>
      </li>)}</ul> : null}
    </div>
  </details>;
}
