"use client";
import { useEffect, useState } from "react";
import { BarChart3, FileText, MessageSquare, Play, Users, Video } from "lucide-react";

const WELCOME_VIDEO_KEY = "vx:welcome-video";

const shortcutTw = {
  support: "grid h-8 w-8 flex-none place-items-center rounded-lg bg-sky-400/20 text-sky-700 dark:text-sky-300",
  crm: "grid h-8 w-8 flex-none place-items-center rounded-lg bg-violet-400/20 text-violet-700 dark:text-violet-300",
  reports: "grid h-8 w-8 flex-none place-items-center rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300",
  documents: "grid h-8 w-8 flex-none place-items-center rounded-lg bg-emerald-400/20 text-emerald-700 dark:text-emerald-300",
};

const shortcuts = [
  { id: "support", label: "Abrir atendimento", hint: "Fila e conversas da equipe", target: "Atendimento", Icon: MessageSquare },
  { id: "crm", label: "CRM comercial", hint: "Negócios e contatos", target: "CRM", Icon: Users },
  { id: "reports", label: "Relatórios", hint: "Resultados da operação", target: "Relatórios", Icon: BarChart3 },
  { id: "documents", label: "Documentos", hint: "Orçamentos e contratos", target: "Documentos", Icon: FileText },
] as const;

/** Converte apenas links públicos do YouTube em embed; qualquer outro valor é recusado. */
function youtubeEmbed(value: string): string | null {
  const match = value.trim().match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match ? "https://www.youtube.com/embed/" + match[1] : null;
}

/** Primeiros passos úteis na Visão geral: vídeo opcional e atalhos frequentes. */
export function DashboardWelcome({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [video, setVideo] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    try { setVideo(window.localStorage.getItem(WELCOME_VIDEO_KEY) || ""); } catch { /* ignore */ }
  }, []);

  const embed = youtubeEmbed(video);
  const saveVideo = () => {
    const value = draft.trim();
    if (youtubeEmbed(value)) {
      try { window.localStorage.setItem(WELCOME_VIDEO_KEY, value); } catch { /* ignore */ }
      setVideo(value);
      setInvalid(false);
      setEditing(false);
    } else {
      setInvalid(true);
    }
  };

  return (
    <section className="grid w-full gap-3 bg-transparent p-4 text-slate-800 hover:bg-transparent dark:text-slate-100" aria-label="Comece por aqui">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap items-center gap-1.5 text-blue-700 dark:text-blue-300">
          <Video size={16} aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Conheça a Véxora em pouco tempo</h2>
          <span className="text-xs text-slate-600 dark:text-slate-300">Um espaço reservado para o vídeo da sua empresa</span>
        </div>
        <button type="button" className="inline-flex min-h-7 items-center gap-1 rounded-lg border border-blue-200 bg-white/80 px-2 text-xs font-bold text-blue-700 transition-colors duration-200 hover:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-blue-300" onClick={() => { setDraft(video); setInvalid(false); setEditing(value => !value); }} aria-label="Alterar vídeo de boas-vindas">Alterar vídeo</button>
      </div>
      {editing ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); saveVideo(); }}>
          <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Link do YouTube do vídeo de boas-vindas" placeholder="Cole o link do YouTube" />
          <button type="submit" className="inline-flex min-h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-bold text-slate-50 transition-colors duration-200 hover:bg-blue-700">Salvar vídeo</button>
          <button type="button" className="inline-flex min-h-8 items-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" onClick={() => setEditing(false)}>Cancelar</button>
        </form>
      ) : null}
      {invalid ? <p className="text-xs text-red-600 dark:text-red-300" role="status">Use um link público do YouTube.</p> : null}
      <div className="grid min-h-40 place-items-center overflow-hidden rounded-xl border border-blue-200 bg-linear-to-br from-sky-400 via-blue-500 to-indigo-600 dark:border-slate-600">
        {embed ? (
          <iframe className="h-48 w-full border-0" src={embed} title="Vídeo de boas-vindas da Véxora" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        ) : (
          <div className="grid place-items-center gap-1 p-4 text-center text-slate-50">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/25"><Play size={18} aria-hidden="true" /></span>
            <strong className="text-sm font-bold">Seu vídeo aparece aqui</strong>
            <span className="text-xs text-slate-100">Cole um link do YouTube para personalizar este espaço.</span>
          </div>
        )}
      </div>
      <div className="grid content-start gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">Atalhos úteis</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {shortcuts.map(({ id, label, hint, target, Icon }) => (
            <button key={id} type="button" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-100 bg-transparent px-3 text-left transition-colors duration-200 hover:border-blue-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600" onClick={() => onNavigate(target)}>
              <span className={shortcutTw[id]} aria-hidden="true"><Icon size={16} /></span>
              <span className="grid min-w-0"><strong className="truncate text-xs font-bold text-slate-800 dark:text-slate-50">{label}</strong><small className="truncate text-xs text-slate-600 dark:text-slate-300">{hint}</small></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
