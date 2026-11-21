"use client";
import { DepartmentManager } from "./department-manager";
import { ModuleChoices,moduleLabels } from "./module-choices";
import { useEffect, useState } from "react";
import { UserRoundPlus, UsersRound, X } from "lucide-react";
type AgendaOption = { key: string; accountId: string; calendarId: string; label: string };
type AgendaAssignment = { id: string; accountId: string; calendarId: string; userId: string | null; departmentId: string | null };
/* TW utility-first: cores do preset, azul só por tokens blue-*. */
const rootTw = "grid min-w-0 content-start gap-token";
const heroTw = "relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-token-lg border border-line bg-linear-to-br from-blue-50 to-surface px-6 py-5 shadow-token-sm";
const heroCopyTw = "relative grid min-w-0 gap-2";
const heroEyebrowTw = "inline-flex w-max items-center gap-1.5 font-display text-2xs font-extrabold uppercase leading-none tracking-wider text-blue-700";
const heroStatsTw = "mt-0.5 flex flex-wrap gap-2";
const heroStatTw = "inline-flex items-baseline gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-2xs text-ink-secondary";
const heroStatValueTw = "font-display text-body font-extrabold tabular-nums text-ink";
const heroCtaTw = "relative inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-5 font-display text-small font-extrabold leading-none";
const tabsTw = "inline-flex w-max max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface-2 p-1";
const tabButtonTw = "min-h-8 shrink-0 rounded-full px-3.5 text-h6 font-bold transition-colors";
const tabButtonStateTw: Record<string, string> = { on: "bg-blue-600 text-blue-50 shadow-token-sm", off: "text-ink-secondary hover:bg-surface hover:text-ink" };
const tabButtonClass = (pressed: boolean) => `${tabButtonTw} ${tabButtonStateTw[pressed ? "on" : "off"]}`;
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-brand-pad text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-brand-pad text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const textButtonTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-surface hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const dangerTextTw = "text-red-600 hover:text-red-700";
const claimBoxTw = "my-3.5 grid gap-3 rounded-token-lg border border-warning bg-warning-soft p-3.5";
const claimActionsTw = "flex flex-wrap gap-2";
const formTw = "grid overflow-hidden rounded-token-lg border border-line bg-surface shadow-token";
const formHeadTw = "flex items-center gap-3 border-b border-line bg-linear-to-b from-surface-2 to-surface px-4 py-3";
const formIconTw = "grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-blue-50 shadow-token-sm";
const formCloseTw = "ml-auto grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-transparent text-ink-secondary transition-colors hover:bg-hover hover:text-ink";
const formBodyTw = "grid grid-cols-1 gap-3.5 p-3.5";
const identityBlockTw = "grid min-w-0 grid-cols-1 content-start gap-3 rounded-token border border-line bg-surface-2 p-3 ov-laptop:grid-cols-team-identity";
const photoPremiumTw = "relative grid w-full cursor-pointer justify-items-center gap-2 px-1.5 py-1";
const photoCircleTw = "grid size-22 place-items-center overflow-hidden rounded-full bg-linear-to-br from-blue-50 to-blue-100 font-display text-h2 font-extrabold text-blue-950 shadow-token";
const photoCtaTw = "grid min-w-0 justify-items-center gap-px text-center";
const sectorsFieldsetTw = "flex flex-wrap gap-1.5 rounded-token border border-line bg-surface p-3";
const toggleTw = "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-small font-semibold text-ink transition-colors hover:border-blue-600";
const formFooterTw = "flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-3";
const formActionsTw = "flex gap-2";
const listTw = "grid grid-cols-team-list gap-3";
const cardTw = "grid content-start gap-2.5 rounded-token-lg border border-line bg-surface p-3.5 transition-transform hover:-translate-y-0.5 hover:shadow-token";
const cardInactiveTw = "opacity-75";
const cardClass = (inactive: boolean) => `${cardTw} ${inactive ? cardInactiveTw : ""}`;
const cardHeadTw = "flex min-w-0 items-center gap-3";
const avatarTw = "grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-blue-50 to-blue-100 font-display text-body font-extrabold text-blue-950 shadow-token-sm";
const cardIdTw = "grid min-w-0 gap-0.5";
const roleChipTw = "inline-flex w-max items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-extrabold uppercase tracking-wider";
const roleChipStateTw: Record<string, string> = { owner: "border-amber-600 bg-amber-50 text-amber-800", admin: "border-blue-600 bg-blue-50 text-blue-700", manager: "border-cyan-600 bg-cyan-50 text-cyan-800", agent: "border-line-strong bg-surface-2 text-ink-secondary", inactive: "border-red-600 bg-red-50 text-red-700" };
const roleChipClass = (role: string, inactive: boolean) => `${roleChipTw} ${inactive ? roleChipStateTw.inactive : roleChipStateTw[String(role).toLowerCase()] || roleChipStateTw.agent}`;
const deptChipsTw = "flex flex-wrap gap-1.5";
const deptChipTw = "rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-2xs font-semibold text-ink";
const deptEmptyTw = "rounded-lg border border-dashed border-line bg-surface-2 px-2.5 py-1 text-2xs font-semibold text-ink-secondary";
const accessSummaryTw = "mt-0.5 grid gap-1.5 rounded-xl border border-line bg-surface-2 p-2.5";
const knownByTw = "grid min-w-0 gap-1 text-2xs font-extrabold uppercase tracking-wider text-ink-secondary";
const knownByInputTw = "min-h-8 normal-case tracking-normal text-small font-semibold";
const cardActionsTw = "flex flex-wrap gap-1.5 border-t border-line pt-2.5";
const ROLE_LABELS: Record<string, string> = { OWNER: "Proprietário", ADMIN: "Administrador", MANAGER: "Gestor", AGENT: "Atendente" };
const initials = (name: string) => String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
function temporaryPasswordNotice(success: string, data: { temporaryPassword?: unknown; passwordEmail?: unknown }) {
  if (data.passwordEmail === "accepted") return success + " O servidor de e-mail aceitou o envio da senha temporária.";
  const status = data.passwordEmail === "unavailable" ? "O envio por e-mail está indisponível." : "O envio por e-mail não foi confirmado.";
  return success + " " + status + (typeof data.temporaryPassword === "string"
    ? " Senha temporária: " + data.temporaryPassword + ". A troca será obrigatória no próximo acesso." : "");
}

