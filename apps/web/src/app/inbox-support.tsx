"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleHelp, ClipboardList, ArrowUpRight } from "lucide-react";

const base = "/api/backend/conversations/";
type Kind = "HELP" | "ESCALATION";
type Field = { key: string; label: string };
type Settings = { fields: Field[]; helpMinutes: number; escalationMinutes: number; replyMinutes: number };
type Context = {
  settings: Settings; canEdit: boolean; canRequest: boolean; platform: string | null;
  values: Record<string,string>; departments: { id: string; name: string }[];
  history: { id: string; kind: Kind; state: string; note: string; answer: string | null; dueAt: string; destination: { name: string } }[];
};
type Pending = { id: string; conversationId: string; kind: Kind; note: string; dueAt: string; destination: string; canAct: boolean; canCancel: boolean; stale: boolean };
type Queue = { manager: boolean; requests: Pending[]; waiting: { id: string; name: string; team: string | null; assignee: string | null; since: string }[] };
const kindNames = { HELP: "Pedido de ajuda", ESCALATION: "Escalonamento" };
const states: Record<string,string> = { OPEN: "Pendente", DONE: "Concluído", CANCELLED: "Cancelado" };
const primaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-transparent bg-linear-to-br from-blue-50 via-blue-600 to-blue-700 px-4 text-xs font-bold text-blue-900 shadow-vx-brand transition-colors hover:from-blue-100 hover:via-blue-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-3.5 text-xs font-bold text-ink shadow-token-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";


async function supportApi<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(base + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : "Não foi possível concluir a operação.");
  return data as T;
}
function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function conversationUrl(id: string) {
  return "/?module=Atendimento&conversation=" + encodeURIComponent(id);
}

function SupportDialog({ title, icon, children, onOpen, onClose, menuItem }: { title: string; icon: ReactNode; children: ReactNode; onOpen: () => void; onClose?: () => void; menuItem?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className={menuItem ? undefined : secondaryButton} role={menuItem ? "menuitem" : undefined} type="button" onClick={() => { dialog.current?.showModal(); onOpen(); }}>{icon}{title}</button>
    <dialog ref={dialog} onClose={onClose} className="w-ib-support max-h-ib-support overflow-auto rounded-ib-modal border border-gray-200 bg-zinc-100 px-ib-pad pb-ib-pad pt-0 text-slate-950 shadow-token-lg" aria-label={title}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-200 bg-zinc-100 py-3"><h2 className="m-0 text-base">{title}</h2><button type="button" className={secondaryButton} onClick={() => dialog.current?.close()}>Fechar</button></header>
      {children}
    </dialog>
  </>;
}

export function InboxSupportContext({ conversationId, customerName, menuItem }: { conversationId: string; customerName: string; menuItem?: boolean }) {
  const [context, setContext] = useState<Context>();
  const [values, setValues] = useState<Record<string,string>>({});
  const [kind, setKind] = useState<Kind>("HELP");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const path = conversationId + "/";
  async function refresh() {
    const data = await supportApi<Context>(path + "support-context");
    setContext(data);
    setValues(data.values);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Falha no atendimento."); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    void run(async () => {
      await supportApi(path + "support-requests", {
        kind, destinationId: fields.get("destinationId"), note: fields.get("note"), minutes: Number(fields.get("minutes")),
      });
      form.reset();
      await refresh();
      setNotice(kind === "HELP" ? "Pedido enviado à equipe. O responsável pelo cliente foi mantido." : "Escalonamento enviado. O responsável atual acompanha até o aceite.");
    });
  }
  return <SupportDialog menuItem={menuItem} title="Contexto e apoio" icon={<CircleHelp size={16} aria-hidden="true" />} onOpen={() => void run(refresh)}>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {busy && !context && <p role="status">Carregando contexto…</p>}
      {context && <>
        <p data-testid="ib-support-context" className="flex flex-wrap items-center gap-2"><strong>{customerName}</strong>{context.platform && <span>{context.platform}</span>}</p>
        {context.settings.fields.length > 0 && <form onSubmit={event => {
          event.preventDefault();
          void run(async () => { await supportApi(path + "support-context", { values }); setNotice("Contexto salvo."); });
        }} className="mt-3 grid gap-ib-gap">
          {context.settings.fields.map(field => <label key={field.key} className="grid min-w-0 gap-1">{field.label}
            <textarea className="w-full min-w-0" rows={2} readOnly={!context.canEdit} maxLength={800} value={values[field.key] ?? ""} onChange={event => setValues({ ...values, [field.key]: event.target.value })} />
          </label>)}
          {context.canEdit && <button className={secondaryButton + " justify-self-start"} disabled={busy}>Salvar contexto</button>}
        </form>}
        {context.canRequest ? <section className="mt-3 grid gap-ib-gap">
          <div className="flex flex-wrap items-center gap-2" aria-label="Tipo de encaminhamento">
            <button type="button" className={secondaryButton + (kind === "HELP" ? " border-blue-600 bg-blue-50 text-blue-800" : "")} aria-pressed={kind === "HELP"} onClick={() => setKind("HELP")}>Pedir ajuda</button>
            <button type="button" className={secondaryButton + (kind === "ESCALATION" ? " border-blue-600 bg-blue-50 text-blue-800" : "")} aria-pressed={kind === "ESCALATION"} onClick={() => setKind("ESCALATION")}>Escalar</button>
          </div>
          {context.departments.length ? <form key={kind} onSubmit={create} className="mt-3 grid gap-ib-gap">
            <p>{kind === "HELP" ? "Seu time continua com o atendimento até a resposta interna." : "O especialista assume a conversa ao aceitar."}</p>
            <label className="grid min-w-0 gap-1">Equipe de destino <select className="w-full min-w-0" name="destinationId" required defaultValue=""><option value="" disabled>Selecionar equipe</option>{context.departments.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="grid min-w-0 gap-1">{kind === "HELP" ? "Pergunta para a equipe" : "Motivo e testes já realizados"}<textarea className="w-full min-w-0" name="note" maxLength={1800} required /></label>
            <label className="grid min-w-0 gap-1">Prazo em minutos <input className="w-full min-w-0" name="minutes" type="number" min="1" max="10080" required defaultValue={kind === "HELP" ? context.settings.helpMinutes : context.settings.escalationMinutes} /></label>
            <button className={primaryButton + " justify-self-start"} disabled={busy}>{kind === "HELP" ? "Enviar pedido de ajuda" : "Enviar escalonamento"}</button>
          </form> : <p>Nenhuma equipe disponível para as suas permissões de transferência.</p>}
        </section> : <p>O responsável pelo atendimento pode pedir ajuda ou escalonar.</p>}
        <section className="mt-3 grid gap-ib-gap">
          <h3 className="m-0 text-base">Histórico interno</h3>
          {context.history.length === 0 && <p>Sem solicitações neste atendimento.</p>}
          {context.history.map(row => <article key={row.id} className="grid gap-ib-gap break-words rounded-ib-article border border-gray-200 p-2.5">
            <strong>{kindNames[row.kind]} · {row.destination.name}</strong>
            <small>{states[row.state] ?? row.state} · {dateTime(row.dueAt)}</small>
            <p className="m-0 whitespace-pre-wrap">{row.note}</p>{row.answer && <p className="m-0 whitespace-pre-wrap"><strong>Resposta</strong> {row.answer}</p>}
          </article>)}
        </section>
      </>}
    </SupportDialog>;
}

