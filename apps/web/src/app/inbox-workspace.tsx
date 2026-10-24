"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, RotateCcw, UserRound, Users, UserPlus, ChevronDown, ArrowRightLeft, Check, Archive, Trash2, Smile, Mic, MicOff, BookmarkPlus, Plus, X, Send, Keyboard, ArrowLeft, Instagram, Facebook, MessageCircle, Bot, BrainCircuit, Music2, AlarmClock } from "lucide-react";
import { ContactProfilePanel } from "./contact-profile-panel";

type Channel = { id: string; name: string; status: string; lastError?: string | null };
type Contact = { id: string; name: string; phone?: string | null; email?: string | null; externalId?: string | null; source?: string | null; metadata?: Record<string, unknown> };
type Message = { id: string; content: string; contentType: string; direction: string; status: string; occurredAt: string };
type Assignee = { id: string; name: string; email: string };
type Department = { id: string; key: string; name: string; keywords: string[]; isActive: boolean };
type Agent = { id: string; name: string; email: string };
type Conversation = { id: string; status: string; createdAt?: string; channel?: string; handlingMode?: "BOT" | "HUMAN"; botState?: Record<string, unknown>; isOverdue?: boolean; department?: Department | null; archivedAt?: string | null; deletedAt?: string | null; contact: Contact; assignee?: { id: string; name: string } | null; messages: Message[] };
function avatarUrl(contact: Contact): string | null {
  const meta = contact.metadata || {};
  for (const key of ["avatarUrl", "profilePictureUrl", "photoUrl", "pictureUrl", "profileImage"]) {
    const value = meta[key];
    if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  }
  return null;
}
function ChannelMark({ channel, kind = "source", mode }: { channel?: string; kind?: "source" | "agent"; mode?: "BOT" | "HUMAN" }) {
  const value = (channel || "WHATSAPP").toUpperCase();
  if (kind === "agent") {
    if (mode === "HUMAN") return null;
    const isAi = ["AI", "LLM", "OPENAI", "GPT"].includes(String(mode || "").toUpperCase()) || ["AI", "LLM", "OPENAI", "GPT", "IA"].some(token => value.includes(token));
    return <span className={"channel-mark " + (isAi ? "channel-ai" : "channel-bot")} title={isAi ? "Atendimento por IA" : "Atendimento por chatbot"} aria-label={isAi ? "IA" : "Chatbot"}>{isAi ? <BrainCircuit size={12}/> : <Bot size={12}/>}</span>;
  }
  if (value.includes("INSTAGRAM")) return <span className="channel-mark channel-instagram" title="Instagram" aria-label="Instagram"><Instagram size={13}/></span>;
  if (value.includes("FACEBOOK") || value === "MESSENGER") return <span className="channel-mark channel-facebook" title="Facebook" aria-label="Facebook"><Facebook size={13}/></span>;
  if (value.includes("TIKTOK")) return <span className="channel-mark channel-tiktok" title="TikTok" aria-label="TikTok"><Music2 size={13}/></span>;
  if (value.includes("CHATBOT") || value.includes("WIDGET") || value.includes("WEBCHAT")) return <span className="channel-mark channel-bot" title="Chatbot do site" aria-label="Chatbot"><Bot size={13}/></span>;
  if (value.includes("AI") || value.includes("IA")) return <span className="channel-mark channel-ai" title="Inteligência artificial" aria-label="IA"><BrainCircuit size={13}/></span>;
  return <span className="channel-mark channel-whatsapp" title="WhatsApp" aria-label="WhatsApp"><MessageCircle size={13}/></span>;
}
function ContactAvatar({ contact, className = "conversation-avatar" }: { contact: Contact; className?: string }) {
  const src = avatarUrl(contact);
  return <span className={className}>{src ? <img src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.display = "flex"; }}/> : null}<span className={src ? "avatar-fallback hidden" : "avatar-fallback"}>{contact.name.slice(0, 1).toUpperCase()}</span></span>;
}

