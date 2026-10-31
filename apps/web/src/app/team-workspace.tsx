"use client";
import { DepartmentManager } from "./department-manager";
import { ModuleChoices,moduleLabels } from "./module-choices";
import { useEffect, useState } from "react";
type AgendaOption = { key: string; accountId: string; calendarId: string; label: string };
type AgendaAssignment = { id: string; accountId: string; calendarId: string; userId: string | null; departmentId: string | null };
export function TeamWorkspace({platformAdmin=false}:{platformAdmin?:boolean}) {
  const [editingId,setEditingId]=useState('');
  const [tab, setTab] = useState("agents");
  const [rows, setRows] = useState<any[]>([]),
    [departments, setDepartments] = useState<any[]>([]),
    [form, setForm] = useState({
      name: "",knownBy:"",
      email: "",
      password: "Senha@123",
      role:"AGENT",deniedModules:[] as string[],
      departmentIds: [] as string[],
      modules: [] as string[],
      agendaKey: "",
    }),
    [photoFile, setPhotoFile] = useState<File | null>(null),
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
      <header className="creative-heading">
        <div>
          <h1>Atendentes</h1>
          <p>
            Pessoas e setores da sua empresa, integrados às conversas e aos
            fluxos.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {setEditingId('');setPhotoFile(null);setForm({name:'',knownBy:'',email:'',password:'Senha@123',role:'AGENT',deniedModules:[],departmentIds:[],modules:[],agendaKey:''});setEditing(v=>!v)}}
        >
          {editing ? "Fechar cadastro" : "+ Cadastrar atendente"}
        </button>
      </header>
      <div className="module-tabs">
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
              className="workspace-surface team-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  if(editingId){
                    const profileResponse=await fetch("/api/backend/team/"+editingId+"/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({name:form.name,email:form.email,knownBy:form.knownBy})});
                    const profileData=await profileResponse.json();
                    if(!profileResponse.ok)throw Error(profileData.message||"Não foi possível atualizar o cadastro.");
                  }
                  const r = await fetch("/api/backend/team"+(editingId?"/"+editingId+"/access":""), {
                    method: editingId?"PATCH":"POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(form),
                  });
                  const d = await r.json();
                  if (!r.ok) throw Error(d.message);
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
                    password: "Senha@123",
      role:"AGENT",deniedModules:[] as string[],
                    departmentIds: [],
                    modules: [],
                    agendaKey: "",
                  });
                  setEditing(false);
                  setPhotoFile(null);
                  await load();
                  window.dispatchEvent(new Event("vexora:team-updated"));
                  setNotice(editingId?"Permissões e setores atualizados.":"Atendente cadastrado e disponível nos fluxos.");setEditingId('');
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
              <div className="team-form-grid">
              <label className="team-photo-field">
                Foto do atendente
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                <small>{photoFile ? photoFile.name : "Opcional · até 2 MB"}</small>
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
              <label>
                Senha temporária
                <input
                  type="password"
                  disabled={!!editingId}
                  required={!editingId}
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  value="Senha@123"
                  readOnly
                />
              </label>
              <p>A senha inicial é Senha@123 e deverá ser alterada antes do acesso aos módulos.</p>
              <label>Agenda pessoal
                <select value={form.agendaKey} onChange={e=>setForm(v=>({...v,agendaKey:e.target.value}))}>
                  <option value="">Sem agenda pessoal</option>
                  {agendaOptions.map(option=><option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <small>O atendente verá somente esta agenda. O nome exibido é o nome amigável do Google.</small>
              </label>
              {platformAdmin&&!editingId&&<label>Perfil<select value={form.role} onChange={e=>setForm(v=>({...v,role:e.target.value,modules:e.target.value==="OWNER"?Object.keys(moduleLabels):v.modules,deniedModules:[]}))}><option value="AGENT">Atendente</option><option value="OWNER">Proprietário da empresa</option></select></label>}
              <fieldset>
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
              <button className="primary-button" disabled={busy}>
                {editingId?"Salvar permissões":"Cadastrar"}
              </button>
              </div>
            </form>
          )}
          <section className="workspace-surface">
            {rows.map((r) => (
              <article className="publication-row" key={r.id}>
                <div className="team-user-summary">
                  <span className="profile-avatar">{r.avatarUrl?<img src={r.avatarUrl} alt={"Foto de "+r.name}/>:String(r.name||"?").slice(0,2).toUpperCase()}</span>
                  <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.email} ·{" "}
                    {
                      (
                        {
                          OWNER: "Proprietário",
                          ADMIN: "Administrador",
                          MANAGER: "Gestor",
                          AGENT: "Atendente",
                        } as any
                      )[r.role]
                    }
                  </small>
                  <small>
                    {departments
                      .filter((d) => r.departmentIds.includes(d.id))
                      .map((d) => d.name)
                      .join(", ") || "Sem setor definido"}
                  </small>
                  </div>
                </div>
<label className="team-known-by">Conhecido por<input key={r.id+":"+(r.knownBy||"")} defaultValue={r.knownBy||""} maxLength={80} placeholder={r.fullName||r.name} onBlur={async e=>{const knownBy=e.target.value.trim();if(knownBy===(r.knownBy||""))return;try{const response=await fetch("/api/backend/team/"+r.id+"/identity",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({knownBy})});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível salvar o nome.");await load();window.dispatchEvent(new Event("vexora:team-updated"));setNotice("Nome de atendimento atualizado.");}catch(error){setNotice(error instanceof Error?error.message:"Falha ao salvar.");}}}/></label>
{r.canEditAccess&&<button className="text-button" onClick={()=>{setEditingId(r.id);setForm({name:r.fullName||r.name,knownBy:r.knownBy||"",email:r.email,password:'Senha@123',role:r.role,deniedModules:r.deniedModules||[],departmentIds:r.departmentIds,modules:r.modules||[],agendaKey:agendaAssignments.filter(item=>item.userId===r.id).map(item=>item.accountId+"::"+item.calendarId)[0]||""});setEditing(true)}}>Setores e permissões</button>}
              {platformAdmin&&<button className="text-button" disabled={busy} onClick={async()=>{setBusy(true);try{const response=await fetch('/api/backend/team/'+r.id+'/reset-password',{method:'POST'});const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível redefinir.');setNotice('Senha de '+r.name+' redefinida para Senha@123. A troca será obrigatória no próximo acesso.');await load();}catch(error){setNotice(error instanceof Error?error.message:'Não foi possível redefinir.')}finally{setBusy(false)}}}>Redefinir senha</button>}
              {r.id!==undefined&&r.isActive&&r.id!==undefined&&<button className="text-button danger-text" disabled={busy} onClick={async()=>{if(!window.confirm("Desativar "+r.name+"? O histórico de conversas será preservado."))return;setBusy(true);try{const response=await fetch("/api/backend/team/"+r.id,{method:"DELETE"});const data=await response.json();if(!response.ok)throw Error(data.message||"Não foi possível desativar.");setNotice("Usuário desativado. O histórico foi preservado.");await load();}catch(error){setNotice(error instanceof Error?error.message:"Não foi possível desativar.")}finally{setBusy(false)}}}>Desativar</button>}
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
