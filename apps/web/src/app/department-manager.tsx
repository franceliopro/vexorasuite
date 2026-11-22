"use client";
import { useEffect, useState } from "react";
import { ModuleChoices, moduleLabels } from "./module-choices";
import { Boxes, Building2, Copy, Handshake, Headset, Landmark, UsersRound } from "lucide-react";
const categoryMeta: Record<string, { label: string; icon: typeof Landmark; tone: string }> = {
  FINANCE: { label: "Financeiro", icon: Landmark, tone: "bg-blue-50 text-blue-800 shadow-dept-blue" },
  SUPPORT: { label: "Suporte t\u00e9cnico", icon: Headset, tone: "bg-dept-blue text-dept-blue-ink shadow-dept-blue" },
  SALES: { label: "Comercial", icon: Handshake, tone: "bg-dept-amber text-dept-amber-ink shadow-dept-amber" },
  ADMIN: { label: "Administrativo", icon: Building2, tone: "bg-dept-violet text-dept-violet-ink shadow-dept-violet" },
  OTHER: { label: "Outro", icon: Boxes, tone: "bg-dept-slate text-dept-slate-ink shadow-dept-icon" },
};
const categoryMetaOf = (value?: string) => categoryMeta[value || "OTHER"] || categoryMeta.OTHER!;
const primaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink shadow-token-sm transition-colors hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60";
const textButtonTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600 transition-colors hover:bg-surface hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const dangerTw = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-red-600 bg-red-100 px-4 text-body font-bold text-red-600 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60";
const dangerTextTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-red-600 transition-colors hover:bg-surface hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const workspaceTw = "grid min-w-0 gap-token content-start";
const headingTw = "flex flex-wrap items-center justify-between gap-dept-heading-gap";
const headingCopyTw = "grid max-w-dept-heading gap-dept-heading-copy";
const headingTitleTw = "m-0 text-dept-heading font-extrabold tracking-dept-heading text-ink";
const headingTextTw = "m-0 text-dept-heading-copy text-ink-secondary";
const countTw = "inline-flex shrink-0 min-h-dept-count-h items-center rounded-dept-pill bg-blue-50 px-dept-count-x text-dept-count font-extrabold text-blue-800";
const noticeTw = "m-0 text-dept-summary text-ink-secondary";
const formTw = "grid min-w-0 max-w-dept-form gap-3 rounded-token-lg border border-line bg-surface-2 p-pad";
const formTitleTw = "m-0 text-dept-heading font-extrabold text-ink";
const formLabelTw = "grid gap-1 text-dept-details font-bold text-ink-secondary";
const fieldTw = "min-h-dept-field-h w-full rounded-dept-field border border-line-strong bg-surface px-dept-field-x text-dept-field font-medium text-ink";
const numberTw = fieldTw + " max-w-dept-number";
const actionsTw = "flex flex-wrap items-center justify-end gap-2";
const routingTw = "grid gap-3";
const hintTw = "text-dept-details text-ink-secondary";
const gridTw = "grid grid-cols-dept-grid gap-dept-grid-gap";
const cardTw = "grid content-start gap-dept-card-gap rounded-dept-card border border-line bg-surface p-dept-card-pad shadow-token-sm transition-dept-card duration-dept ease-token hover:-translate-y-0.5 hover:border-line-strong hover:shadow-token-lg";
const cardInactiveTw = "opacity-dept-inactive filter-dept-inactive";
const cardHeadTw = "flex items-center gap-dept-head-gap";
const cardIconTw = "grid size-dept-icon shrink-0 place-items-center rounded-dept-icon";
const cardTitleTw = "grid min-w-0 flex-1 gap-0.5";
const cardTitleStrongTw = "truncate text-dept-card-title font-extrabold tracking-dept-card-title text-ink";
const cardTitleSmallTw = "text-dept-card-sub font-bold uppercase tracking-dept-card-sub text-ink-secondary";
const statusTw = "inline-flex shrink-0 min-h-dept-status-h items-center rounded-dept-pill px-dept-status-x text-dept-status font-extrabold uppercase tracking-dept-status";
const statusActiveTw = "bg-blue-50 text-blue-800";
const statusInactiveTw = "bg-surface-3 text-ink-secondary";
const agendaTw = "grid gap-0.5 rounded-dept-options border border-dashed border-line-strong bg-surface-2 px-dept-agenda-x py-dept-agenda-pad text-dept-agenda text-ink";
const agendaSubTw = "text-dept-agenda-sub text-ink-secondary";
const modulesTw = "flex min-h-6 flex-wrap gap-dept-modules-gap";
const moduleTw = "inline-flex min-h-dept-module-h items-center rounded-dept-pill border border-line bg-surface-2 px-dept-module-x text-dept-module font-bold text-ink-secondary";
const moduleEmptyTw = "border-dashed opacity-80";
const peopleTw = "flex items-center justify-between gap-2.5";
const peopleCountTw = "text-dept-people tabular-nums text-ink-secondary";
const avatarStackTw = "flex items-center";
const avatarTw = "grid size-dept-avatar place-items-center rounded-full border-2 border-surface text-dept-avatar font-extrabold tracking-dept-avatar shadow-token-sm first:ml-0 -ml-dept-avatar-gap";
const avatarUserTw = "bg-dept-avatar text-dept-avatar-ink";
const avatarMoreTw = "bg-none border-surface bg-surface-3 text-ink-secondary";
const avatarNoneTw = "ml-0 size-auto border-0 bg-none bg-transparent text-dept-people font-semibold text-ink-secondary shadow-none";
const cardActionsTw = "flex flex-wrap items-center justify-end gap-1.5 border-t border-line pt-3";
const detailsTw = "group rounded-dept-details border border-line bg-surface-2 px-dept-details-pad pb-dept-details-pad";
const detailsSummaryTw = "flex min-h-dept-summary-h cursor-pointer list-none items-center gap-2 text-dept-summary font-extrabold text-ink-secondary hover:text-blue-800 group-open:mb-2.5 group-open:border-b group-open:border-line group-open:text-blue-800";
const detailsCopyTw = "m-0 mb-2.5 text-dept-details leading-relaxed text-ink-secondary";
const memberOptionsTw = "mb-2.5 grid max-h-dept-options grid-cols-dept-options gap-dept-options-gap overflow-y-auto rounded-dept-options border border-line bg-surface p-dept-options-pad";
const memberChoiceTw = "inline-flex items-center gap-2 text-dept-option text-ink-secondary";
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
async function readDepartmentResponse(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const message = typeof data?.message === "string" ? data.message : Array.isArray(data?.message) ? data.message.join(" ") : "";
    const requestId = response.headers.get("x-request-id");
    throw new Error(message || fallback + " (HTTP " + response.status + ")" + (requestId ? " · Referência " + requestId : ""));
  }
  return data;
}

