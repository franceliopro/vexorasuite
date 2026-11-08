"use client";
import { tagForeground } from "../lib/tag-contrast";
import { formatDateBR } from "../lib/date-format";
import dynamic from "next/dynamic";
const InboxAppointments=dynamic(()=>import("./inbox-appointments").then(m=>m.InboxAppointments));
import { contactDisplayName } from "../lib/contact-identity";
import { readTenantCache, writeTenantCache } from "../lib/tenant-cache";
import { useModalDialog } from "../lib/use-modal-dialog";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  RotateCcw,
  UserRound,
  Users,
  UserPlus,
  ChevronDown,
  ArrowRightLeft,
  Check,
  Archive,
  Clock3,
  Lock,
  Trash2,
  Smile,
  Mic,
  MicOff,
  BookmarkPlus,
  Plus,
  X,
  Send,
  Keyboard,
  ArrowLeft,
  MoreHorizontal,
  Instagram,
  Facebook,
  MessageCircle,
  Mail,
  Bot,
  BrainCircuit,
  Music2,
  AlarmClock,
  CreditCard,
  CalendarDays,
  Paperclip,
  HelpCircle,
  PanelRightClose,
  RotateCw,
  MessagesSquare,
  Maximize2,
  Minimize2,
  MoveDiagonal2,
  Sparkles,
  Wand2,
  StickyNote,
} from "lucide-react";
const InboxCopilot=dynamic(()=>import("./inbox-copilot").then(m=>m.InboxCopilot));
import { InboxInternalChat } from "./inbox-internal-chat";
import { WhatsappBridge } from "./whatsapp-bridge";
import { ContactProfilePanel } from "./contact-profile-panel";
import { emojiCatalog } from "./emoji-catalog";

type FinanceDebt={id:string;value:number;dueDate:string;status:string;description:string;invoiceUrl:string|null;bankSlipUrl:string|null};
type Channel = { id: string; name: string; provider: string; status: string; lastError?: string | null; healthCheckedAt?: string | null };
type Contact = { id: string; name: string; phone?: string | null; email?: string | null; externalId?: string | null; source?: string | null; pipelineId?:string|null; metadata?: Record<string, unknown> };
type ServiceProtocol = { code: string; conversationId: string };
type Message = { id: string; content: string; contentType: string; direction: string; status: string; occurredAt: string; senderName?:string|null; metadata?: Record<string, unknown> & {linkedConversationId?:string;departmentName?:string;linkPreview?:{url:string;title?:string;description?:string;imageUrl?:string}} };
type Assignee = { id: string; name: string; email: string };
type Department = { id: string; key: string; name: string; keywords: string[]; isActive: boolean };
type Agent = { id: string; name: string; email: string };
function messageDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}

function messageDateLabel(value: string, now = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Data desconhecida";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days > 1 && days < 7) {
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
    return weekday.charAt(0).toLocaleUpperCase("pt-BR") + weekday.slice(1);
  }
  return formatDateBR(date);
}

function MessageStatus({ message }: { message: Message }) {
  if (message.direction !== "OUTBOUND") return null;
  const status = String(message.status || "SENT").toUpperCase();
  const failed = status === "FAILED";
  const queued = status === "QUEUED";
  const read = status === "READ";
  const delivered = status === "DELIVERED" || read;
  const label = failed ? "Falhou" : queued ? "Enviando" : read ? "Lida" : delivered ? "Entregue" : "Enviada";
  const marks = failed ? "!" : queued ? "◷" : delivered ? "✓✓" : "✓";
  return <span className={"message-status " + (failed ? "failed" : read ? "read" : delivered ? "delivered" : queued ? "queued" : "sent")} aria-label={label} title={label}>{marks}<span className="sr-only"> {label}</span></span>;
}

function AudioMessage({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const bars = [18, 28, 22, 36, 48, 30, 55, 42, 64, 38, 52, 72, 46, 60, 34, 58, 78, 50, 40, 66, 32, 54, 44, 70, 36, 48, 26, 58, 42, 62, 30, 50];
  return <div className="inbox-audio-player">
    <div className="inbox-audio-waveform" aria-hidden="true">
      {bars.map((height, index) => <span key={index} className={index / bars.length <= progress ? "played" : ""} style={{ height: `${height}%` }} />)}
    </div>
    <audio ref={audioRef} className="inbox-audio-message" controls preload="metadata" src={src} aria-label="Áudio recebido" onTimeUpdate={(event) => {
      const audio = event.currentTarget;
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    }} onEnded={() => setProgress(1)} onLoadedMetadata={(event) => {
      if (event.currentTarget.currentTime === 0) setProgress(0);
    }} />
  </div>;
}

const MESSAGE_URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
function MessageText({ content, deleted }: { content: string; deleted?: boolean }) {
  const parts = content.split(MESSAGE_URL_PATTERN);
  return <p className={deleted ? "message-deleted" : undefined}>{parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <Fragment key={index}>{part}</Fragment>;
    const punctuation = part.match(/[.,!?;:)]*$/)?.[0] || "";
    const href = punctuation ? part.slice(0, -punctuation.length) : part;
    return <Fragment key={index}><a className="message-link" href={href} target="_blank" rel="noopener noreferrer">{href}</a>{punctuation}</Fragment>;
  })}</p>;
}
function LinkPreview({ preview }: { preview: NonNullable<Message["metadata"]>["linkPreview"] }) {
  if (!preview?.url) return null;
  return <a className="message-link-preview" href={preview.url} target="_blank" rel="noopener noreferrer">
    {preview.imageUrl ? <img src={preview.imageUrl} alt="" loading="lazy"/> : null}
    <span><strong>{preview.title || preview.url}</strong>{preview.description ? <small>{preview.description}</small> : null}<em>{preview.url}</em></span>
  </a>;
}

