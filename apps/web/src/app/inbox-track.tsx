"use client";

import { useRef, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";

type Position = { id?: string; latitude: number; longitude: number; battery: number | null; speedKph: number | null; recordedAt: string; receivedAt: string };
type Device = { id: string; name: string; reference: string; isSimulation: boolean; isActive: boolean; lastSeenAt: string | null; position: Position | null; department: { name: string } | null };
type Devices = { manager: boolean; hasNext: boolean; devices: Device[]; departments: { id: string; name: string }[] };
const primaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-transparent bg-linear-to-br from-blue-50 via-blue-600 to-blue-700 px-4 text-xs font-bold text-blue-900 shadow-vx-brand transition-colors hover:from-blue-100 hover:via-blue-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-9 items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-3.5 text-xs font-bold text-ink shadow-token-sm transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";


async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch("/api/backend/track/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Não foi possível concluir a operação.");
  return payload as T;
}
function date(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function location(point: Position) {
  const latitude = point.latitude.toFixed(5), longitude = point.longitude.toFixed(5);
  return "https://www.openstreetmap.org/?mlat=" + latitude + "&mlon=" + longitude + "#map=15/" + latitude + "/" + longitude;
}

export function InboxTrack({ menuItem = false }: { menuItem?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [catalog, setCatalog] = useState<Devices>();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>();
  const [history, setHistory] = useState<Position[]>([]);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const current = catalog?.devices.find(device => device.id === selected);

  async function refresh(targetPage = page) {
    setCatalog(await api<Devices>("devices?page=" + targetPage));
    setPage(targetPage);
  }

  async function run(action: () => Promise<void>) {
    setSaving(true); setError(""); setNotice("");
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : "Falha no Track."); }
    finally { setSaving(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    void run(async () => {
      const result = await api<{id: string; token?: string}>("devices", {
        name: values.get("name"), reference: values.get("reference"), departmentId: values.get("team") || null,
        isSimulation: values.get("mode") === "simulation",
      });
      setToken(result.token ?? "");
      setSelected(result.id); setHistory([]);
      form.reset();
      await refresh(1);
      setNotice("Dispositivo cadastrado.");
    });
  }

  function simulate(event: FormEvent<HTMLFormElement>, device: Device) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void run(async () => {
      await api("devices/" + device.id + "/simulate", { latitude: Number(values.get("latitude")), longitude: Number(values.get("longitude")) });
      await refresh();
      setHistory(await api<Position[]>("devices/" + device.id + "/history"));
      setNotice("Posição simulada registrada.");
    });
  }

  function change(device: Device, action: string) {
    if (action === "rotate" && !window.confirm("Gerar outra chave? A chave atual deixará de receber posições.")) return;
    void run(async () => {
      const response = await api<{token?: string}>("devices/" + device.id + "/" + action, {});
      setToken(response.token ?? "");
      await refresh();
      setNotice(action === "rotate" ? "Nova chave gerada." : "Dispositivo atualizado.");
    });
  }

  return <>
    <button type="button" role={menuItem ? "menuitem" : undefined} className={menuItem ? undefined : secondaryButton} onClick={() => { dialog.current?.showModal(); void run(() => refresh()); }}>
      <MapPin size={16} aria-hidden="true" /> Véxora Track
    </button>
    <dialog ref={dialog} className="w-ib-track max-h-ib-track overflow-auto rounded-ib-modal border border-gray-200 bg-zinc-100 px-ib-pad pb-ib-pad pt-0 text-slate-950" aria-label="Véxora Track" onClose={() => setToken("")}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2.5 border-b border-gray-200 bg-zinc-100 py-3"><div><h2 className="m-0 text-ib-title font-bold">Véxora Track</h2><span>Dispositivos e posições</span></div><button type="button" className={secondaryButton} onClick={() => dialog.current?.close()}>Fechar</button></header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!catalog && saving && <p role="status">Carregando dispositivos…</p>}
      {token && <aside className="my-3 rounded-ib-panel border border-gray-200 p-3">
        <strong>Chave de ingestão</strong>
        <p>Copie esta chave agora para o dispositivo ou integrador. Ela será exibida uma única vez.</p>
        <input aria-label="Chave de ingestão" className="w-full min-w-0" value={token} readOnly onFocus={event => event.currentTarget.select()} />
      </aside>}
      {catalog?.manager && <details className="my-3 rounded-ib-panel border border-gray-200 p-3"><summary className="cursor-pointer font-ib">Cadastrar dispositivo</summary>
        <form onSubmit={create} className="my-ib-block grid min-w-0 content-start gap-ib-gap">
          <label className="grid min-w-0 content-start gap-ib-gap">Nome <input className="w-full min-w-0" name="name" required maxLength={100} placeholder="Ex. Equipamento da unidade 01" /></label>
          <label className="grid min-w-0 content-start gap-ib-gap">Referência <input className="w-full min-w-0" name="reference" required maxLength={80} placeholder="Ex. TRK-01" /></label>
          <label className="grid min-w-0 content-start gap-ib-gap">Modo <select className="w-full min-w-0" name="mode"><option value="simulation">Simulado</option><option value="real">Integração real</option></select></label>
          <label className="grid min-w-0 content-start gap-ib-gap">Equipe com acesso <select className="w-full min-w-0" name="team"><option value="">Administradores</option>{catalog.departments.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <button className={primaryButton + " justify-self-start"} disabled={saving}>Cadastrar</button>
        </form>
      </details>}
      {catalog && <>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-0 content-start gap-ib-gap">Filtrar nesta página <input className="w-full min-w-0" type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
          <button type="button" className={secondaryButton} disabled={saving} onClick={() => void run(async () => {
            await refresh();
            if (selected) setHistory(await api<Position[]>("devices/" + selected + "/history"));
          })}>Atualizar</button>
        </div>
        <div className="mt-3 grid grid-cols-ib-track gap-3.5 ib-narrow:grid-cols-1">
          <nav aria-label="Dispositivos" className="grid min-w-0 content-start gap-ib-gap">
            {!catalog.devices.length && <p>Nenhum dispositivo disponível.</p>}
            {catalog.devices.filter(device => (device.name + " " + device.reference).toLowerCase().includes(filter.trim().toLowerCase())).map(device => <button type="button" key={device.id} disabled={saving} aria-pressed={selected === device.id} className={"grid gap-1 break-words rounded-ib-entry border border-gray-200 bg-zinc-200 p-2.5 text-start text-slate-950" + (selected === device.id ? " border-blue-600" : "")} onClick={() => void run(async () => {
              setSelected(device.id); setToken(""); setHistory([]);
              setHistory(await api<Position[]>("devices/" + device.id + "/history"));
            })}><strong>{device.name}</strong><small>{device.reference} · {device.isSimulation ? "Simulado" : "Real"}{device.isActive ? "" : " · Pausado"}</small></button>)}
            {(page > 1 || catalog.hasNext) && <div className="flex flex-wrap items-end gap-2">
              <button type="button" className={secondaryButton} disabled={saving || page <= 1} onClick={() => void run(() => refresh(page - 1))}>Anterior</button>
              <button type="button" className={secondaryButton} disabled={saving || !catalog.hasNext} onClick={() => void run(() => refresh(page + 1))}>Próxima</button>
            </div>}
          </nav>
          {current && <section className="my-ib-block grid min-w-0 content-start gap-ib-gap">
            <h3 className="m-0 text-base font-bold">{current.name}</h3>
            <dl className="my-ib-block grid min-w-0 content-start gap-ib-gap">
              <div><dt>Equipe</dt><dd className="m-0">{current.department?.name ?? "Administradores"}</dd></div>
              <div><dt>Última comunicação recebida</dt><dd className="m-0">{current.lastSeenAt ? date(current.lastSeenAt) : "Aguardando dados"}</dd></div>
              <div><dt>Última posição registrada</dt><dd className="m-0">{current.position ? date(current.position.recordedAt) : "Sem posição"}</dd></div>
            </dl>
            {current.position && <a href={location(current.position)} target="_blank" rel="noreferrer">Abrir última posição no mapa</a>}
            {catalog.manager && <div className="flex flex-wrap items-end gap-2">
              <button type="button" className={secondaryButton} disabled={saving} onClick={() => change(current, current.isActive ? "pause" : "resume")}>{current.isActive ? "Pausar recebimento" : "Retomar recebimento"}</button>
              {!current.isSimulation && <button type="button" className={secondaryButton} disabled={saving} onClick={() => change(current, "rotate")}>Gerar nova chave</button>}
            </div>}
            {catalog.manager && current.isActive && current.isSimulation && <form onSubmit={event => simulate(event, current)} className="my-ib-block grid min-w-0 content-start gap-ib-gap">
              <label className="grid min-w-0 content-start gap-ib-gap">Latitude <input className="w-full min-w-0" name="latitude" type="number" min="-90" max="90" step="any" required /></label>
              <label className="grid min-w-0 content-start gap-ib-gap">Longitude <input className="w-full min-w-0" name="longitude" type="number" min="-180" max="180" step="any" required /></label>
              <button className={primaryButton + " justify-self-start"} disabled={saving}>Registrar posição simulada</button>
            </form>}
            {history.length > 0 && <details className="my-3 rounded-ib-panel border border-gray-200 p-3"><summary className="cursor-pointer font-ib">Histórico de posições</summary>
              <ul>{history.map(point => <li key={point.id}><a href={location(point)} target="_blank" rel="noreferrer">{date(point.recordedAt)}</a> · {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</li>)}</ul>
            </details>}
          </section>}
        </div>
      </>}
    </dialog>
  </>;
}