export function DepartmentManager() {
  const [copy, setCopy] = useState<{ id: string; source: string; name: string; routingPlatform: string; sourcePlatform: string; copyMembers: boolean } | null>(null);
  const [rows, setRows] = useState<any[]>([]),
    [agents, setAgents] = useState<{ id: string; name: string; email?: string; isActive?: boolean }[]>([]),
    [members, setMembers] = useState<Record<string, string[]>>({}),
    [form, setForm] = useState(initial),
    [id, setId] = useState(""),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState<{ departmentId: string | null; userId: string | null }[]>([]);
  async function load() {
    const [r, teamResponse] = await Promise.all([
      fetch("/api/backend/departments", { cache: "no-store" }),
      fetch("/api/backend/team", { cache: "no-store" }),
    ]);
    fetch("/api/backend/integrations/google/calendar/assignments", { cache: "no-store" }).then(x => x.ok ? x.json() : []).then((rows: any[]) => setAssignments(Array.isArray(rows) ? rows.map((row: any) => ({ departmentId: row.departmentId ?? null, userId: row.userId ?? null })) : [])).catch(() => setAssignments([]));
    if (!r.ok) throw Error("Não foi possível carregar setores.");
    if (!teamResponse.ok) throw Error("Não foi possível carregar os atendentes.");
    const departments = await readDepartmentResponse(r, "Não foi possível carregar setores.");
    const team = await readDepartmentResponse(teamResponse, "Não foi possível carregar os atendentes.");
    const pairs = await Promise.all(
      departments.map(async (department: any) => {
        const response = await fetch(
          "/api/backend/departments/" + department.id + "/members",
          { cache: "no-store" },
        );
        if (!response.ok) throw Error("Não foi possível carregar os atendentes do setor.");
        const assigned = await readDepartmentResponse(response, "Não foi possível carregar os atendentes do setor.");
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
    setCopy(null);
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

  function prepareDuplicate(department: { id: string; name: string; routingPlatform?: string | null }) {
    const platform = department.routingPlatform ?? "";
    setEditing(false);
    setNotice("");
    setCopy({ id: department.id, source: department.name, name: (department.name + " (cópia)").slice(0, 80), routingPlatform: platform, sourcePlatform: platform, copyMembers: true });
  }

  async function duplicateDepartment() {
    if (!copy) return;
    setNotice(""); setBusy(true);
    try {
      const response = await fetch("/api/backend/departments/" + copy.id + "/duplicate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: copy.name.trim(), routingPlatform: copy.routingPlatform.trim(), copyMembers: copy.copyMembers }),
      });
      const data = await readDepartmentResponse(response, "Não foi possível confirmar a duplicação. Confira a lista antes de tentar novamente.");
      if (typeof data?.id !== "string" || typeof data?.name !== "string") {
        throw new Error("Resposta inesperada ao duplicar. Confira a lista antes de tentar novamente.");
      }
      setCopy(null);
      window.dispatchEvent(new Event("vexora:team-updated"));
      try {
        await load();
        setNotice("Setor duplicado como “" + data.name + "”.");
      } catch {
        setNotice("Setor “" + data.name + "” criado. Recarregue a página para atualizar a lista.");
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível confirmar a duplicação. Confira a lista antes de tentar novamente.");
    } finally {
      setBusy(false);
    }
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
    <section className={workspaceTw}>
      <div className={headingTw}>
        <div className={headingCopyTw}>
          <h2 className={headingTitleTw}>Setores da empresa</h2>
          <p className={headingTextTw}>Cada empresa define seus setores; nenhum setor genérico é criado automaticamente.</p>
        </div>
        <span className={countTw}>{rows.length} {rows.length === 1 ? "setor" : "setores"}</span>
        <button className={primaryTw} onClick={() => edit()}>
          + Criar setor
        </button>
      </div>
      {notice && <p className={noticeTw} role="status">{notice}</p>}
      {copy && <form className={formTw} onSubmit={event => { event.preventDefault(); void duplicateDepartment(); }}>
        <h3 className={formTitleTw}>Duplicar {copy.source}</h3>
        <label className={formLabelTw}>Nome do novo setor <input className={fieldTw} value={copy.name} maxLength={80} required onChange={event => setCopy({ ...copy, name: event.target.value })} /></label>
        <label className={formLabelTw}>Plataforma de destino <input className={fieldTw} value={copy.routingPlatform} maxLength={80} onChange={event => {
          const value = event.target.value;
          setCopy({ ...copy, routingPlatform: value, copyMembers: value.trim() === copy.sourcePlatform && copy.copyMembers });
        }} /></label>
        <label className={formLabelTw}><input type="checkbox" checked={copy.copyMembers} onChange={event => setCopy({ ...copy, copyMembers: event.target.checked })} /> Copiar atendentes</label>
        <p className={noticeTw}>As rotinas copiadas começam desativadas. Para outra plataforma, configure a agenda no novo setor.</p>
        <div className={actionsTw}>
          <button type="submit" className={primaryTw} disabled={busy || !copy.name.trim()}>Confirmar duplicação</button>
          <button type="button" className={textButtonTw} disabled={busy} onClick={() => setCopy(null)}>Cancelar</button>
        </div>
      </form>}
      {editing && (
        <form
          className={formTw}
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
          <label className={formLabelTw}>
            Nome
            <input
              className={fieldTw}
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </label>
          <label className={formLabelTw}>
            Finalidade
            <select
              className={fieldTw}
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
          <label className={formLabelTw}>
            Plataforma
            <input className={fieldTw} maxLength={80} value={form.routingPlatform} onChange={event => setForm(v => ({ ...v, routingPlatform: event.target.value }))} />
          </label>
          <label className={formLabelTw}>
            Palavras-chave · separadas por vírgula
            <input
              className={fieldTw}
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
          <div className={routingTw}>
            <label className={formLabelTw}>
              Distribuição de novas conversas
              <select
                className={fieldTw}
                value={form.routingStrategy}
                onChange={(e) =>
                  setForm((v) => ({ ...v, routingStrategy: e.target.value }))
                }
              >
                <option value="ROUND_ROBIN">Rodízio entre os atendentes</option>
                <option value="LOAD_BALANCED">Quem tem menos conversas</option>
              </select>
              <small className={hintTw}>Escolha como a fila encaminha novos atendimentos. O limite 0 deixa sem limite.</small>
            </label>
            <label className={formLabelTw}>
              Limite de conversas abertas por atendente
              <input
                className={numberTw}
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
            <label className={formLabelTw}>
              Modelo de pipeline
              <select
                className={fieldTw}
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
          <p className={noticeTw}>
            O CRM deste setor fica disponível apenas para os membros com CRM
            habilitado, além da administração.
          </p>
          <div className={actionsTw}>
            <button className={primaryTw} disabled={busy}>
              Salvar setor
            </button>
            <button
              type="button"
              className={textButtonTw}
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className={gridTw}>
        {rows.map((d) => {
          const meta = categoryMetaOf(d.routingCategory);
          const Icon = meta.icon;
          const assigned = members[d.id] || [];
          const assignedAgents = agents.filter((agent) => assigned.includes(agent.id));
          return (
            <article className={d.isActive ? cardTw : cardTw + " " + cardInactiveTw} key={d.id}>
              <header className={cardHeadTw}>
                <span className={cardIconTw + " " + meta.tone} aria-hidden="true"><Icon size={20} /></span>
                <div className={cardTitleTw}>
                  <strong className={cardTitleStrongTw}>{d.name}</strong>{d.routingPlatform && <small className={cardTitleSmallTw}>{d.routingPlatform}</small>}
                  <small className={cardTitleSmallTw}>{meta.label}</small>
                </div>
                <span className={statusTw + " " + (d.isActive ? statusActiveTw : statusInactiveTw)}>{d.isActive ? "Ativo" : "Desativado"}</span>
              </header>
              {assignments.filter(a => a.departmentId === d.id).length > 0 && (
                <p className={agendaTw}>
                  <span>📅 {assignments.filter(a => a.departmentId === d.id).length} {assignments.filter(a => a.departmentId === d.id).length === 1 ? "agenda vinculada" : "agendas vinculadas"}</span>
                  <small className={agendaSubTw}>Todos os atendentes deste setor veem {assignments.filter(a => a.departmentId === d.id).length === 1 ? "esta agenda" : "essas agendas"} no calendário deles.</small>
                </p>
              )}
              <div className={modulesTw}>
                {(d.modules || []).map((module: string) => <span className={moduleTw} key={module}>{moduleLabels[module]}</span>)}
                {!d.modules?.length && <span className={moduleTw + " " + moduleEmptyTw}>Sem módulos</span>}
              </div>
              <div className={peopleTw}>
                <div className={avatarStackTw}>
                  {assignedAgents.slice(0, 5).map((agent) => <span className={avatarTw + " " + avatarUserTw} key={agent.id} title={agent.name}>{initialsOf(agent.name)}</span>)}
                  {assignedAgents.length > 5 && <span className={avatarTw + " " + avatarMoreTw}>+{assignedAgents.length - 5}</span>}
                  {!assignedAgents.length && <span className={avatarNoneTw}>Ninguém</span>}
                </div>
                <small className={peopleCountTw}>{assignedAgents.length} {assignedAgents.length === 1 ? "atendente" : "atendentes"} no setor</small>
              </div>
              <div className={cardActionsTw}>
                <button className={secondaryTw} onClick={() => edit(d)}>{d.isActive ? "Editar" : "Reativar"}</button>
                {d.isActive && (
                  <button className={secondaryTw} disabled={busy} onClick={() => prepareDuplicate(d)} title="Duplicar configuração do setor"><Copy size={13} aria-hidden="true" /> Duplicar</button>
                )}
                {d.isActive && (
                  <button className={dangerTextTw} disabled={busy} onClick={() => { if (window.confirm("Desativar " + d.name + "? O acesso do setor ser\u00e1 revogado e o hist\u00f3rico ser\u00e1 preservado.")) void save({}, "DELETE", d.id); }}>Desativar</button>
                )}
                <button className={dangerTw} disabled={busy} onClick={() => void purgeDepartment(d)}>Excluir setor</button>
              </div>
              {d.isActive && (
                <details className={detailsTw}>
                  <summary className={detailsSummaryTw}><UsersRound size={14} aria-hidden="true" /> Atendentes deste setor · {assignedAgents.length}</summary>
                  <p className={detailsCopyTw}>Defina quem recebe e pode assumir conversas encaminhadas para este setor.</p>
                  <div className={memberOptionsTw}>
                    {agents.length ? agents.map((agent) => (
                      <label className={memberChoiceTw} key={agent.id}>
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
                    )) : <small className={hintTw}>Nenhum atendente ativo cadastrado.</small>}
                  </div>
                  <button className={secondaryTw} type="button" disabled={busy} onClick={() => void saveMembers(d.id)}>
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
