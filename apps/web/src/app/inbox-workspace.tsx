"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, RotateCcw, UserRound, Users, UserPlus, ChevronDown, ArrowRightLeft, Check, Archive, Trash2, Smile, Mic, MicOff, BookmarkPlus, Plus, X, Send, Keyboard } from "lucide-react";
import { ContactProfilePanel } from "./contact-profile-panel";

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
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const [queueView, setQueueView] = useState("mine");
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickReplies, setQuickReplies] = useState<Array<{id:string;title:string;content:string}>>([]);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickContent, setQuickContent] = useState("");
  const [listening, setListening] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<{stop:()=>void}|null>(null);
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
  const loadQueueCounts = useCallback(async () => {
    const views = ["new", "mine", "team"];
    const counts = await Promise.all(views.map(async (view) => { try { return [view, (await api<Conversation[]>("/api/backend/conversations?view=" + view)).length] as const; } catch { return [view, 0] as const; } }));
    setQueueCounts(Object.fromEntries(counts));
  }, []);
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
  useEffect(() => { try { const saved = localStorage.getItem("vexora:quick-replies"); if (saved) setQuickReplies(JSON.parse(saved)); } catch {} }, []);

  // Close every inbox dropdown on outside click or Escape for consistent menu behavior.
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      document.querySelectorAll<HTMLElement>(".inbox-workspace details[open]").forEach((menu) => {
        if (!menu.contains(event.target as Node)) menu.removeAttribute("open");
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document.querySelectorAll<HTMLElement>(".inbox-workspace details[open]").forEach((menu) => menu.removeAttribute("open"));
      }
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  useEffect(() => { void loadConversations(); void loadQueueCounts(); void loadChannels(); void loadAssignees();
    void api<Department[]>("/api/backend/departments").then(setDepartments).catch(() => {});
    void api<Agent[]>("/api/backend/conversations/assignees").then(setAgents).catch(() => {});
  }, [loadConversations, loadQueueCounts, loadChannels, loadAssignees]);
  useEffect(() => { if (selectedId) void loadMessages(selectedId); else setMessages([]); }, [selectedId, loadMessages]);

  // Poll as a fallback: inbound messages must appear even if an SSE event is missed.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations(); void loadQueueCounts();
      if (selectedRef.current) void loadMessages(selectedRef.current);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadQueueCounts, loadMessages]);
  useEffect(() => {
    const source = new EventSource("/api/backend/events");
    const refresh = () => { void loadConversations(); void loadQueueCounts(); void loadChannels(); if (selectedRef.current) void loadMessages(selectedRef.current); };
    ["message.received", "message.sent", "message.failed", "message.status", "message.queued", "conversation.updated", "conversation.created", "channel.status", "channel.created"].forEach((name) => source.addEventListener(name, refresh));
    // EventSource reconnects automatically. Keep the interface quiet; the 5-second polling fallback keeps conversations fresh while SSE recovers.
    source.onerror = () => { /* transient realtime interruptions are handled silently */ };
    return () => source.close();
  }, [loadConversations, loadQueueCounts, loadChannels, loadMessages]);

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


  function saveQuickReplies(next: Array<{id:string;title:string;content:string}>) { setQuickReplies(next); try { localStorage.setItem("vexora:quick-replies", JSON.stringify(next)); } catch { setError("Não foi possível salvar respostas rápidas neste navegador."); } }
  function createQuickReply() { if (!quickTitle.trim() || !quickContent.trim()) return; saveQuickReplies([...quickReplies, {id:crypto.randomUUID(),title:quickTitle.trim(),content:quickContent.trim()}]); setQuickTitle(""); setQuickContent(""); }
  function insertEmoji(value:string) { const el=composerRef.current; const a=el?.selectionStart ?? draft.length; const b=el?.selectionEnd ?? draft.length; setDraft(draft.slice(0,a)+value+draft.slice(b)); setEmojiOpen(false); requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(a+value.length,a+value.length)}); }
  function toggleVoice() {
    if(listening){recognitionRef.current?.stop();setListening(false);return}
    const w=window as Window & {SpeechRecognition?:new()=>any;webkitSpeechRecognition?:new()=>any};
    const C=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!C){setError("Ditado por voz indisponível neste navegador. Você pode usar o microfone do teclado do celular.");return}
    try { const r=new C(); r.lang="pt-BR"; r.continuous=true; r.interimResults=true; r.onresult=(e:any)=>{const text=Array.from(e.results as ArrayLike<any>).slice(e.resultIndex).filter((x:any)=>x.isFinal).map((x:any)=>x[0].transcript).join(" ").trim();if(text)setDraft(v=>v?v.trimEnd()+" "+text:text)}; r.onerror=()=>{setListening(false);setError("Verifique a permissão de acesso ao microfone.")}; r.onend=()=>setListening(false); recognitionRef.current=r; r.start(); setListening(true); } catch { setError("Não foi possível iniciar o microfone. Confira as permissões do navegador."); }
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
        {([{ id: "new", label: "Novas" }, { id: "mine", label: "Minhas" }, { id: "team", label: "Equipe" }, { id: "others", label: "Outras" }] as const).map((item) => <button key={item.id} type="button" className={"inbox-queue-button " + (queueView === item.id ? "active" : "")} onClick={() => setQueueView(item.id)}><span>{item.label}</span>{item.id !== "others" ? <span className="inbox-queue-count">{queueCounts[item.id] ?? 0}</span> : null}</button>)}
        <details className={"inbox-more-queues " + (["all-open", "completed", "archived", "trash"].includes(queueView) ? "has-active" : "")}>
          <summary aria-label="Mais filas" title="Mais filas">Mais <span aria-hidden="true">⌄</span></summary>
          <div className="inbox-queue-menu">{([{ id: "all-open", label: "Todos abertos" }, { id: "completed", label: "Concluídos" }, { id: "archived", label: "Arquivados" }, { id: "trash", label: "Lixeira" }] as const).map((item) => <button key={item.id} type="button" className={queueView === item.id ? "active" : ""} onClick={(event) => { setQueueView(item.id); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{item.label}</button>)}</div>
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
        <header className="thread-heading"><span className="conversation-avatar">{selected.contact.name.slice(0, 1).toUpperCase()}</span><div className="thread-contact"><h2>{selected.contact.name}</h2><p>{selected.contact.phone || "WhatsApp"}{selected.assignee ? " · " + selected.assignee.name : " · Sem responsável"} · {selected.handlingMode === "HUMAN" ? "Atendimento humano" : "Bot"}</p></div><div className="thread-actions">{!selected.assignee ? <button className="thread-action-button" onClick={() => void assumeConversation()} disabled={actionBusy || selected.status === "RESOLVED" || selected.status === "CLOSED"} title="Assumir esta conversa"><UserRound size={15} aria-hidden="true" /><span>Assumir</span></button> : null}<div className="handoff-toolbar" aria-label="Direcionamento da conversa">
          <details className="handoff-menu">
            <summary className="handoff-invite-trigger handoff-direct-trigger" title="Direcionar conversa">
              <ArrowRightLeft size={15}/><span>Direcionar</span><ChevronDown size={13}/>
            </summary>
            <div className="handoff-popover">
              <div className="handoff-popover-heading"><div><strong>Para quem vai?</strong><small>Escolha a equipe ou uma pessoa</small></div><span className="handoff-popover-mark"><Users size={17}/></span></div>
              <div className="handoff-section-label">EQUIPES</div>
              <button type="button" className={"handoff-option " + (!handoffDepartment && !handoffAssignee ? "selected" : "")} onClick={()=>{setHandoffDepartment("");setHandoffAssignee("");}}><span className="handoff-option-icon"><Users size={15}/></span><span className="handoff-option-copy"><strong>Fila geral</strong></span>{!handoffDepartment&&!handoffAssignee?<Check size={15}/>:null}</button>
              {departments.filter(d=>d.isActive).map(d=><button type="button" key={d.id} className={"handoff-option "+(handoffDepartment===d.id?"selected":"")} onClick={()=>setHandoffDepartment(d.id)}><span className="handoff-option-icon"><Users size={15}/></span><span className="handoff-option-copy"><strong>{d.name}</strong></span>{handoffDepartment===d.id?<Check size={15}/>:null}</button>)}
              <div className="handoff-section-label">ATENDENTE ESPECÍFICO</div>
              <button type="button" className={"handoff-option "+(!handoffAssignee?"selected":"")} onClick={()=>setHandoffAssignee("")}><span className="handoff-option-icon"><UserRound size={15}/></span><span className="handoff-option-copy"><strong>Sem atendente específico</strong></span>{!handoffAssignee?<Check size={15}/>:null}</button>
              {agents.map(a=><button type="button" key={a.id} className={"handoff-option "+(handoffAssignee===a.id?"selected":"")} onClick={()=>setHandoffAssignee(a.id)}><span className="handoff-avatar">{a.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span className="handoff-option-copy"><strong>{a.name}</strong></span>{handoffAssignee===a.id?<Check size={15}/>:null}</button>)}
              <div className="handoff-popover-footer"><span>Destino: <b>{handoffDepartment?departments.find(d=>d.id===handoffDepartment)?.name:"Fila geral"}{handoffAssignee?" · "+agents.find(a=>a.id===handoffAssignee)?.name:""}</b></span><button type="button" className="handoff-confirm" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void handoffToHuman();}}><ArrowRightLeft size={14}/> Transferir</button></div>
            </div>
          </details>
          <details className="handoff-menu invite-menu">
            <summary className="handoff-invite-trigger" title="Convidar atendente"><UserPlus size={15}/><span>Convidar</span><ChevronDown size={13}/></summary>
            <div className="handoff-popover invite-popover">
              <div className="handoff-popover-heading"><div><strong>Convidar para a conversa</strong><small>A pessoa poderá acompanhar o atendimento</small></div><span className="handoff-popover-mark"><UserPlus size={17}/></span></div>
              {agents.map(a=><div className="invite-option" key={a.id}><span className="handoff-avatar">{a.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span className="handoff-option-copy"><strong>{a.name}</strong><small>{a.email}</small></span><button type="button" aria-label={"Convidar "+a.name} title={"Convidar "+a.name} className="invite-person-button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");setInviteAssignee(a.id);void api("/api/backend/conversations/"+selected.id+"/invite?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({userId:a.id})}).then(()=>{setInviteAssignee("");return loadConversations();}).catch(e=>setError(e instanceof Error?e.message:"Não foi possível convidar o atendente."));}}><UserPlus size={14}/></button></div>)}
              {!agents.length?<p className="handoff-empty">Nenhum atendente disponível.</p>:null}
            </div>
          </details>
        </div>{selected.status === "RESOLVED" ? <button className="thread-action-button" onClick={() => void setConversationStatus("OPEN")} disabled={actionBusy} title="Reabrir conversa"><RotateCcw size={15} aria-hidden="true" /><span>Reabrir</span></button> : <button className="thread-action-button resolve" onClick={() => void setConversationStatus("RESOLVED")} disabled={actionBusy || selected.status === "CLOSED"} title="Resolver conversa"><CheckCircle2 size={15} aria-hidden="true" /><span>Resolver</span></button>}<div className="thread-rare-actions">{selected.archivedAt || selected.deletedAt ? <button type="button" className="thread-icon-action" aria-label="Restaurar" title="Restaurar" onClick={() => void api("/api/backend/conversations/" + selected.id + "/restore?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível restaurar."))}><RotateCcw size={16}/></button> : <><button type="button" className="thread-icon-action" aria-label="Arquivar" title="Arquivar" onClick={() => void api("/api/backend/conversations/" + selected.id + "/archive?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível arquivar."))}><Archive size={16}/></button><button type="button" className="thread-icon-action danger-text" aria-label="Mover para lixeira" title="Mover para lixeira" onClick={() => void api("/api/backend/conversations/" + selected.id + "/trash?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível mover para a lixeira."))}><Trash2 size={16}/></button></>}</div></div></header>
        <div className="thread-messages">
          {messages.map((message) => <div key={message.id} className={"message-line " + (message.direction === "OUTBOUND" ? "outgoing" : "")}><div className="message-bubble"><p>{message.content || "Anexo recebido (" + message.contentType + ")"}</p><small>{new Date(message.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{message.direction === "OUTBOUND" ? " · " + (message.status === "FAILED" ? "Falhou" : message.status === "QUEUED" ? "Enviando" : message.status === "READ" ? "Lida" : message.status === "DELIVERED" ? "Entregue" : "Enviada") : ""}</small></div></div>)}
          {!messages.length ? <p className="inbox-empty">Aguardando a primeira mensagem…</p> : null}
        </div>
        <div className="composer-shell"><form className="inbox-composer" onSubmit={sendMessage}><textarea ref={composerRef} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();e.currentTarget.form?.requestSubmit()}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="e"){e.preventDefault();setEmojiOpen(v=>!v)}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="r"){e.preventDefault();setQuickOpen(v=>!v)}}} placeholder="Digite sua mensagem..." maxLength={4000} rows={3} aria-label="Mensagem"/><div className="composer-toolbar"><div className="composer-tools"><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Emojis · Ctrl+Shift+E" onClick={()=>{setEmojiOpen(v=>!v);setQuickOpen(false)}} aria-label="Emojis"><Smile size={18}/></button>{emojiOpen?<div className="composer-popover emoji-popover"><strong>Emojis</strong><div className="emoji-grid">{["😀","😊","😂","❤️","👍","🙏","👏","🎉","😍","🤝","✅","📌","🔥","💡","👋","😅","🤔","🚀","📞","⭐","😉","💬","✨","🥳"].map(x=><button type="button" key={x} onClick={()=>insertEmoji(x)}>{x}</button>)}</div></div>:null}</div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Respostas rápidas · Ctrl+Shift+R" onClick={()=>{setQuickOpen(v=>!v);setEmojiOpen(false)}} aria-label="Respostas rápidas"><BookmarkPlus size={18}/></button>{quickOpen?<div className="composer-popover quick-replies-popover"><strong>Respostas rápidas</strong>{quickReplies.map(q=><div className="quick-reply-row" key={q.id}><button type="button" className="quick-reply-use" onClick={()=>{setDraft(v=>v?v+"\n"+q.content:q.content);setQuickOpen(false);composerRef.current?.focus()}}><b>{q.title}</b><small>{q.content}</small></button><button type="button" className="quick-reply-delete" aria-label="Excluir resposta" onClick={()=>saveQuickReplies(quickReplies.filter(x=>x.id!==q.id))}><X size={14}/></button></div>)}<div className="quick-reply-create"><input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} placeholder="Nome da resposta"/><textarea rows={2} value={quickContent} onChange={e=>setQuickContent(e.target.value)} placeholder="Texto da resposta"/><button type="button" onClick={createQuickReply} disabled={!quickTitle.trim()||!quickContent.trim()}><Plus size={14}/> Criar resposta</button></div></div>:null}</div><button type="button" className={"composer-icon-button "+(listening?"recording":"")} title="Ditado por voz" aria-label="Ditado por voz" onClick={toggleVoice}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><span className="composer-shortcut-hint"><Keyboard size={13}/> Ctrl + Enter envia</span></div><span className="composer-char-count">{draft.length}/4000</span><button className="composer-send-button" type="submit" disabled={busy||!draft.trim()}>{busy?<RotateCcw size={16}/>:<Send size={16}/>}<span>{busy?"Enviando":"Enviar"}</span></button></div></form></div>
      </> : <div className="thread-empty"><span className="module-placeholder-icon">☏</span><p>As mensagens recebidas aparecerão aqui.</p></div>}
    </div>
    {selected ? <ContactProfilePanel contact={selected.contact} conversationId={selected.id} status={selected.status} createdAt={selected.createdAt} channel={selected.channel} /> : null}
    {error ? <div className="inbox-error" role="status"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso">×</button></div> : null}
  </section>;
}
