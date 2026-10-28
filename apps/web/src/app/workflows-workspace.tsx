"use client";
import { useEffect, useState } from "react";
async function api(path = "", body?: unknown) {
  const r = await fetch("/api/backend/workflows" + (path ? "/" + path : ""), {
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.message || "Não foi possível concluir.");
  return d;
}
const statuses: Record<string, string> = {
  WAITING: "Aguardando horário",
  RUNNING: "Executando",
  DONE: "Concluída",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
  REVIEW: "Precisa de revisão",
};
const triggers: Record<string, string> = {
  SCHEDULE: "Horário agendado",
  INBOX: "Nova conversa",
  QUEUE: "Conversa aguardando em fila",
  STAGE: "Etapa do CRM",
};
type Step = { type: string; text: string; minutes: number };
export function WorkflowsWorkspace() {
  const [agents,setAgents]=useState<any[]>([]),[assigneeId,setAssigneeId]=useState("");
  const [tab, setTab] = useState("routines"),
    [data, setData] = useState<any>({ workflows: [], runs: [] }),
    [channels, setChannels] = useState<any[]>([]),
    [departments, setDepartments] = useState<any[]>([]),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [id, setId] = useState(""),
    [name, setName] = useState(""),
    [trigger, setTrigger] = useState("SCHEDULE"),
    [timezone, setTimezone] = useState("America/Sao_Paulo"),
    [localStart, setLocalStart] = useState(""),
    [repeatDays, setRepeatDays] = useState(0),
    [channelId, setChannelId] = useState(""),
    [departmentId, setDepartmentId] = useState(""),
    [stage, setStage] = useState("proposal"),
    [stopOnReply, setStopOnReply] = useState(true),
    [steps, setSteps] = useState<Step[]>([
      { type: "TASK", text: "Fazer follow-up com o cliente", minutes: 0 },
    ]);
  async function load() {
    setData(await api());
  }
  useEffect(() => {
    void load().catch((e) => setNotice(e.message));
    void fetch("/api/backend/team").then(r=>r.ok?r.json():[]).then(d=>setAgents(Array.isArray(d)?d:[])).catch(()=>{});
    void Promise.all([
      fetch("/api/backend/channels").then((r) => r.json()),
      fetch("/api/backend/departments").then((r) => r.json()),
    ])
      .then(([c, d]) => {
        setChannels(Array.isArray(c) ? c : []);
        setDepartments(Array.isArray(d) ? d : []);
      })
      .catch(() => {});
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  function edit(row?: any) {
    setId(row?.id || "");
    setName(row?.name || "");
    setTrigger(row?.trigger || "SCHEDULE");
    setTimezone(row?.timezone || "America/Sao_Paulo");
    const instant = row?.nextRunAt
      ? new Date(row.nextRunAt)
      : new Date(Date.now() + 3600000);
    const zone = row?.timezone || "America/Sao_Paulo";
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(instant)
        .map((x) => [x.type, x.value]),
    );
    setLocalStart(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`,
    );
    setRepeatDays(row?.repeatDays || 0);
    setSteps(
      row?.steps || [
        { type: "TASK", text: "Fazer follow-up com o cliente", minutes: 0 },
      ],
    );
    setChannelId(row?.filters?.channelId || "");
    setDepartmentId(row?.filters?.departmentId || "");
    setAssigneeId(row?.filters?.assigneeId || "");
    setStage(row?.filters?.stage || "proposal");
    setStopOnReply(row?.filters?.stopOnReply !== false);
    setEditing(true);
  }
  return (
    <section className="simple-workspace">
      <header className="creative-heading">
        <div>
          <h1>Workflows</h1>
          <p>Agende tarefas e organize sequências de relacionamento.</p>
        </div>
        {!editing && (
          <button className="primary-button" onClick={() => edit()}>
            + Nova rotina
          </button>
        )}
      </header>
      <div className="module-tabs" role="group" aria-label="Workflows">
        {[
          ["routines", "Rotinas"],
          ["runs", "Execuções"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value!);
              setEditing(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      {editing ? (
        <form
          className="workspace-surface ai-admin-fields"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api("", {
                id: id || undefined,
                name,
                trigger,
                timezone,
                localStart,
                repeatDays,
                steps,
                filters: {
                  channelId: channelId || undefined,
                  departmentId: departmentId || undefined,
                  assigneeId: trigger==="QUEUE"?undefined:assigneeId||undefined,
                  stage,
                  stopOnReply,
                },
                enabled: false,
              });
              setEditing(false);
              setNotice(
                "Rotina salva como pausada. Revise e ative quando quiser.",
              );
            });
          }}
        >
          <div className="workspace-section-heading">
            <h2>{id ? "Editar rotina" : "Nova rotina"}</h2>
            <button
              type="button"
              className="text-button"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </button>
          </div>
          <label>
            Nome
            <input
              required
              maxLength={180}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Quando começar
            <select
              value={trigger}
              onChange={(e) => {
                setTrigger(e.target.value);
                setSteps([
                  {
                    type: "TASK",
                    text: "Fazer follow-up com o cliente",
                    minutes: 0,
                  },
                ]);
              }}
            >
              {Object.entries(triggers).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="workflow-schedule">
            <label>
              Fuso horário
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {[
                  "America/Sao_Paulo",
                  "America/Manaus",
                  "America/Rio_Branco",
                  "America/Noronha",
                  "America/New_York",
                  "Europe/Lisbon",
                  "UTC",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              {trigger === "SCHEDULE"
                ? "Primeira execução"
                : "Começar a observar a partir de"}
              <input
                type="datetime-local"
                required
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
              />
            </label>
          </div>
          {trigger === "SCHEDULE" ? (
            <label>
              Repetição
              <select
                value={repeatDays}
                onChange={(e) => setRepeatDays(Number(e.target.value))}
              >
                <option value={0}>Uma vez</option>
                <option value={1}>Todo dia</option>
                <option value={7}>Toda semana</option>
                <option value={30}>A cada 30 dias</option>
              </select>
            </label>
          ) : (
            <>
              <label>
                Canal
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                >
                  <option value="">Todos os canais</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {trigger !== "SCHEDULE" && (
                <label>
                  Fila
                  <select
                    value={departmentId}
                    onChange={(e) => {setDepartmentId(e.target.value);setAssigneeId("");}}
                  >
                    <option value="">Todos os departamentos</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {trigger!=="QUEUE"&&trigger!=="SCHEDULE"&&<label>Atendente<select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)}><option value="">Todos os atendentes do contexto</option>{agents.filter(a=>!departmentId||a.departmentIds?.includes(departmentId)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
              {trigger === "STAGE" && (
                <label>
                  Etapa do CRM
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="new">Novo</option>
                    <option value="qualification">Qualificação</option>
                    <option value="proposal">Proposta</option>
                  </select>
                </label>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={stopOnReply}
                  onChange={(e) => setStopOnReply(e.target.checked)}
                />{" "}
                Parar a sequência quando o cliente responder
              </label>
              <small>
                Cada conversa entra uma vez por rotina. Conversas encerradas,
                arquivadas ou excluídas interrompem a sequência.
              </small>
            </>
          )}
          <h3>Etapas</h3>
          {steps.map((s, i) => (
            <fieldset key={i}>
              <legend>Etapa {i + 1}</legend>
              <label>
                Ação
                <select
                  value={s.type}
                  onChange={(e) =>
                    setSteps((rows) =>
                      rows.map((r, n) =>
                        n === i ? { ...r, type: e.target.value } : r,
                      ),
                    )
                  }
                >
                  <option value="WAIT">Esperar</option>
                  <option value="TASK">Criar tarefa interna</option>
                  {trigger !== "SCHEDULE" && (
                    <>
                      <option value="NOTE">Registrar nota</option>
                      <option value="TAG">Adicionar etiqueta</option>
                      <option value="WHATSAPP">
                        Enviar mensagem no WhatsApp
                      </option>
                    </>
                  )}
                </select>
              </label>
              {s.type !== "WAIT" && (
                <label>
                  {s.type === "TAG" ? "Etiqueta" : "Conteúdo"}
                  <textarea
                    required
                    rows={3}
                    maxLength={2000}
                    value={s.text}
                    onChange={(e) =>
                      setSteps((rows) =>
                        rows.map((r, n) =>
                          n === i ? { ...r, text: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
              )}
              {["WAIT", "TASK"].includes(s.type) && (
                <label>
                  {s.type === "WAIT"
                    ? "Esperar por · minutos"
                    : "Prazo da tarefa · minutos após executar"}
                  <input
                    type="number"
                    min={s.type === "WAIT" ? 1 : 0}
                    max={525600}
                    value={s.minutes}
                    onChange={(e) =>
                      setSteps((rows) =>
                        rows.map((r, n) =>
                          n === i
                            ? { ...r, minutes: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
              )}
              {s.type === "WHATSAPP" && (
                <p>
                  A mensagem vai para o WhatsApp da própria conversa, pela
                  conexão ativa. Não envia por Instagram/Messenger. Use{" "}
                  {"{{novo_nome}}"} para personalizar.
                </p>
              )}
              <button
                className="text-button"
                type="button"
                disabled={steps.length === 1}
                onClick={() =>
                  setSteps((rows) => rows.filter((_, n) => n !== i))
                }
              >
                Remover etapa
              </button>
            </fieldset>
          ))}
          <button
            className="secondary-button"
            type="button"
            disabled={steps.length >= 20}
            onClick={() =>
              setSteps((rows) => [
                ...rows,
                { type: "WAIT", text: "", minutes: 60 },
              ])
            }
          >
            + Adicionar etapa
          </button>
          <button className="primary-button" disabled={busy}>
            Salvar rotina pausada
          </button>
        </form>
      ) : (
        <>
          {tab === "routines" && (
            <section className="workspace-surface">
              {!data.workflows.length && (
                <div className="workspace-empty">
                  <h2>Seu trabalho, no horário certo</h2>
                  <p>
                    Crie lembretes internos ou sequências para conversas e
                    filas.
                  </p>
                </div>
              )}
              {data.workflows.map((w: any) => (
                <article className="publication-row" key={w.id}>
                  <div>
                    <strong>{w.name}</strong>
                    <small>
                      {triggers[w.trigger]} · {w.timezone} ·{" "}
                      {w.enabled ? "Ativa" : "Pausada"}
                    </small>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api(w.id + "/state", { enabled: !w.enabled });
                      })
                    }
                  >
                    {w.enabled ? "Pausar" : "Ativar"}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy || w.enabled}
                    onClick={() => edit(w)}
                  >
                    Editar
                  </button>
                </article>
              ))}
            </section>
          )}
          {tab === "runs" && (
            <section className="workspace-surface">
              <div className="workspace-section-heading">
                <h2>Sequências recentes</h2>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void act(load)}
                >
                  Atualizar
                </button>
              </div>
              {data.runs.map((r: any) => (
                <article className="publication-row" key={r.id}>
                  <div>
                    <strong>
                      {data.workflows.find((w: any) => w.id === r.workflowId)
                        ?.name || "Rotina"}
                    </strong>
                    <small>
                      {statuses[r.status] || "Em acompanhamento"} · Etapa{" "}
                      {r.position + 1}
                    </small>
                    {r.status === "WAITING" && (
                      <small>
                        Próximo horário:{" "}
                        {new Date(r.nextRunAt).toLocaleString("pt-BR")}
                      </small>
                    )}
                    {r.error && (
                      <p>
                        Esta sequência precisa de revisão antes de continuar.
                      </p>
                    )}
                  </div>
                  {["WAITING", "PAUSED"].includes(r.status) && (
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await api("runs/" + r.id + "/cancel", {});
                        })
                      }
                    >
                      Cancelar sequência
                    </button>
                  )}
                </article>
              ))}
              {!data.runs.length && <p>Nenhuma sequência iniciada.</p>}
            </section>
          )}
        </>
      )}
    </section>
  );
}