type QuickReply = { id:string; title:string; content:string; category?:string; shortcut?:string };
type QuickReplyPipeline={id:string;name:string;stages:{id:string;label?:string}[]};
type QuickReplySettings = { companyName:string; greetings:{dawn:string;morning:string;afternoon:string;evening:string}; farewells:{dawn:string;morning:string;afternoon:string;evening:string} };
const DEFAULT_QUICK_REPLY_SETTINGS: QuickReplySettings = {
  companyName: "",
  greetings: { dawn:"Olá, boa madrugada!", morning:"Bom dia!", afternoon:"Boa tarde!", evening:"Boa noite!" },
  farewells: { dawn:"Tenha uma ótima madrugada!", morning:"Tenha um ótimo dia!", afternoon:"Tenha uma ótima tarde!", evening:"Tenha uma ótima noite!" },
};
const QUICK_REPLY_VARIABLES = [
  { token:"{{novo_nome}}", label:"Nome preferido", hint:"Nome informado na triagem" },
  { token:"{{nome}}", label:"Nome do contato", hint:"Nome identificado no canal" },
  { token:"{{empresa}}", label:"Empresa", hint:"Nome configurado da empresa" },
  { token:"{{saudacao}}", label:"Saudação", hint:"Varia conforme o horário" },
  { token:"{{despedida}}", label:"Despedida", hint:"Varia conforme o horário" },
  { token:"{{atendente}}", label:"Atendente", hint:"Atendente responsável pela conversa (conhecido_por)" },
  { token:"{{time}}", label:"Time", hint:"Equipe responsável pela conversa" },
  { token:"{{equipe}}", label:"Equipe", hint:"Equipe responsável pela conversa" },
  { token:"{{telefone}}", label:"Telefone", hint:"Telefone do contato" },
  { token:"{{email}}", label:"E-mail", hint:"E-mail do contato" },
  { token:"{{origem}}", label:"Origem", hint:"Origem do contato" },
  { token:"{{pipeline}}", label:"Pipeline", hint:"Pipeline atual do contato" },
  { token:"{{etapa}}", label:"Etapa", hint:"Etapa atual do contato" },
  { token:"{{protocolo}}", label:"Protocolo", hint:"Número do atendimento" },
] as const;
function greetingPeriod(date = new Date()): "dawn"|"morning"|"afternoon"|"evening" {
  const hour = date.getHours();
  if (hour < 6) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const EMOJI_CATEGORY_LABELS: Record<string, string> = {
  "Smileys & Emotion": "Rostos",
  "People & Body": "Pessoas e gestos",
  "Animals & Nature": "Animais e natureza",
  "Food & Drink": "Comidas e bebidas",
  "Travel & Places": "Viagens e lugares",
  "Activities": "Atividades",
  "Objects": "Objetos",
  "Symbols": "Símbolos",
  "Flags": "Bandeiras",
  "Component": "Componentes",
};
const EMOJI_NAME_BY_VALUE: Record<string, string> = Object.fromEntries(emojiCatalog.map(([emoji, name]) => [emoji, name.toLocaleLowerCase("pt-BR")]));
const EMOJI_GROUPS: Record<string, string[]> = emojiCatalog.reduce((groups, [emoji, _name, category]) => {
  const label = EMOJI_CATEGORY_LABELS[category] || category;
  (groups[label] ||= []).push(emoji);
  return groups;
}, {} as Record<string, string[]>);
type Conversation = { id: string; status: string; createdAt?: string; updatedAt?: string; channel?: string; handlingMode?: "BOT" | "HUMAN"; botState?: Record<string, unknown>; isOverdue?: boolean; department?: Department | null; archivedAt?: string | null; deletedAt?: string | null; contact: Contact; assignee?: { id: string; name: string } | null; messages: Message[]; subject?: string | null; lastMessageAt?: string | null; priority?: string | null };
type SupervisionOverview = {
  slaMinutes: number;
  totals: { open: number; pending: number; waiting: number; stale: number };
  oldestWaiting: { conversationId: string; contactName: string; createdAt: string } | null;
  byDepartment: Array<{ id: string; name: string; waiting: number; open: number; stale: number }>;
  staleConversations: Array<{ id: string; contactName: string; assignee: string | null; department: string | null; updatedAt: string; status: string }>;
};
function avatarUrl(contact: Contact): string | null {
  const meta = contact.metadata || {};
  for (const key of ["avatarUrl", "profilePictureUrl", "photoUrl", "pictureUrl", "profileImage", "profilePicUrl", "profilePicture", "imageUrl", "photo", "avatar"]) {
    const value = meta[key];
    if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  }
  return null;
}
function ChannelMark({ channel, kind = "source", mode }: { channel?: string; kind?: "source" | "agent"; mode?: "BOT" | "HUMAN" }) {
  const value = (channel || "WHATSAPP").toUpperCase();
  if (kind === "agent") {
    if (mode !== "BOT") return null;
    if (!value.trim()) return null;
    const isAi = ["AI", "LLM", "OPENAI", "GPT", "IA"].some(token => value === token);
    return <span className={"channel-mark " + (isAi ? "channel-ai" : "channel-bot")} title={isAi ? "Atendimento por IA" : "Atendimento por chatbot"} aria-label={isAi ? "IA" : "Chatbot"}>{isAi ? <BrainCircuit size={12}/> : <Bot size={12}/>}</span>;
  }
  if (value.includes("EMAIL") || value.includes("E-MAIL")) return <span className="channel-mark channel-email" title="E-mail" aria-label="E-mail"><Mail size={13} strokeWidth={2.25}/></span>;
  if (value.includes("INSTAGRAM")) return <span className="channel-mark channel-instagram" title="Instagram" aria-label="Instagram"><Instagram size={13} strokeWidth={2.25}/></span>;
  if (value.includes("FACEBOOK") || value === "MESSENGER") return <span className="channel-mark channel-facebook" title="Facebook" aria-label="Facebook"><Facebook size={13} strokeWidth={2.25}/></span>;
  if (value.includes("TIKTOK")) return <span className="channel-mark channel-tiktok" title="TikTok" aria-label="TikTok"><Music2 size={13} strokeWidth={2.25}/></span>;
  if (value.includes("CHATBOT") || value.includes("WIDGET") || value.includes("WEBCHAT")) return <span className="channel-mark channel-bot" title="Chatbot do site" aria-label="Chatbot"><Bot size={13}/></span>;
  if (value.includes("AI") || value.includes("IA")) return <span className="channel-mark channel-ai" title="Inteligência artificial" aria-label="IA"><BrainCircuit size={13}/></span>;
  return <span className="channel-mark channel-whatsapp" title="WhatsApp" aria-label="WhatsApp"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#25D366" d="M12 1.5a10.5 10.5 0 0 0-9.02 15.88L1.5 22.5l5.27-1.38A10.5 10.5 0 1 0 12 1.5Z"/><path fill="white" d="M12 3.5a8.5 8.5 0 0 0-7.3 12.85l.31.5-.79 2.9 2.98-.78.48.28A8.5 8.5 0 1 0 12 3.5Z"/><path fill="#25D366" d="M9.07 7.36c-.22-.48-.44-.49-.65-.5h-.55c-.19 0-.5.07-.77.36s-1 1-1 2.4 1.03 2.76 1.17 2.95c.14.2 2 3.2 4.94 4.37 2.44.97 2.94.78 3.47.73.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.27-.19-.57-.34l-1.68-.83c-.3-.14-.52-.21-.74.12-.22.34-.85 1.03-1.04 1.25-.2.22-.38.25-.68.1-.3-.14-1.28-.47-2.43-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.46.13-.61.14-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53l-.75-1.8Z"/></svg></span>
}
function ContactAvatar({ contact, className = "conversation-avatar" }: { contact: Contact; className?: string }) {
  const proxy="/api/backend/contacts/"+contact.id+"/avatar";
  const [src,setSrc]=useState<string|null>(proxy);
  useEffect(()=>setSrc(proxy),[proxy,contact.metadata?.avatarUrl]);
  return <span className={className}>{src?<img key={src} src={src} alt={"Foto de "+contactDisplayName(contact)} loading="lazy" referrerPolicy="no-referrer" onError={()=>setSrc(current=>current===proxy?avatarUrl(contact):null)}/>:null}{!src&&<span className="avatar-fallback">{contactDisplayName(contact).slice(0,1).toUpperCase()}</span>}</span>;
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

export function InboxWorkspace({tenantId,canManageChannels=false}:{tenantId:string;canManageChannels?:boolean}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationLoadError, setConversationLoadError] = useState("");
  const [quickReplyPipelines,setQuickReplyPipelines]=useState<QuickReplyPipeline[]>([]);

  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  const [supervision, setSupervision] = useState<SupervisionOverview | null>(null);
  const [supervisionSla, setSupervisionSla] = useState(30);
  const [supervisionHidden, setSupervisionHidden] = useState(false);
  const [queueView, setQueueView] = useState("mine");
  const notificationFocus=useRef<string|null>(null),conversationRequest=useRef(0);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get("conversation");if(id&&/^[a-f0-9-]{36}$/i.test(id)){notificationFocus.current=id;setQueueView("all-open");setMobileThreadOpen(true)}},[]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [fullScreen,setFullScreen]=useState(false);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setFullScreen(false)};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const loadInitialLists = useCallback(async () => {
    setInitialListError("");
    const failures: string[] = [];
    await Promise.all([
      api<{pipelines?: QuickReplyPipeline[]}>("/api/backend/crm/pipelines").then(data => setQuickReplyPipelines(Array.isArray(data?.pipelines) ? data.pipelines : [])).catch(() => failures.push("pipelines")),
      api<Department[]>("/api/backend/departments").then(setDepartments).catch(() => failures.push("departamentos")),
      api<Agent[]>("/api/backend/conversations/assignees").then(setAgents).catch(() => failures.push("atendentes")),
    ]);
    if (failures.length) {
      setInitialListError("Não foi possível carregar: " + failures.join(", ") + ". Tente novamente.");
    }
  }, []);

  const [handoffDepartment, setHandoffDepartment] = useState("");
  const [handoffNote,setHandoffNote]=useState("");
  const [handoffPhone,setHandoffPhone]=useState("");
  const [internalOpen,setInternalOpen]=useState(false);
  const [copilotOpen,setCopilotOpen]=useState(false);
  const [copilotMessage,setCopilotMessage]=useState<Message|null>(null);
  const [internalDraft,setInternalDraft]=useState("");
  const [handoffAssignee, setHandoffAssignee] = useState("");
  const [inviteAssignee, setInviteAssignee] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serviceProtocol, setServiceProtocol] = useState<ServiceProtocol | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [contactProfileExpanded, setContactProfileExpanded] = useState(true);
  const attachmentInputRef=useRef<HTMLInputElement|null>(null);
  const [attachmentFiles,setAttachmentFiles]=useState<File[]>([]);
  const [financeRecipientConfirmed,setFinanceRecipientConfirmed]=useState(false),[debtDocument,setDebtDocument]=useState(""),[debtResult,setDebtResult]=useState<{customerName:string|null;environment:string;debts:FinanceDebt[];partial:boolean}|null>(null),[debtLoading,setDebtLoading]=useState(false),[debtSending,setDebtSending]=useState(false),[debtSelected,setDebtSelected]=useState<string[]>([]),[debtFormat,setDebtFormat]=useState("invoice");
  const [quickPanelSize,setQuickPanelSize]=useState({width:300,height:440});
  const quickResize=useRef<{x:number;y:number;width:number;height:number}|null>(null);
  const debtRequestVersion=useRef(0);
  useEffect(()=>{debtRequestVersion.current++;setDebtDocument("");setDebtResult(null);setDebtSelected([]);setFinanceRecipientConfirmed(false);setDebtLoading(false);setQuickPanel(null);},[selectedId]);
  useEffect(() => {
    let active = true;
    setServiceProtocol(null);
    if (!selectedId) return () => { active = false; };
    void api<ServiceProtocol>("/api/backend/service-protocols/conversations/" + selectedId, { method: "POST" })
      .then((protocol) => { if (active) setServiceProtocol(protocol); })
      .catch(() => { if (active) setServiceProtocol(null); });
    return () => { active = false; };
  }, [selectedId]);
  const [quickPanel,setQuickPanel]=useState<"billing"|"appointments"|"attachments"|"help"|null>(null);
  const appointmentModalRef=useRef<HTMLElement|null>(null);
  useModalDialog(quickPanel==="appointments",appointmentModalRef,()=>setQuickPanel(null));
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){setQuickPanel(null);setEmojiOpen(false);setQuickOpen(false);return;}if(!event.altKey||event.ctrlKey||event.shiftKey||event.repeat)return;const key=event.code;const panels:Record<string,"billing"|"appointments"|"attachments"|"help">={KeyF:"billing",KeyA:"appointments",KeyU:"attachments",Slash:"help"};if(key==="KeyP"){event.preventDefault();setContactProfileExpanded(v=>!v);}else if(key==="KeyE"){event.preventDefault();setEmojiTarget("composer");setEmojiOpen(v=>!v);setQuickOpen(false);setQuickPanel(null);}else if(key==="KeyR"){event.preventDefault();setQuickOpen(v=>!v);setEmojiOpen(false);setQuickPanel(null);}else if(panels[key]){event.preventDefault();setQuickPanel(v=>v===panels[key]?null:panels[key] ?? null);setEmojiOpen(false);setQuickOpen(false);}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState("");
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [aiSuggestion, setAiSuggestion] = useState<{ conversationId: string; text: string; provider?: string; model?: string } | null>(null);
  const [aiSuggestionBusy, setAiSuggestionBusy] = useState(false);
  const [aiSuggestionError, setAiSuggestionError] = useState("");
  const [attendantNotes, setAttendantNotes] = useState<Message[]>([]);
  const [attendantNote, setAttendantNote] = useState("");
  const [attendantNoteBusy, setAttendantNoteBusy] = useState(false);
  const [attendantNoteError, setAttendantNoteError] = useState("");
  const [messageMenu, setMessageMenu] = useState<{message: Message; x: number; y: number} | null>(null);
  useEffect(()=>{setInternalOpen(!!selectedId&&new URLSearchParams(window.location.search).get("internal")==="1");setInternalDraft("");setCopilotOpen(false);setCopilotMessage(null);setHandoffNote("");setHandoffPhone("");setHandoffDepartment("");setHandoffAssignee("");},[selectedId]);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!(event.target as Element)?.closest(".message-context-menu"))setMessageMenu(null)};window.addEventListener("click",close);return()=>window.removeEventListener("click",close)},[]);
  const threadScrollRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const element=threadScrollRef.current;
    if(!element)return;
    const openImage=(event:MouseEvent)=>{
      const target=(event.target as Element).closest("img.inbox-image-message") as HTMLImageElement|null;
      if(!target?.src)return;
      window.open(target.src,"_blank","noopener,noreferrer");
    };
    element.addEventListener("click",openImage);
    return()=>element.removeEventListener("click",openImage);
  },[selectedId,messages.length]);
  const threadPinnedRef=useRef(true);
  useEffect(()=>{const el=threadScrollRef.current;if(!el)return;if(threadPinnedRef.current)el.scrollTop=el.scrollHeight},[messages,selectedId]);
  useEffect(()=>{threadPinnedRef.current=true;requestAnimationFrame(()=>{const el=threadScrollRef.current;if(el)el.scrollTop=el.scrollHeight})},[selectedId]);
  const [debtLookupError,setDebtLookupError]=useState("");
  async function lookupDebts(){const digits=debtDocument.replace(/\D/g,"");if(digits.length!==11&&digits.length!==14){setDebtLookupError("Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.");return;}const version=++debtRequestVersion.current;setDebtLookupError("");setDebtLoading(true);setDebtResult(null);try{const response=await fetch("/api/backend/finance/debts?document="+encodeURIComponent(debtDocument.replace(/\D/g,"")),{cache:"no-store"});const body=await response.json();if(!response.ok)throw Error(body.message||"Falha na consulta.");if(version!==debtRequestVersion.current)return;setDebtResult(body);setDebtSelected([]);setFinanceRecipientConfirmed(false);}catch(e){if(version===debtRequestVersion.current)setDebtLookupError(e instanceof Error?e.message:"Documento não encontrado ou consulta indisponível.");}finally{if(version===debtRequestVersion.current)setDebtLoading(false);}}
  async function sendFinanceText(content:string){if(!selectedId||!selected)return;if(!financeRecipientConfirmed){setError("Confirme o destinatário antes de enviar dados financeiros.");return;}setDebtSending(true);try{await api("/api/backend/conversations/"+selectedId+"/messages?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content})});await loadMessages(selectedId);setError("");}catch(e){setError(e instanceof Error?e.message:"Falha ao enviar cobrança.");}finally{setDebtSending(false);}}
  function financeSummary(){if(!debtResult)return "";const rows=debtResult.debts;const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});const digits=debtDocument.replace(/\D/g,"");const masked=digits.length===11?digits.slice(0,3)+"."+digits.slice(3,4)+"XX.XXX-"+digits.slice(-2):digits.length===14?digits.slice(0,2)+".XXX.XXX/XXXX-"+digits.slice(-2):"Documento informado";const services=[...new Set(rows.map(d=>d.description?.trim()).filter(Boolean))].slice(0,6);const date=(s:string)=>formatDateBR(s);return "*Cobranças em aberto:*\n*Nome:* "+(debtResult.customerName||"Cliente")+"\n*Documento:* "+masked+"\n*Serviço(s):* "+(services.join("; ")||"Conforme faturas")+"\n\n"+rows.map((d,i)=>(i+1)+". | "+date(d.dueDate)+" | "+money(d.value)+" | "+(d.status==="OVERDUE"?"Vencida":"Pendente")).join("\n")+"\n\n*Total dos débitos = "+money(rows.reduce((sum,d)=>sum+d.value,0))+"*";}
  function financePayment(){if(!debtResult)return "";const debts=debtResult.debts.filter(d=>debtSelected.includes(d.id));return debts.map(d=>{const link=debtFormat==="boleto"?d.bankSlipUrl:d.invoiceUrl;return (d.description||"Cobrança")+" — "+d.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+"\n"+(link||"Forma de pagamento indisponível para esta cobrança.")}).join("\n\n");}
  const [composerHeight, setComposerHeight] = useState(0);
  const composerResizeStart = useRef<{ pointerY: number; height: number } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("Todos");
  const [emojiTarget, setEmojiTarget] = useState<"composer" | "quick-reply">("composer");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [quickActiveIndex, setQuickActiveIndex] = useState(0);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickContent, setQuickContent] = useState("");
  const [quickCategory, setQuickCategory] = useState("Geral");
  const [quickShortcut, setQuickShortcut] = useState("");
  const [quickEditingId, setQuickEditingId] = useState<string | null>(null);
  const [quickEditorOpen, setQuickEditorOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [quickReplySettings, setQuickReplySettings] = useState<QuickReplySettings>(DEFAULT_QUICK_REPLY_SETTINGS);
  const [quickSettingsSaving, setQuickSettingsSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string; mimetype: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => () => {
    recordingStreamRef.current = null;
    setListening(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, [selectedId]);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [composerTextHeight, setComposerTextHeight] = useState(34);
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "34px";
    const next = Math.max(34, Math.min(142, el.scrollHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 142 ? "auto" : "hidden";
    setComposerTextHeight(next);
    if (document.activeElement === el) el.scrollTop = el.scrollHeight;
  }, [draft]);
  const quickContentRef = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialListError, setInitialListError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [finalizationOpen, setFinalizationOpen] = useState(false);
  const [finalizationOutcome, setFinalizationOutcome] = useState<"WON" | "LOST" | "">("");
  const [finalizationReason, setFinalizationReason] = useState("");
  const finalizationRef=useRef<HTMLElement|null>(null);
  useModalDialog(finalizationOpen,finalizationRef,()=>{if(!actionBusy)setFinalizationOpen(false)});
  const lossReasons = ["Preço/Condição", "Sem interesse", "Sem retorno", "Concorrência", "Inatividade"];
  const [qr, setQr] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const messageRequest = useRef(0);
  const olderMessagesInFlight = useRef(false);


  const loadConversations = useCallback(async (showLoading = true) => {
    const request=++conversationRequest.current;
    if (showLoading) setConversationsLoading(true);
    setConversationLoadError("");
    try {
      const rows = await api<Conversation[]>("/api/backend/conversations?view=" + queueView);
      const focus=queueView==="all-open"?notificationFocus.current:null;
      if(focus&&!rows.some(row=>row.id===focus)){const focused=await api<Conversation[]>("/api/backend/conversations?view=all-open&focus="+focus);rows.unshift(...focused);}
      if(request!==conversationRequest.current)return;
      setConversations(rows);
      setConversationsLoading(false);
      setSelectedId((current) => focus&&rows.some(row=>row.id===focus)?focus:current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch (e) {
      if (request === conversationRequest.current) {
        setConversationsLoading(false);
        setConversationLoadError(e instanceof Error ? e.message : "Falha ao carregar conversas.");
      }
    }
  }, [queueView]);
  const loadQueueCounts = useCallback(async () => {
    try { setQueueCounts(await api<Record<string,number>>("/api/backend/conversations/counts")); } catch { /* Preserve last known counts when a refresh fails. */ }
  }, []);
  const loadChannels = useCallback(async () => {
    try { setChannels(await api<Channel[]>("/api/backend/channels")); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar canais."); }
  }, []);
  const loadSupervision = useCallback(async (sla = supervisionSla) => {
    try {
      const data = await api<Partial<SupervisionOverview>>("/api/backend/supervision/overview?slaMinutes=" + encodeURIComponent(String(sla)));
      if (
        data &&
        typeof data.slaMinutes === "number" &&
        data.totals &&
        typeof data.totals.waiting === "number" &&
        typeof data.totals.open === "number" &&
        typeof data.totals.pending === "number" &&
        typeof data.totals.stale === "number"
      ) {
        setSupervision(data as SupervisionOverview);
      }
    } catch {
      // Supervisão é restrita a administradores; agentes seguem sem chamada ou aviso extra.
    }
  }, [supervisionSla]);
  useEffect(() => {
    void api<{ slaMinutes: number }>("/api/backend/supervision/settings").then((settings) => {
      const sla = Number(settings.slaMinutes);
      if (Number.isInteger(sla) && sla >= 1 && sla <= 1440) {
        setSupervisionSla(sla);
        void loadSupervision(sla);
      }
    }).catch(() => {});
  }, [loadSupervision]);
  const loadMessages = useCallback(async (id: string, showLoading = true) => {
    const request = ++messageRequest.current;
    if (showLoading) setMessagesLoading(true);
    setMessageLoadError("");
    try {
      const rows = await api<Message[]>("/api/backend/conversations/" + id + "/messages?view=" + queueView + "&limit=100");
      if (request !== messageRequest.current || selectedRef.current !== id) return;
      setMessages(rows);
      setHasOlderMessages(rows.length === 100);
    } catch (e) {
      if (request === messageRequest.current && selectedRef.current === id) setMessageLoadError(e instanceof Error ? e.message : "Falha ao carregar mensagens.");
    } finally {
      if (request === messageRequest.current) setMessagesLoading(false);
    }
  }, [queueView]);

  const loadAttendantNotes = useCallback(async (id: string) => {
    try {
      const rows = await api<Message[]>("/api/backend/conversations/" + id + "/internal-notes?view=" + queueView);
      if (selectedRef.current === id) setAttendantNotes(rows);
    } catch {
      if (selectedRef.current === id) setAttendantNotes([]);
    }
  }, [queueView]);

  useEffect(() => {
    setAiSuggestion(null);
    setAiSuggestionError("");
    setAiSuggestionBusy(false);
    setAttendantNotes([]);
    setAttendantNote("");
    setAttendantNoteError("");
    setAttendantNoteBusy(false);
    if (selectedId) void loadAttendantNotes(selectedId);
  }, [selectedId, loadAttendantNotes]);

  async function requestAiSuggestion(mode: "suggest" | "improve" = "suggest") {
    if (!selectedId || aiSuggestionBusy) return;
    if (mode === "improve" && !draft.trim()) {
      setAiSuggestionError("Escreva um rascunho para a assistente reescrever.");
      return;
    }
    setAiSuggestionBusy(true);
    setAiSuggestionError("");
    try {
      const result = await api<{ text: string; provider?: string; model?: string }>(
        "/api/backend/conversations/" + selectedId + "/copilot",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: mode, text: mode === "improve" ? draft : undefined, tone: "cordial" }),
        },
      );
      setAiSuggestion({ conversationId: selectedId, text: result.text, provider: result.provider, model: result.model });
    } catch (e) {
      setAiSuggestionError(e instanceof Error ? e.message : "A assistente não conseguiu sugerir uma resposta agora.");
    } finally {
      setAiSuggestionBusy(false);
    }
  }

  function handleNoteSubmit(event?: any) { if (event && typeof event.preventDefault === "function") event.preventDefault(); return saveAttendantNote(); }
  async function saveAttendantNote() {
    if (!selectedId || attendantNoteBusy) return;
    const content = attendantNote.trim();
    if (!content) return;
    setAttendantNoteBusy(true);
    setAttendantNoteError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/internal-notes?view=" + queueView, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setAttendantNote("");
      await loadAttendantNotes(selectedId);
      await loadMessages(selectedId);
    } catch (e) {
      setAttendantNoteError(e instanceof Error ? e.message : "Não foi possível salvar a anotação interna.");
    } finally {
      setAttendantNoteBusy(false);
    }
  }

  const loadOlderMessages = useCallback(async () => {
    if (olderMessagesInFlight.current || !selectedId || !messages.length || !hasOlderMessages) return;
    olderMessagesInFlight.current = true;
    setOlderMessagesLoading(true);
    const id = selectedId;
    const request = messageRequest.current;
    const thread = threadScrollRef.current;
    const previousHeight = thread?.scrollHeight || 0;
    const previousTop = thread?.scrollTop || 0;
    try {
      const oldest = messages[0]!;
      const older = await api<Message[]>(
        "/api/backend/conversations/" + id + "/messages?view=" + queueView + "&limit=100&before=" + encodeURIComponent(oldest.id),
      );
      if (request !== messageRequest.current || selectedRef.current !== id) return;
      setMessages((current) => [...older, ...current]);
      setHasOlderMessages(older.length === 100);
      requestAnimationFrame(() => {
        if (thread) thread.scrollTop = thread.scrollHeight - previousHeight + previousTop;
      });
    } catch (e) {
      if (request === messageRequest.current && selectedRef.current === id) setError(e instanceof Error ? e.message : "Falha ao carregar mensagens anteriores.");
    } finally {
      olderMessagesInFlight.current = false;
      setOlderMessagesLoading(false);
    }
  }, [hasOlderMessages, messages, queueView, selectedId]);

  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => {
    if (selectedId && notificationFocus.current === selectedId) notificationFocus.current = null;
  }, [selectedId]);
  useEffect(() => {
    let active = true;
    void Promise.all([api<QuickReply[]>("/api/backend/conversations/quick-replies"), api<Partial<QuickReplySettings>>("/api/backend/conversations/quick-reply-settings")])
      .then(([items, settings]) => { if (active) { setQuickReplies(items); setQuickReplySettings({ ...DEFAULT_QUICK_REPLY_SETTINGS, ...settings, greetings: { ...DEFAULT_QUICK_REPLY_SETTINGS.greetings, ...(settings.greetings || {}) }, farewells: { ...DEFAULT_QUICK_REPLY_SETTINGS.farewells, ...(settings.farewells || {}) } }); } })
      .catch(() => {
        // Keep the last local catalog available if the API is temporarily offline.
        try { const saved = readTenantCache<QuickReply[]>(tenantId,"quick-replies"); if (active && Array.isArray(saved)) setQuickReplies(saved); } catch {}
      });
    return () => { active = false; };
  }, []);

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
  // Popovers opened from toolbar icons behave like native app sheets: tap outside or Escape closes them.
  useEffect(() => {
    if (!quickOpen && !emojiOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".composer-tool-wrap")) return;
      setQuickOpen(false);
      setEmojiOpen(false);
      setQuickSettingsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickOpen(false);
        setEmojiOpen(false);
        setQuickSettingsOpen(false);
      }
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [quickOpen, emojiOpen]);
  useEffect(() => { void loadConversations(); void loadQueueCounts(); void loadChannels(); void loadSupervision(); void loadInitialLists();
  }, [loadConversations, loadQueueCounts, loadChannels, loadSupervision, loadInitialLists]);
  useEffect(() => {
    messageRequest.current += 1;
    olderMessagesInFlight.current = false;
    setOlderMessagesLoading(false);
    setMessages([]);
    setHasOlderMessages(false);
    setMessageLoadError("");
    if (selectedId) void loadMessages(selectedId);
    else { setMessages([]); setMessagesLoading(false); }
  }, [selectedId, loadMessages]);

  // SSE is the primary realtime path. Poll only while it is unavailable, when the tab is visible.
  useEffect(() => {
    let realtimeOnline = false;
    const refreshFallback = () => {
      if (realtimeOnline || document.visibilityState !== "visible") return;
      void loadConversations(false); void loadQueueCounts(); void loadChannels(); void loadSupervision();
      if (selectedRef.current) void loadMessages(selectedRef.current, false);
    };
    const markOnline = () => { realtimeOnline = true; };
    const markOffline = () => { realtimeOnline = false; };
    const onVisibility = () => { if (document.visibilityState === "visible") refreshFallback(); };
    window.addEventListener("vexora:events-online", markOnline);
    window.addEventListener("vexora:events-offline", markOffline);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(refreshFallback, 15000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("vexora:events-online", markOnline);
      window.removeEventListener("vexora:events-offline", markOffline);
    };
  }, [loadConversations, loadQueueCounts, loadMessages, loadChannels, loadSupervision]);
  useEffect(() => {
    const source = new EventSource("/api/backend/events");
    let refreshTimer: number | null = null;
    let refreshInFlight = false;
    const refreshNow = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      void Promise.all([
        loadConversations(false),
        loadQueueCounts(),
        loadChannels(),
        loadSupervision(),
        selectedRef.current ? loadMessages(selectedRef.current, false) : Promise.resolve(),
      ]).finally(() => { refreshInFlight = false; });
    };
    // A busy tenant can emit several related events for one user action. Coalesce them so
    // one burst results in one refresh instead of multiplying reads against the rate limit.
    const refresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshNow();
      }, 250);
    };
    source.onopen = () => window.dispatchEvent(new Event("vexora:events-online"));
    source.onerror = () => window.dispatchEvent(new Event("vexora:events-offline"));
    ["message.received", "message.sent", "message.failed", "message.status", "message.queued", "message.deleted", "conversation.updated", "conversation.assigned", "conversation.created", "contact.updated", "contact.created", "contact.stage_changed", "channel.status", "channel.created"].forEach((name) => source.addEventListener(name, refresh));
    source.addEventListener("team.updated",()=>{void api<Agent[]>("/api/backend/conversations/assignees").then(setAgents).catch(()=>{});refresh();});
    // EventSource owns reconnection. The offline event only enables the existing polling
    // fallback; no manual reconnect loop is created here.
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [loadConversations, loadQueueCounts, loadMessages, loadChannels, loadSupervision]);
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

  async function deleteMessage(message: Message, scope: "ME" | "ALL") {
    if (!selectedId) return;
    setMessageMenu(null);
    const confirmation = scope === "ALL"
      ? "Excluir esta mensagem para todos? Ela será substituída por “Mensagem apagada”."
      : "Excluir esta mensagem somente para você?";
    if (!window.confirm(confirmation)) return;
    setBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/messages/" + message.id + "/delete?view=" + queueView, {
        method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({scope}),
      });
      await loadMessages(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir a mensagem.");
    } finally { setBusy(false); }
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
    if (!selectedId || actionBusy) return;
    setActionBusy(true);setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/handoff?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(handoffDepartment ? { departmentId: handoffDepartment } : {}), ...(handoffAssignee ? { assigneeId: handoffAssignee } : {}), note:handoffNote }) });
      await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível transferir para o atendimento humano."); }
    finally {setActionBusy(false);}
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


  function saveQuickReplies(next: QuickReply[]) {
    setQuickReplies(next);
    try { writeTenantCache(tenantId,"quick-replies",next); } catch {}
    void api("/api/backend/conversations/quick-replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: next }) })
      .catch((e) => setError(e instanceof Error ? "As respostas foram alteradas nesta tela, mas não puderam ser compartilhadas: " + e.message : "Não foi possível compartilhar as respostas rápidas."));
  }
  function editQuickReply(item: QuickReply) {
    setQuickEditingId(item.id); setQuickTitle(item.title); setQuickContent(item.content); setQuickCategory(item.category || "Geral"); setQuickShortcut(item.shortcut || ""); setQuickEditorOpen(true); setQuickSettingsOpen(false);
  }
  function resetQuickEditor() {
    setQuickEditingId(null); setQuickTitle(""); setQuickContent(""); setQuickCategory("Geral"); setQuickShortcut(""); setQuickEditorOpen(false);
  }
  function createQuickReply() {
    if (!quickTitle.trim() || !quickContent.trim()) return;
    const shortcut = quickShortcut.trim().replace(/^\/+/, "");
    if (shortcut && quickReplies.some(item => item.id !== quickEditingId && (item.shortcut || "").toLocaleLowerCase("pt-BR") === shortcut.toLocaleLowerCase("pt-BR"))) {
      setError("Esse atalho já está sendo usado por outra resposta rápida.");
      return;
    }
    const item = { id:quickEditingId || crypto.randomUUID(), title:quickTitle.trim(), content:quickContent.trim(), category:quickCategory.trim() || "Geral", ...(shortcut ? { shortcut } : {}) };
    saveQuickReplies(quickEditingId ? quickReplies.map(existing => existing.id === quickEditingId ? item : existing) : [...quickReplies,item]);
    resetQuickEditor();
  }
  function insertQuickToken(token: string) {
    const el = quickContentRef.current;
    const start = el?.selectionStart ?? quickContent.length;
    const end = el?.selectionEnd ?? quickContent.length;
    const next = quickContent.slice(0, start) + token + quickContent.slice(end);
    setQuickContent(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  }
  async function saveQuickReplySettings() {
    setQuickSettingsSaving(true);
    try {
      const saved = await api<QuickReplySettings>("/api/backend/conversations/quick-reply-settings", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({settings:quickReplySettings})
      });
      setQuickReplySettings({ ...DEFAULT_QUICK_REPLY_SETTINGS, ...saved, greetings:{...DEFAULT_QUICK_REPLY_SETTINGS.greetings,...saved.greetings}, farewells:{...DEFAULT_QUICK_REPLY_SETTINGS.farewells,...saved.farewells} });
      setQuickSettingsOpen(false);
    } catch (e) { setError(e instanceof Error ? "Não foi possível salvar as frases da empresa: " + e.message : "Não foi possível salvar as frases da empresa."); }
    finally { setQuickSettingsSaving(false); }
  }
  function quickReplyVariableCatalog() {
    const metadata=selected?.contact.metadata||{};
    const state=selected?.botState&&typeof selected.botState==="object"?selected.botState as Record<string,unknown>:{};
    const custom=metadata.customFields&&typeof metadata.customFields==="object"&&!Array.isArray(metadata.customFields)?metadata.customFields as Record<string,unknown>:{};
    const dynamic={...custom,...(state.variables&&typeof state.variables==="object"?state.variables as Record<string,unknown>:{})};
    const keys=Object.keys(dynamic).map(key=>/^[\p{L}_][\p{L}\p{N}_.-]{0,39}$/u.test(key)?key:key.trim().replace(/[^\p{L}\p{N}_-]+/gu,"_").replace(/^([^\p{L}_])/u,"_$1").slice(0,40)).filter(Boolean);
    return [...QUICK_REPLY_VARIABLES,...keys.filter(key=>!QUICK_REPLY_VARIABLES.some(v=>v.token==="{{"+key+"}}")).map(key=>({token:"{{"+key+"}}",label:key,hint:"Campo disponível neste contato ou fluxo"}))];
  }
  function resolveQuickReply(content: string) {
    const period=greetingPeriod();
    const metadata=selected?.contact.metadata||{};
    const customFields=metadata.customFields&&typeof metadata.customFields==="object"&&!Array.isArray(metadata.customFields)?metadata.customFields as Record<string,unknown>:{};
    const state=selected?.botState&&typeof selected.botState==="object"?selected.botState as Record<string,unknown>:{};
    const flowVariables=state.variables&&typeof state.variables==="object"?state.variables as Record<string,unknown>:{};
    const preferred=selected?contactDisplayName(selected.contact,selected.botState):"";
    const name=selected?.contact.name?.trim()||"";
    const getText=(...keys:string[])=>{
      for(const key of keys){
        const match=Object.entries(metadata).find(([candidate])=>candidate.toLocaleLowerCase("pt-BR").replace(/[\s_.-]/g,"")===key.toLocaleLowerCase("pt-BR").replace(/[\s_.-]/g,""));
        if(typeof match?.[1]==="string"&&(match[1] as string).trim())return (match[1] as string).trim();
      }
      return "";
    };
    const attendant=selected?.assignee?.name||"";
    const team=selected?.department?.name?.trim()||getText("team","teamName","equipe","nome_equipe","departmentName")||"";
    const periodGreeting=quickReplySettings.greetings[period]||DEFAULT_QUICK_REPLY_SETTINGS.greetings[period];
    const periodFarewell=quickReplySettings.farewells[period]||DEFAULT_QUICK_REPLY_SETTINGS.farewells[period];
    const crmPipeline=quickReplyPipelines.find(p=>p.id===selected?.contact.pipelineId);
    const stageId=getText("crmStage","stage");
    const stageLabel=crmPipeline?.stages.find(stage=>stage.id===stageId)?.label||stageId;
    const context:Record<string,string>={
      ...Object.fromEntries(Object.entries(metadata).filter(([,v])=>typeof v==="string") as [string,string][]),
      ...Object.fromEntries(Object.entries(customFields).filter(([,v])=>typeof v==="string") as [string,string][]),
      ...Object.fromEntries(Object.entries(flowVariables).filter(([,v])=>typeof v==="string") as [string,string][]),
      telefone:selected?.contact.phone||"",email:selected?.contact.email||"",origem:selected?.contact.source||getText("source","origem"),pipeline:crmPipeline?.name||getText("pipelineName","pipeline"),
      etapa:stageLabel,atendente:attendant,time:team,equipe:team,team,empresa:quickReplySettings.companyName.trim()||"nossa equipe",
      nome:name,novo_nome:typeof preferred==="string"&&preferred.trim()?preferred.trim():name,saudacao:periodGreeting,despedida:periodFarewell
    };
    const valueFor=(name:string)=>{
      if(typeof context[name]==="string")return context[name]!;
      const normalized=name.toLocaleLowerCase("pt-BR").replace(/[\s_.-]/g,"");
      const match=Object.entries(context).find(([key])=>key.toLocaleLowerCase("pt-BR").replace(/[\s_.-]/g,"")===normalized);
      return match?.[1]||"";
    };
    return content.replace(/\{\{([^{}]+)\}\}/g,(_,key:string)=>valueFor(key.trim()));
  }

  function insertEmoji(value:string) {
    const isQuickReply = emojiTarget === "quick-reply";
    const el = isQuickReply ? quickContentRef.current : composerRef.current;
    const currentText = isQuickReply ? quickContent : draft;
    const start = el?.selectionStart ?? currentText.length;
    const end = el?.selectionEnd ?? currentText.length;
    const nextText = currentText.slice(0, start) + value + currentText.slice(end);
    if (isQuickReply) setQuickContent(nextText); else setDraft(nextText);
    setEmojiOpen(false); setEmojiSearch("");
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + value.length, start + value.length); });
  }
  const emojiGroups = EMOJI_GROUPS;
  const visibleEmojis = Object.entries(emojiGroups).filter(([group,values]) =>
    (emojiCategory === "Todos" || emojiCategory === group) &&
    (!emojiSearch.trim() || group.toLocaleLowerCase("pt-BR").includes(emojiSearch.toLocaleLowerCase("pt-BR")) ||
      values.some(v => v.includes(emojiSearch.trim()) || (EMOJI_NAME_BY_VALUE[v] || "").includes(emojiSearch.trim().toLocaleLowerCase("pt-BR"))))
  );
  function clearRecordedAudio() {
    if (recordedAudio) URL.revokeObjectURL(recordedAudio.url);
    setRecordedAudio(null);
  }
  async function sendRecordedBlob(blob: Blob) {
    if (!selectedId || busy) return;
    setBusy(true); setError("");
    try {
      const mimetype = blob.type || "audio/webm";
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "audio", filename: "audio-vexora." + (mimetype.includes("ogg") ? "ogg" : "webm"), mimetype, data: await fileBase64(blob) }) });
      await loadMessages(selectedId); await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o áudio."); }
    finally { setBusy(false); }
  }
  function toggleVoice() {
    if (listening) {
      recorderRef.current?.stop(); setListening(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("A gravação de áudio não está disponível neste navegador."); return;
    }
    void navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      recordingStreamRef.current = stream;
      const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (recordingStreamRef.current === stream && blob.size) void sendRecordedBlob(blob);
        if (recordingStreamRef.current === stream) recordingStreamRef.current = null;
      };
      recorder.onerror = () => { stream.getTracks().forEach(track => track.stop()); recordingStreamRef.current = null; setListening(false); setError("Não foi possível concluir a gravação."); };
      recorderRef.current = recorder; recorder.start(); setListening(true);
    }).catch(() => setError("Permita o acesso ao microfone para gravar um áudio."));
  }

  function fileKind(file: File): "image"|"video"|"audio"|"file" {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "file";
  }
  async function fileBase64(file: Blob): Promise<string> {
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return btoa(binary);
  }
  async function sendAttachmentFiles() {
    if (!selectedId || !attachmentFiles.length || busy) return;
    setBusy(true); setError("");
    try {
      for (const file of attachmentFiles) {
        await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: fileKind(file), filename: file.name, mimetype: file.type || "application/octet-stream", data: await fileBase64(file) }) });
      }
      setAttachmentFiles([]); setQuickPanel(null);
      await loadMessages(selectedId); await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar os anexos."); } finally { setBusy(false); }
  }
  async function sendCurrentLocation() {
    if (!selectedId || busy) return;
    if (!navigator.geolocation) { setError("Este dispositivo não disponibilizou a localização."); return; }
    setBusy(true); setError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "location", latitude: position.coords.latitude, longitude: position.coords.longitude, title: "Minha localização" }) });
      setQuickPanel(null); await loadMessages(selectedId); await loadConversations();
    } catch (e) { setError(e instanceof Error ? "Não foi possível obter a localização." : "Não foi possível enviar a localização."); } finally { setBusy(false); }
  }
  async function sendCurrentContact() {
    if (!selectedId || !selected?.contact || busy) return;
    const contact = selected.contact;
    const phone = contact.phone || "";
    if (!phone) { setError("Este contato não possui telefone para compartilhar."); return; }
    const vcard = ["BEGIN:VCARD","VERSION:3.0","FN:" + (contact.name || phone),"TEL;TYPE=CELL:" + phone,"EMAIL:" + (contact.email || ""),"END:VCARD"].join("\
");
    setBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "contact", contactName: contact.name || phone, vcard }) });
      setQuickPanel(null); await loadMessages(selectedId); await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o contato."); } finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || busy || (!draft.trim() && !recordedAudio)) return;
    setBusy(true); setError("");
    try {
      const body = recordedAudio
        ? { kind: "audio", filename: "audio-vexora." + (recordedAudio.mimetype.includes("ogg") ? "ogg" : "webm"), mimetype: recordedAudio.mimetype, data: await fileBase64(recordedAudio.blob) }
        : { content: draft.trim() };
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setDraft("");
      clearRecordedAudio();
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
  const filteredQuickReplies = quickReplies.filter(q => (q.title + " " + q.content + " " + (q.category || "") + " " + (q.shortcut || "")).toLocaleLowerCase("pt-BR").includes(quickSearch.toLocaleLowerCase("pt-BR")));
  function applyQuickReply(item: QuickReply) {
    const content = resolveQuickReply(item.content);
    setDraft(value => value ? value + "\n" + content : content);
    setQuickOpen(false); setQuickSearch(""); setQuickActiveIndex(0);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  function conversationStatusLine(conversation: Conversation): string {
    if (conversation.status === "RESOLVED" || conversation.status === "CLOSED") return "Finalizada";
    const age = Math.max(0, Date.now() - new Date(conversation.createdAt || conversation.updatedAt || Date.now()).getTime());
    const minutes = Math.floor(age / 60000);
    const time = minutes < 1 ? "agora" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h`;
    if (conversation.handlingMode === "BOT") return `A assistente respondeu há ${time}`;
    if (!conversation.assignee) return `Aguardando você há ${time}`;
    return `Em atendimento com ${conversation.assignee.name}`;
  }
  function conversationStatusTone(conversation: Conversation): string {
    if (conversation.status === "RESOLVED" || conversation.status === "CLOSED") return "is-done";
    if (conversation.handlingMode === "BOT") return "is-bot";
    if (!conversation.assignee) return "is-waiting";
    return "is-live";
  }
  function conversationStatusPill(conversation: Conversation): string {
    if (conversation.status === "RESOLVED" || conversation.status === "CLOSED") return "Finalizada";
    if (conversation.status === "PENDING") return "Pendente";
    if (conversation.handlingMode === "BOT") return "IA";
    if (!conversation.assignee) return "Novo";
    return "Em atendimento";
  }
  function presenceTone(conversation: Conversation): string | null {
    if (conversation.isOverdue) return "conversation-presence presence-dot-coral";
    const age = conversation.updatedAt || conversation.createdAt ? Date.now() - new Date((conversation.updatedAt || conversation.createdAt) as string).getTime() : Number.POSITIVE_INFINITY;
    const minutes = age / 60000;
    if (minutes <= 5) return "conversation-presence";
    if (minutes <= 20) return "conversation-presence presence-dot-amber";
    return null;
  }
  function lastInboundContent(): string {
    const last = messages.filter((message) => message.direction === "INBOUND").slice(-1)[0];
    const text = last?.content?.trim() || "Sem mensagens ainda";
    return text.length > 90 ? text.slice(0, 88) + "…" : text;
  }
  return <section className={"inbox-workspace " + (fullScreen ? "inbox-full-screen " : "") + (mobileThreadOpen ? "mobile-thread-open" : "")}>
    <aside className="inbox-list content-card">
      <div className="inbox-panel-heading"><h2>Conversas</h2><button className="text-button" title="Atualizar" aria-label="Atualizar conversas" onClick={() => { void loadConversations(); void loadChannels(); }}><RotateCw size={15} aria-hidden="true" /></button></div>
      {supervision ? <section className="supervision-summary" aria-label="Supervisão operacional">
        <div className="supervision-metrics">
          <span><strong>{supervision.totals.waiting}</strong><small>Aguardando</small></span>
          <span><strong>{supervision.totals.open}</strong><small>Abertas</small></span>
          <span><strong>{supervision.totals.pending}</strong><small>Pausadas</small></span>
          <span className={supervision.totals.stale ? "is-alert" : ""}><strong>{supervision.totals.stale}</strong><small>Fora do SLA</small></span>
        </div>
      </section> : null}
      {conversationLoadError ? <div className="inbox-list-error" role="alert"><strong>Não foi possível atualizar as conversas.</strong><span>{conversationLoadError}</span><button type="button" onClick={() => void loadConversations()}>Tentar novamente</button></div> : null}
      <nav className="inbox-queues" aria-label="Filas de atendimento">
        {([{ id: "new", label: "Todas" }, { id: "mine", label: "Novas" }, { id: "team", label: "Minhas" }, { id: "others", label: "Equipe" }, { id: "all-open", label: "Outras" }] as const).map((item) => <button key={item.id} type="button" className={"inbox-queue-button " + (queueView === item.id ? "active" : "")} aria-current={queueView === item.id ? "page" : undefined} aria-pressed={queueView === item.id} onClick={() => { setQueueView(item.id); setMobileThreadOpen(false); }}><span>{item.label}</span>{item.id !== "others" ? <span className="inbox-queue-count">{queueCounts[item.id] ?? 0}</span> : null}</button>)}
      </nav>
      <div className="inbox-conversation-list">
        {conversations.map((item) => <button key={item.id} className={"inbox-conversation " + (selectedId === item.id ? "selected" : "")} onClick={() => { notificationFocus.current=null;setSelectedId(item.id); setMobileThreadOpen(true); }}>
          <span className="conversation-avatar-wrap"><ContactAvatar contact={item.contact}/>{presenceTone(item) ? <span className={presenceTone(item) as string} aria-hidden="true" /> : null}</span><span className="conversation-summary"><span className="conversation-title-row"><strong>{contactDisplayName(item.contact,item.botState)}</strong><span className="conversation-channel-marks"><ChannelMark channel={item.channel || item.contact.source || "WHATSAPP"}/><ChannelMark kind="agent" mode={item.handlingMode} channel={String(item.botState?.mode || item.botState?.provider || (item.handlingMode === "BOT" ? "BOT" : ""))}/></span></span><small>{item.messages?.[0]?.content || "Sem mensagens"}</small>{contactLabels(item.contact).length ? <span className="conversation-tags">{contactLabels(item.contact).map((tag,index)=><span key={tag.name+index} className="conversation-tag" style={{backgroundColor:tag.color,color:tagForeground(tag.color),borderColor:"color-mix(in srgb, "+tag.color+" 82%, #334155)"}}>{tag.name}</span>)}</span> : null}{item.isOverdue ? <span className="conversation-overdue"><AlarmClock size={11}/> Atrasado · sem assistência</span> : null}</span>
        </button>)}
        {conversationsLoading && conversations.length === 0 ? <div className="inbox-empty" role="status"><strong>Carregando conversas…</strong><p>Buscando as conversas desta fila.</p></div> : null}
        {!conversationsLoading && !conversations.length ? <div className="inbox-empty"><strong>{queueView === "mine" ? "Nenhuma conversa atribuída a você" : queueView === "team" ? "Nenhuma conversa da sua equipe" : queueView === "others" ? "Nenhuma conversa em que você foi incluído" : "Nenhuma conversa nesta fila"}</strong><p>Você só vê conversas destinadas a você, às suas equipes ou incluídas por convite. A visão ampliada continua sujeita às permissões.</p></div> : null}
      </div>
    </aside>
    <div className="inbox-thread content-card">
      {selected ? <>
        {copilotOpen&&<InboxCopilot key={selected.id+":"+(copilotMessage?.id||"draft")} conversationId={selected.id} view={queueView} draft={draft} message={copilotMessage?{id:copilotMessage.id,content:copilotMessage.content}:undefined} onUse={setDraft} onClose={()=>{setCopilotOpen(false);setCopilotMessage(null);}} onNote={()=>{void loadMessages(selected.id);}} onSend={async text=>{await api("/api/backend/conversations/"+selected.id+"/messages?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:text})});setDraft("");await loadMessages(selected.id);await loadConversations();}}/>}
                <header className="thread-heading"><ContactAvatar contact={selected.contact} className="thread-contact-avatar"/><div className="thread-contact"><h2 title={selected.contact.name}>{contactDisplayName(selected.contact,selected.botState)}</h2><p className="thread-contact-status"><span className={"status-dot " + conversationStatusTone(selected)} aria-hidden="true" />{conversationStatusLine(selected)}</p><div className="thread-protocol-row"><small className="thread-protocol" title="Protocolo do atendimento">Protocolo {serviceProtocol ? serviceProtocol.code : "—"}</small><details className="thread-status-pill"><summary>{conversationStatusPill(selected)}<ChevronDown size={13} aria-hidden="true" /></summary><div className="thread-status-pill-menu">{!selected.assignee ? <button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void assumeConversation();}}><UserPlus size={13} aria-hidden="true" /> Assumir esta conversa</button> : null}<button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void setConversationStatus("PENDING");}}><Clock3 size={13} aria-hidden="true" /> Pendente</button><button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void setConversationStatus("RESOLVED");}}><CheckCircle2 size={13} aria-hidden="true" /> Resolvida</button></div></details></div></div><div className="thread-header-actions">{selected.handlingMode === "HUMAN" ? <button type="button" aria-label="Devolver ao chatbot" className="thread-icon-action" onClick={() => void returnToBot()} disabled={actionBusy || selected.status === "RESOLVED" || selected.status === "CLOSED"} title="Devolver ao chatbot"><Bot size={15} aria-hidden="true" /></button> : null}<details className="handoff-menu">
            <summary className="handoff-invite-trigger handoff-direct-trigger thread-transfer-button" aria-label="Direcionar conversa" title="Direcionar conversa"><ArrowRightLeft size={14} aria-hidden="true" /><span>Transferir</span></summary>
            <div className="handoff-popover">
              <div className="handoff-popover-heading"><div><strong>Para quem vai?</strong><small>Escolha a equipe ou uma pessoa</small></div><span className="handoff-popover-mark"><Users size={17}/></span></div>
              <div className="handoff-section-label">EQUIPES</div>
              <button type="button" className={"handoff-option " + (!handoffDepartment && !handoffAssignee ? "selected" : "")} onClick={()=>{setHandoffDepartment("");setHandoffAssignee("");}}><span className="handoff-option-icon"><Users size={15}/></span><span className="handoff-option-copy"><strong>Fila geral</strong></span>{!handoffDepartment&&!handoffAssignee?<Check size={15}/>:null}</button>
              {departments.filter(d=>d.isActive).map(d=><button type="button" key={d.id} className={"handoff-option "+(handoffDepartment===d.id?"selected":"")} onClick={()=>setHandoffDepartment(d.id)}><span className="handoff-option-icon"><Users size={15}/></span><span className="handoff-option-copy"><strong>{d.name}</strong></span>{handoffDepartment===d.id?<Check size={15}/>:null}</button>)}
              <div className="handoff-section-label">ATENDENTE ESPECÍFICO</div>
              <button type="button" className={"handoff-option "+(!handoffAssignee?"selected":"")} onClick={()=>setHandoffAssignee("")}><span className="handoff-option-icon"><UserRound size={15}/></span><span className="handoff-option-copy"><strong>Sem atendente específico</strong></span>{!handoffAssignee?<Check size={15}/>:null}</button>
              {agents.map(a=><button type="button" key={a.id} className={"handoff-option "+(handoffAssignee===a.id?"selected":"")} onClick={()=>setHandoffAssignee(a.id)}><span className="handoff-avatar">{a.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span className="handoff-option-copy"><strong>{a.name}</strong></span>{handoffAssignee===a.id?<Check size={15}/>:null}</button>)}
              <div className="handoff-context"><label>WhatsApp do setor · opcional<input value={handoffPhone} maxLength={24} onChange={e=>setHandoffPhone(e.target.value)} placeholder="Código do país, DDD e número"/></label><button type="button" className="text-button" disabled={!/^\d{10,15}$/.test(handoffPhone.replace(/\D/g,""))} onClick={e=>{const phone=handoffPhone.replace(/\D/g,"");const name=departments.find(d=>d.id===handoffDepartment)?.name||"setor responsável";setDraft("Você pode continuar com "+name+" pelo WhatsApp: +"+phone+"\nhttps://wa.me/"+phone);e.currentTarget.closest("details")?.removeAttribute("open");composerRef.current?.focus();}}>Preparar contato para o cliente</button><small>Revise e envie a mensagem ao cliente antes de transferir. O contexto abaixo fica somente com a equipe.</small></div>
              <label className="handoff-context">Contexto para quem recebe<textarea rows={3} maxLength={4000} value={handoffNote} onChange={e=>setHandoffNote(e.target.value)} placeholder="Informações importantes para o próximo atendente ou setor…"/><small>Nota interna. Não será enviada ao cliente.</small></label>
              <div className="handoff-popover-footer"><span>Destino: <b>{handoffDepartment?departments.find(d=>d.id===handoffDepartment)?.name:"Fila geral"}{handoffAssignee?" · "+agents.find(a=>a.id===handoffAssignee)?.name:""}</b></span><button type="button" className="handoff-confirm" disabled={actionBusy} onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void handoffToHuman();}}><ArrowRightLeft size={14}/> Transferir</button></div>
            </div>
          </details><button type="button" aria-label="Finalizar atendimento" className="thread-action-button thread-finalize-button" onClick={() => { setFinalizationOpen(true); setFinalizationOutcome(""); setFinalizationReason(""); }} disabled={actionBusy} title="Finalizar atendimento"><CheckCircle2 size={14} aria-hidden="true" /><span>Finalizar</span></button><details className="thread-rare-actions"><summary className="thread-icon-action" aria-label="Mais ações" title="Mais ações"><MoreHorizontal size={16} aria-hidden="true" /></summary><div className="thread-rare-menu"><details className="rare-invite"><summary className="handoff-invite-trigger" aria-label="Convidar atendente" title="Convidar atendente"><UserPlus size={14} aria-hidden="true" /> Convidar atendente</summary><div className="thread-rare-submenu">{agents.map(a=><div key={a.id} className="invite-option"><span className="handoff-avatar">{a.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span className="handoff-option-copy"><strong>{a.name}</strong><small>{a.email}</small></span><button type="button" aria-label={"Convidar "+a.name} title={"Convidar "+a.name} className="invite-person-button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");setInviteAssignee(a.id);void api("/api/backend/conversations/"+selected.id+"/invite?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({userId:a.id})}).then(()=>{setInviteAssignee("");return loadConversations();}).catch(e=>setError(e instanceof Error?e.message:"Não foi possível convidar o atendente."));}}><UserPlus size={14}/></button></div>)}{!agents.length?<p className="handoff-empty">Nenhum atendente disponível.</p>:null}</div></details>{selected.archivedAt || selected.deletedAt ? <button type="button" onClick={() => void api("/api/backend/conversations/" + selected.id + "/restore?view=" + queueView, { method: "POST" }).then(() => loadConversations()).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível restaurar."))}><RotateCcw size={14} aria-hidden="true" /> Restaurar</button> : <><button type="button" onClick={() => void api("/api/backend/conversations/" + selected.id + "/archive?view=" + queueView, { method: "POST" }).then(() => loadConversations()).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível arquivar."))}><Archive size={14} aria-hidden="true" /> Arquivar</button><button type="button" className="danger" onClick={() => void api("/api/backend/conversations/" + selected.id + "/trash?view=" + queueView, { method: "POST" }).then(() => loadConversations()).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível mover para a lixeira."))}><Trash2 size={14} aria-hidden="true" /> Lixeira</button></>}</div></details></div></header>{copilotOpen&&<InboxCopilot key={selected.id+":"+(copilotMessage?.id||"draft")} conversationId={selected.id} view={queueView} draft={draft} message={copilotMessage?{id:copilotMessage.id,content:copilotMessage.content}:undefined} onUse={setDraft} onClose={()=>{setCopilotOpen(false);setCopilotMessage(null);}} onNote={()=>{void loadMessages(selected.id);}} onSend={async text=>{await api("/api/backend/conversations/"+selected.id+"/messages?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:text})});setDraft("");await loadMessages(selected.id);await loadConversations();}}/>}
        
        {selected.channel!=='WHATSAPP'&&<WhatsappBridge conversationId={selected.id} view={queueView} onOpen={id=>{notificationFocus.current=id;setQueueView('all-open');setSelectedId(id);void loadConversations();setMobileThreadOpen(true)}}/>}
        {channels.filter(c=>c.provider==='WAHA'&&(c.status!=='CONNECTED'||!c.healthCheckedAt||Date.now()-Date.parse(c.healthCheckedAt)>90000)).map(c=><div className="channel-health-warning" role="alert" key={c.id}><strong>{c.name}: {c.status==='CONNECTED'?'verificação desatualizada':c.status==='UNKNOWN'?'conexão não verificada':'WhatsApp desconectado ou aguardando conexão'}</strong><span>{c.lastError||'Mensagens podem não ser recebidas nem respondidas.'} Última verificação: {c.healthCheckedAt?new Date(c.healthCheckedAt).toLocaleTimeString('pt-BR'):'ainda não realizada'}.</span><a href="/?module=Canais%20e%20integra%C3%A7%C3%B5es">Ver conexões</a></div>)}<div className="inbox-assume-wrap">{selected.handlingMode === "HUMAN" && !selected.assignee && selected.status === "OPEN" ? <><section className="inbox-assume-banner" aria-label="Conversa na fila de novas"><span className="inbox-assume-icon" aria-hidden="true"><UserRound size={19} /></span><div className="inbox-assume-text"><strong>Esta conversa está na fila de novas.</strong><span>Assuma para responder em nome da equipe.</span></div><button type="button" className="primary-button inbox-assume-button" onClick={() => void assumeConversation()} disabled={actionBusy}>Assumir conversa</button></section><dl className="inbox-assume-meta"><div><dt>Motivo</dt><dd>{selected.subject?.trim() || "Atendimento novo"}</dd></div><div><dt>Contexto</dt><dd title={lastInboundContent()}>{lastInboundContent()}</dd></div><div><dt>Próximo passo</dt><dd>Assumir e responder</dd></div></dl></> : null}</div><div className="thread-messages" ref={threadScrollRef} onScroll={e=>{const el=e.currentTarget;threadPinnedRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<110}}>
          {hasOlderMessages&&<button type="button" className="text-button load-older-messages" disabled={olderMessagesLoading} onClick={()=>void loadOlderMessages()}>{olderMessagesLoading ? "Carregando mensagens anteriores…" : "Carregar mensagens anteriores"}</button>}
          {messages.map((message, index) => {
            const showDateSeparator = index === 0 || messageDateKey(messages[index - 1]!.occurredAt) !== messageDateKey(message.occurredAt);
            const hasMedia = message.metadata?.hasMedia === true || typeof message.metadata?.mediaUrl === "string";
            const mediaUrl = selected && hasMedia && ["audio", "image", "video", "file"].includes(message.contentType)
              ? "/api/backend/conversations/" + selected.id + "/messages/" + message.id + "/media?view=" + encodeURIComponent(queueView)
              : "";
            return <Fragment key={message.id}>{showDateSeparator&&<div className="message-date-separator" role="separator" aria-label={messageDateLabel(message.occurredAt)}><span>{messageDateLabel(message.occurredAt)}</span></div>}{message.direction === "INTERNAL" ? <div className="internal-note-line"><div className="internal-note-card"><header className="internal-note-head"><span className="internal-note-icon" aria-hidden="true">{message.metadata?.kind === "handoff_context" || message.senderName === "Contexto do atendimento" ? <Sparkles size={12}/> : <StickyNote size={12}/>}</span><strong className="internal-note-title">{message.metadata?.kind === "handoff_context" || message.senderName === "Contexto do atendimento" ? "Contexto do atendimento" : "Nota privada de " + (message.senderName || "Equipe")}</strong><small className="internal-note-badge">Só a equipe vê</small><time className="internal-note-time">{new Date(message.occurredAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time></header><div className="internal-note-body"><MessageText content={message.content || "Anexo recebido (" + message.contentType + ")"} deleted={message.metadata?.deleted===true}/></div>{message.metadata?.linkedConversationId&&/^[a-f0-9-]{36}$/i.test(message.metadata.linkedConversationId) ? <div className="internal-note-linked"><button type="button" className="text-button" onClick={() => { const linked = message.metadata!.linkedConversationId!; notificationFocus.current = linked; setQueueView("all-open"); setSelectedId(linked); void loadConversations(); setMobileThreadOpen(true); }}>Abrir conversa vinculada</button></div> : null}{message.metadata?.kind === "handoff_context" && !selected.assignee && (selected.status === "OPEN" || selected.status === "PENDING") ? <div className="internal-note-cta"><button type="button" className="primary-button internal-note-assume" onClick={() => void assumeConversation()} disabled={actionBusy}>{actionBusy ? "Assumindo…" : "Assumir conversa"}</button></div> : null}</div></div> : <div className={"message-line " + (message.direction === "OUTBOUND" ? "outgoing" : "")}><div className="message-bubble" onContextMenu={event=>{event.preventDefault();setMessageMenu({message,x:Math.min(event.clientX,window.innerWidth-220),y:Math.min(event.clientY,window.innerHeight-130)})}}>{message.direction==="OUTBOUND"&&message.senderName&&<strong className="attendant-identity">{message.senderName}{message.metadata?.departmentName?" · "+message.metadata.departmentName:""}</strong>}{message.direction==="INTERNAL"&&<strong className="internal-note-label">Interno · {message.senderName||"Equipe"}{message.metadata?.departmentName?" · "+message.metadata.departmentName:""} · não enviado ao cliente</strong>}{mediaUrl ? (message.contentType==="audio" ? <AudioMessage src={mediaUrl}/> : message.contentType==="image" ? <img className="inbox-image-message" src={mediaUrl} alt={typeof message.metadata?.filename==="string" ? message.metadata.filename : "Imagem recebida"} loading="lazy"/> : message.contentType==="video" ? <video className="inbox-video-message" controls preload="metadata" src={mediaUrl} aria-label="Vídeo recebido"/> : <a className="inbox-file-message" href={mediaUrl} target="_blank" rel="noreferrer"><Paperclip size={15}/>{typeof message.metadata?.filename==="string" ? message.metadata.filename : "Abrir arquivo"}</a>) : <>{message.metadata?.linkPreview ? <LinkPreview preview={message.metadata.linkPreview}/> : null}<MessageText content={message.content || "Anexo recebido (" + message.contentType + ")"} deleted={message.metadata?.deleted===true}/></>}{message.direction==='INTERNAL'&&message.metadata?.linkedConversationId&&/^[a-f0-9-]{36}$/i.test(message.metadata.linkedConversationId)&&<button type="button" className="text-button" onClick={()=>{const id=message.metadata!.linkedConversationId!;notificationFocus.current=id;setQueueView('all-open');setSelectedId(id);void loadConversations();setMobileThreadOpen(true)}}>Abrir conversa vinculada</button>}<small><span>{new Date(message.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><MessageStatus message={message}/></small>{messageMenu?.message.id===message.id&&<div className="message-context-menu" style={{left:messageMenu.x,top:messageMenu.y}} role="menu" onClick={event=>event.stopPropagation()}><button type="button" onClick={()=>void deleteMessage(message,"ME")}>Excluir para mim</button>{message.direction==="OUTBOUND"&&<button type="button" onClick={()=>void deleteMessage(message,"ALL")}>Excluir para todos</button>}</div>}{message.direction==="OUTBOUND"&&(message.metadata&&(message.metadata as Record<string,unknown>).engine===true||message.metadata&&(message.metadata as Record<string,unknown>).bot===true||message.senderName==="Véxora Intelligence Engine"||message.senderName==="Assistente virtual")?<span className="ai-message-foot"><Sparkles size={11} aria-hidden="true" /><em>{message.senderName||"Véxora Intelligence Engine"} · IA</em><span>{new Date(message.occurredAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span><MessageStatus message={message}/></span>:null}</div></div>}</Fragment>;
          })}
          {messagesLoading ? <p className="inbox-empty" role="status">Carregando mensagens…</p> : null}
          {!messagesLoading && messageLoadError ? <div className="inbox-list-error" role="alert"><strong>Não foi possível carregar as mensagens.</strong><span>{messageLoadError}</span><button type="button" onClick={() => selectedId && void loadMessages(selectedId)}>Tentar novamente</button></div> : null}
          {!messagesLoading && !messageLoadError && !messages.length ? <p className="inbox-empty">Aguardando a primeira mensagem…</p> : null}
        </div>
        {quickPanel?<div className="inbox-quick-overlay"><section ref={quickPanel==="appointments"?appointmentModalRef:undefined} tabIndex={-1} className="inbox-quick-dialog" style={quickPanel==="appointments"?{width:"min(760px, calc(100vw - 24px))",height:"min(720px, calc(100dvh - 100px))"}:{width:quickPanelSize.width,height:quickPanelSize.height}} role={quickPanel==="appointments"?"dialog":"region"} aria-modal={quickPanel==="appointments"?true:undefined} aria-label="Ações rápidas"><header><strong>{quickPanel==="billing"?"Cobranças · "+contactDisplayName(selected.contact,selected.botState):quickPanel==="appointments"?"Agendamentos":quickPanel==="attachments"?"Anexos":"Atalhos de teclado"}</strong><button type="button" aria-label="Fechar" title="Fechar · Esc" onClick={()=>setQuickPanel(null)}><X size={17}/></button></header>{quickPanel==="billing"?<div><p className="inbox-finance-intro">Consulte os débitos e envie ao cliente sem sair da conversa.</p><div className="inbox-finance-lookup"><input aria-label="CPF ou CNPJ do cliente" maxLength={18} autoComplete="off" inputMode="numeric" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void lookupDebts()}}} placeholder="CPF ou CNPJ" value={debtDocument} onChange={e=>{debtRequestVersion.current++;setDebtDocument(e.target.value);setDebtLookupError("");setDebtResult(null);setDebtSelected([]);setFinanceRecipientConfirmed(false);setDebtLoading(false)}}/><button type="button" className="secondary-button" disabled={debtLoading||debtDocument.replace(/\D/g,"").length<11} onClick={()=>void lookupDebts()}>{debtLoading?"Consultando…":"Consultar"}</button></div>{debtLookupError?<p role="alert" className="inbox-finance-field-error">{debtLookupError}</p>:null}{debtResult?<><div className="inbox-finance-client"><strong>{debtResult.customerName||"Cliente"}</strong><small>{debtResult.environment} · {debtResult.debts.length} débitos{debtResult.partial?" · consulta parcial":""}</small></div><div className="inbox-finance-select-all"><label><input type="checkbox" checked={debtResult.debts.length>0&&debtSelected.length===debtResult.debts.length} onChange={e=>setDebtSelected(e.target.checked?debtResult.debts.map(d=>d.id):[])}/> Selecionar todos os débitos</label><span>{debtSelected.length} de {debtResult.debts.length} selecionados</span></div><div className="inbox-finance-debts">{debtResult.debts.map(d=><label key={d.id}><input type="checkbox" checked={debtSelected.includes(d.id)} onChange={e=>setDebtSelected(v=>e.target.checked?[...v,d.id]:v.filter(id=>id!==d.id))}/><span>{d.description||"Cobrança"} · {/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)?d.dueDate.slice(8,10)+"/"+d.dueDate.slice(5,7)+"/"+d.dueDate.slice(0,4):d.dueDate}<small>{d.status==="OVERDUE"?"Vencida":"Pendente"}</small></span><strong>{d.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></label>)}</div>{debtResult.debts.length?<><div className="inbox-finance-total"><span>Total em aberto</span><strong>{debtResult.debts.reduce((a,d)=>a+d.value,0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div><label className="inbox-finance-confirm"><input type="checkbox" checked={financeRecipientConfirmed} onChange={e=>setFinanceRecipientConfirmed(e.target.checked)}/> Confirmei que esta conversa pertence ao destinatário correto.</label><button type="button" className="primary-button" disabled={!financeRecipientConfirmed||debtSending||debtResult.partial} onClick={()=>void sendFinanceText(financeSummary())}>Enviar lista de débitos</button></>:<p>Nenhuma cobrança pendente encontrada.</p>}<label>Forma de pagamento<select value={debtFormat} onChange={e=>setDebtFormat(e.target.value)}><option value="invoice">Fatura completa (link)</option><option value="boleto">Boleto completo (link)</option></select></label><button type="button" className="secondary-button" disabled={!financeRecipientConfirmed||debtSending||!debtSelected.length||debtResult.partial||debtResult.debts.filter(d=>debtSelected.includes(d.id)).some(d=>!(debtFormat==="boleto"?d.bankSlipUrl:d.invoiceUrl))} onClick={()=>void sendFinanceText(financePayment())}>Enviar cobrança selecionada</button><small>Pix copia e cola e linha digitável exigem consulta específica ao Asaas e serão adicionados depois.</small></>:null}</div>:quickPanel==="appointments"?<InboxAppointments key={selected.id} contact={{...selected.contact,name:contactDisplayName(selected.contact,selected.botState)}} onConfirm={text=>{setDraft(current=>current.trim()?current+"\n\n"+text:text);setQuickPanel(null);composerRef.current?.focus();}}/>:quickPanel==="attachments"?<div><p>Envie arquivos, localização ou um contato para esta conversa.</p>{attachmentFiles.length?<div className="inbox-attachment-list">{attachmentFiles.map((file,index)=><div key={index}><span>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</span><button type="button" onClick={()=>setAttachmentFiles(v=>v.filter((_,i)=>i!==index))} aria-label={"Remover "+file.name}><X size={14}/></button></div>)}</div>:<p className="inbox-quick-warning">Escolha um ou mais arquivos no clipe para preparar o envio.</p>}<div className="inbox-attachment-actions"><button type="button" className="primary-button" disabled={busy||!attachmentFiles.length} onClick={()=>void sendAttachmentFiles()}>Enviar arquivos</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void sendCurrentLocation()}>Enviar localização</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>void sendCurrentContact()}>Enviar contato</button></div></div>:<div className="inbox-shortcut-list">{[["Alt+M","Menu lateral"],["Alt+P","Ficha do contato"],["Alt+F","Cobranças"],["Alt+A","Agendamentos"],["Alt+U","Anexos"],["Alt+E","Emojis"],["Alt+R","Respostas rápidas"],["Alt+/","Esta lista"],["Esc","Fechar janela"]].map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div>}<button type="button" className="inbox-quick-resize" style={{display:quickPanel==="appointments"?"none":undefined}} aria-label="Redimensionar janela de ações rápidas" title="Arraste para ajustar largura e altura; use as setas com foco" onPointerDown={e=>{quickResize.current={x:e.clientX,y:e.clientY,width:quickPanelSize.width,height:quickPanelSize.height};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const r=quickResize.current;if(!r)return;setQuickPanelSize({width:Math.max(Math.min(260,window.innerWidth-36),Math.min(window.innerWidth-36,r.width+r.x-e.clientX)),height:Math.max(240,Math.min(window.innerHeight-100,r.height+e.clientY-r.y))})}} onPointerUp={()=>{quickResize.current=null}} onPointerCancel={()=>{quickResize.current=null}} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();setQuickPanelSize(v=>({width:Math.max(260,Math.min(window.innerWidth-36,v.width+(e.key==="ArrowLeft"?20:e.key==="ArrowRight"?-20:0))),height:Math.max(240,Math.min(window.innerHeight-100,v.height+(e.key==="ArrowDown"?20:e.key==="ArrowUp"?-20:0)))}))}}}><MoveDiagonal2 size={14} aria-hidden="true" /></button></section></div>:null}
        <div hidden={!internalOpen}><InboxInternalChat key={selected.id} open={internalOpen} conversationId={selected.id} view={queueView} attendants={agents} draft={internalDraft} onDraftChange={setInternalDraft} onClose={()=>setInternalOpen(false)} onSent={()=>{void loadMessages(selected.id);}}/></div>
        <input ref={attachmentInputRef} type="file" accept="image/*,video/mp4,video/3gpp,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" multiple style={{display:"none"}} onChange={e=>{const files=Array.from(e.target.files||[]);const valid=files.filter(file=>file.size<=16*1024*1024);setAttachmentFiles(valid);if(valid.length!==files.length)setError("Alguns arquivos excedem o limite provisório de 16 MB e não foram selecionados.");if(valid.length)setQuickPanel("attachments");e.currentTarget.value="";}}/><div className="composer-shell" style={composerHeight ? { height: `${composerHeight}px` } : undefined}><div className="composer-resize-handle" role="separator" aria-orientation="horizontal" aria-label="Ajustar altura da área de mensagem" tabIndex={0} title="Arraste para ajustar a altura da área de mensagem" onPointerDown={event=>{const shell=event.currentTarget.parentElement;if(!shell)return;composerResizeStart.current={pointerY:event.clientY,height:shell.getBoundingClientRect().height};event.currentTarget.setPointerCapture(event.pointerId);setComposerHeight(shell.getBoundingClientRect().height)}} onPointerMove={event=>{const start=composerResizeStart.current;if(!start||!(event.buttons&1))return;setComposerHeight(Math.max(58,Math.min(280,start.height+start.pointerY-event.clientY)))}} onPointerUp={()=>{composerResizeStart.current=null}} onPointerCancel={()=>{composerResizeStart.current=null}} onKeyDown={event=>{if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();const current=event.currentTarget.parentElement?.getBoundingClientRect().height??58;setComposerHeight(Math.max(58,Math.min(280,(composerHeight||current)+(event.key==="ArrowUp"?16:-16))))}}}><span /></div>{quickReplies.length ? <div className="composer-chips" aria-label="Respostas rápidas">{quickReplies.slice(0, 3).map((item) => <button key={item.id} type="button" className="composer-chip" title={item.content} onClick={() => applyQuickReply(item)}>{item.title}</button>)}</div> : null}
<form className={"inbox-composer" + (composerTab === "note" ? " composer-is-note" : "")} onSubmit={composerTab === "note" ? handleNoteSubmit : sendMessage}><div className="composer-tabs" role="tablist" aria-label="Modo do compositor"><button type="button" role="tab" aria-selected={composerTab === "reply"} className={composerTab === "reply" ? "active" : ""} onClick={() => setComposerTab("reply")}><MessageCircle size={14} aria-hidden="true" /> Responder</button><button type="button" role="tab" aria-selected={composerTab === "note"} className={composerTab === "note" ? "active" : ""} onClick={() => setComposerTab("note")}><Lock size={13} aria-hidden="true" /> Nota privada</button></div><div className="composer-toolbar"><div className="composer-tools"><div className="composer-tool-wrap"><button type="button" className={"composer-icon-button "+(internalOpen?"active":"")} aria-label="Chat interno" aria-expanded={internalOpen} title="Chat interno · digite ##" onClick={()=>setInternalOpen(v=>!v)}><MessageCircle size={18}/></button></div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Atalhos · Alt+/" aria-label="Ver atalhos · Alt+/" onClick={()=>setQuickPanel(v=>v==="help"?null:"help")}><HelpCircle size={17}/></button></div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Cobranças · Alt+F" aria-label="Cobranças · Alt+F" onClick={()=>setQuickPanel(v=>v==="billing"?null:"billing")}><CreditCard size={18}/></button></div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Agendamentos · Alt+A" aria-label="Agendamentos · Alt+A" onClick={()=>setQuickPanel(v=>v==="appointments"?null:"appointments")}><CalendarDays size={18}/></button></div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Anexos · Alt+U" aria-label="Anexos · Alt+U" onClick={()=>attachmentInputRef.current?.click()}><Paperclip size={18}/></button></div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Emojis · Alt+E" onClick={()=>{setEmojiTarget("composer");setEmojiOpen(v=>!v);setQuickOpen(false)}} aria-label="Emojis"><Smile size={18}/></button>{emojiOpen?<div className="composer-popover emoji-popover"><div className="composer-popover-heading"><strong>Emojis</strong><button type="button" className="composer-popover-close" onClick={()=>setEmojiOpen(false)} aria-label="Fechar emojis"><X size={15}/></button></div><input className="composer-search" value={emojiSearch} onChange={e=>setEmojiSearch(e.target.value)} placeholder="Buscar emoji ou categoria…" aria-label="Buscar emoji"/><div className="emoji-category-tabs"><button type="button" className={emojiCategory==="Todos"?"active":""} onClick={()=>setEmojiCategory("Todos")}>Todos</button>{Object.keys(emojiGroups).map(group=><button type="button" key={group} className={emojiCategory===group?"active":""} onClick={()=>setEmojiCategory(group)}>{group}</button>)}</div><div className="emoji-grid">{visibleEmojis.flatMap(([group,values])=>values.map(x=><button type="button" key={group+x} title={EMOJI_NAME_BY_VALUE[x] || group} aria-label={"Inserir emoji "+(EMOJI_NAME_BY_VALUE[x] || x)} onClick={()=>insertEmoji(x)}>{x}</button>))}</div>{!visibleEmojis.length?<small className="composer-empty-hint">Nenhum emoji encontrado. Tente outra busca.</small>:null}</div>:null}</div><div className="composer-tool-wrap"><button type="button" className="composer-icon-button" title="Respostas rápidas · Alt+R" onClick={()=>{setQuickOpen(v=>!v);setQuickActiveIndex(0);setEmojiOpen(false)}} aria-label="Respostas rápidas"><BookmarkPlus size={18}/></button>{quickOpen?<div className="composer-popover quick-replies-popover"><div className="composer-popover-heading"><strong>Respostas rápidas</strong><div className="quick-reply-heading-actions"><button type="button" className="quick-reply-settings-toggle" onClick={()=>{resetQuickEditor();setQuickEditorOpen(true);setQuickSettingsOpen(false)}}><Plus size={13}/> Nova</button><button type="button" className="quick-reply-settings-toggle" onClick={()=>setQuickSettingsOpen(v=>!v)}>{quickSettingsOpen?"Voltar":"Configurar frases"}</button><button type="button" className="composer-popover-close" onClick={()=>setQuickOpen(false)} aria-label="Fechar respostas rápidas"><X size={15}/></button></div></div>{quickSettingsOpen ? <div className="quick-reply-settings"><label>Nome da empresa<input value={quickReplySettings.companyName} onChange={e=>setQuickReplySettings(v=>({...v,companyName:e.target.value}))} placeholder="Nome usado em {{empresa}}"/></label><strong>Saudações por horário</strong>{([{key:"dawn",label:"Madrugada"},{key:"morning",label:"Manhã"},{key:"afternoon",label:"Tarde"},{key:"evening",label:"Noite"}] as const).map(period=><label key={"g-"+period.key}>{period.label}<input value={quickReplySettings.greetings[period.key]} onChange={e=>setQuickReplySettings(v=>({...v,greetings:{...v.greetings,[period.key]:e.target.value}}))}/></label>)}<strong>Despedidas por horário</strong>{([{key:"dawn",label:"Madrugada"},{key:"morning",label:"Manhã"},{key:"afternoon",label:"Tarde"},{key:"evening",label:"Noite"}] as const).map(period=><label key={"f-"+period.key}>{period.label}<input value={quickReplySettings.farewells[period.key]} onChange={e=>setQuickReplySettings(v=>({...v,farewells:{...v.farewells,[period.key]:e.target.value}}))}/></label>)}<button type="button" onClick={()=>void saveQuickReplySettings()} disabled={quickSettingsSaving}>{quickSettingsSaving?"Salvando…":"Salvar frases da empresa"}</button></div> : <><input className="composer-search" value={quickSearch} onChange={e=>setQuickSearch(e.target.value)} placeholder="Buscar por nome, categoria, atalho ou conteúdo…" aria-label="Buscar respostas rápidas"/>{filteredQuickReplies.map((q,index)=><div className="quick-reply-row" key={q.id}><button type="button" className={"quick-reply-use "+(quickActiveIndex===index?"active":"")} onClick={()=>applyQuickReply(q)}><b>{q.title}</b><small>{q.category || "Geral"}{q.shortcut ? " · /"+q.shortcut : ""}</small><small>{resolveQuickReply(q.content)}</small></button><button type="button" className="quick-reply-edit" aria-label={"Editar "+q.title} title="Editar resposta" onClick={()=>editQuickReply(q)}><Keyboard size={14}/></button><button type="button" className="quick-reply-delete" aria-label="Excluir resposta" onClick={()=>saveQuickReplies(quickReplies.filter(x=>x.id!==q.id))}><X size={14}/></button></div>)}{quickEditorOpen ? <div className="quick-reply-create"><div className="quick-reply-editor-heading"><strong>{quickEditingId?"Editar resposta rápida":"Nova resposta rápida"}</strong><button type="button" onClick={resetQuickEditor} aria-label="Fechar editor"><X size={15}/></button></div><input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} placeholder="Nome da resposta"/><div className="quick-reply-meta-fields"><input value={quickCategory} onChange={e=>setQuickCategory(e.target.value)} placeholder="Categoria (ex.: Cobrança)"/><input value={quickShortcut} onChange={e=>setQuickShortcut(e.target.value.replace(/\s/g,""))} placeholder="Atalho opcional (ex.: oi)"/></div><textarea ref={quickContentRef} rows={3} value={quickContent} onChange={e=>setQuickContent(e.target.value)} placeholder="Texto da resposta. Use as variáveis abaixo…"/><div className="quick-reply-variables"><strong>Inserir variável no cursor</strong><div>{quickReplyVariableCatalog().map(variable=><button type="button" key={variable.token} title={variable.hint} onClick={()=>insertQuickToken(variable.token)}>{variable.token}</button>)}</div></div><div className="quick-reply-preview"><strong>Prévia</strong><p>{resolveQuickReply(quickContent || "Olá, {{novo_nome}}! {{saudacao}} {{despedida}}")}</p></div><button type="button" className="quick-reply-emoji-trigger" title="Inserir emoji no texto da resposta" onClick={()=>{setEmojiTarget("quick-reply");setEmojiOpen(true);}}><Smile size={14}/> Inserir emoji</button><button type="button" onClick={createQuickReply} disabled={!quickTitle.trim()||!quickContent.trim()}><Plus size={14}/> {quickEditingId?"Salvar alterações":"Criar resposta"}</button></div> : null}</> }</div>:null}</div><textarea ref={composerRef} style={{ height: `${composerTextHeight}px`, minHeight: "34px", maxHeight: "74px" }} value={composerTab === "note" ? attendantNote : draft} onChange={e=>{if(composerTab === "note"){setAttendantNote(e.target.value);return;} if(e.target.value.startsWith("##")){setInternalDraft(e.target.value.slice(2).trimStart());setDraft("");setInternalOpen(true);}else setDraft(e.target.value);}} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==="/"&&(e.currentTarget.selectionStart===0||/\s/.test(e.currentTarget.value[e.currentTarget.selectionStart-1]||" "))){e.preventDefault();setQuickSearch("");setQuickActiveIndex(0);setQuickOpen(true);setEmojiOpen(false)}if(quickOpen&&e.key==="ArrowDown"){e.preventDefault();setQuickActiveIndex(i=>Math.min(i+1,Math.max(0,filteredQuickReplies.length-1)))}if(quickOpen&&e.key==="ArrowUp"){e.preventDefault();setQuickActiveIndex(i=>Math.max(0,i-1))}if(quickOpen&&e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const item=filteredQuickReplies[Math.min(quickActiveIndex,filteredQuickReplies.length-1)];if(item)applyQuickReply(item)}else if(e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();e.currentTarget.form?.requestSubmit()}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="e"){e.preventDefault();setEmojiOpen(v=>!v)}if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="r"){e.preventDefault();setQuickOpen(v=>!v)}}} placeholder={composerTab === "note" ? "Escreva sua anotação privada…" : "Digite sua mensagem..."} maxLength={4000} rows={1} aria-label={composerTab === "note" ? "Anotação privada" : "Mensagem"}/>{composerTab !== "note" ? <button type="button" className={"composer-icon-button "+(listening?"recording":"")} title={listening ? "Parar gravação" : "Gravar áudio"} aria-label={listening ? "Parar gravação" : "Gravar áudio"} onClick={toggleVoice}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button> : null}{composerTab !== "note" ? <button className="composer-send-button" type="submit" aria-label={busy ? "Enviando mensagem" : "Enviar mensagem"} disabled={busy||!draft.trim()}>{busy?<RotateCcw size={16}/>:<Send size={16}/>}<span>{busy?"Enviando":"Enviar"}</span></button> : <button className="composer-send-button composer-note-send" type="submit" aria-label="Salvar anotação" disabled={attendantNoteBusy||!attendantNote.trim()}>{attendantNoteBusy?<RotateCcw size={16}/>:<Check size={16}/>}<span>{attendantNoteBusy?"Salvando":"Salvar nota"}</span></button>}</div></div></form></div>
      </> : <div className="thread-empty"><span className="module-placeholder-icon"><MessagesSquare size={22} aria-hidden="true" /></span><p>As mensagens recebidas aparecerão aqui.</p></div>}
    </div>
    {selected ? <ContactProfilePanel contact={selected.contact} conversationId={selected.id} status={selected.status} createdAt={selected.createdAt} displayName={contactDisplayName(selected.contact,selected.botState)} channel={selected.channel} expanded={contactProfileExpanded} onExpandedChange={setContactProfileExpanded} aiSuggestion={aiSuggestion && aiSuggestion.conversationId === selected.id ? aiSuggestion : null} aiSuggestionBusy={aiSuggestionBusy} aiSuggestionError={aiSuggestionError} onRequestAiSuggestion={requestAiSuggestion} onUseAiSuggestion={setDraft} /> : null}

    {finalizationOpen && selected ? <div className="finalization-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionBusy) setFinalizationOpen(false); }}><section ref={finalizationRef} tabIndex={-1} className="finalization-dialog" role="dialog" aria-modal="true" aria-labelledby="inbox-finalization-title"><button type="button" className="finalization-close" aria-label="Fechar" disabled={actionBusy} onClick={() => setFinalizationOpen(false)}><X size={18}/></button><span className="finalization-icon"><CheckCircle2 size={22}/></span><h2 id="inbox-finalization-title">Finalizar atendimento</h2><p>Qual foi o resultado comercial de <strong>{selected.contact.name}</strong>?</p><div className="finalization-outcomes"><button type="button" className={finalizationOutcome === "WON" ? "selected won" : "won"} onClick={() => { setFinalizationOutcome("WON"); setFinalizationReason(""); }}><Check size={17}/><span><strong>Ganho</strong><small>Converter lead em cliente</small></span></button><button type="button" className={finalizationOutcome === "LOST" ? "selected lost" : "lost"} onClick={() => setFinalizationOutcome("LOST")}><X size={17}/><span><strong>Perda</strong><small>Registrar motivo da perda</small></span></button></div>{finalizationOutcome === "LOST" ? <label className="finalization-reason">Motivo da perda<select required value={finalizationReason} onChange={(event) => setFinalizationReason(event.target.value)}><option value="">Selecione o motivo…</option>{lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label> : null}<p className="finalization-note">A conversa sairá da fila de mensagens e o contato será retirado do Kanban. O histórico continuará disponível em Contatos.</p><div className="finalization-actions"><button type="button" className="secondary-button" disabled={actionBusy} onClick={() => setFinalizationOpen(false)}>Cancelar</button><button type="button" className="primary-button" disabled={!finalizationOutcome || (finalizationOutcome === "LOST" && !finalizationReason) || actionBusy} onClick={() => void confirmConversationFinalization()}>{actionBusy ? "Finalizando…" : "Confirmar finalização"}</button></div></section></div> : null}
    {initialListError ? <div className="inbox-error" role="alert" aria-live="assertive"><span>{initialListError}</span><button type="button" onClick={() => void loadInitialLists()}>Tentar novamente</button><button type="button" onClick={() => setInitialListError("")} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button></div> : null}{error ? <div className="inbox-error" role="alert" aria-live="assertive"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button></div> : null}
  </section>;
}

