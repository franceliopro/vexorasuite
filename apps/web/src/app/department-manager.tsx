"use client";
import { useEffect, useState } from "react";
import { ModuleChoices, moduleLabels } from "./module-choices";
import { Boxes, Building2, Handshake, Headset, Landmark, UsersRound } from "lucide-react";
const categoryMeta: Record<string, { label: string; icon: typeof Landmark; tone: string }> = {
  FINANCE: { label: "Financeiro", icon: Landmark, tone: "tone-emerald" },
  SUPPORT: { label: "Suporte t\u00e9cnico", icon: Headset, tone: "tone-blue" },
  SALES: { label: "Comercial", icon: Handshake, tone: "tone-amber" },
  ADMIN: { label: "Administrativo", icon: Building2, tone: "tone-violet" },
  OTHER: { label: "Outro", icon: Boxes, tone: "tone-slate" },
};
const categoryMetaOf = (value?: string) => categoryMeta[value || "OTHER"] || categoryMeta.OTHER!;
const initialsOf = (name: string) => {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return (first + last).toUpperCase();
};
const initial = {
  name: "",
  key: "",
  keywords: "",
  modules: [] as string[],
  routingCategory: "OTHER",
  routingPlatform: "",
  routingStrategy: "ROUND_ROBIN",
  maxOpenConversations: 0,
  crmTemplate: "GENERAL",
};
export function DepartmentManager() {
  const [rows, setRows] = useState<any[]>([]),
    [agents, setAgents] = useState<{ id: string; name: string; email?: string; isActive?: boolean }[]>([]),
    [members, setMembers] = useState<Record<string, string[]>>({}),
    [form, setForm] = useState(initial),
    [id, setId] = useState(""),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const [r, teamResponse] = await Promise.all([
      fetch("/api/backend/departments", { cache: "no-store" }),
      fetch("/api/backend/team", { cache: "no-store" }),
    ]);
    if (!r.ok) throw Error("Não foi possível carregar setores.");
    if (!teamResponse.ok) throw Error("Não foi possível carregar os atendentes.");
    const departments = await r.json();
    const team = await teamResponse.json();
    const pairs = await Promise.all(
      departments.map(async (department: any) => {
        const response = await fetch(
          "/api/backend/departments/" + department.id + "/members",
          { cache: "no-store" },
        );
        if (!response.ok) throw Error("Não foi possível carregar os atendentes do setor.");
        const assigned = await response.json();
        return [department.id, assigned.map((agent: { id: string }) => agent.id)] as const;
      }),
    );
    setRows(departments);
    setAgents(team.filter((agent: any) => agent.isActive !== false));
    setMembers(Object.fromEntries(pairs));
  }
  useEffect(() => {
    void load().catch((e) => setNotice(e.message));
  }, []);
  function edit(d?: any) {
    setId(d?.id || "");
    setForm(
      d
        ? {
            name: d.name,
            key: d.key,
            keywords: d.keywords.join(", "),
            modules: d.modules || [],
            routingCategory: d.routingCategory || "OTHER",
            routingPlatform: d.routingPlatform || "",
            routingStrategy: d.routingStrategy || "ROUND_ROBIN",
            maxOpenConversations: Number(d.maxOpenConversations || 0),
            crmTemplate: d.pipeline?.template || "GENERAL",
          }
        : initial,
    );
    setEditing(true);
  }

  async function purgeDepartment(department: any) {
    const response = window.confirm("Excluir o setor \"" + department.name + "\"? Esta ação é irreversível e removerá o setor de todo o sistema.");
    if (!response) return;
    window.alert("Confirmação copiada: EXCLUIR-SETOR. Cole no prompt que abrir.");
    const value = window.prompt("Digite EXCLUIR-SETOR no campo abaixo:");
    if (value !== "EXCLUIR-SETOR") { setNotice("Operação cancelada. Digite EXCLUIR-SETOR exatamente."); return; }
    setNotice(""); setBusy(true);
    try {
      const r = await fetch("/api/backend/departments/" + department.id + "/purge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: "EXCLUIR-SETOR" }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.message || "Não foi possível excluir o setor.");
      setNotice("Setor \"" + department.name + "\" excluído. Recarregando a lista…");
      await load();
      window.dispatchEvent(new Event("vexora:team-updated"));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao excluir setor.");
    } finally {
      setBusy(false);
    }
  }
  async function save(body: any, method = "POST", target = id) {
    setBusy(true);
    try {
      const r = await fetch(
        "/api/backend/departments" + (target ? "/" + target : ""),
        {
          method,
          headers: { "content-type": "application/json" },
          ...(method !== "DELETE" ? { body: JSON.stringify(body) } : {}),
        },
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.message);
      await load();
      window.dispatchEvent(new Event("vexora:team-updated"));
      setEditing(false);
      setNotice(
        method === "DELETE"
          ? "Setor desativado. Os registros foram preservados."
          : "Setor e permissões atualizados.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function saveMembers(departmentId: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/backend/departments/" + departmentId + "/members", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userIds: members[departmentId] || [] }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "Não foi possível salvar os atendentes do setor.");
      setMembers((current) => ({
        ...current,
        [departmentId]: data.map((agent: { id: string }) => agent.id),
      }));
      setNotice("Atendentes do setor salvos.");
      window.dispatchEvent(new Event("vexora:team-updated"));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível salvar os atendentes do setor.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="simple-workspace department-manager">
      <div className="workspace-section-heading department-heading">
        <div>
          <h2>Setores da empresa</h2>
          <p>Cada empresa define seus setores; nenhum setor genérico é criado automaticamente.</p>
        </div>
        <span className="department-count">{rows.length} {rows.length === 1 ? "setor" : "setores"}</span>
        <button className="primary-button" onClick={() => edit()}>
          + Criar setor
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {editing && (
        <form
          className="workspace-surface department-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                ...form,
                key:
                  form.key ||
                  form.name
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, "_")
                    .slice(0, 40),
                keywords: form.keywords
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                isActive: true,
              },
              id ? "PATCH" : "POST",
            );
          }}
        >
          <label>
            Nome
            <input
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </label>
          <label>
            Finalidade
            <select
              value={form.routingCategory}
              onChange={(e) =>
                setForm((v) => ({ ...v, routingCategory: e.target.value }))
              }
            >
              <option value="FINANCE">Financeiro</option>
              <option value="SUPPORT">Suporte</option>
              <option value="SALES">Comercial</option>
              <option value="ADMIN">Administrativo</option>
              <option value="OTHER">Outro</option>
            </select>
          </label>
          <label>
            Palavras-chave · separadas por vírgula
            <input
              maxLength={3000}
              value={form.keywords}
              onChange={(e) =>
                setForm((v) => ({ ...v, keywords: e.target.value }))
              }
            />
          </label>
          <ModuleChoices
            value={form.modules}
            onChange={(modules) => setForm((v) => ({ ...v, modules }))}
          />
          <div className="department-routing-fields">
            <label>
              Distribuição de novas conversas
              <select
                value={form.routingStrategy}
                onChange={(e) =>
                  setForm((v) => ({ ...v, routingStrategy: e.target.value }))
                }
              >
                <option value="ROUND_ROBIN">Rodízio entre os atendentes</option>
                <option value="LOAD_BALANCED">Quem tem menos conversas</option>
              </select>
              <small>Escolha como a fila encaminha novos atendimentos. O limite 0 deixa sem limite.</small>
            </label>
            <label>
              Limite de conversas abertas por atendente
              <input
                type="number"
                min={0}
                max={1000}
                value={form.maxOpenConversations}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    maxOpenConversations: Math.max(0, Math.min(1000, Number(e.target.value) || 0)),
                  }))
                }
              />
            </label>
          </div>

          {form.modules.includes("CRM") && (
            <label>
              Modelo de pipeline
              <select
                value={form.crmTemplate}
                onChange={(e) =>
                  setForm((v) => ({ ...v, crmTemplate: e.target.value }))
                }
              >
                <option value="GENERAL">Geral</option>
                <option value="FINANCE">Financeiro</option>
                <option value="SUPPORT">Suporte</option>
                <option value="SALES">Comercial</option>
              </select>
            </label>
          )}
          <p>
            O CRM deste setor fica disponível apenas para os membros com CRM
            habilitado, além da administração.
          </p>
          <div className="workspace-actions">
            <button className="primary-button" disabled={busy}>
              Salvar setor
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="department-grid">
        {rows.map((d) => {
          const meta = categoryMetaOf(d.routingCategory);
          const Icon = meta.icon;
          const assigned = members[d.id] || [];
          const assignedAgents = agents.filter((agent) => assigned.includes(agent.id));
          return (
            <article className={"department-card" + (d.isActive ? "" : " is-inactive")} key={d.id}>
              <header className="department-card-head">
                <span className={"department-card-icon " + meta.tone} aria-hidden="true"><Icon size={20} /></span>
                <div className="department-card-title">
                  <strong>{d.name}</strong>
                  <small>{meta.label}</small>
                </div>
                <span className={"department-status " + (d.isActive ? "is-active" : "is-inactive")}>{d.isActive ? "Ativo" : "Desativado"}</span>
              </header>
              <div className="department-card-modules">
                {(d.modules || []).map((module: string) => <span key={module}>{moduleLabels[module]}</span>)}
                {!d.modules?.length && <span className="is-empty">Sem módulos</span>}
              </div>
              <div className="department-card-people">
                <div className="department-avatar-stack">
                  {assignedAgents.slice(0, 5).map((agent) => <span key={agent.id} title={agent.name}>{initialsOf(agent.name)}</span>)}
                  {assignedAgents.length > 5 && <span className="is-more">+{assignedAgents.length - 5}</span>}
                  {!assignedAgents.length && <span className="is-none">Ninguém</span>}
                </div>
                <small>{assignedAgents.length} {assignedAgents.length === 1 ? "atendente" : "atendentes"} no setor</small>
              </div>
              <div className="department-card-actions">
                <button className="secondary-button" onClick={() => edit(d)}>{d.isActive ? "Editar" : "Reativar"}</button>
                {d.isActive && (
                  <button className="text-button danger-text" disabled={busy} onClick={() => { if (window.confirm("Desativar " + d.name + "? O acesso do setor ser\u00e1 revogado e o hist\u00f3rico ser\u00e1 preservado.")) void save({}, "DELETE", d.id); }}>Desativar</button>
                )}
                <button className="danger-button" disabled={busy} onClick={() => void purgeDepartment(d)}>Excluir setor</button>
              </div>
              {d.isActive && (
                <details className="department-members-details">
                  <summary><UsersRound size={14} aria-hidden="true" /> Atendentes deste setor · {assignedAgents.length}</summary>
                  <p>Defina quem recebe e pode assumir conversas encaminhadas para este setor.</p>
                  <div className="department-member-options">
                    {agents.length ? agents.map((agent) => (
                      <label className="ai-toggle" key={agent.id}>
                        <input
                          type="checkbox"
                          checked={assigned.includes(agent.id)}
                          onChange={(event) => setMembers((current) => ({
                            ...current,
                            [d.id]: event.target.checked
                              ? [...new Set([...(current[d.id] || []), agent.id])]
                              : (current[d.id] || []).filter((id) => id !== agent.id),
                          }))}
                        />
                        <span>{agent.name}{agent.email ? " · " + agent.email : ""}</span>
                      </label>
                    )) : <small>Nenhum atendente ativo cadastrado.</small>}
                  </div>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => void saveMembers(d.id)}>
                    {busy ? "Salvando…" : "Salvar atendentes do setor"}
                  </button>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

