"use client";
import { DepartmentManager } from "./department-manager";
import { ModuleChoices,moduleLabels } from "./module-choices";
import { useEffect, useState } from "react";
import { UserRoundPlus, UsersRound, X } from "lucide-react";
type AgendaOption = { key: string; accountId: string; calendarId: string; label: string };
type AgendaAssignment = { id: string; accountId: string; calendarId: string; userId: string | null; departmentId: string | null };
const ROLE_LABELS: Record<string, string> = { OWNER: "Proprietário", ADMIN: "Administrador", MANAGER: "Gestor", AGENT: "Atendente" };
const initials = (name: string) => String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
export function TeamWorkspace({platformAdmin=false}:{platformAdmin?:boolean}) {
  const [editingId,setEditingId]=useState('');
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
  return (
    <section className="simple-workspace team-workspace">
      <header className="team-hero">
        <div className="team-hero-copy">
          <span className="team-eyebrow"><UsersRound size={13} aria-hidden="true" /> Equipe</span>
          <h1>Atendentes</h1>
          <p>Pessoas e setores da sua empresa, integrados às conversas e aos fluxos.</p>
          <div className="team-hero-stats">
            <span><b>{rows.filter((r: any) => r.isActive !== false).length}</b> ativos</span>
            <span><b>{rows.length}</b> cadastrados</span>
            <span><b>{departments.filter((d: any) => d.isActive).length}</b> setores</span>
          </div>
        </div>
        <button
          className="primary-button team-hero-cta"
          onClick={() => {setEditingId('');setPhotoFile(null);setPhotoPreview(null);setForm({name:'',knownBy:'',email:'',password:'',role:'AGENT',deniedModules:[],departmentIds:[],modules:[],agendaKey:''});setEditing(v=>!v)}}
        >
          {editing ? "Fechar cadastro" : (<><UserRoundPlus size={16} aria-hidden="true" />Cadastrar atendente</>)}
        </button>
      </header>
      <div className="module-tabs team-tabs" role="tablist" aria-label="Alternar entre atendentes e setores">
        <button
          onClick={() => {
            setTab("agents");
            void load();
          }}
          aria-pressed={tab === "agents"}
        >
          Atendentes
        </button>
        <button
          onClick={() => setTab("departments")}
          aria-pressed={tab === "departments"}
        >
          Setores e permissões
        </button>
      </div>
      {tab === "departments" ? (
        <DepartmentManager />
      ) : (
        <>
          {notice && <p role="status">{notice}</p>}
          {editing && (
            <form
              className="team-form team-form-premium"
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
                  const temporaryPassword = !editingId && typeof d.temporaryPassword === "string" ? d.temporaryPassword : "";
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
                  });
                  setEditing(false);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  await load();
                  window.dispatchEvent(new Event("vexora:team-updated"));
                  setNotice(temporaryPassword ? "Atendente cadastrado. Senha temporária: " + temporaryPassword + ". Guarde-a agora; ela será exigida apenas no primeiro acesso." : editingId ? "Permissões e setores atualizados." : "Atendente cadastrado e disponível nos fluxos.");setEditingId('');
                } catch (e) {
                  setNotice(
                    e instanceof Error
                      ? e.message
                      : "Não foi possível cadastrar.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <header className="team-form-head">
                <span className="team-form-icon" aria-hidden="true"><UserRoundPlus size={20} /></span>
                <div>
                  <h2>{editingId ? "Setores e permissões" : "Cadastrar atendente"}</h2>
                  <p>{editingId ? "Ajuste os setores e os módulos liberados para esta pessoa." : "Preencha os dados abaixo. Uma senha temporária é gerada no primeiro acesso."}</p>
                </div>
                <button type="button" className="team-form-close" aria-label="Fechar cadastro" onClick={() => setEditing(false)}><X size={16} aria-hidden="true" /></button>
              </header>
              <div className="team-form-grid team-form-body">
              <div className="team-identity-block">
              <label className="team-photo-premium">
                <span className="team-photo-circle">{photoPreview ? <img src={photoPreview} alt="Pré-visualização da foto" /> : initials(form.name || "Atendente")}</span>
                <span className="team-photo-cta"><b>{photoFile ? photoFile.name : "Adicionar foto"}</b><small>Opcional · PNG, JPG ou WebP · até 2 MB</small></span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoFile(file); setPhotoPreview(file ? URL.createObjectURL(file) : null); }} />
              </label>
              <label>
                Nome
                <input
                  required={!editingId}
                  disabled={!!editingId}
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
                  required={!editingId}
                  disabled={!!editingId}
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
              {platformAdmin&&!editingId&&<label>Perfil<select value={form.role} onChange={e=>setForm(v=>({...v,role:e.target.value,modules:e.target.value==="OWNER"?Object.keys(moduleLabels):v.modules,deniedModules:[]}))}><option value="AGENT">Atendente</option><option value="OWNER">Proprietário da empresa</option></select></label>}
              </div>
              <fieldset className="team-sectors-fieldset">
                <legend>Setores</legend>
                {departments
                  .filter((d) => d.isActive)
                  .map((d) => (
                    <label className="ai-toggle" key={d.id}>
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
              <footer className="team-form-footer">
                <small>{!editingId ? "Uma senha temporária aleatória será gerada e trocada no primeiro acesso." : "Nome e e-mail não podem ser alterados após o cadastro."}</small>
                <div className="team-form-actions">
                  <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button>
                  <button className="primary-button" disabled={busy}>{editingId?"Salvar permissões":"Cadastrar atendente"}</button>
                </div>
              </footer>
            </form>
          )}
          <div className="team-list" aria-label="Atendentes cadastrados">
            {rows.map((r) => (
              <article className={"team-attendant-card"+(r.isActive===false?" is-inactive":"")} key={r.id}>
                <div className="team-card-head">
                  <span className="team-avatar">{r.avatarUrl?<img src={r.avatarUrl} alt={"Foto de "+r.name}/>:initials(r.name)}</span>
                  <div className="team-card-id">
                    <strong>{r.name}</strong>
                    <small>{r.email}</small>
                    <span className={"team-role-chip is-"+String(r.role||"AGENT").toLowerCase()}>{ROLE_LABELS[r.role] || r.role}</span>{r.isActive === false && <span className="team-role-chip is-inactive">Desativada</span>}
                  </div>
                </div>
                <div className="team-dept-chips">
                  {departments.filter((d) => r.departmentIds.includes(d.id)).map((d) => <span key={d.id}>{d.name}</span>)}
                  {!r.departmentIds.length && <span className="team-dept-empty">Sem setor definido</span>}
                </div>
<label className="team-known-by"><span>Conhecido por</span><input key={r.id+":"+(r.knownBy||"")} defaultValue={r.knownBy||""} maxLength={80} placeholder={r.fullName||r.name} onBlur={async e=>{const knownBy=e.target.value.trim();if(knownBy===(r.knownBy||""))return;try{const response=await fetch("/api/backend/team/"+r.id+"/identity",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({knownBy})});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível salvar o nome.");await load();window.dispatchEvent(new Event("vexora:team-updated"));setNotice("Nome de atendimento atualizado.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar.");}}}/></label>
<div className="team-card-actions">{r.isActive === false ? (<>
              <button className="secondary-button" disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id+"/reactivate",{method:"PATCH"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível reativar.");setNotice("Atendente reativado. Senha temporária: "+(data.temporaryPassword||"")+". Troca obrigatória no próximo acesso.");await load();window.dispatchEvent(new Event("vexora:team-updated"));}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível reativar.")}finally{setBusy(false)}}}>Reativar</button>
              <button className="text-button danger-text" disabled={busy} onClick={async()=>{if(!window.confirm("Excluir definitivamente "+r.name+" da empresa? O e-mail fica liberado e o vínculo é desfeito; quando possível, o histórico é preservado. Esta ação não pode ser desfeita."))return;setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id+"/permanent",{method:"DELETE"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível excluir definitivamente.");setNotice(data.emailFreed?"Atendente excluído definitivamente: e-mail liberado para novo cadastro.":"Vínculo do atendente removido desta empresa.");await load();window.dispatchEvent(new Event("vexora:team-updated"));}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível excluir definitivamente.")}finally{setBusy(false)}}}>Excluir definitivamente</button>
              </>) : (<>
              {r.canEditAccess&&<button className="secondary-button" onClick={()=>{setEditingId(r.id);setPhotoFile(null);setPhotoPreview(null);setForm({name:r.fullName||r.name,knownBy:r.knownBy||"",email:r.email,password:'',role:r.role,deniedModules:r.deniedModules||[],departmentIds:r.departmentIds,modules:r.modules||[],agendaKey:agendaAssignments.filter(item=>item.userId===r.id).map(item=>item.accountId+"::"+item.calendarId)[0]||""});setEditing(true)}}>Setores e permissões</button>}
              {platformAdmin&&<button className="text-button" disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/backend/team/'+r.id+'/reset-password',{method:'POST'});const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível redefinir.');setNotice(typeof data.temporaryPassword === "string" ? "Senha temporária de "+r.name+": "+data.temporaryPassword+". Guarde-a agora; a troca será obrigatória no próximo acesso." : "Senha redefinida. A troca será obrigatória no próximo acesso.");await load();}catch(error){setNotice(error instanceof Error?error.message:'Não foi possível redefinir.')}finally{setBusy(false)}}}>Redefinir senha</button>}
              {r.id!==undefined&&r.isActive&&r.id!==undefined&&<button className="text-button danger-text" disabled={busy} onClick={async()=>{if(!window.confirm("Desativar "+r.name+"? O histórico de conversas será preservado."))return;setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id,{method:"DELETE"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível desativar.");setNotice("Usuário desativado. O histórico foi preservado.");await load();}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível desativar.")}finally{setBusy(false)}}}>Desativar</button>}
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

