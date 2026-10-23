"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Channel = { id: string; name: string; status: string; lastError?: string | null };
type Contact = { id: string; name: string; phone?: string | null };
type Message = { id: string; content: string; contentType: string; direction: string; status: string; occurredAt: string };
type Department = { id: string; key: string; name: string; keywords: string[]; isActive: boolean };
type Agent = { id: string; name: string; email: string };
type GroupSettings = { groupsEnabled: boolean; allowedGroupIds: string[] };
type GroupChoice = { id: string; name: string };
type Conversation = { id: string; status: string; handlingMode?: "BOT" | "HUMAN"; department?: Department | null; assignee?: Agent | null; contact: Contact; messages: Message[] };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || data.error || "Falha na operação.");
  return data as T;
}

export function InboxWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({ groupsEnabled: false, allowedGroupIds: [] });
  const [groupIdsDraft, setGroupIdsDraft] = useState("");
  const [groupSettingsBusy, setGroupSettingsBusy] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<GroupChoice[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [handoffDepartment, setHandoffDepartment] = useState("");
  const [handoffAssignee, setHandoffAssignee] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const rows = await api<Conversation[]>("/api/backend/conversations");
      setConversations(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar conversas."); }
  }, []);
  const loadChannels = useCallback(async () => {
    try { setChannels(await api<Channel[]>("/api/backend/channels")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar canais."); }
  }, []);
  const loadMessages = useCallback(async (id: string) => {
    try { setMessages(await api<Message[]>("/api/backend/conversations/" + id + "/messages")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar mensagens."); }
  }, []);

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { void loadConversations(); void loadChannels();
    void api<Department[]>("/api/backend/departments").then(setDepartments).catch(() => {});
    void api<Agent[]>("/api/backend/conversations/assignees").then(setAgents).catch(() => {});
  }, [loadConversations, loadChannels]);
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

  useEffect(() => {
    if (!activeChannel?.id) { setGroupSettings({ groupsEnabled: false, allowedGroupIds: [] }); setGroupIdsDraft(""); return; }
    let cancelled = false;
    void api<GroupSettings>("/api/backend/channels/" + activeChannel.id + "/group-settings")
      .then((settings) => { if (!cancelled) { setGroupSettings(settings); setGroupIdsDraft(settings.allowedGroupIds.join("\n")); } })
      .catch(() => { if (!cancelled) { setGroupSettings({ groupsEnabled: false, allowedGroupIds: [] }); setGroupIdsDraft(""); } });
    return () => { cancelled = true; };
  }, [channels.map((item) => item.id + ":" + item.status).join("|")]);

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

  async function toggleDepartment(department: Department, isActive: boolean) {
    setError("");
    try {
      await api("/api/backend/departments/" + department.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive }) });
      setDepartments((rows) => rows.map((row) => row.id === department.id ? { ...row, isActive } : row));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o departamento."); }
  }

  async function createDepartment() {
    const name = newDepartmentName.trim();
    if (!name) return;
    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 40);
    setError("");
    try {
      await api("/api/backend/departments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, key, keywords: [] }) });
      setDepartments(await api<Department[]>("/api/backend/departments"));
      setNewDepartmentName("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o departamento."); }
  }

  async function discoverGroups() {
    if (!activeChannel) return;
    setLoadingGroups(true); setError("");
    try {
      const result = await api<{ groups: GroupChoice[] }>("/api/backend/channels/" + activeChannel.id + "/groups");
      setAvailableGroups(result.groups);
      if (!result.groups.length) setError("Nenhum grupo retornado pelo WhatsApp. Você ainda pode informar os IDs manualmente.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar os grupos do WhatsApp."); }
    finally { setLoadingGroups(false); }
  }

  function toggleAllowedGroup(groupId: string, checked: boolean) {
    const current = groupIdsDraft.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    const next = checked ? [...new Set([...current, groupId])] : current.filter((id) => id !== groupId);
    setGroupIdsDraft(next.join("\n"));
  }

  async function saveGroupSettings() {
    if (!activeChannel) return;
    setGroupSettingsBusy(true); setError("");
    const allowedGroupIds = [...new Set(groupIdsDraft.split(/\r?\n|,/).map((value) => value.trim()).filter((value) => value.endsWith("@g.us")))];
    try {
      const saved = await api<GroupSettings>("/api/backend/channels/" + activeChannel.id + "/group-settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groupsEnabled: groupSettings.groupsEnabled, allowedGroupIds }) });
      setGroupSettings(saved); setGroupIdsDraft(saved.allowedGroupIds.join("\n"));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar as regras de grupos."); }
    finally { setGroupSettingsBusy(false); }
  }

  async function handoffToHuman() {
    if (!selectedId) return;
    setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/handoff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(handoffDepartment ? { departmentId: handoffDepartment } : {}), ...(handoffAssignee ? { assigneeId: handoffAssignee } : {}) }) });
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível transferir para o atendimento humano."); }
  }

  async function returnToBot() {
    if (!selectedId) return;
    setError("");
    try { await api("/api/backend/conversations/" + selectedId + "/return-to-bot", { method: "POST" }); await loadConversations(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível devolver ao bot."); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: draft.trim() }) });
      setDraft("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a mensagem.");
      await loadMessages(selectedId);
    } finally { setBusy(false); }
  }

  const activeChannel = channels.find((item) => item.status === "CONNECTED") || channels[0];
  const selected = conversations.find((item) => item.id === selectedId);
  return <section className="inbox-workspace">
    <aside className="inbox-list content-card">
      <div className="inbox-panel-heading"><h2>Conversas</h2><button className="text-button" title="Atualizar" aria-label="Atualizar conversas" onClick={() => { void loadConversations(); void loadChannels(); }}>↻</button></div>
      {activeChannel ? <div className="inbox-connection"><span className={"connection-light " + (activeChannel.status === "CONNECTED" ? "connected" : activeChannel.status === "ERROR" ? "failed" : "")} /><span><strong>{activeChannel.name}</strong><small>{activeChannel.status === "CONNECTED" ? "Conectado" : activeChannel.status === "QR" ? "Aguardando QR Code" : activeChannel.status === "ERROR" ? "Falha na conexão" : activeChannel.status}</small></span><div className="connection-actions">{activeChannel.status === "ERROR" || activeChannel.status === "DISCONNECTED" ? <button className="text-button" onClick={() => void retryConnection(activeChannel)}>Reconectar</button> : activeChannel.status === "CONNECTED" ? <><button className="text-button" onClick={() => void retryConnection(activeChannel)}>Sincronizar</button><button className="text-button" onClick={() => void disconnectChannel(activeChannel)}>Desconectar</button></> : null}<button className="text-button danger-text" title="Excluir sessão" onClick={() => void deleteChannel(activeChannel)}>Excluir</button></div></div>
        : <div className="inbox-connect-prompt"><p>Conecte o WhatsApp para receber e responder mensagens aqui.</p><button className="primary-button" onClick={() => void connectWhatsApp()} disabled={connecting}>{connecting ? "Conectando..." : "Conectar WhatsApp"}</button></div>}
      {qr ? <div className="qr-panel"><p>Leia o QR Code com o WhatsApp do atendimento.</p><img src={qr} alt="QR Code para conectar WhatsApp" /><small>O estado da sessão é atualizado automaticamente.</small></div> : null}
      {activeChannel ? <details className="group-settings" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontSize: 12 }}><summary style={{ cursor: "pointer", fontWeight: 650 }}>Grupos do WhatsApp <span style={{ color: "var(--muted)", fontWeight: 400 }}>· desativados por padrão</span></summary><label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}><input type="checkbox" checked={groupSettings.groupsEnabled} onChange={(event) => setGroupSettings((current) => ({ ...current, groupsEnabled: event.target.checked }))} /> Permitir receber conversas de grupos</label><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}><label style={{ color: "var(--muted)" }}>Escolha os grupos autorizados</label><button type="button" className="text-button" onClick={() => void discoverGroups()} disabled={loadingGroups}>{loadingGroups ? "Buscando..." : "Buscar grupos"}</button></div>{availableGroups.length ? <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 10, border: "1px solid var(--line)", borderRadius: 7, padding: 7 }}>{availableGroups.map((group) => <label key={group.id} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "5px 2px" }}><input type="checkbox" checked={groupIdsDraft.split(/\r?\n|,/).map((value) => value.trim()).includes(group.id)} onChange={(event) => toggleAllowedGroup(group.id, event.target.checked)} /><span><span style={{ display: "block" }}>{group.name}</span><small style={{ color: "var(--muted)", overflowWrap: "anywhere" }}>{group.id}</small></span></label>)}</div> : null}<label style={{ display: "block", color: "var(--muted)", marginBottom: 5 }}>Ou informe IDs manualmente (um por linha, terminados em @g.us)</label><textarea value={groupIdsDraft} onChange={(event) => setGroupIdsDraft(event.target.value)} rows={3} placeholder="120363000000000000@g.us" style={{ width: "100%", resize: "vertical", fontSize: 11, border: "1px solid var(--line)", borderRadius: 7, padding: 8 }} /><small style={{ display: "block", color: "var(--muted)", margin: "6px 0 9px" }}>Mesmo ativado, nenhum grupo entra sem estar nesta lista. Conversas individuais continuam funcionando normalmente.</small><button className="primary-button" type="button" onClick={() => void saveGroupSettings()} disabled={groupSettingsBusy}>{groupSettingsBusy ? "Salvando..." : "Salvar regras de grupos"}</button></details> : null}
      <details className="department-settings" style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontSize: 12 }}><summary style={{ cursor: "pointer", fontWeight: 650 }}>Departamentos da empresa</summary><small style={{ display: "block", color: "var(--muted)", margin: "8px 0" }}>Ative somente as áreas que esta empresa utiliza. Desativar todas deixa a empresa sem departamentos; a fila geral continua disponível.</small>{departments.map((department) => <label key={department.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}><input type="checkbox" checked={department.isActive} onChange={(event) => void toggleDepartment(department, event.target.checked)} /><span>{department.name}</span></label>)}<div style={{ display: "flex", gap: 6, marginTop: 8 }}><input value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="Nova área (ex.: Marketing)" maxLength={80} style={{ minWidth: 0, flex: 1, padding: "7px 8px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 11 }} /><button className="text-button" type="button" onClick={() => void createDepartment()} disabled={!newDepartmentName.trim()}>Adicionar</button></div></details>
      <div className="inbox-conversation-list">
        {conversations.map((item) => <button key={item.id} className={"inbox-conversation " + (selectedId === item.id ? "selected" : "")} onClick={() => setSelectedId(item.id)}>
          <span className="conversation-avatar">{item.contact.name.slice(0, 1).toUpperCase()}</span><span className="conversation-summary"><strong>{item.contact.name}</strong><small>{item.messages?.[0]?.content || "Sem mensagens"}</small></span>
        </button>)}
        {!conversations.length ? <div className="inbox-empty"><strong>Nenhuma conversa ainda</strong><p>Envie “oi” de outro celular para o WhatsApp conectado. Esta lista se atualiza sozinha a cada poucos segundos.</p></div> : null}
      </div>
    </aside>
    <div className="inbox-thread content-card">
      {selected ? <>
        <header className="thread-heading"><span className="conversation-avatar">{selected.contact.name.slice(0, 1).toUpperCase()}</span><div style={{ minWidth: 0, flex: 1 }}><h2>{selected.contact.name}</h2><p>{selected.contact.phone || "WhatsApp"} · {selected.handlingMode === "HUMAN" ? "Atendimento humano" : "Bot"}</p><small style={{ color: "var(--muted)" }}>{selected.department?.name || (selected.assignee?.name ? "Atendente: " + selected.assignee.name : selected.handlingMode === "HUMAN" ? "Fila humana sem equipe" : "Automação inicial")}</small></div>{selected.handlingMode === "HUMAN" ? <button type="button" className="text-button" onClick={() => void returnToBot()}>Devolver ao bot</button> : null}</header>
        <div className="handoff-controls" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--line)" }}><span style={{ fontSize: 11, color: "var(--muted)" }}>Transferir para:</span><select aria-label="Departamento" value={handoffDepartment} onChange={(event) => { setHandoffDepartment(event.target.value); if (event.target.value) setHandoffAssignee(""); }} style={{ maxWidth: 190, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 11 }}><option value="">Sem equipe / departamento</option>{departments.filter((department) => department.isActive).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select><select aria-label="Atendente" value={handoffAssignee} onChange={(event) => { setHandoffAssignee(event.target.value); if (event.target.value) setHandoffDepartment(""); }} style={{ maxWidth: 190, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 7, fontSize: 11 }}><option value="">Sem atendente específico</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button type="button" className="primary-button" onClick={() => void handoffToHuman()}>Transferir para humano</button><small style={{ color: "var(--muted)", fontSize: 10 }}>Sem seleção = fila geral, sem equipe.</small></div>
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