export function TeamWorkspace({platformAdmin=false,canManageAdmin}:{platformAdmin?:boolean;canManageAdmin?:boolean}) {
  const [editingId,setEditingId]=useState('');
  const [editRole,setEditRole]=useState('');
  const [tab, setTab] = useState("agents");
  const [rows, setRows] = useState<any[]>([]),
    [departments, setDepartments] = useState<any[]>([]),
    [form, setForm] = useState({
      name: "",knownBy:"",
      email: "",
      password: "",
      role:"AGENT",deniedModules:[] as string[],
      departmentIds: [] as string[],
      modules: [] as string[],
      agendaKey: "",
      transferScope: { anyDepartment: false, ownDepartment: true, directAgent: false },
    }),
    [photoFile, setPhotoFile] = useState<File | null>(null),
    [photoPreview, setPhotoPreview] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [agendaOptions, setAgendaOptions] = useState<AgendaOption[]>([]),
    [agendaAssignments, setAgendaAssignments] = useState<AgendaAssignment[]>([]);
  async function loadAgendas() {
    try {
      const [accountsResponse, assignmentsResponse] = await Promise.all([
        fetch("/api/backend/integrations/google/calendar/accounts"),
        fetch("/api/backend/integrations/google/calendar/assignments"),
      ]);
      if (!accountsResponse.ok || !assignmentsResponse.ok) { setAgendaOptions([]); setAgendaAssignments([]); return; }
      const accounts = await accountsResponse.json() as { id: string; email: string }[];
      const assignments = await assignmentsResponse.json() as AgendaAssignment[];
      const options: AgendaOption[] = [];
      for (const account of accounts) {
        const response = await fetch("/api/backend/integrations/google/calendar/" + encodeURIComponent(account.id) + "/calendars");
        if (!response.ok) continue;
        const data = await response.json() as { items?: { id: string; summary?: string }[] };
        for (const calendar of data.items || []) options.push({ key: account.id + "::" + calendar.id, accountId: account.id, calendarId: calendar.id, label: (calendar.summary || calendar.id) + " · " + account.email });
      }
      setAgendaOptions(options);
      setAgendaAssignments(assignments);
    } catch {
      setAgendaOptions([]);
      setAgendaAssignments([]);
    }
  }
  async function load() {
    const [r, d] = await Promise.all([
      fetch("/api/backend/team"),
      fetch("/api/backend/departments"),
    ]);
    if (!r.ok || !d.ok) throw Error("Não foi possível carregar a equipe.");
    setRows(await r.json());
    setDepartments(await d.json());
    await loadAgendas();
  }
  useEffect(() => {
    void load().catch((e) => setNotice(e.message));
  }, []);
  const [claimEmail, setClaimEmail] = useState<string | null>(null);
  async function claimSameAccount(){
  if(!claimEmail) return;
  setBusy(true);
  try { const r = await fetch("/api/backend/team/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: claimEmail, knownBy: form.knownBy }) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw Error(d.message || "Não foi possível ativar a conta."); setNotice("Conta ativada. Senha temporária: " + (d.temporaryPassword || "") + ". Anote para o primeiro acesso."); setClaimEmail(null); setForm({ ...form, name: "", email: "", knownBy: "", departmentIds: [], modules: [], deniedModules: [] }); await load(); window.dispatchEvent(new Event("vexora:team-updated")); } catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível ativar a conta."); } finally { setBusy(false); }
}

  return (
    <section className={rootTw}>
      <header className={heroTw}>
        <div className={heroCopyTw}>
          <span className={heroEyebrowTw}><UsersRound size={13} aria-hidden="true" /> Equipe</span>
          <h1>Atendentes</h1>
          <p>Pessoas e setores da sua empresa, integrados às conversas e aos fluxos.</p>
          <div className={heroStatsTw}>
            <span className={heroStatTw}><b className={heroStatValueTw}>{rows.filter((r: any) => r.isActive !== false).length}</b> ativos</span>
            <span className={heroStatTw}><b className={heroStatValueTw}>{rows.length}</b> cadastrados</span>
            <span className={heroStatTw}><b className={heroStatValueTw}>{departments.filter((d: any) => d.isActive).length}</b> setores</span>
          </div>
        </div>
        <button
          className={heroCtaTw}
          onClick={() => {setEditingId('');setPhotoFile(null);setPhotoPreview(null);setForm({name:'',knownBy:'',email:'',password:'',role:'AGENT',deniedModules:[],departmentIds:[],modules:[],agendaKey:'',transferScope:{anyDepartment:false,ownDepartment:true,directAgent:false}});setEditing(v=>!v)}}
        >
          {editing ? "Fechar cadastro" : (<><UserRoundPlus size={16} aria-hidden="true" />Cadastrar atendente</>)}
        </button>
      </header>
      <div className={tabsTw} role="tablist" aria-label="Alternar entre atendentes e setores">
        <button
          onClick={() => {
            setTab("agents");
            void load();
          }}
          aria-pressed={tab === "agents"}
          className={tabButtonClass(tab === "agents")}
        >
          Atendentes
        </button>
        <button
          onClick={() => setTab("departments")}
          aria-pressed={tab === "departments"}
          className={tabButtonClass(tab === "departments")}
        >
          Setores e permissões
        </button>
      </div>
      {tab === "departments" ? (
        <DepartmentManager />
      ) : (
        <>
          {notice && <p role="status">{notice}</p>}
          {claimEmail ? (
  <div role="alert" className={claimBoxTw}>
    <p>A conta <strong>{claimEmail}</strong> existe no sistema, mas está desativada ou não vinculada a esta empresa. Deseja ativar com uma senha temporária para ela entrar?</p>
    <div className={claimActionsTw}>
      <button type="button" className={secondaryTw} onClick={() => setClaimEmail(null)}>Cancelar</button>
      <button type="button" className={primaryTw} onClick={() => void claimSameAccount()}>Ativar a conta com senha temporária</button>
    </div>
  </div>
) : null}
          {editing && (
            <form
              className={formTw}
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await fetch("/api/backend/team"+(editingId?"/"+editingId+"/access":""), {
                    method: editingId?"PATCH":"POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(form),
                  });
                  const d = await r.json();
                  if (!r.ok) throw Error(d.message);
                  if (editingId) {
                    const scopeResponse = await fetch("/api/backend/team/" + editingId + "/transfer-scope", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(form.transferScope) });
                    if (!scopeResponse.ok) { const sd = await scopeResponse.json().catch(() => ({})); throw Error(sd.message || "Não foi possível salvar as permissões de transferência."); }
                    const profileResponse = await fetch("/api/backend/team/" + editingId + "/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, knownBy: form.knownBy }) });
                    if (!profileResponse.ok) { const pd = await profileResponse.json().catch(() => ({})); throw Error(pd.message || "Não foi possível salvar nome e e-mail."); }
                    if (canManageAdmin && form.role && form.role !== editRole) {
                      const roleResponse = await fetch("/api/backend/team/" + editingId + "/role", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: form.role }) });
                      if (!roleResponse.ok) { const rd = await roleResponse.json().catch(() => ({})); throw Error(rd.message || "Não foi possível alterar o nível de acesso."); }
                      setEditRole(form.role);
                    }
                  }
                  const createdNotice = !editingId ? temporaryPasswordNotice("Atendente cadastrado.", d) : "";
                  const memberId = editingId || d.id;
                  if (memberId) {
                    for (const assignment of agendaAssignments.filter(item => item.userId === memberId)) {
                      await fetch("/api/backend/integrations/google/calendar/assignments/" + assignment.id, { method: "DELETE" });
                    }
                    if (form.agendaKey) {
                      const [accountId, calendarId] = form.agendaKey.split("::");
                      const assignmentResponse = await fetch("/api/backend/integrations/google/calendar/assignments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId, calendarId, userId: memberId }) });
                      if (!assignmentResponse.ok) {
                        const assignmentData = await assignmentResponse.json().catch(() => ({}));
                        throw Error(assignmentData.message || "Não foi possível vincular a agenda.");
                      }
                    }
                  }
                  if (photoFile && memberId) {
                    const photoBody = new FormData();
                    photoBody.append("file", photoFile);
                    const photoResponse = await fetch("/api/backend/team/" + memberId + "/photo", { method: "POST", body: photoBody });
                    const photoData = await photoResponse.json().catch(() => ({}));
                    if (!photoResponse.ok) throw Error(photoData.message || "Não foi possível salvar a foto.");
                  }
                  setForm({
                    name: "",knownBy:"",
                    email: "",
                    password: "",
      role:"AGENT",deniedModules:[] as string[],
                    departmentIds: [],
                    modules: [],
                    agendaKey: "",
                    transferScope: { anyDepartment: false, ownDepartment: true, directAgent: false },
                  });
                  setEditing(false);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  await load();
                  window.dispatchEvent(new Event("vexora:team-updated"));
                  setNotice(editingId ? "Permissões e setores atualizados." : createdNotice);setEditingId('');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Não foi possível cadastrar.";
                  setNotice(msg);
                  if (!editingId) { const lower = msg.toLowerCase(); if (lower.includes("já possui") || lower.includes("já existe")) setClaimEmail(form.email); }
                  else setClaimEmail(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <header className={formHeadTw}>
                <span className={formIconTw} aria-hidden="true"><UserRoundPlus size={20} /></span>
                <div>
                  <h2>{editingId ? "Editar atendente" : "Cadastrar atendente"}</h2>
                  <p>{editingId ? "Altere dados, permissões e setores. O histórico da pessoa é preservado." : "Preencha os dados abaixo. Uma senha temporária é gerada no primeiro acesso."}</p>
                </div>
                <button type="button" className={formCloseTw} aria-label="Fechar cadastro" onClick={() => setEditing(false)}><X size={16} aria-hidden="true" /></button>
              </header>
              <div className={formBodyTw}>
              <div className={identityBlockTw}>
              <label className={photoPremiumTw}>
                <span className={photoCircleTw}>{photoPreview ? <img src={photoPreview} alt="Pré-visualização da foto" /> : initials(form.name || "Atendente")}</span>
                <span className={photoCtaTw}><b>{photoFile ? photoFile.name : "Adicionar foto"}</b><small>Opcional · PNG, JPG ou WebP · até 2 MB</small></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoFile(file); setPhotoPreview(file ? URL.createObjectURL(file) : null); }} />
              </label>
              <label>
                Nome
                <input
                  required
                  maxLength={160}
                  value={form.name}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, name: e.target.value }))
                  }
                />
              </label>
              <label>Conhecido por<input maxLength={80} value={form.knownBy} onChange={e=>setForm(v=>({...v,knownBy:e.target.value}))} placeholder="Ex.: Tonico"/><small>Nome exibido na empresa, nas menções e em {"{{atendente}}"}. Se vazio, usa o nome cadastrado.</small></label>
              <label>
                E-mail de acesso
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, email: e.target.value }))
                  }
                />
              </label>
              <label>Calendário pessoal
                <select value={form.agendaKey} onChange={e=>setForm(v=>({...v,agendaKey:e.target.value}))}>
                  <option value="">Sem agenda pessoal</option>
                  {agendaOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <small>O atendente verá somente esta agenda. O nome exibido é o nome amigável do Google.</small>
              </label>
              {(platformAdmin||canManageAdmin)&&<label>Permissão<select value={form.role} onChange={e=>setForm(v=>({...v,role:e.target.value,modules:e.target.value==="OWNER"?Object.keys(moduleLabels):v.modules,deniedModules:[]}))}><option value="AGENT">Atendente</option><option value="ADMIN">Administrador</option>{platformAdmin?<option value="OWNER">Proprietário da empresa</option>:null}</select><small>Administrador tem acesso a todas as permissões e setores da empresa, exceto a administração da Véxora.</small></label>}
              </div>
              <fieldset className={sectorsFieldsetTw}>
                <legend>Setores</legend>
                {departments
                  .filter((d) => d.isActive)
                  .map((d) => (
                    <label className={toggleTw} key={d.id}>
                      <input
                        type="checkbox"
                        checked={form.departmentIds.includes(d.id)}
                        onChange={(e) =>
                          setForm((v) => ({
                            ...v,
                            modules:e.target.checked?[...new Set([...v.modules,...(d.modules||[])])]:v.modules,
                            departmentIds: e.target.checked
                              ? [...v.departmentIds, d.id]
                              : v.departmentIds.filter((id) => id !== d.id),
                          }))
                        }
                      />
                      {d.name}
                    </label>
                  ))}
              </fieldset>
              <fieldset className={sectorsFieldsetTw}>
                <legend>Permissões de transferência</legend>
                <label className={toggleTw}>
                  <input
                    type="checkbox"
                    checked={form.transferScope?.ownDepartment !== false}
                    onChange={(e) => setForm((v) => ({ ...v, transferScope: { ...v.transferScope, ownDepartment: e.target.checked } }))}
                  />
                  Transferir para o próprio setor
                </label>
                <label className={toggleTw}>
                  <input
                    type="checkbox"
                    checked={form.transferScope?.anyDepartment === true}
                    onChange={(e) => setForm((v) => ({ ...v, transferScope: { ...v.transferScope, anyDepartment: e.target.checked } }))}
                  />
                  Transferir para outros setores
                </label>
                <label className={toggleTw}>
                  <input
                    type="checkbox"
                    checked={form.transferScope?.directAgent !== false}
                    onChange={(e) => setForm((v) => ({ ...v, transferScope: { ...v.transferScope, directAgent: e.target.checked } }))}
                  />
                  Transferir para atendente direto
                </label>
                <small>Vale para a janela de transferência da conversa: o atendente só enxerga e escolhe destinos liberados aqui. Assumir conversa dentro do próprio setor é sempre permitido.</small>
              </fieldset>
              <ModuleChoices
                value={form.modules}
                allowed={
                  form.role==="OWNER"?undefined:[
                    ...new Set(
                      departments
                        .filter((d) => form.departmentIds.includes(d.id))
                        .flatMap((d) => d.modules || []),
                    ),
                  ] as string[]
                }
                onChange={(modules) => setForm((v) => ({ ...v, modules,deniedModules:Object.keys(moduleLabels).filter(id=>!modules.includes(id)) }))}
              />
              </div>
              <footer className={formFooterTw}>
                <small>{!editingId ? "O atendente receberá uma senha temporária por e-mail. A troca é obrigatória no primeiro acesso." : "Nome e e-mail podem ser alterados; o histórico da pessoa é preservado."}</small>
                <div className={formActionsTw}>
                  <button type="button" className={secondaryTw} onClick={() => setEditing(false)}>Cancelar</button>
                  <button className={primaryTw} disabled={busy}>{editingId?"Salvar alterações":"Cadastrar atendente"}</button>
                </div>
              </footer>
            </form>
          )}
          <div className={listTw} aria-label="Atendentes cadastrados">
            {rows.map((r) => (
              <article className={cardClass(r.isActive === false)} key={r.id}>
                <div className={cardHeadTw}>
                  <span className={avatarTw}>{r.avatarUrl?<img src={r.avatarUrl} alt={"Foto de "+r.name}/>:initials(r.name)}</span>
                  <div className={cardIdTw}>
                    <strong>{r.name}</strong>
                    <small>{r.email}</small>
                    <span className={roleChipClass(r.role || "AGENT", false)}>{ROLE_LABELS[r.role] || r.role}</span>{r.isActive === false && <span className={roleChipClass("inactive", true)}>Desativada</span>}
                  </div>
                </div>
                <div className={deptChipsTw}>
                  {departments.filter((d) => r.departmentIds.includes(d.id)).map((d) => <span key={d.id} className={deptChipTw}>{d.name}</span>)}
                  {!r.departmentIds.length && <span className={deptEmptyTw}>Sem setor definido</span>}
                </div>
                <div className={accessSummaryTw}>
                  <strong>Permissões por módulo</strong>
                  <ul className={deptChipsTw} aria-label={"Permissões de " + r.name} style={{ listStyle: "none", padding: 0, margin: "5px 0 0" }}>
                    {Object.entries(moduleLabels).map(([id, label]) => {
                      const allowed = r.isActive !== false && (r.effectiveAccessModules ?? r.modules ?? []).includes(id);
                      return <li key={id} data-allowed={allowed}><span className={allowed ? deptChipTw : deptEmptyTw}>
                        <b aria-hidden="true">{allowed ? "✓ " : "− "}</b>{label}
                        <i className="sr-only">{allowed ? " — com acesso" : " — sem acesso"}</i>
                      </span></li>;
                    })}
                  </ul>
                </div>
<label className={knownByTw}><span>Conhecido por</span><input key={r.id+":"+(r.knownBy||"")} defaultValue={r.knownBy||""} maxLength={80} placeholder={r.fullName||r.name} className={knownByInputTw} onBlur={async e=>{const knownBy=e.target.value.trim();if(knownBy===(r.knownBy||""))return;try{const response=await fetch("/api/backend/team/"+r.id+"/identity",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({knownBy})});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível salvar o nome.");await load();window.dispatchEvent(new Event("vexora:team-updated"));setNotice("Nome de atendimento atualizado.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar.");}}}/></label>
<div className={cardActionsTw}>{r.isActive === false ? (<>
              <button className={secondaryTw} disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id+"/reactivate",{method:"PATCH"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível reativar.");setNotice("Atendente reativado. Senha temporária: "+(data.temporaryPassword||"")+". Troca obrigatória no próximo acesso.");await load();window.dispatchEvent(new Event("vexora:team-updated"));}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível reativar.")}finally{setBusy(false)}}}>Reativar</button>
              <button className={`${textButtonTw} ${dangerTextTw}`} disabled={busy} onClick={async()=>{if(!window.confirm("Excluir definitivamente "+r.name+" da empresa? O e-mail fica liberado e o vínculo é desfeito; quando possível, o histórico é preservado. Esta ação não pode ser desfeita."))return;setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id+"/permanent",{method:"DELETE"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível excluir definitivamente.");setNotice(data.emailFreed?"Atendente excluído definitivamente: e-mail liberado para novo cadastro.":"Vínculo do atendente removido desta empresa.");await load();window.dispatchEvent(new Event("vexora:team-updated"));}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível excluir definitivamente.")}finally{setBusy(false)}}}>Excluir definitivamente</button>
              </>) : (<>
              {r.canEditAccess&&<button className={secondaryTw} onClick={()=>{setEditingId(r.id);setEditRole(r.role||'');setPhotoFile(null);setPhotoPreview(null);setForm({name:r.fullName||r.name,knownBy:r.knownBy||"",email:r.email,password:'',role:r.role,deniedModules:r.deniedModules||[],departmentIds:r.departmentIds,modules:r.modules||[],agendaKey:agendaAssignments.filter(item=>item.userId===r.id).map(item=>item.accountId+"::"+item.calendarId)[0]||"",transferScope:{anyDepartment:r.transferScope?.anyDepartment===true,ownDepartment:r.transferScope?.ownDepartment!==false,directAgent:r.transferScope?.directAgent!==false}});setEditing(true)}}>Editar atendente</button>}
              {(r.canResetPassword ?? platformAdmin)&&<button className={textButtonTw} disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/backend/team/'+r.id+'/reset-password',{method:'POST'});const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível redefinir.');setNotice(temporaryPasswordNotice("Senha redefinida para " + r.name + ".", data));await load().catch(() => undefined);}catch(error){setNotice(error instanceof Error?error.message:'Não foi possível redefinir.')}finally{setBusy(false)}}}>Redefinir senha</button>}
              {r.id!==undefined&&r.isActive&&r.id!==undefined&&<button className={`${textButtonTw} ${dangerTextTw}`} disabled={busy} onClick={async()=>{if(!window.confirm("Desativar "+r.name+"? O histórico de conversas será preservado."))return;setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id,{method:"DELETE"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível desativar.");setNotice("Usuário desativado. O histórico foi preservado.");await load();}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível desativar.")}finally{setBusy(false)}}}>Desativar</button>}
                            </>)}
              </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

