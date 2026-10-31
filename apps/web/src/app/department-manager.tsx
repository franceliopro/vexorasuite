"use client";
import { useEffect, useState } from "react";
import { ModuleChoices, moduleLabels } from "./module-choices";
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
    [form, setForm] = useState(initial),
    [id, setId] = useState(""),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const r = await fetch("/api/backend/departments", { cache: "no-store" });
    if (!r.ok) throw Error("Não foi possível carregar setores.");
    setRows(await r.json());
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
  return (
    <section className="simple-workspace department-manager">
      <div className="workspace-section-heading">
        <h2>Setores da empresa</h2>
        <button className="primary-button" onClick={() => edit()}>
          + Criar setor
        </button>
      </div>
      <p>
        Cada empresa define seus setores. Nenhum setor genérico é criado
        automaticamente.
      </p>
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
              <option value="SUPPORT">Suporte técnico</option>
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
                <option value="SUPPORT">Suporte técnico</option>
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
      {rows.map((d) => (
        <article className="workspace-surface publication-row" key={d.id}>
          <div>
            <strong>{d.name}</strong>
            <small>
              {d.isActive ? "Ativo" : "Desativado"}
              
            </small>
            <small>
              {(d.modules || [])
                .map((m: string) => moduleLabels[m])
                .join(" · ") || "Sem módulos habilitados"}
            </small>
          </div>
          <button className="secondary-button" onClick={() => edit(d)}>
            {d.isActive ? "Editar" : "Reativar"}
          </button>
          {d.isActive && (
            <button
              className="text-button danger-text"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Desativar " +
                      d.name +
                      "? O acesso do setor será revogado e o histórico será preservado.",
                  )
                )
                  void save({}, "DELETE", d.id);
              }}
            >
              Desativar
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
