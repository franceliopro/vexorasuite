"use client";
import { useEffect, useState } from "react";
import { RichEmailEditor } from "./rich-email-editor";
async function api(path = "", body?: unknown) {
  const r = await fetch("/api/backend/mail" + (path ? "/" + path : ""), {
    cache: "no-store",
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.message || "Não foi possível concluir.");
  return d;
}
const states: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Em envio",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  REVIEW: "Requer revisão",
  QUEUED: "Na fila",
  SENDING: "Enviando",
  SENT: "Aceito pelo servidor",
  SUPPRESSED: "Não receberá",
};
export function MailWorkspace() {
  const [data, setData] = useState<any>({
      accounts: [],
      templates: [],
      campaigns: [],
      presets: [],
    }),
    [tab, setTab] = useState("inbox"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [accountId, setAccountId] = useState(""),
    [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState({
    name: "",
    email: "",
    smtpHost: "",
    smtpPort: 465,
    imapHost: "",
    user: "",
    password: "",
  });
  const [replying, setReplying] = useState(false),
    [replyHtml, setReplyHtml] = useState("<p>Olá!</p>");
  const [messages, setMessages] = useState<any[]>([]),
    [opened, setOpened] = useState<any>(null),
    [editing, setEditing] = useState(false),
    [templateId, setTemplateId] = useState(""),
    [name, setName] = useState(""),
    [subject, setSubject] = useState(""),
    [html, setHtml] = useState(
      "<h1>Olá, {{nome}}!</h1><p>Escreva sua mensagem aqui.</p>",
    );
  const [kind, setKind] = useState("all"),
    [month, setMonth] = useState(new Date().getMonth() + 1),
    [contacts, setContacts] = useState<any[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [scheduled, setScheduled] = useState(""),
    [campaign, setCampaign] = useState<any>(null),
    [confirm, setConfirm] = useState(false);
  async function load() {
    const d = await api();
    setData(d);
    setAccountId((current) =>
      d.accounts.some((a: any) => a.id === current && a.active)
        ? current
        : d.accounts.find((a: any) => a.active)?.id || "",
    );
  }
  useEffect(() => {
    void load().catch((e) => setNotice(e.message));
  }, []);
  useEffect(() => {
    if (!accountId) {
      setMessages([]);
      return;
    }
    void api("accounts/" + accountId + "/messages")
      .then(setMessages)
      .catch((e) => setNotice(e.message));
    setOpened(null);
  }, [accountId]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  function choose(t: any) {
    setName(t.name);
    setSubject(t.subject);
    setHtml(t.html);
    setTemplateId(t.id || "");
    setEditing(true);
  }
  return (
    <section className="simple-workspace mail-workspace">
      <header className="creative-heading">
        <div>
          <h1>E-mails</h1>
          <p>Conversas, campanhas e cartões da sua empresa.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => setConnecting((v) => !v)}
        >
          {connecting ? "Fechar conexão" : "+ Conectar e-mail"}
        </button>
      </header>
      <div className="module-tabs" role="group" aria-label="E-mails">
        {[
          ["inbox", "Caixa de entrada"],
          ["campaigns", "Campanhas"],
          ["templates", "Modelos"],
          ["occasions", "Felicitações"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id!);
              setEditing(false);
              setCampaign(null);
              setConfirm(false);
              setOpened(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
      {connecting && (
        <form
          className="workspace-surface ai-admin-fields"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api("accounts", connection);
              setConnection({ ...connection, password: "" });
              setConnecting(false);
              await load();
              setNotice(
                "Conta cadastrada. Use Testar SMTP e Sincronizar para conferir a conexão.",
              );
            });
          }}
        >
          <h2>Conectar sua conta</h2>
          <p>
            Use os servidores do seu provedor e uma senha de aplicativo. Gmail e
            Microsoft podem exigir autorização específica do provedor.
          </p>
          {(
            [
              ["name", "Nome do remetente"],
              ["email", "E-mail"],
              ["user", "Usuário de acesso"],
              ["smtpHost", "Servidor SMTP"],
              ["imapHost", "Servidor IMAP · opcional"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required={key !== "imapHost"}
                type={key === "email" ? "email" : "text"}
                value={connection[key]}
                onChange={(e) =>
                  setConnection((v) => ({ ...v, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          <label>
            Porta SMTP
            <select
              value={connection.smtpPort}
              onChange={(e) =>
                setConnection((v) => ({
                  ...v,
                  smtpPort: Number(e.target.value),
                }))
              }
            >
              <option value={465}>465 · TLS</option>
              <option value={587}>587 · STARTTLS</option>
            </select>
          </label>
          <label>
            Senha de aplicativo
            <input
              type="password"
              autoComplete="new-password"
              required
              value={connection.password}
              onChange={(e) =>
                setConnection((v) => ({ ...v, password: e.target.value }))
              }
            />
          </label>
          <small>
            IMAP usa TLS na porta 993. As credenciais são protegidas e não serão
            exibidas novamente.
          </small>
          <button className="primary-button" disabled={busy}>
            Salvar conexão
          </button>
        </form>
      )}
      <div className="mail-account-bar">
        <label>
          Conta
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Selecione</option>
            {data.accounts
              .filter((a: any) => a.active)
              .map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
          </select>
        </label>
        {accountId && (
          <details>
            <summary>Gerenciar conexão</summary>
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api("accounts/" + accountId + "/verify", {});
                  setNotice("SMTP autenticado.");
                })
              }
            >
              Testar SMTP
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api("accounts/" + accountId + "/disconnect", {});
                  await load();
                  setNotice(
                    "Conta desconectada. Campanhas desta conta não serão enviadas.",
                  );
                })
              }
            >
              Desconectar
            </button>
          </details>
        )}
      </div>
      {tab === "inbox" && (
        <section className="workspace-surface">
          <div className="workspace-section-heading">
            <h2>Caixa de entrada</h2>
            <button
              className="secondary-button"
              disabled={busy || !accountId}
              onClick={() =>
                void act(async () => {
                  const d = await api("accounts/" + accountId + "/sync", {});
                  setMessages(await api("accounts/" + accountId + "/messages"));
                  setNotice(d.imported + " e-mail(s) sincronizado(s).");
                })
              }
            >
              Sincronizar
            </button>
          </div>
          {opened ? (
            <>
              <button className="text-button" onClick={() => setOpened(null)}>
                ← Voltar
              </button>
              <h3>{opened.subject}</h3>
              <p>{opened.fromAddress}</p>
              <iframe
                title="Mensagem de e-mail"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={
                  "<!doctype html><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'\"><body>" +
                  opened.html +
                  "</body>"
                }
              />
              <p>Imagens remotas ficam bloqueadas nesta leitura.</p>
              <button
                className="secondary-button"
                onClick={() => setReplying((v) => !v)}
              >
                {replying ? "Cancelar resposta" : "Responder"}
              </button>
              {replying && (
                <div className="ai-admin-fields">
                  <RichEmailEditor value={replyHtml} onChange={setReplyHtml} />
                  <button
                    className="primary-button"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const d = await api(
                          "messages/" + opened.id + "/reply",
                          { html: replyHtml },
                        );
                        setCampaign(await api("campaigns/" + d.id));
                        setTab("campaigns");
                        setOpened(null);
                        setReplying(false);
                        setConfirm(false);
                        setNotice(
                          "Resposta salva. Confirme o envio ao remetente.",
                        );
                      })
                    }
                  >
                    Revisar resposta
                  </button>
                </div>
              )}
            </>
          ) : (
            messages.map((m) => (
              <button
                className="mail-message-row"
                key={m.id}
                onClick={() =>
                  void act(async () => setOpened(await api("messages/" + m.id)))
                }
              >
                <strong>{m.subject}</strong>
                <span>{m.fromAddress}</span>
                <small>{new Date(m.receivedAt).toLocaleString("pt-BR")}</small>
              </button>
            ))
          )}
          {!opened && !messages.length && (
            <p>
              Sincronize uma conta IMAP para consultar as mensagens recentes.
            </p>
          )}
        </section>
      )}
      {(tab === "templates" || tab === "occasions") && !editing && (
        <section className="workspace-surface">
          <div className="workspace-section-heading">
            <h2>
              {tab === "occasions" ? "Cartões de felicitações" : "Seus modelos"}
            </h2>
            <button
              className="primary-button"
              onClick={() =>
                choose({
                  name: "Novo cartão",
                  subject: "Olá, {{nome}}!",
                  html: "<h1>Olá, {{nome}}!</h1><p>Escreva sua mensagem.</p>",
                })
              }
            >
              + Criar modelo
            </button>
          </div>
          {[...data.presets, ...data.templates].map((t: any, i: number) => (
            <article className="publication-row" key={t.id || i}>
              <strong>{t.name}</strong>
              <button className="secondary-button" onClick={() => choose(t)}>
                Editar
              </button>
              <button
                className="text-button"
                onClick={() => {
                  choose({ ...t, id: undefined });
                  setTab("campaigns");
                }}
              >
                Usar em campanha
              </button>
            </article>
          ))}
        </section>
      )}
      {tab === "occasions" && (
        <section className="workspace-surface">
          <h2>Aniversariantes do mês</h2>
          <p>
            Use a data de nascimento ou de início da parceria registrada na
            ficha do contato.
          </p>
          <div className="workspace-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setKind("birthday");
                setTab("campaigns");
                setEditing(true);
              }}
            >
              Aniversário pessoal
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setKind("partnership");
                setTab("campaigns");
                setEditing(true);
              }}
            >
              Aniversário de parceria
            </button>
          </div>
        </section>
      )}
      {tab === "campaigns" && !editing && !campaign && (
        <section className="workspace-surface">
          <div className="workspace-section-heading">
            <h2>Campanhas</h2>
            <button
              className="primary-button"
              onClick={() => {
                setEditing(true);
                setSelected([]);
                setName("Nova campanha");
                setTemplateId("");
              }}
            >
              + Nova campanha
            </button>
          </div>
          {data.campaigns.map((c: any) => (
            <article className="publication-row" key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <small>{states[c.status] || c.status}</small>
              </div>
              <button
                className="secondary-button"
                onClick={() =>
                  void act(async () => {
                    setCampaign(await api("campaigns/" + c.id));
                    setConfirm(false);
                  })
                }
              >
                Abrir
              </button>
            </article>
          ))}
          {!data.campaigns.length && <p>Nenhuma campanha criada.</p>}
        </section>
      )}
      {editing && (
        <form
          className="workspace-surface ai-admin-fields"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              if (tab === "campaigns") {
                const d = await api("campaigns", {
                  accountId,
                  name,
                  subject,
                  html,
                  contactIds: selected,
                  ...(scheduled
                    ? { scheduledAt: new Date(scheduled).toISOString() }
                    : {}),
                });
                setCampaign(await api("campaigns/" + d.id));
                setConfirm(false);
              } else {
                await api("templates", {
                  ...(templateId ? { id: templateId } : {}),
                  name,
                  subject,
                  html,
                });
                setNotice("Modelo salvo.");
              }
              setEditing(false);
              await load();
            });
          }}
        >
          <div className="workspace-section-heading">
            <h2>
              {tab === "campaigns" ? "Preparar campanha" : "Editar cartão"}
            </h2>
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
            Assunto
            <input
              required
              maxLength={240}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <RichEmailEditor value={html} onChange={setHtml} />
          <small>Use {"{{nome}}"} para personalizar cada destinatário.</small>
          {tab === "campaigns" && (
            <>
              <fieldset>
                <legend>Público</legend>
                <label>
                  Quem receberá
                  <select
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value);
                      setSelected([]);
                      setContacts([]);
                    }}
                  >
                    <option value="all">Contatos com e-mail</option>
                    <option value="birthday">Aniversariantes</option>
                    <option value="partnership">Aniversário de parceria</option>
                  </select>
                </label>
                {kind !== "all" && (
                  <label>
                    Mês
                    <select
                      value={month}
                      onChange={(e) => {
                        setMonth(Number(e.target.value));
                        setSelected([]);
                        setContacts([]);
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {new Date(2026, i, 1).toLocaleDateString("pt-BR", {
                            month: "long",
                          })}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const d = await api(
                        "audience?kind=" +
                          kind +
                          "&month=" +
                          (kind === "all" ? 0 : month),
                      );
                      setContacts(d.contacts);
                      setSelected([]);
                      if (d.truncated)
                        setNotice(
                          "Mostrando até 500 destinatários. Divida campanhas maiores.",
                        );
                    })
                  }
                >
                  Consultar público
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={
                      contacts.length > 0 && selected.length === contacts.length
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? contacts.map((c) => c.id) : [],
                      )
                    }
                  />{" "}
                  Selecionar todos · {selected.length} selecionados
                </label>
                <div className="recipient-list">
                  {contacts.map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected((ids) =>
                            e.target.checked
                              ? [...ids, c.id]
                              : ids.filter((id) => id !== c.id),
                          )
                        }
                      />
                      {c.name} · {c.email}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Enviar a partir de · horário deste dispositivo
                <input
                  type="datetime-local"
                  value={scheduled}
                  onChange={(e) => setScheduled(e.target.value)}
                />
              </label>
              <small>
                O próximo passo permite revisar a quantidade antes de iniciar os
                envios.
              </small>
            </>
          )}
          <button
            className="primary-button"
            disabled={
              busy ||
              !name ||
              !subject ||
              (tab === "campaigns" && (!accountId || !selected.length))
            }
          >
            {tab === "campaigns" ? "Salvar para revisão" : "Salvar modelo"}
          </button>
        </form>
      )}
      {campaign && (
        <section className="workspace-surface ai-admin-fields">
          <div className="workspace-section-heading">
            <h2>{campaign.name}</h2>
            <button className="text-button" onClick={() => setCampaign(null)}>
              Fechar
            </button>
          </div>
          <p>{states[campaign.status] || campaign.status}</p>
          <p>{campaign.subject}</p>
          <div className="campaign-counts">
            {campaign.counts.map((c: any) => (
              <span key={c.status}>
                {states[c.status] || c.status}: {c.count}
              </span>
            ))}
          </div>
          {["DRAFT", "PAUSED"].includes(campaign.status) && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />{" "}
                Revisei os destinatários e tenho autorização para enviar esta
                campanha.
              </label>
              <button
                className="primary-button"
                disabled={busy || !confirm}
                onClick={() =>
                  void act(async () => {
                    await api("campaigns/" + campaign.id + "/send", {
                      confirm: true,
                    });
                    setCampaign(await api("campaigns/" + campaign.id));
                    await load();
                    setConfirm(false);
                  })
                }
              >
                Confirmar envio
              </button>
            </>
          )}
          {campaign.status === "ACTIVE" && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api("campaigns/" + campaign.id + "/pause", {});
                  setCampaign(await api("campaigns/" + campaign.id));
                })
              }
            >
              Pausar campanha
            </button>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void act(async () =>
                setCampaign(await api("campaigns/" + campaign.id)),
              )
            }
          >
            Atualizar resultado
          </button>
          <p>
            “Aceito pelo servidor” confirma o envio SMTP, não a leitura nem a
            chegada à caixa de entrada. Envios sem confirmação ficam para
            revisão.
          </p>
        </section>
      )}
    </section>
  );
}