function SupportSettingsForm({ settings, onSave, busy }: { settings: Settings; onSave: (value: Settings) => void; busy: boolean }) {
  const [fields, setFields] = useState(settings.fields);
  return <form onSubmit={event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSave({ fields, helpMinutes: Number(values.get("help")), escalationMinutes: Number(values.get("escalation")), replyMinutes: Number(values.get("reply")) });
  }} className="mt-3 grid gap-ib-gap">
    <label className="grid min-w-0 gap-1">Prazo padrão para ajuda (min) <input className="w-full min-w-0" type="number" name="help" min="1" max="10080" required defaultValue={settings.helpMinutes} /></label>
    <label className="grid min-w-0 gap-1">Prazo padrão para aceite (min) <input className="w-full min-w-0" type="number" name="escalation" min="1" max="10080" required defaultValue={settings.escalationMinutes} /></label>
    <label className="grid min-w-0 gap-1">Tempo para sinalizar cliente sem retorno (min) <input className="w-full min-w-0" type="number" name="reply" min="1" max="10080" required defaultValue={settings.replyMinutes} /></label>
    <h3 className="m-0 text-base">Campos do atendimento</h3>
    {fields.map((field, index) => <div key={index} className="grid grid-cols-ib-field items-end gap-2 ib-mobile:grid-cols-2">
      <label className="grid min-w-0 gap-1">Chave <input className="w-full min-w-0" value={field.key} pattern="[a-z][a-z0-9_]{0,31}" required onChange={event => setFields(fields.map((row,i) => i === index ? { ...row, key: event.target.value } : row))} /></label>
      <label className="grid min-w-0 gap-1">Nome visível <input className="w-full min-w-0" value={field.label} maxLength={55} required onChange={event => setFields(fields.map((row,i) => i === index ? { ...row, label: event.target.value } : row))} /></label>
      <button type="button" className={secondaryButton + " ib-mobile:col-span-2 ib-mobile:justify-self-start"} aria-label={"Remover campo " + (field.label || index + 1)} onClick={() => setFields(fields.filter((_,i) => i !== index))}>Remover</button>
    </div>)}
    <button type="button" className={secondaryButton + " justify-self-start"} disabled={fields.length >= 12} onClick={() => setFields([...fields, { key: "", label: "" }])}>Adicionar campo</button>
    <button className={primaryButton + " justify-self-start"} disabled={busy}>Salvar configuração da empresa</button>
  </form>;
}