function contactLabels(contact: Contact): Array<{name:string;color:string}> {
  const value = contact.metadata?.tags;
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw === "string") return [{name:raw,color:"#eeecff"}];
    if (raw && typeof raw === "object" && "name" in raw && typeof (raw as {name?:unknown}).name === "string") return [{name:(raw as {name:string}).name,color:typeof (raw as {color?:unknown}).color === "string" ? (raw as {color:string}).color : "#eeecff"}];
    return [];
  });
}


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
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("Todos");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
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
  const [finalizationOpen, setFinalizationOpen] = useState(false);
  const [finalizationOutcome, setFinalizationOutcome] = useState<"WON" | "LOST" | "">("");
  const [finalizationReason, setFinalizationReason] = useState("");
  const lossReasons = ["Preço/Condição", "Sem interesse", "Sem retorno", "Concorrência", "Inatividade"];
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
    ["message.received", "message.sent", "message.failed", "message.status", "message.queued", "conversation.updated", "conversation.created", "contact.updated", "contact.created", "contact.stage_changed", "channel.status", "channel.created"].forEach((name) => source.addEventListener(name, refresh));
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
  function insertEmoji(value:string) {
    const el=composerRef.current;
    const start=el?.selectionStart ?? draft.length;
    const end=el?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0,start)+value+draft.slice(end));
    setEmojiOpen(false); setEmojiSearch("");
    requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(start+value.length,start+value.length)});
  }
  const emojiGroups:Record<string,string[]> = {
    "Rostos":["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😍","🥰","😘","😋","😎","🤔","🫡","😢","😭","😡","🥳"],
    "Gestos":["👋","🤚","✋","🖐️","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","👍","👎","👏","🙌","🙏","🤝","💪","🫶"],
    "Corações":["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝"],
    "Natureza":["🐶","🐱","🐭","🐰","🦊","🐻","🐼","🐸","🐵","🌷","🌹","🌻","🌞","🌈","⭐","🌟","🔥","🌊","🍀","🌿"],
    "Comida":["🍎","🍓","🍕","🍔","🍟","🌮","🍣","🍰","🎂","☕","🧉","🥤","🍻","🍽️"],
    "Objetos":["📱","💻","📞","📧","📎","📌","📍","📝","📄","📦","🔑","💡","🔔","🎁","💰","💳","🛒","🚗"],
    "Símbolos":["✅","☑️","❌","⚠️","❗","❓","💯","♻️","🔒","🔓","✨","💬","➡️","⬅️","✔️","➕","➖"],
    "Festa":["🎉","🎊","🎈","🎂","🏆","🥇","🎯","🚀","🎵","🎶","⚽","🏖️","✈️","🎄"]
  };
  const visibleEmojis = Object.entries(emojiGroups).filter(([group,values])=>(emojiCategory==="Todos"||emojiCategory===group)&&(!emojiSearch.trim()||group.toLowerCase().includes(emojiSearch.toLowerCase())||values.some(v=>v.includes(emojiSearch.trim()))));
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


  async function confirmConversationFinalization() {
    if (!selected || !finalizationOutcome || (finalizationOutcome === "LOST" && !finalizationReason) || actionBusy) return;
    setActionBusy(true); setError("");
    try {
      await api("/api/backend/contacts/" + selected.contact.id + "/finalize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ outcome: finalizationOutcome, reason: finalizationOutcome === "LOST" ? finalizationReason : undefined }),
      });
      setFinalizationOpen(false); setFinalizationOutcome(""); setFinalizationReason("");
      await loadConversations(); await loadQueueCounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível finalizar o atendimento.");
    } finally { setActionBusy(false); }
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
  return <section className={"inbox-workspace " + (mobileThreadOpen ? "mobile-thread-open" : "")}>
    <aside className="inbox-list content-card">
      <div className="inbox-panel-heading"><h2>Conversas</h2><button className="text-button" title="Atualizar" aria-label="Atualizar conversas" onClick={() => { void loadConversations(); void loadChannels(); }}>↻</button></div>
      {activeChannel ? <div className="inbox-connection"><span className={"connection-light " + (activeChannel.status === "CONNECTED" ? "connected" : activeChannel.status === "ERROR" ? "failed" : "")} /><span><strong>{activeChannel.name}</strong><small>{activeChannel.status === "CONNECTED" ? "Conectado" : activeChannel.status === "QR" ? "Aguardando QR Code" : activeChannel.status === "ERROR" ? "Falha na conexão" : activeChannel.status}</small></span><div className="connection-actions">{activeChannel.status === "ERROR" || activeChannel.status === "DISCONNECTED" ? <button className="text-button" onClick={() => void retryConnection(activeChannel)}>Reconectar</button> : activeChannel.status === "CONNECTED" ? <><button className="text-button" onClick={() => void retryConnection(activeChannel)}>Sincronizar</button><button className="text-button" onClick={() => void disconnectChannel(activeChannel)}>Desconectar</button></> : null}<button className="text-button danger-text" title="Excluir sessão" onClick={() => void deleteChannel(activeChannel)}>Excluir</button></div></div>
        : <div className="inbox-connect-prompt"><p>Conecte o WhatsApp para receber e responder mensagens aqui.</p><button className="primary-button" onClick={() => void connectWhatsApp()} disabled={connecting}>{connecting ? "Conectando..." : "Conectar WhatsApp"}</button></div>}
      {qr ? <div className="qr-panel"><p>Leia o QR Code com o WhatsApp do atendimento.</p><img src={qr} alt="QR Code para conectar WhatsApp" /><small>O estado da sessão é atualizado automaticamente.</small></div> : null}
      <nav className="inbox-queues" aria-label="Filas de atendimento">
        {([{ id: "new", label: "Novas" }, { id: "mine", label: "Minhas" }, { id: "team", label: "Equipe" }, { id: "others", label: "Outras" }] as const).map((item) => <button key={item.id} type="button" className={"inbox-queue-button " + (queueView === item.id ? "active" : "")} onClick={() => { setQueueView(item.id); setMobileThreadOpen(false); }}><span>{item.label}</span>{item.id !== "others" ? <span className="inbox-queue-count">{queueCounts[item.id] ?? 0}</span> : null}</button>)}
        <details className={"inbox-more-queues " + (["all-open", "completed", "archived", "trash"].includes(queueView) ? "has-active" : "")}>
          <summary aria-label="Mais filas" title="Mais filas">Mais <span aria-hidden="true">⌄</span></summary>
          <div className="inbox-queue-menu">{([{ id: "all-open", label: "Todos abertos" }, { id: "completed", label: "Concluídos" }, { id: "archived", label: "Arquivados" }, { id: "trash", label: "Lixeira" }] as const).map((item) => <button key={item.id} type="button" className={queueView === item.id ? "active" : ""} onClick={(event) => { setQueueView(item.id); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{item.label}</button>)}</div>
        </details>
      </nav>
      <div className="inbox-conversation-list">
        {conversations.map((item) => <button key={item.id} className={"inbox-conversation " + (selectedId === item.id ? "selected" : "")} onClick={() => { setSelectedId(item.id); setMobileThreadOpen(true); }}>
          <ContactAvatar contact={item.contact}/><span className="conversation-summary"><span className="conversation-title-row"><strong>{item.contact.name}</strong><span className="conversation-channel-marks"><ChannelMark channel={item.channel || item.contact.source || "WHATSAPP"}/><ChannelMark kind="agent" mode={item.handlingMode} channel={String(item.botState?.mode || item.botState?.provider || "")}/></span></span>{contactLabels(item.contact).length ? <span className="conversation-tags">{contactLabels(item.contact).map((tag,index)=><span key={tag.name+index} className="conversation-tag" style={{backgroundColor:tag.color,color:"#fff",borderColor:"color-mix(in srgb, "+tag.color+" 78%, #111827)",boxShadow:"inset 0 0 0 1px color-mix(in srgb, "+tag.color+" 78%, #111827)"}}>{tag.name}</span>)}</span> : null}<small>{item.messages?.[0]?.content || "Sem mensagens"}</small>{item.isOverdue ? <span className="conversation-overdue"><AlarmClock size={11}/> Atrasado · sem assistência</span> : null}</span>
        </button>)}
        {!conversations.length ? <div className="inbox-empty"><strong>{queueView === "mine" ? "Nenhuma conversa atribuída a você" : queueView === "team" ? "Nenhuma conversa da sua equipe" : queueView === "others" ? "Nenhuma conversa em que você foi incluído" : "Nenhuma conversa nesta fila"}</strong><p>Você só vê conversas destinadas a você, às suas equipes ou incluídas por convite. A visão ampliada continua sujeita às permissões.</p></div> : null}
      </div>
    </aside>
    <div className="inbox-thread content-card">
      {selected ? <>
        <header className="thread-heading"><button type="button" className="mobile-inbox-back" aria-label="Voltar às conversas" onClick={() => setMobileThreadOpen(false)}><ArrowLeft size={18}/><span>Conversas</span></button><ContactAvatar contact={selected.contact}/><div className="thread-contact"><h2>{selected.contact.name}</h2><p>{selected.contact.phone || "WhatsApp"}{selected.assignee ? " · " + selected.assignee.name : " · Sem responsável"} · {selected.handlingMode === "HUMAN" ? "Atendimento humano" : "Bot"}</p></div><div className="thread-actions">{!selected.assignee ? <button className="thread-action-button" onClick={() => void assumeConversation()} disabled={actionBusy || selected.status === "RESOLVED" || selected.status === "CLOSED"} title="Assumir esta conversa"><UserRound size={15} aria-hidden="true" /><span>Assumir</span></button> : null}<div className="handoff-toolbar" aria-label="Direcionamento da conversa">
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
        </div>{selected.status === "RESOLVED" ? <button className="thread-action-button" onClick={() => void setConversationStatus("OPEN")} disabled={actionBusy} title="Reabrir conversa"><RotateCcw size={15} aria-hidden="true" /><span>Reabrir</span></button> : selected.status !== "CLOSED" ? <button className="thread-action-button resolve" onClick={() => { setFinalizationOpen(true); setFinalizationOutcome(""); setFinalizationReason(""); }} disabled={actionBusy} title="Finalizar atendimento"><CheckCircle2 size={15} aria-hidden="true" /><span>Finalizar</span></button> : null}<div className="thread-rare-actions">{selected.archivedAt || selected.deletedAt ? <button type="button" className="thread-icon-action" aria-label="Restaurar" title="Restaurar" onClick={() => void api("/api/backend/conversations/" + selected.id + "/restore?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível restaurar."))}><RotateCcw size={16}/></button> : <><button type="button" className="thread-icon-action" aria-label="Arquivar" title="Arquivar" onClick={() => void api("/api/backend/conversations/" + selected.id + "/archive?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível arquivar."))}><Archive size={16}/></button><button type="button" className="thread-icon-action danger-text" aria-label="Mover para lixeira" title="Mover para lixeira" onClick={() => void api("/api/backend/conversations/" + selected.id + "/trash?view=" + queueView, { method: "POST" }).then(loadConversations).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível mover para a lixeira."))}><Trash2 size={16}/></button></>}</div></div></header>
        <div className="thread-messages">
          {messages.map((message) => <div key={message.id} className={"message-line " + (message.direction === "OUTBOUND" ? "outgoing" : "")}><div className="message-bubble"><p>{message.content || "Anexo recebido (" + message.contentType + ")"}</p><small>{new Date(message.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{message.direction === "OUTBOUND" ? " · " + (message.status === "FAILED" ? "Falhou" : message.status === "QUEUED" ? "Enviando" : message.status === "READ" ? "Lida" : message.status === "DELIVERED" ? "Entregue" : "Enviada") : ""}</small></div></div>)}
          {!messages.length ? <p className="inbox-empty">Aguardando a primeira mensagem…</p> : null}
        </div>
        <div className="composer-shell"><form className="inbox-composer" onSubmit={sendMessage}><textarea ref={composerRef} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();e.currentTarget.form?.requestSubmit()}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="e"){e.preventDefault();setEmojiOpen(v=>!v)}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="r"){e.preventDefault();setQuickOpen(v=>!v)}}} placeholder="Digite sua mensagem..." maxLength={4000} rows={3} aria-label="Mensagem"/><div className="composer-toolbar"><div className="composer-tools"><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Emojis · Ctrl+Shift+E" onClick={()=>{setEmojiOpen(v=>!v);setQuickOpen(false)}} aria-label="Emojis"><Smile size={18}/></button>{emojiOpen?<div className="composer-popover emoji-popover"><div className="composer-popover-heading"><strong>Emojis</strong><button type="button" className="composer-popover-close" onClick={()=>setEmojiOpen(false)} aria-label="Fechar emojis"><X size={15}/></button></div><input className="composer-search" value={emojiSearch} onChange={e=>setEmojiSearch(e.target.value)} placeholder="Buscar emoji ou categoria…" aria-label="Buscar emoji"/><div className="emoji-category-tabs"><button type="button" className={emojiCategory==="Todos"?"active":""} onClick={()=>setEmojiCategory("Todos")}>Todos</button>{Object.keys(emojiGroups).map(group=><button type="button" key={group} className={emojiCategory===group?"active":""} onClick={()=>setEmojiCategory(group)}>{group}</button>)}</div><div className="emoji-grid">{visibleEmojis.flatMap(([group,values])=>values.map(x=><button type="button" key={group+x} title={group} aria-label={"Inserir emoji "+x} onClick={()=>insertEmoji(x)}>{x}</button>))}</div>{!visibleEmojis.length?<small className="composer-empty-hint">Nenhum emoji encontrado. Tente outra busca.</small>:null}</div>:null}</div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Respostas rápidas · Ctrl+Shift+R" onClick={()=>{setQuickOpen(v=>!v);setEmojiOpen(false)}} aria-label="Respostas rápidas"><BookmarkPlus size={18}/></button>{quickOpen?<div className="composer-popover quick-replies-popover"><div className="composer-popover-heading"><strong>Respostas rápidas</strong><button type="button" className="composer-popover-close" onClick={()=>setQuickOpen(false)} aria-label="Fechar respostas rápidas"><X size={15}/></button></div><input className="composer-search" value={quickSearch} onChange={e=>setQuickSearch(e.target.value)} placeholder="Buscar por nome ou conteúdo…" aria-label="Buscar respostas rápidas"/>{quickReplies.filter(q=>(q.title+" "+q.content).toLocaleLowerCase("pt-BR").includes(quickSearch.toLocaleLowerCase("pt-BR"))).map(q=><div className="quick-reply-row" key={q.id}><button type="button" className="quick-reply-use" onClick={()=>{setDraft(v=>v?v+"\n"+q.content:q.content);setQuickOpen(false);setQuickSearch("");composerRef.current?.focus()}}><b>{q.title}</b><small>{q.content}</small></button><button type="button" className="quick-reply-delete" aria-label="Excluir resposta" onClick={()=>saveQuickReplies(quickReplies.filter(x=>x.id!==q.id))}><X size={14}/></button></div>)}<div className="quick-reply-create"><input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} placeholder="Nome da resposta"/><textarea rows={2} value={quickContent} onChange={e=>setQuickContent(e.target.value)} placeholder="Texto da resposta"/><button type="button" onClick={createQuickReply} disabled={!quickTitle.trim()||!quickContent.trim()}><Plus size={14}/> Criar resposta</button></div></div>:null}</div><button type="button" className={"composer-icon-button "+(listening?"recording":"")} title="Ditado por voz" aria-label="Ditado por voz" onClick={toggleVoice}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><span className="composer-shortcut-hint"><Keyboard size={13}/> Ctrl + Enter envia</span></div><span className="composer-char-count" aria-live="polite">{draft.length}/4000 · Shift+Enter quebra linha</span><button className="composer-send-button" type="submit" disabled={busy||!draft.trim()}>{busy?<RotateCcw size={16}/>:<Send size={16}/>}<span>{busy?"Enviando":"Enviar"}</span></button></div></form></div>
      </> : <div className="thread-empty"><span className="module-placeholder-icon">☏</span><p>As mensagens recebidas aparecerão aqui.</p></div>}
    </div>
    {selected ? <ContactProfilePanel contact={selected.contact} conversationId={selected.id} status={selected.status} createdAt={selected.createdAt} channel={selected.channel} /> : null}

    {finalizationOpen && selected ? <div className="finalization-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionBusy) setFinalizationOpen(false); }}><section className="finalization-dialog" role="dialog" aria-modal="true" aria-labelledby="inbox-finalization-title"><button type="button" className="finalization-close" aria-label="Fechar" disabled={actionBusy} onClick={() => setFinalizationOpen(false)}><X size={18}/></button><span className="finalization-icon"><CheckCircle2 size={22}/></span><h2 id="inbox-finalization-title">Finalizar atendimento</h2><p>Qual foi o resultado comercial de <strong>{selected.contact.name}</strong>?</p><div className="finalization-outcomes"><button type="button" className={finalizationOutcome === "WON" ? "selected won" : "won"} onClick={() => { setFinalizationOutcome("WON"); setFinalizationReason(""); }}><Check size={17}/><span><strong>Ganho</strong><small>Converter lead em cliente</small></span></button><button type="button" className={finalizationOutcome === "LOST" ? "selected lost" : "lost"} onClick={() => setFinalizationOutcome("LOST")}><X size={17}/><span><strong>Perda</strong><small>Registrar motivo da perda</small></span></button></div>{finalizationOutcome === "LOST" ? <label className="finalization-reason">Motivo da perda<select required value={finalizationReason} onChange={(event) => setFinalizationReason(event.target.value)}><option value="">Selecione o motivo…</option>{lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label> : null}<p className="finalization-note">A conversa sairá da fila de mensagens e o contato será retirado do Kanban. O histórico continuará disponível em Contatos.</p><div className="finalization-actions"><button type="button" className="secondary-button" disabled={actionBusy} onClick={() => setFinalizationOpen(false)}>Cancelar</button><button type="button" className="primary-button" disabled={!finalizationOutcome || (finalizationOutcome === "LOST" && !finalizationReason) || actionBusy} onClick={() => void confirmConversationFinalization()}>{actionBusy ? "Finalizando…" : "Confirmar finalização"}</button></div></section></div> : null}
    {error ? <div className="inbox-error" role="status"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso">×</button></div> : null}
  </section>;
}
