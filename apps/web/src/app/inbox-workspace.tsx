"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, RotateCcw, UserRound } from "lucide-react";

type Channel = { id: string; name: string; status: string; lastError?: string | null };
type Contact = { id: string; name: string; phone?: string | null };
type Message = { id: string; content: string; contentType: string; direction: string; status: string; occurredAt: string };
type Assignee = { id: string; name: string; email: string };
type Department = { id: string; key: string; name: string; keywords: string[]; isActive: boolean };
type Agent = { id: string; name: string; email: string };
type Conversation = { id: string; status: string; handlingMode?: "BOT" | "HUMAN"; department?: Department | null; archivedAt?: string | null; deletedAt?: string | null; contact: Contact; assignee?: { id: string; name: string } | null; messages: Message[] };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || data.error || "Falha na operação.");
  return data as T;
}

export function InboxWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [queueView, setQueueView] = useState("new");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [handoffDepartment, setHandoffDepartment] = useState("");
  const [handoffAssignee, setHandoffAssignee] = useState("");
  const [inviteAssignee, setInviteAssignee] = useState("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  const activeChannel = channels.find((item) => item.status === "CONNECTED") || channels[0];

  const loadConversations = useCallback(async () => {
    try {
      const rows = await api<Conversation[]>("/api/backend/conversations?view=" + queueView);
      setConversations(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar conversas."); }
  }, [queueView]);
  const loadChannels = useCallback(async () => {
    try { setChannels(await api<Channel[]>("/api/backend/channels")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar canais."); }
  }, []);
  const loadAssignees = useCallback(async () => {
    try { setAssignees(await api<Assignee[]>("/api/backend/conversations/assignees")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar atendentes."); }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try { setMessages(await api<Message[]>("/api/backend/conversations/" + id + "/messages?view=" + queueView)); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar mensagens."); }
  }, [queueView]);

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { void loadConversations(); void loadChannels(); void loadAssignees();
    void api<Department[]>("/api/backend/departments").then(setDepartments).catch(() => {});
    void api<Agent[]>("/api/backend/conversations/assignees").then(setAgents).catch(() => {});
  }, [loadConversations, loadChannels, loadAssignees]);
  useEffect(() => { if (selectedId) void loadMessages(selectedId); else setMessages([]); }, [selectedId, loadMessages]);

  // Poll as a fallback: inbound messages must appear even if an SSE event is missed.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations();
      if (selectedRef.current) void loadMessages(selectedRef.current);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages]);
  useEffect(() => {
    const source = new EventSource("/api/backend/events");
    const refresh = () => { void loadConversations(); void loadChannels(); if (selectedRef.current) void loadMessages(selectedRef.current); };
    ["message.received", "message.sent", "message.failed", "message.status", "message.queued", "conversation.updated", "conversation.created", "channel.status", "channel.created"].forEach((name) => source.addEventListener(name, refresh));
    // EventSource reconnects automatically. Keep the interface quiet; the 5-second polling fallback keeps conversations fresh while SSE recovers.
    source.onerror = () => { /* transient realtime interruptions are handled silently */ };
    return () => source.close();
  }, [loadConversations, loadChannels, loadMessages]);

  const pendingId = channels.find((item) => item.status === "CONNECTING" || item.status === "QR")?.id ?? null;
  useEffect(() => {
    if (!pendingId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await api<{ status: string }>("/api/backend/channels/" + pendingId + "/status");
        if (cancelled) return;
        setChannels((rows) => rows.map((item) => item.id === pendingId ? { ...item, status: result.status } : item));
        if (result.status === "QR") {
          const qrResult = await api<{ qrDataUrl: string }>("/api/backend/channels/" + pendingId + "/qr");
          if (!cancelled) setQr(qrResult.qrDataUrl);
        } else if (result.status === "CONNECTED") {
          setQr(null);
          void loadChannels();
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao consultar WhatsApp."); }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [pendingId, loadChannels]);

  async function connectWhatsApp() {
    setConnecting(true); setError("");
    try {
      await api("/api/backend/channels/waha", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "WhatsApp principal" }) });
      await loadChannels();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a sessão WhatsApp."); }
    finally { setConnecting(false); }
  }

  async function retryConnection(channel: Channel) {
    setError("");
    try {
      await api("/api/backend/channels/" + channel.id + "/connect", { method: "POST" });
      setChannels((rows) => rows.map((item) => item.id === channel.id ? { ...item, status: "CONNECTING", lastError: null } : item));
      await loadChannels();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível reconectar."); }
  }

  async function disconnectChannel(channel: Channel) {
    setError("");
    try {
      await api("/api/backend/channels/" + channel.id + "/disconnect", { method: "POST" });
      setQr(null);
      await loadChannels();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível desconectar o WhatsApp."); }
  }

  async function deleteChannel(channel: Channel) {
    if (!window.confirm("Excluir esta sessão do WhatsApp? Será necessário ler um novo QR Code para conectá-la novamente.")) return;
    setError("");
    try {
      await api("/api/backend/channels/" + channel.id, { method: "DELETE" });
      setQr(null);
      await loadChannels();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível excluir a sessão."); }
  }

  async function handoffToHuman() {
    if (!selectedId) return;
    setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/handoff?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(handoffDepartment ? { departmentId: handoffDepartment } : {}), ...(handoffAssignee ? { assigneeId: handoffAssignee } : {}) }) });
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível transferir para o atendimento humano."); }
  }

  async function inviteToConversation() {
    if (!selectedId || !inviteAssignee) return;
    setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/invite?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: inviteAssignee }) });
      setInviteAssignee("");
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível convidar o atendente."); }
  }

  async function returnToBot() {
    if (!selectedId) return;
    setError("");
    try { await api("/api/backend/conversations/" + selectedId + "/return-to-bot?view=" + queueView, { method: "POST" }); await loadConversations(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível devolver ao bot."); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: draft.trim() }) });
      setDraft("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a mensagem.");
      await loadMessages(selectedId);
    } finally { setBusy(false); }
  }

  async function assumeConversation() {
    if (!selectedId || actionBusy) return;
    setActionBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/assume?view=" + queueView, { method: "POST" });
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível assumir a conversa."); }
    finally { setActionBusy(false); }
  }

  async function assignConversation(userId: string | null) {
    if (!selectedId || actionBusy) return;
    setActionBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/assign?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atribuir a conversa."); }
    finally { setActionBusy(false); }
  }

  async function setConversationStatus(status: "OPEN" | "PENDING" | "RESOLVED") {
    if (!selectedId || actionBusy) return;
    setActionBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/status?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      await loadConversations();
      await loadMessages(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a conversa."); }
    finally { setActionBusy(false); }
  }

  const selected = conversations.find((item) => item.id === selectedId);
  return <section className="inbox-workspace">
    <aside className="inbox-list content-card">
      <div className="inbox-panel-heading"><h2>Conversas</h2><button className="text-button" title="Atualizar" aria-label="Atualizar conversas" onClick={() => { void loadConversations(); void loadChannels(); }}>↻</button></div>
      {activeChannel ? <div className="inbox-connection"><span className={"connection-light " + (activeChannel.status === "CONNECTED" ? "connected" : activeChannel.status === "ERROR" ? "failed" : "")} /><span><strong>{activeChannel.name}</strong><small>{activeChannel.status === "CONNECTED" ? "Conectado" : activeChannel.status === "QR" ? "Aguardando QR Code" : activeChannel.status === "ERROR" ? "Falha na conexão" : activeChannel.status}</small></span><div className="connection-actions">{activeChannel.status === "ERROR" || activeChannel.status === "DISCONNECTED" ? <button className="text-button" onClick={() => void retryConnection(activeChannel)}>Reconectar</button> : activeChannel.status === "CONNECTED" ? <><button className="text-button" onClick={() => void retryConnection(activeChannel)}>Sincronizar</button><button className="text-button" onClick={() => void disconnectChannel(activeChannel)}>Desconectar</button></> : null}<button className="text-button danger-text" title="Excluir sessão" onClick={() => void deleteChannel(activeChannel)}>Excluir</button></div></div>
        : <div className="inbox-connect-prompt"><p>Conecte o WhatsApp para receber e responder mensagens aqui.</p><button className="primary-button" onClick={() => void connectWhatsApp()} disabled={connecting}>{connecting ? "Conectando..." : "Conectar WhatsApp"}</button></div>}
      {qr ? <div className="qr-panel"><p>Leia o QR Code com o WhatsApp do atendimento.</p><img src={qr} alt="QR Code para conectar WhatsApp" /><small>O estado da sessão é atualizado automaticamente.</small></div> : null}
      <nav className="inbox-queues" aria-label="Filas de atendimento">
        {([{ id: "new", label: "Novas" }, { id: "mine", label: "Minhas" }, { id: "team", label: "Minha equipe" }, { id: "others", label: "Outras" }] as const).map((item) => <button key={item.id} type="button" className={"inbox-queue-button " + (queueView === item.id ? "active" : "")} onClick={() => setQueueView(item.id)}>{item.label}</button>)}
        <details className={"inbox-more-queues " + (["all-open", "completed", "archived", "trash"].includes(queueView) ? "has-active" : "")}>
          <summary aria-label="Mais filas" title="Mais filas">Mais <span aria-hidden="true">⌄</span></summary>
          <div className="inbox-queue-menu">{([{ id: "all-open", label: "Todos abertos" }, { id: "completed", label: "Concluídos" }, { id: "archived", label: "Arquivados" }, { id: "trash", label: "Lixeira" }] as const).map((item) => <button key={item.id} type="button" className={queueView === item.id ? "active" : ""} onClick={() => setQueueView(item.id)}>{item.label}</button>)}</div>
        </details>
      </nav>
      <div className="inbox-conversation-list">
        {conversations.map((item) => <button key={item.id} className={"inbox-conversation " + (selectedId === item.id ? "selected" : "")} onClick={() => setSelectedId(item.id)}>
          <span className="conversation-avatar">{item.contact.name.slice(0, 1).toUpperCase()}</span><span className="conversation-summary"><strong>{item.contact.name}</strong><small>{item.messages?.[0]?.content || "Sem mensagens"}</small></span>
        </button>)}
        {!conversations.length ? <div className="inbox-empty"><strong>{queueView === "mine" ? "Nenhuma conversa atribuída a você" : queueView === "team" ? "Nenhuma conversa da sua equipe" : queueView === "others" ? "Nenhuma conversa em que você foi incluído" : "Nenhuma conversa nesta fila"}</strong><p>Você só vê conversas destinadas a você, às suas equipes ou incluídas por convite. A visão ampliada continua sujeita às permissões.</p></div> : null}
      </div>
    </aside>
    <div className="inbox-thread content-card">
      {selected ? <>
        <header className="thread-heading"><span className="conversation-avatar">{selected.contact.name.slice(0, 1).toUpperCase()}</span><div className="thread-contact"><h2>{selected.contact.name}</h2><p>{selected.contact.phone || "WhatsApp"}{selected.assignee ? " · " + selected.assignee.name : " · Sem responsável"} · {selected.handlingMode === "HUMAN" ? "Atendimento humano" : "Bot"}</p></div><div className="thread-actions">{!selected.assignee ? <button className="thread-action-button" onClick={() => void assumeConversation()} disabled={actionBusy || selected.status === "RESOLVED" || selected.status === "CLOSED"} title="Assumir esta conversa"><UserRound size={15} aria-hidden="true" /><span>Assumir</span></button> : null}<label className="thread-assign-select" title="Atribuir conversa"><UserRound size={14} aria-hidden="true" /><select aria-label="Atribuir conversa" value={selected.assignee?.id ?? ""} onChange={(event) => void assignConversation(event.target.value || null)} disabled={actionBusy || selected.status === "RESOLVED" || selected.status === "CLOSED"}><option value="">Sem responsável</option>{assignees.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>{selected.status === "RESOLVED" ? <button className="thread-action-button" onClick={() => void setConversationStatus("OPEN")} disabled={actionBusy} title="Reabrir conversa"><RotateCcw size={15} aria-hidden="true" /><span>Reabrir</span></button> : <button className="thread-action-button resolve" onClick={() => void setConversationStatus("RESOLVED")} disabled={actionBusy || selected.status === "CLOSED"} title="Resolver conversa"><CheckCircle2 size={15} aria-hidden="true" /><span>Resolver</span></button>}</div></header>
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>
          {selected.archivedAt || selected.deletedAt ? <button type="button" className="text-button" onClick={() => void api("/api/backend/conversations/" + selected.id + "/restore?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível restaurar."))}>Restaurar</button> : <><button type="button" className="text-button" onClick={() => void api("/api/backend/conversations/" + selected.id + "/archive?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível arquivar."))}>Arquivar</button><button type="button" className="text-button danger-text" onClick={() => void api("/api/backend/conversations/" + selected.id + "/trash?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível mover para a lixeira."))}>Lixeira</button></>}
        </div>
        <div className="handoff-controls" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--line)" }}><span style={{ fontSize: 11, color: "var(--muted)" }}>Transferir para:</span><select aria-label="Departamento" value={handoffDepartment} onChange={(event) => setHandoffDepartment(event.target.value)} style={{ maxWidth: 190, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 11 }}><option value="">Sem equipe / departamento</option>{departments.filter((department) => department.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select aria-label="Atendente" value={handoffAssignee} onChange={(event) => setHandoffAssignee(event.target.value)} style={{ maxWidth: 190, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 11 }}><option value="">Sem atendente específico</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button type="button" className="primary-button" onClick={() => void handoffToHuman()}>Transferir para humano</button><select aria-label="Convidar atendente" value={inviteAssignee} onChange={(event) => setInviteAssignee(event.target.value)} style={{ maxWidth: 160, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 11 }}><option value="">Convidar atendente…</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button type="button" className="text-button" onClick={() => void inviteToConversation()} disabled={!inviteAssignee}>Convidar</button><small style={{ color: "var(--muted)", fontSize: 10 }}>Sem seleção = fila geral, sem equipe.</small></div>
        <div className="thread-messages">
          {messages.map((message) => <div key={message.id} className={"message-line " + (message.direction === "OUTBOUND" ? "outgoing" : "")}><div className="message-bubble"><p>{message.content || "Anexo recebido (" + message.contentType + ")"}</p><small>{new Date(message.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{message.direction === "OUTBOUND" ? " · " + (message.status === "FAILED" ? "Falhou" : message.status === "QUEUED" ? "Enviando" : message.status === "READ" ? "Lida" : message.status === "DELIVERED" ? "Entregue" : "Enviada") : ""}</small></div></div>)}
          {!messages.length ? <p className="inbox-empty">Aguardando a primeira mensagem…</p> : null}
        </div>
        <form className="inbox-composer" onSubmit={sendMessage}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Digite sua mensagem..." maxLength={4000} rows={2} /><button className="primary-button" type="submit" disabled={busy || !draft.trim()}>{busy ? "Enviando..." : "Enviar"}</button></form>
      </> : <div className="thread-empty"><span className="module-placeholder-icon">☏</span><p>As mensagens recebidas aparecerão aqui.</p></div>}
    </div>
    {error ? <div className="inbox-error" role="status"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso">×</button></div> : null}
  </section>;
}
