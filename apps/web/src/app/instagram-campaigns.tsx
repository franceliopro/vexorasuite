"use client";

import { type FormEvent, useEffect, useState } from "react";

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
type InstagramPost = { id: string; caption: string; date: string };
type Draft = { id: string; name: string; trigger: string; keyword: string; mediaId: string };
type Campaigns = { accounts: { id: string; name: string }[]; campaigns: Campaign[]; drafts: Draft[]; providerUnavailable?: boolean };
const emptyDraft = { name: "", channelId: "", trigger: "comment", mediaId: "", keyword: "", message: "", link: "", delaySeconds: "" };
const fieldClass = "w-full rounded-token-sm border border-line bg-surface px-3 py-2 text-ink";

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
  const [form, setForm] = useState(emptyDraft);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [page, setPage] = useState<{ cursor: string | null }>({ cursor: null });
  const [mediaStatus, setMediaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pausing, setPausing] = useState<string | null>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const update = (field: keyof typeof emptyDraft, value: string) => {
    if (field === "channelId" || field === "trigger") {
      setPosts([]);
      setNextCursor(null);
      setPage({ cursor: null });
      setForm(current => ({ ...current, [field]: value, mediaId: "" }));
      return;
    }
    setForm(current => ({ ...current, [field]: value }));
  };
  const needsKeyword = form.trigger !== "story_mention";
  const supportsMedia = form.trigger === "comment" || form.trigger === "story_reply";
  const supportsDelay = form.trigger !== "live_comment";

  useEffect(() => {
    if (!open || !mediaOpen || !form.channelId || form.trigger !== "comment") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ channelId: form.channelId });
    if (page.cursor) params.set("cursor", page.cursor);
    setMediaStatus("loading");
    void fetch("/api/backend/chatbot/instagram/campaigns/media?" + params.toString(), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Publicações indisponíveis");
        const result = await response.json();
        if (!Array.isArray(result.posts)) throw new Error("Resposta inválida");
        const incoming: InstagramPost[] = result.posts;
        if (controller.signal.aborted) return;
        setPosts(current => page.cursor ? [...new Map([...current, ...incoming].map(post => [post.id, post])).values()] : incoming);
        setNextCursor(typeof result.nextCursor === "string" ? result.nextCursor : null);
        setMediaStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setMediaStatus("error"); });
    return () => controller.abort();
  }, [open, mediaOpen, form.channelId, form.trigger, page]);

  async function pauseCampaign(id: string) {
    if (pausing) return;
    setPausing(id);
    setPauseError(null);
    try {
      const response = await fetch("/api/backend/chatbot/instagram/campaigns/" + encodeURIComponent(id) + "/pause", { method: "POST" });
      if (!response.ok) throw new Error("Falha ao pausar a campanha");
      const result = await response.json();
      if (result.active !== false) throw new Error("Pausa não confirmada");
      setData(current => current ? {
        ...current,
        campaigns: current.campaigns.map(campaign => campaign.id === id ? { ...campaign, active: false } : campaign),
      } : current);
    } catch {
      setPauseError(id);
    } finally {
      setPausing(null);
      setAttempt(value => value + 1);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/backend/chatbot/instagram/campaigns/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          keyword: needsKeyword ? form.keyword : "",
          mediaId: supportsMedia ? form.mediaId : "",
          delaySeconds: supportsDelay ? Number(form.delaySeconds) : 0,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result?.message === "string" ? result.message : "Não foi possível salvar o rascunho.");
      setForm(emptyDraft);
      setPosts([]);
      setNextCursor(null);
      setPage({ cursor: null });
      setNotice({ text: "Rascunho salvo.", error: false });
      setAttempt(value => value + 1);
    } catch (failure) {
      const message = failure instanceof Error && failure.name === "Error" ? failure.message : "Não foi possível salvar o rascunho.";
      setNotice({ text: message, error: true });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setError(false);
    void fetch("/api/backend/chatbot/instagram/campaigns", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error("Campanhas indisponíveis");
        const result = await response.json();
        if (!Array.isArray(result?.campaigns) || !Array.isArray(result?.accounts) || !Array.isArray(result?.drafts)) throw Error("Resposta inválida");
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
      {data?.accounts.length ? <details className="rounded-token-sm border border-line bg-surface-2 p-3">
        <summary className="cursor-pointer font-semibold">Nova campanha</summary>
        <form onSubmit={saveDraft} className="mt-3 grid gap-3">
          <label className="grid gap-1">Nome da campanha<input required maxLength={120} className={fieldClass} value={form.name} onChange={event => update("name", event.target.value)} placeholder="Oferta de lançamento" /></label>
          <label className="grid gap-1">Conta do Instagram<select required className={fieldClass} value={form.channelId} onChange={event => update("channelId", event.target.value)}>
            <option value="">Escolha uma conta</option>
            {data.accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select></label>
          <label className="grid gap-1">Quando acontecer<select className={fieldClass} value={form.trigger} onChange={event => update("trigger", event.target.value)}>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {needsKeyword ? <label className="grid gap-1">Com esta palavra ou frase<input required maxLength={120} className={fieldClass} value={form.keyword} onChange={event => update("keyword", event.target.value)} placeholder="Eu quero" /></label> : null}
          <label className="grid gap-1">Enviar esta mensagem privada<textarea required rows={3} maxLength={form.link.trim() ? 640 : 1000} className={fieldClass} value={form.message} onChange={event => update("message", event.target.value)} /></label>
          <details onToggle={event => setMediaOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer text-small font-semibold">Publicação específica, link e atraso</summary>
            <div className="mt-2 grid gap-3">
              {form.trigger === "comment" && form.channelId ? <div className="grid gap-2">
                <label className="grid gap-1">Publicação ou Reel<select className={fieldClass} value={form.mediaId} onChange={event => update("mediaId", event.target.value)}>
                  <option value="">Qualquer publicação</option>
                  {posts.map(post => <option key={post.id} value={post.id}>{post.date ? post.date.split("-").reverse().join("/") + " · " : ""}{post.caption || "Publicação sem legenda"}</option>)}
                </select></label>
                {mediaStatus === "loading" ? <p role="status">Buscando publicações…</p> : null}
                {mediaStatus === "ready" && !posts.length ? <p>Nenhuma publicação encontrada.</p> : null}
                {mediaStatus === "error" ? <button type="button" className="w-fit underline" onClick={() => setPage(current => ({ ...current }))}>Falha na consulta. Tentar novamente</button> : null}
                {mediaStatus === "ready" && nextCursor ? <button type="button" className="w-fit underline" onClick={() => setPage({ cursor: nextCursor })}>Carregar publicações anteriores</button> : null}
              </div> : null}
              {form.trigger === "story_reply" ? <label className="grid gap-1">ID do Story<input inputMode="numeric" pattern="[0-9]{1,40}" className={fieldClass} value={form.mediaId} onChange={event => update("mediaId", event.target.value)} placeholder="Em branco para qualquer publicação do tipo escolhido" /></label> : null}
              <label className="grid gap-1">Link da oferta<input type="url" maxLength={2000} className={fieldClass} value={form.link} onChange={event => update("link", event.target.value)} placeholder="https://…" /></label>
              {supportsDelay ? <label className="grid gap-1">Atraso em segundos<input type="number" min={0} max={86400} step={1} className={fieldClass} value={form.delaySeconds} onChange={event => update("delaySeconds", event.target.value)} placeholder="0 para enviar na hora" /></label> : null}
            </div>
          </details>
          <button disabled={saving} className="w-fit rounded-token-sm border border-line bg-surface px-3 py-2 font-semibold hover:bg-hover disabled:opacity-60">{saving ? "Salvando…" : "Salvar rascunho"}</button>
          {notice ? <p role={notice.error ? "alert" : "status"}>{notice.text}</p> : null}
        </form>
      </details> : null}
      {data?.drafts.length ? <ul aria-label="Rascunhos do Instagram" className="grid gap-2">{data.drafts.map(draft => <li key={draft.id} className="rounded-token-sm border border-line bg-surface-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{draft.name}</strong><span className="text-small text-ink-secondary">Rascunho</span></div>
        <p className="text-small text-ink-secondary">{labels[draft.trigger]}{draft.keyword ? " · " + draft.keyword : ""}{draft.mediaId ? " · Mídia " + draft.mediaId : ""}</p>
      </li>)}</ul> : null}
      {data?.providerUnavailable ? <p role="alert">O Instagram está indisponível para consulta. Você ainda pode salvar rascunhos.</p> : null}
      {data?.accounts.length && !data.providerUnavailable && !data.campaigns.length && !data.drafts.length ? <p>Nenhuma campanha encontrada nas contas conectadas.</p> : null}
      {data?.campaigns.length ? <ul className="grid gap-2">{data.campaigns.map(campaign => <li key={campaign.id} className="grid gap-2 rounded-token-sm border border-line bg-surface-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{campaign.name}</strong><span className="text-small text-ink-secondary">{campaign.active ? "Ativa" : "Pausada"}</span></div>
        <p className="text-small text-ink-secondary">{campaign.channelName} · {labels[campaign.trigger] || campaign.trigger}{campaign.postTitle ? " · " + campaign.postTitle : ""}</p>
        <p className="text-small">{campaign.keywords.length ? campaign.keywords.join(", ") : "Sem filtro de palavra-chave"} · {campaign.delaySeconds ? "Atraso de " + campaign.delaySeconds + " s" : "Resposta imediata"}</p>
        {campaign.active ? <button type="button" disabled={pausing !== null} className="w-fit rounded-token-sm border border-line bg-surface px-3 py-2 font-semibold hover:bg-hover disabled:opacity-60" onClick={() => void pauseCampaign(campaign.id)}>
          {pausing === campaign.id ? "Pausando…" : "Pausar campanha"}
        </button> : null}
        {pauseError === campaign.id && campaign.active ? <p role="alert">O Instagram não confirmou a pausa. Confira o status e tente novamente.</p> : null}
        <dl className="flex flex-wrap gap-4 text-small">
          <div><dt>Enviadas</dt><dd>{campaign.stats.sent ?? "—"}</dd></div>
          <div><dt>Lidas</dt><dd>{campaign.stats.read ?? "—"}</dd></div>
          <div><dt>Cliques</dt><dd>{campaign.stats.clicks ?? "—"}</dd></div>
        </dl>
      </li>)}</ul> : null}
    </div>
  </details>;
}