export function InboxSupportQueue({ menuItem = false }: { menuItem?: boolean }) {
  const [queue, setQueue] = useState<Queue>();
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState(false);
  const [acceptedConversation, setAcceptedConversation] = useState<string>();
  async function refresh() {
    setQueue(await supportApi<Queue>("support-queue"));
    setNow(Date.now());
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Falha na operação."); }
    finally { setBusy(false); }
  }
  function respond(row: Pending, decision: "accept" | "answer" | "cancel", answer?: FormDataEntryValue | null) {
    void run(async () => {
      await supportApi("support-requests/" + row.id + "/respond", { decision, answer });
      await refresh();
      if (decision === "accept") setAcceptedConversation(row.conversationId);
      setNotice(decision === "accept" ? "Escalonamento aceito. A conversa foi atribuída a você." : decision === "answer" ? "Resposta registrada." : "Solicitação cancelada.");
    });
  }
  useEffect(() => {
    if (!open || busy) return;
    let active = true;
    const timer = window.setInterval(() => {
      void supportApi<Queue>("support-queue").then(data => {
        if (active) { setQueue(data); setNow(Date.now()); }
      }).catch(() => {});
    }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, busy]);

  return <SupportDialog menuItem={menuItem} title="Fila de apoio" icon={<ClipboardList size={16} aria-hidden="true" />} onOpen={() => { setOpen(true); setAcceptedConversation(undefined); void run(refresh); }} onClose={() => setOpen(false)}>
    <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className={secondaryButton} disabled={busy} onClick={() => void run(refresh)}>Atualizar fila</button>
      {queue?.manager && <button type="button" className={secondaryButton} disabled={busy} onClick={() => void run(async () => setSettings(await supportApi<Settings>("support-settings")))}>Configurar campos e prazos</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {acceptedConversation && <a href={conversationUrl(acceptedConversation)}>Abrir atendimento assumido <ArrowUpRight size={14} aria-hidden="true" /></a>}
    {busy && !queue && <p role="status">Carregando fila…</p>}
    {settings && <section className="mt-3 grid gap-ib-gap"><h3 className="m-0 text-base">Configuração da empresa</h3>
      <SupportSettingsForm settings={settings} busy={busy} onSave={value => void run(async () => {
        await supportApi("support-settings", value); setSettings(undefined); await refresh(); setNotice("Configuração salva.");
      })} />
    </section>}
    {queue?.manager && <section className="mt-3 grid gap-ib-gap">
      <h3 className="m-0 text-base">Clientes sem retorno no prazo</h3>
      {!queue.waiting.length && <p>Nenhum atendimento nesta fila.</p>}
      {queue.waiting.map(row => <article key={row.id} className="grid gap-ib-gap break-words rounded-ib-article border border-gray-200 p-2.5">
        <a href={conversationUrl(row.id)}>{row.name} <ArrowUpRight size={14} aria-hidden="true" /></a>
        <span>{row.team ?? "Sem equipe"} · {row.assignee ?? "Sem responsável"}</span>
        <small>Aguardando desde {dateTime(row.since)}</small>
      </article>)}
    </section>}
    {queue && (["HELP","ESCALATION"] as const).map(kind => <section key={kind} className="mt-3 grid gap-ib-gap">
      <h3 className="m-0 text-base">{kind === "HELP" ? "Pedidos de ajuda" : "Escalonamentos sem aceite"}</h3>
      {!queue.requests.some(row => row.kind === kind) && <p>Nenhuma solicitação pendente.</p>}
      {queue.requests.filter(row => row.kind === kind).map(row => <article key={row.id} className="grid gap-ib-gap break-words rounded-ib-article border border-gray-200 p-2.5">
        <strong>{row.destination}</strong>
        <small>{row.stale ? "Responsabilidade alterada" : now >= Date.parse(row.dueAt) ? "Atrasado" : "No prazo"} · {dateTime(row.dueAt)}</small>
        <p className="m-0 whitespace-pre-wrap">{row.note}</p>
        <div className="flex flex-wrap items-center gap-2">
          {row.canCancel && <button type="button" className={secondaryButton} disabled={busy} onClick={() => respond(row,"cancel")}>Cancelar solicitação</button>}
          {row.canAct && row.kind === "ESCALATION" && <button type="button" className={primaryButton} disabled={busy} onClick={() => respond(row,"accept")}>Aceitar e assumir</button>}
        </div>
        {row.canAct && row.kind === "HELP" && <form onSubmit={event => { event.preventDefault(); respond(row,"answer",new FormData(event.currentTarget).get("answer")); }} className="mt-3 grid gap-ib-gap">
          <label className="grid min-w-0 gap-1">Resposta interna <textarea className="w-full min-w-0" name="answer" maxLength={1800} required /></label>
          <button className={primaryButton + " justify-self-start"} disabled={busy}>Responder</button>
        </form>}
        {row.canCancel && <a href={conversationUrl(row.conversationId)}>Abrir atendimento <ArrowUpRight size={14} aria-hidden="true" /></a>}
      </article>)}
    </section>)}
  </SupportDialog>;
}
