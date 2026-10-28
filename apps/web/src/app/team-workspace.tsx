"use client";
import { DepartmentManager } from "./department-manager";
import { ModuleChoices } from "./module-choices";
import { useEffect, useState } from "react";
export function TeamWorkspace() {
  const [editingId,setEditingId]=useState('');
  const [tab, setTab] = useState("agents");
  const [rows, setRows] = useState<any[]>([]),
    [departments, setDepartments] = useState<any[]>([]),
    [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      departmentIds: [] as string[],
      modules: [] as string[],
    }),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    const [r, d] = await Promise.all([
      fetch("/api/backend/team"),
      fetch("/api/backend/departments"),
    ]);
    if (!r.ok || !d.ok) throw Error("Não foi possível carregar a equipe.");
    setRows(await r.json());
    setDepartments(await d.json());
  }
  useEffect(() => {
    void load().catch((e) => setNotice(e.message));
  }, []);
  return (
    <section className="simple-workspace">
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
          onClick={() => {setEditingId('');setForm({name:'',email:'',password:'',departmentIds:[],modules:[]});setEditing(v=>!v)}}
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
              className="workspace-surface ai-admin-fields"
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
                  setForm({
                    name: "",
                    email: "",
                    password: "",
                    departmentIds: [],
                    modules: [],
                  });
                  setEditing(false);
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
              <label>
                Nome
                <input
                  required
                  maxLength={160}
                  readOnly={!!editingId} value={form.name}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, name: e.target.value }))
                  }
                />
              </label>
              <label>
                E-mail de acesso
                <input
                  type="email"
                  required
                  autoComplete="off"
                  readOnly={!!editingId} value={form.email}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, email: e.target.value }))
                  }
                />
              </label>
              <label>
                Senha inicial
                <input
                  type="password"
                  disabled={!!editingId}
                  required={!editingId}
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, password: e.target.value }))
                  }
                />
              </label>
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
                  [
                    ...new Set(
                      departments
                        .filter((d) => form.departmentIds.includes(d.id))
                        .flatMap((d) => d.modules || []),
                    ),
                  ] as string[]
                }
                onChange={(modules) => setForm((v) => ({ ...v, modules }))}
              />
              <button className="primary-button" disabled={busy}>
                {editingId?"Salvar permissões":"Cadastrar"}
              </button>
            </form>
          )}
          <section className="workspace-surface">
            {rows.map((r) => (
              <article className="publication-row" key={r.id}>
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
<button className="text-button" onClick={()=>{setEditingId(r.id);setForm({name:r.name,email:r.email,password:'',departmentIds:r.departmentIds,modules:r.modules||[]});setEditing(true)}}>Setores e permissões</button>
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
