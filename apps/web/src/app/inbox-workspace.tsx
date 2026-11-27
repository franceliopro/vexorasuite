"use client";
import { InboxTrack } from "./inbox-track";
import { InboxSupportContext, InboxSupportQueue } from "./inbox-support";
import { formatDateBR } from "../lib/date-format";
import dynamic from "next/dynamic";
const InboxAppointments=dynamic(()=>import("./inbox-appointments").then(m=>m.InboxAppointments));
import { contactDisplayName } from "../lib/contact-identity";
import { readTenantCache, writeTenantCache } from "../lib/tenant-cache";
import { useModalDialog } from "../lib/use-modal-dialog";
import { VexoraDialog } from "./vexora-dialog";
import { AnchoredPopover } from "./anchored-popover";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  RotateCcw,
  UserRound,
  Users,
  UserPlus,
  ChevronDown,
  ArrowRightLeft,
  ChevronLeft,
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
  MessageCircle,
  Bot,
  Wallet,
  CalendarDays,
  Paperclip,
  HelpCircle,
  RotateCw,
  MessagesSquare,
  MoveDiagonal2,
  Sparkles,
  StickyNote,
  ImagePlus,
  Film,
  FileText,
  MapPin,
  MapPinned,
  MoreVertical,
  PackageSearch,
  Quote,
  Download,
  Link2,
  Maximize2,
  Minimize2,
  Phone,
  Search,
} from "lucide-react";
import { CatalogQuotePanel } from "./catalog-quote-panel";
const InboxCopilot=dynamic(()=>import("./inbox-copilot").then(m=>m.InboxCopilot));
import { WhatsappBridge } from "./whatsapp-bridge";
import { ContactProfilePanel } from "./contact-profile-panel";
import { emojiCatalog } from "./emoji-catalog";

/* Padrao TW — o azul vem dos tokens --primary do preset, nunca fixado na classe. */
const messageStatusTw="text-xs font-bold tabular-nums";
const statusTw={failed:"text-red-600",read:"text-ib-read",delivered:"text-blue-700",queued:"text-amber-600",sent:"text-slate-600"} as const;
const brandStatusTw={failed:"text-red-200",read:"text-ib-read",delivered:"text-blue-100",queued:"text-amber-200",sent:"text-blue-100"} as const;
const srOnlyTw="sr-only";
const audioPlayerTw="grid gap-2";
const audioWaveTw="flex h-10 items-end gap-0.5";
const audioBarTw="w-1 rounded-full bg-zinc-300";
const audioBarPlayedTw="bg-blue-600";
const audioMessageTw="w-full";
const messageLinkTw="break-words underline underline-offset-2";
const deletedTw="italic opacity-70";
const linkPreviewTw="grid gap-1 rounded-lg border border-gray-200 bg-zinc-100 p-2 text-xs";
/* O contexto do atendimento usa âmbar claro com tinta escura; notas privadas seguem em azul. */
const internalToneTw = {
  context: {
    card: "border border-dashed border-amber-400 bg-amber-200 p-3 text-amber-950 shadow",
    icon: "rounded bg-amber-400 text-amber-950",
    title: "mr-auto text-xs font-extrabold tracking-wide text-amber-950",
    badge: "rounded-full bg-amber-400 px-1.5 py-0.5 text-xs font-extrabold uppercase tracking-widest text-amber-950",
    time: "text-xs tabular-nums text-amber-900",
    body: "text-sm leading-normal text-amber-950",
    link: "text-amber-900 transition-colors hover:bg-amber-300",
    action: "bg-amber-400 text-amber-950 shadow-md transition-colors hover:bg-amber-500",
  },
  private: {
    card: "border border-dashed border-blue-600 bg-blue-50 p-3 shadow",
    icon: "rounded bg-blue-600 text-white",
    title: "mr-auto text-xs font-extrabold tracking-wide text-slate-950",
    badge: "rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-extrabold uppercase tracking-widest text-white",
    time: "text-xs tabular-nums text-slate-600",
    body: "text-sm leading-normal text-slate-950",
    link: "text-blue-600 transition-colors hover:bg-zinc-400",
    action: "bg-blue-600 text-white shadow-md transition-colors hover:bg-blue-700",
  },
} as const;
const handoffToneTw = [
  "border-blue-200 bg-blue-50 text-blue-800",
  "border-slate-300 bg-slate-100 text-slate-800",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-indigo-200 bg-indigo-50 text-indigo-900",
  "border-sky-200 bg-sky-50 text-sky-900",
] as const;
/* Avatares sem imagem: fundo com 20% do tom da paleta TW e letra no tom cheio. */
const agentToneTw = ["bg-sky-400/20 text-sky-400", "bg-purple-400/20 text-purple-400", "bg-emerald-400/20 text-emerald-400", "bg-amber-400/20 text-amber-400", "bg-cyan-400/20 text-cyan-400"] as const;
type FinanceDebt={id:string;value:number;dueDate:string;status:string;description:string;invoiceUrl:string|null;bankSlipUrl:string|null};
type Channel = { id: string; name: string; provider: string; status: string; lastError?: string | null; healthCheckedAt?: string | null };
type ServiceProtocol = { code: string; conversationId: string };
type InboxListFilters = { tag: string; name: string; phone: string; network: string; keyword: string; protocol: string };
const EMPTY_INBOX_LIST_FILTERS: InboxListFilters = { tag: "", name: "", phone: "", network: "", keyword: "", protocol: "" };
type Department = { id: string; key: string; name: string; keywords: string[]; isActive: boolean; isMine?: boolean };
import { ContactAvatar, contactLabels } from "./inbox-avatars";
import { ConversationList } from "./conversation-list";
import { MentionPopover } from "./mention-popover";
import type { Agent, Message, Conversation } from "./inbox-workspace-types";
function messageDateKey(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}

function handoffHue(value: string): number {
  let h = 0;
  for (let index = 0; index < value.length; index++) {
    h = (h * 31 + value.charCodeAt(index)) >>> 0;
  }
  return h % 360;
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

function MessageStatus({ message, onBrand = false }: { message: Message; onBrand?: boolean }) {
  if (message.direction !== "OUTBOUND") return null;
  const status = String(message.status || "SENT").toUpperCase();
  const failed = status === "FAILED";
  const queued = status === "QUEUED";
  const read = status === "READ";
  const delivered = status === "DELIVERED" || read;
  const label = failed ? "Falhou" : queued ? "Enviando" : read ? "Lida" : delivered ? "Entregue" : "Enviada";
  const marks = failed ? "!" : queued ? "◷" : delivered ? "✓✓" : "✓";
  const tones = onBrand ? brandStatusTw : statusTw;
  const tone = failed ? tones.failed : read ? tones.read : delivered ? tones.delivered : queued ? tones.queued : tones.sent;
  return <span className={messageStatusTw + " " + tone} data-status={status.toLowerCase()} aria-label={label} title={label}>{marks}<span className={srOnlyTw}> {label}</span></span>;
}

function AudioMessage({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const bars = [18, 28, 22, 36, 48, 30, 55, 42, 64, 38, 52, 72, 46, 60, 34, 58, 78, 50, 40, 66, 32, 54, 44, 70, 36, 48, 26, 58, 42, 62, 30, 50];
  return <div className={audioPlayerTw} data-testid="audio-player">
    <div className={audioWaveTw} aria-hidden="true">
      {bars.map((height, index) => <span key={index} className={audioBarTw + " " + (index / bars.length <= progress ? audioBarPlayedTw : "")} style={{ height: `${height}%` }} />)}
    </div>
    <audio ref={audioRef} className={audioMessageTw} controls preload="metadata" src={src} aria-label="Áudio recebido" onTimeUpdate={(event) => {
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
  return <p className={deleted ? deletedTw : undefined} data-deleted={deleted ? "true" : undefined}>{parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <Fragment key={index}>{part}</Fragment>;
    const punctuation = part.match(/[.,!?;:)]*$/)?.[0] || "";
    const href = punctuation ? part.slice(0, -punctuation.length) : part;
    return <Fragment key={index}><a className={messageLinkTw} href={href} target="_blank" rel="noopener noreferrer">{href}</a>{punctuation}</Fragment>;
  })}</p>;
}
function LinkPreview({ preview }: { preview: NonNullable<Message["metadata"]>["linkPreview"] }) {
  if (!preview?.url) return null;
  return <a className={linkPreviewTw} data-testid="link-preview" href={preview.url} target="_blank" rel="noopener noreferrer">
    {preview.imageUrl ? <img className="w-full rounded-lg" src={preview.imageUrl} alt="" loading="lazy"/> : null}
    <span className="grid gap-0.5"><strong className="truncate text-slate-950">{preview.title || preview.url}</strong>{preview.description ? <small className="line-clamp-2 text-slate-600">{preview.description}</small> : null}<em className="break-all text-xs not-italic text-slate-600">{preview.url}</em></span>
  </a>;
}

/** Comparação tolerante de telefone: aceita DDD, país, espaços e pontuação digitados à mão. */
function phoneDigits(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function loosePhoneMatch(value: unknown, query: string): boolean {
  const hay = phoneDigits(value);
  const needle = phoneDigits(query);
  if (hay.length < 8 || needle.length < 8) return false;
  return hay === needle || hay.endsWith(needle) || needle.endsWith(hay);
}

/**
 * Filtro local da lista lateral. Não altera a consulta da fila: cada critério
 * preenchido estreita as conversas já carregadas para a visão atual.
 */
function filterInboxConversations(conversations: Conversation[], filters: InboxListFilters, protocolCode: string, selectedId: string | null): Conversation[] {
  const tag = filters.tag.trim().toLocaleLowerCase("pt-BR");
  const name = filters.name.trim().toLocaleLowerCase("pt-BR");
  const network = filters.network.trim().toLocaleLowerCase("pt-BR");
  const keyword = filters.keyword.trim().toLocaleLowerCase("pt-BR");
  const protocol = filters.protocol.trim().replace(/\s+/g, "").toLocaleUpperCase("pt-BR");
  return conversations.filter((item) => {
    if (tag && !contactLabels(item.contact).some((label) => label.name.toLocaleLowerCase("pt-BR").includes(tag))) return false;
    if (name && ![item.contact.name, contactDisplayName(item.contact, item.botState)].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(name)) return false;
    if (filters.phone.trim() && !loosePhoneMatch(item.contact.phone, filters.phone) && !loosePhoneMatch(item.contact.externalId, filters.phone)) return false;
    if (network && ![item.channel, item.contact.source, String(item.botState?.provider || ""), String(item.botState?.mode || ""), JSON.stringify(item.contact.metadata || {})].join(" ").toLocaleLowerCase("pt-BR").includes(network)) return false;
    if (keyword && ![item.subject, ...item.messages.map((message) => message.content)].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(keyword)) return false;
    if (protocol) {
      const haystack = [item.id, item.subject, item.id === selectedId ? protocolCode : "", ...item.messages.map((message) => message.content)].filter(Boolean).join(" ").toLocaleUpperCase("pt-BR").replace(/\s+/g, "");
      if (!haystack.includes(protocol)) return false;
    }
    return true;
  });
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
  { token:"{{mapa_endereco}}", label:"Mapa da empresa", hint:"Link do Google Maps configurado em Dados da empresa" },
] as const;
function formatVoiceTimer(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

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
type SupervisionOverview = {
  slaMinutes: number;
  totals: { open: number; pending: number; waiting: number; stale: number };
  oldestWaiting: { conversationId: string; contactName: string; createdAt: string } | null;
  byDepartment: Array<{ id: string; name: string; waiting: number; open: number; stale: number }>;
  staleConversations: Array<{ id: string; contactName: string; assignee: string | null; department: string | null; updatedAt: string; status: string }>;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || data.error || "Falha na operação.");
  return data as T;
}

export function InboxWorkspace({tenantId,userId,canManageChannels=false}:{tenantId:string;userId:string;canManageChannels?:boolean}) {
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
  const [copilotOpen,setCopilotOpen]=useState(false);
  const [copilotMessage,setCopilotMessage]=useState<Message|null>(null);
  const [handoffAssignee, setHandoffAssignee] = useState("");
  const [inviteAssignee, setInviteAssignee] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [serviceProtocol, setServiceProtocol] = useState<ServiceProtocol | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [queueMoreOpen, setQueueMoreOpen] = useState(false);
  const [statusPillOpen, setStatusPillOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const queueMoreRef = useRef<HTMLElement>(null);
  const statusPillRef = useRef<HTMLElement>(null);
  const handoffRef = useRef<HTMLElement>(null);
  const inviteRef = useRef<HTMLElement>(null);
  const phoneToolsRef = useRef<HTMLElement>(null);
  const searchFiltersRef = useRef<HTMLElement>(null);
  const [phoneToolsOpen, setPhoneToolsOpen] = useState(false);
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneNotice, setPhoneNotice] = useState("");
  const [inboxListFilters, setInboxListFilters] = useState<InboxListFilters>(EMPTY_INBOX_LIST_FILTERS);
  const emojiRef = useRef<HTMLButtonElement>(null);
  const quickReplyEmojiRef = useRef<HTMLButtonElement>(null);
  const [contactProfileExpanded, setContactProfileExpanded] = useState(true);
  const toggleContactProfile = useCallback(() => {
    if (!selectedId) return;
    if (window.matchMedia("(min-width: 1101px)").matches) {
      setContactProfileExpanded(expanded => !expanded);
      return;
    }
    if (!fichaOpen) setContactProfileExpanded(true);
    setFichaOpen(!fichaOpen);
  }, [selectedId, fichaOpen]);

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
  useEffect(() => {
    document.body.dataset.inboxFullscreen = fullScreen ? "true" : "false";
    return () => { delete document.body.dataset.inboxFullscreen; };
  }, [fullScreen]);
  useEffect(() => {
    const transfer = () => { document.querySelector<HTMLButtonElement>("[data-testid='thread-transfer-button']")?.click(); };
    const assume = () => document.querySelector<HTMLButtonElement>("[data-testid='inbox-assume-button']")?.click();
    const finalize = () => { document.querySelector<HTMLButtonElement>("[data-testid='thread-finalize-button']")?.click(); };
    const conversationList = () => setMobileThreadOpen(false);
    window.addEventListener("vexora:mobile-transfer", transfer);
    window.addEventListener("vexora:mobile-assume", assume);
    window.addEventListener("vexora:mobile-finalize", finalize);
    window.addEventListener("vexora:mobile-conversation-list", conversationList);
    return () => {
      window.removeEventListener("vexora:mobile-transfer", transfer);
      window.removeEventListener("vexora:mobile-assume", assume);
      window.removeEventListener("vexora:mobile-finalize", finalize);
      window.removeEventListener("vexora:mobile-conversation-list", conversationList);
    };
  }, []);
  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFullScreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullScreen]);
  const [quickPanel,setQuickPanel]=useState<"billing"|"appointments"|"attachments"|"help"|"proposal"|null>(null);
  const appointmentModalRef=useRef<HTMLElement|null>(null);
  useModalDialog(quickPanel==="appointments",appointmentModalRef,()=>setQuickPanel(null));
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"){setQuickPanel(null);setEmojiOpen(false);setQuickOpen(false);setAttachOpen(false);setComposerMenuOpen(false);return;}if(!event.altKey||event.ctrlKey||event.shiftKey||event.repeat)return;const key=event.code;const panels:Record<string,"billing"|"appointments"|"attachments"|"help"|"proposal">={KeyF:"billing",KeyA:"appointments",KeyU:"attachments",Slash:"help",KeyD:"proposal"};if(key==="KeyP"){event.preventDefault();setComposerTab(v=>v==="reply"?"note":"reply");}else if(key==="KeyE"){event.preventDefault();setEmojiTarget("composer");setEmojiOpen(v=>!v);setQuickOpen(false);setQuickPanel(null);}else if(key==="KeyC"){event.preventDefault();toggleContactProfile();}else if(panels[key]){event.preventDefault();setQuickPanel(v=>v===panels[key]?null:panels[key] ?? null);setEmojiOpen(false);setQuickOpen(false);}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[toggleContactProfile]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState("");
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [improveBusy, setImproveBusy] = useState(false);
  const [improveError, setImproveError] = useState("");
  const [attendantNotes, setAttendantNotes] = useState<Message[]>([]);
  const [attendantNote, setAttendantNote] = useState("");
  const [attendantNoteBusy, setAttendantNoteBusy] = useState(false);
  const [attendantNoteError, setAttendantNoteError] = useState("");
  const [messageMenu, setMessageMenu] = useState<{message: Message; x: number; y: number} | null>(null);
  useEffect(()=>{setCopilotOpen(false);setCopilotMessage(null);setHandoffNote("");setHandoffPhone("");setHandoffDepartment("");setHandoffAssignee("");},[selectedId]);
  useEffect(() => { setComposerTab("reply"); setComposerMenuOpen(false); }, [selectedId]);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!(event.target as Element)?.closest("[data-testid='message-context-menu']"))setMessageMenu(null)};window.addEventListener("click",close);return()=>window.removeEventListener("click",close)},[]);
  const threadScrollRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const element=threadScrollRef.current;
    if(!element)return;
    const openImage=(event:MouseEvent)=>{
      const target=(event.target as Element).closest("img[data-testid='inbox-image-message']") as HTMLImageElement|null;
      if(!target?.src)return;
      setLightboxSrc(target.src);
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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("Todos");
  const [emojiTarget, setEmojiTarget] = useState<"composer" | "quick-reply">("composer");
  const [emojiAnchorRef, setEmojiAnchorRef] = useState<RefObject<HTMLButtonElement | null>>(emojiRef);
  const emojiTriggerRef = useRef<HTMLElement | null>(null);
  const closeEmoji = useCallback((restoreFocus = false) => {
    setEmojiOpen(false);
    setEmojiSearch("");
    if (restoreFocus) {
      requestAnimationFrame(() => {
        const target = emojiTarget === "quick-reply" ? quickContentRef.current : composerRef.current;
        if (target?.isConnected) {
          target.focus();
          return;
        }
        const trigger = emojiTriggerRef.current?.isConnected ? emojiTriggerRef.current : emojiRef.current;
        trigger?.focus();
      });
    }
  }, [emojiTarget]);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!composerMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!composerMenuRef.current?.contains(event.target as Node)) setComposerMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [composerMenuOpen]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionList = mentionQuery === null ? [] : agents.filter(a => a.name.toLowerCase().includes(mentionQuery.toLowerCase()) || a.email.toLowerCase().includes(mentionQuery.toLowerCase()));
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
  const [recordingLevels, setRecordingLevels] = useState<number[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const voiceStartingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveFrameRef = useRef(0);
  const discardRecordingRef = useRef(false);
  useEffect(() => () => {
    recordingStreamRef.current = null;
    setListening(false);
    if (waveFrameRef.current) window.cancelAnimationFrame(waveFrameRef.current);
    if (audioContextRef.current) { const ctx = audioContextRef.current; audioContextRef.current = null; ctx.close().catch(() => {}); }
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
  }, [selectedId]);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerCaretRef = useRef<number | null>(null);
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
        setConversationLoadError(e instanceof Error ? e.message : "Não foi possível atualizar as conversas. Verifique sua conexão e toque em Tentar novamente.");
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
      if (request === messageRequest.current && selectedRef.current === id) setMessageLoadError(e instanceof Error ? e.message : "Não foi possível carregar as mensagens. Verifique sua conexão e toque em Tentar novamente.");
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
    setImproveBusy(false);
    setImproveError("");
    setAttendantNotes([]);
    setAttendantNote("");
    setAttendantNoteError("");
    setAttendantNoteBusy(false);
    if (selectedId) void loadAttendantNotes(selectedId);
  }, [selectedId, loadAttendantNotes]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-tip]")) return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest?.("[data-tip]")) active.blur();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest?.("[data-tip]")) active.blur();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!listening) return;
    setRecordingSeconds(0);
    const id = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);

  async function improveDraftWithAi() {
    if (!selectedId || improveBusy) return;
    const isNote = composerTab === "note";
    const source = isNote ? attendantNote : draft;
    if (!source.trim()) {
      setImproveError("Escreva algo antes de melhorar com IA.");
      return;
    }
    setImproveBusy(true);
    setImproveError("");
    try {
      const result = await api<{ text: string }>(
        "/api/backend/conversations/" + selectedId + "/copilot",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "improve", text: source, tone: "cordial" }),
        },
      );
      if (isNote) setAttendantNote(result.text); else setDraft(result.text);
    } catch (e) {
      setImproveError(e instanceof Error ? e.message : "A assistente não conseguiu melhorar o texto agora.");
    } finally {
      setImproveBusy(false);
    }
  }

  function handleComposerChange(event: { target: HTMLTextAreaElement; nativeEvent: Event }) {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    const current = composerTab === "note" ? attendantNote : draft;
    const input = event.nativeEvent as InputEvent;
    if (!input.isComposing && (!input.inputType || input.inputType === "insertText") &&
        value[caret - 1] === "/" && (caret === 1 || /\s/.test(value.charAt(caret - 2))) &&
        (input.data === "/" || value.slice(0, caret - 1) + value.slice(caret) === current)) {
      setQuickSearch("");
      setQuickActiveIndex(0);
      setQuickOpen(true);
      setEmojiOpen(false);
      setAttachOpen(false);
      setComposerMenuOpen(false);
      setMentionQuery(null);
      return;
    }
    if (composerTab === "note") { setAttendantNote(value); return; }
    composerCaretRef.current = caret;
    const before = value.slice(0, caret);
    const match = /@([A-Za-zÀ-Ÿ0-9_.\- ]{0,32})$/.exec(before);
    if (match && typeof match[1] === "string") { setMentionQuery(match[1]); setMentionIndex(0); } else { setMentionQuery(null); }
    setDraft(value);
  }

  function handleComposerKeyDown(event: { key: string; currentTarget: HTMLTextAreaElement; nativeEvent: { isComposing: boolean }; preventDefault: () => void; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) {
    const e = event;
    if (e.nativeEvent && e.nativeEvent.isComposing) return;
    if (mentionQuery !== null && e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, Math.max(0, mentionList.length - 1))); return; }
    if (mentionQuery !== null && e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(0, i - 1)); return; }
    if (mentionQuery !== null && (e.key === "Enter" || e.key === "Tab") && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); const picked = mentionList[Math.min(mentionIndex, Math.max(0, mentionList.length - 1))]; if (picked) applyMention(picked); return; }
    if (mentionQuery !== null && e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
    if(quickOpen&&e.key==="ArrowDown"){e.preventDefault();setQuickActiveIndex(i=>Math.min(i+1,Math.max(0,filteredQuickReplies.length-1)))}
    if(quickOpen&&e.key==="ArrowUp"){e.preventDefault();setQuickActiveIndex(i=>Math.max(0,i-1))}
    if(quickOpen&&e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();const item=filteredQuickReplies[Math.min(quickActiveIndex,filteredQuickReplies.length-1)];if(item)applyQuickReply(item)}
    else if(e.key==="Enter"&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}
    if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();e.currentTarget.form?.requestSubmit()}
    if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="e"){e.preventDefault();setEmojiOpen(v=>!v)}
  }

  function applyMention(agent: Agent) {
    const value = composerTab === "note" ? attendantNote : draft;
    const caret = composerCaretRef.current ?? value.length;
    const before = value.slice(0, caret).replace(/@([A-Za-zÀ-Ÿ0-9_.\- ]*)$/, "@" + agent.name.trim() + " ");
    const next = before + value.slice(caret);
    if (composerTab === "note") { setAttendantNote(next); } else { setDraft(next); }
    setMentionQuery(null);
    composerRef.current?.focus();
    const pos = before.length;
    requestAnimationFrame(() => { if (composerRef.current) composerRef.current.setSelectionRange(pos, pos); });
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
      document.querySelectorAll<HTMLElement>("[data-testid='inbox-workspace'] details[open]").forEach((menu) => {
        if (!menu.contains(event.target as Node)) menu.removeAttribute("open");
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document.querySelectorAll<HTMLElement>("[data-testid='inbox-workspace'] details[open]").forEach((menu) => menu.removeAttribute("open"));
      }
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const [attachOpen, setAttachOpen] = useState(false);
  const [orgMapsUrl, setOrgMapsUrl] = useState("");
  const loadOrgMapsUrl = useCallback(async () => {
    const organization = await api<{ mapsUrl?: string | null; address?: string; city?: string; state?: string; zipCode?: string }>("/api/backend/auth/organization");
    const address = [organization.address, organization.city, organization.state, organization.zipCode].filter(part => part?.trim()).join(", ");
    return organization.mapsUrl?.trim() || (address && "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address));
  }, []);
  useEffect(() => {
    let active = true;
    void loadOrgMapsUrl().then(url => { if (active) setOrgMapsUrl(url); }).catch(() => {});
    return () => { active = false; };
  }, [loadOrgMapsUrl]);

  async function insertCompanyMap() {
    if (!selectedId) return;
    setAttachOpen(false);
    setError("");
    try {
      const url = await loadOrgMapsUrl();
      setOrgMapsUrl(url);
      if (selectedRef.current !== selectedId) return;
      if (!url) {
        setError("Cadastre o endereço ou o link do mapa em Configurações → Dados da empresa.");
        return;
      }
      setComposerTab("reply");
      setDraft(current => current.trim() ? current + "\n" + url : url);
      composerRef.current?.focus();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível consultar a localização da empresa.");
    }
  }
  const [attachmentAccept, setAttachmentAccept] = useState("image/*,video/mp4,video/3gpp,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip");
  // Popovers opened from toolbar icons behave like native app sheets: tap outside or Escape closes them.
  useEffect(() => {
    if (!quickOpen && !emojiOpen && !attachOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-composer-tool-wrap='true'], [data-testid='composer-emoji-popover']")) return;
      setQuickOpen(false);
      closeEmoji(false);
      setQuickSettingsOpen(false);
      setAttachOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickOpen(false);
        closeEmoji(true);
        setQuickSettingsOpen(false);
        setAttachOpen(false);
      }
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [quickOpen, emojiOpen, attachOpen, closeEmoji]);
  useEffect(() => { void loadConversations(); void loadQueueCounts(); void loadChannels(); void loadSupervision(); void loadInitialLists();
  }, [loadConversations, loadQueueCounts, loadChannels, loadSupervision, loadInitialLists]);
  useEffect(() => {
    messageRequest.current += 1;
    olderMessagesInFlight.current = false;
    setOlderMessagesLoading(false);
    setMessages([]);
    setHasOlderMessages(false);
    setMessageLoadError("");
    if (selectedId) {
      void loadMessages(selectedId);
      // Marca o chat como visto no WhatsApp (tick azul no aparelho do cliente). Fire-and-forget.
      void api("/api/backend/conversations/" + selectedId + "/seen?view=" + queueView, { method: "POST" }).catch(() => {});
    }
    else { setMessages([]); setMessagesLoading(false); }
  }, [selectedId, loadMessages, queueView]);

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

  function mediaUrlOf(message: Message): string {
    const hasMedia = message.metadata?.hasMedia === true || typeof message.metadata?.mediaUrl === "string";
    // Provedor sem binário seguro: nunca oferecer link quebrado.
    if (!hasMedia || message.metadata?.mediaDelivery === "UNAVAILABLE" || !selectedId) return "";
    return "/api/backend/conversations/" + selectedId + "/messages/" + message.id + "/media?view=" + encodeURIComponent(queueView);
  }
  function downloadMedia(message: Message) {
    const url = mediaUrlOf(message); if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = typeof message.metadata?.filename === "string" ? message.metadata.filename : "arquivo-" + message.id.slice(0, 8);
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setMessageMenu(null);
  }
  async function copyMediaLink(message: Message) {
    const url = mediaUrlOf(message); if (!url) return;
    try { await navigator.clipboard.writeText(window.location.origin + url); } catch { setError("Não foi possível copiar o link."); setMessageMenu(null); return; }
    setMessageMenu(null);
  }
  function quoteReply(message: Message) {
    const author = message.direction === "OUTBOUND" ? "Você" : (selected?.contact?.name || "Cliente");
    const text = message.content?.trim() || ("[" + (message.contentType || "mídia") + "]");
    setDraft("> " + author + ": " + text.slice(0, 240) + "\n");
    setMessageMenu(null);
    composerRef.current?.focus();
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
    try {
      await api("/api/backend/conversations/" + selectedId + "/return-to-bot?view=" + queueView, { method: "POST" });
      setConversations(rows => rows.map(row => row.id === selectedId ? { ...row, handlingMode: "BOT", assignee: null, claimedById: null } : row));
      await loadConversations();
    }
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
      nome:name,novo_nome:typeof preferred==="string"&&preferred.trim()?preferred.trim():name,saudacao:periodGreeting,despedida:periodFarewell,mapa_endereco:orgMapsUrl||""
    };
    const valueFor=(name:string)=>{
      if(typeof context[name]==="string")return context[name]!;
      const normalized=name.toLocaleLowerCase("pt-BR").replace(/[\s_.-]/g,"");
      const match=Object.entries(context).find(([key])=>key.toLocaleLowerCase("pt-BR").replace(/[\s_.-]/g,"")===normalized);
      return match?.[1]||"";
    };
    return content.replace(/\{\{([^{}]+)\}\}/g,(_,key:string)=>valueFor(key.trim()));
  }

  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem("vexora:recent-emojis");
      return raw ? (JSON.parse(raw) as string[]).slice(0, 14) : [];
    } catch {
      return [];
    }
  });
  function insertEmoji(value:string) {
    const isQuickReply = emojiTarget === "quick-reply";
    const el = isQuickReply ? quickContentRef.current : composerRef.current;
    const currentText = isQuickReply ? quickContent : draft;
    const start = el?.selectionStart ?? currentText.length;
    const end = el?.selectionEnd ?? currentText.length;
    const nextText = currentText.slice(0, start) + value + currentText.slice(end);
    if (isQuickReply) setQuickContent(nextText); else setDraft(nextText);
    setRecentEmojis(prev => {
      const next = [value, ...prev.filter(v => v !== value)].slice(0, 14);
      try { window.localStorage.setItem("vexora:recent-emojis", JSON.stringify(next)); } catch {}
      return next;
    });
    closeEmoji(false);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + value.length, start + value.length); });
  }
  const emojiGroups = EMOJI_GROUPS;
  const visibleEmojis = emojiCategory === "Recentes"
    ? (recentEmojis.length ? [["Recentes", recentEmojis] as [string, string[]]] : [])
    : Object.entries(emojiGroups).filter(([group,values]) =>
    (emojiCategory === "Todos" || emojiCategory === group) &&
    (!emojiSearch.trim() || group.toLocaleLowerCase("pt-BR").includes(emojiSearch.toLocaleLowerCase("pt-BR")) ||
      values.some(v => v.includes(emojiSearch.trim()) || (EMOJI_NAME_BY_VALUE[v] || "").includes(emojiSearch.trim().toLocaleLowerCase("pt-BR"))))
  );
  async function sendRecordedBlob(blob: Blob) {
    if (!canReply || !selectedId || selectedRef.current !== selectedId || busy) return;
    setBusy(true); setError("");
    try {
      const mimetype = blob.type.split(";")[0] || "audio/webm";
      const extension = mimetype === "audio/ogg" ? "ogg" : mimetype === "audio/mp4" ? "m4a" : "webm";
      if (blob.size > 16 * 1024 * 1024) throw new Error("O áudio precisa ter até 16 MB.");
      const data = await fileBase64(blob);
      if (selectedRef.current !== selectedId) return;
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "audio", filename: "audio-vexora." + extension, mimetype, data }) });
      await loadMessages(selectedId); await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o áudio."); }
    finally { setBusy(false); }
  }
  function startWaveform(stream: MediaStream, ctx: AudioContext | null) {
    setRecordingLevels(Array.from({ length: 26 }, () => 0));
    if (!ctx) return;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const step = () => {
        analyser.getByteFrequencyData(bins);
        const bars: number[] = [];
        const chunk = Math.max(1, Math.floor(bins.length / 26));
        for (let i = 0; i < 26; i++) {
          let sum = 0;
          for (let j = 0; j < chunk; j++) sum += bins[i * chunk + j] || 0;
          bars.push(sum / chunk / 255);
        }
        setRecordingLevels(bars);
        waveFrameRef.current = window.requestAnimationFrame(step);
      };
      waveFrameRef.current = window.requestAnimationFrame(step);
    } catch {
      /* waveform é decorativa */
    }
  }
  function stopWaveform() {
    if (waveFrameRef.current) window.cancelAnimationFrame(waveFrameRef.current);
    waveFrameRef.current = 0;
    analyserRef.current = null;
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      ctx.close().catch(() => {});
    }
    setRecordingLevels([]);
  }
  function stopVoiceRecording(send: boolean) {
    discardRecordingRef.current = !send;
    const recorder = recorderRef.current;
    if (!recorder) {
      setListening(false);
      stopWaveform();
      return;
    }
    if (recorder.state !== "inactive") recorder.stop();
    setListening(false);
    stopWaveform();
  }
  function toggleVoice() {
    if (listening) {
      stopVoiceRecording(true);
      return;
    }
    if (!canReply || busy || voiceStartingRef.current || recorderRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("A gravação de áudio não está disponível neste navegador.");
      return;
    }
    voiceStartingRef.current = true;
    discardRecordingRef.current = false;
    setError("");
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    try {
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
        void audioContextRef.current.resume().catch(() => {});
      }
    } catch { /* o gravador funciona sem a forma de onda */ }
    const context = audioContextRef.current;
    void navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } }).then(stream => {
      if (selectedRef.current !== selectedId || discardRecordingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      recordingStreamRef.current = stream;
      const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (recordingStreamRef.current !== stream) return;
        recordingStreamRef.current = null;
        recorderRef.current = null;
        stopWaveform();
        if (discardRecordingRef.current || selectedRef.current !== selectedId) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || (chunks[0] instanceof Blob ? chunks[0].type : "") || mime || "audio/webm" });
        if (!blob.size) { setError("A gravação saiu vazia. Grave novamente."); return; }
        void sendRecordedBlob(blob);
      };
      recorder.onerror = () => {
        if (recordingStreamRef.current !== stream) return;
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setListening(false);
        stopWaveform();
        setError("Não foi possível concluir a gravação.");
      };
      recorderRef.current = recorder;
      recorder.start();
      setListening(true);
      startWaveform(stream, context);
    }).catch(() => {
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      stopWaveform();
      setError("Verifique a permissão do microfone e tente gravar novamente.");
    }).finally(() => { voiceStartingRef.current = false; });
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
      if (selectedRef.current !== selectedId) return;
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "location", latitude: position.coords.latitude, longitude: position.coords.longitude, title: "Minha localização" }) });
      setQuickPanel(null); await loadMessages(selectedId); await loadConversations();
    } catch (e) {
      const code = typeof e === "object" && e !== null && "code" in e ? e.code : null;
      setError(code === 1 ? "Permita o acesso à localização nas configurações do navegador." :
        code === 3 ? "A localização demorou a responder. Tente novamente." :
        e instanceof Error ? e.message : "O dispositivo não conseguiu obter a localização.");
    } finally { setBusy(false); }
  }
  async function sendCurrentContact() {
    if (!selectedId || !selected?.contact || busy) return;
    const contact = selected.contact;
    const phone = contact.phone || "";
    if (!phone) { setError("Este contato não possui telefone para compartilhar."); return; }
    const escapeVcard = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n|\r/g, "\\n").replace(/([,;])/g, "\\$1");
    const name = escapeVcard(contact.name || phone);
    const vcard = ["BEGIN:VCARD", "VERSION:3.0", "N:" + name + ";;;;", "FN:" + name,
      "TEL;TYPE=CELL:" + phone.replace(/[^\d+]/g, ""),
      ...(contact.email ? ["EMAIL:" + escapeVcard(contact.email)] : []), "END:VCARD"].join("\r\n");
    setBusy(true); setError("");
    try {
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "contact", contactName: contact.name || phone, vcard }) });
      setQuickPanel(null); await loadMessages(selectedId); await loadConversations();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o contato."); } finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!canReply || !selectedId || busy || listening || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      const body = { content: draft.trim() };
      await api("/api/backend/conversations/" + selectedId + "/messages?view=" + queueView, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
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
      const claimed = await api<Pick<Conversation, "id" | "assignee" | "claimedById" | "handlingMode">>("/api/backend/conversations/" + selectedId + "/assume?view=" + queueView, { method: "POST" });
      setConversations(rows => rows.map(row => row.id === claimed.id ? { ...row, ...claimed } : row));
      if (selectedRef.current === selectedId) {
        setQueueView("mine");
        if (queueView === "mine") await loadConversations(false);
      }
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
  const isOpen = Boolean(selected && !selected.archivedAt && !selected.deletedAt && ["OPEN", "PENDING"].includes(selected.status));
  const canReply = Boolean(isOpen && userId && selected?.handlingMode === "HUMAN" && selected.assignee?.id === userId && selected.claimedById === userId);
  useEffect(() => {
    if (canReply) return;
    setQuickPanel(null);
    setCopilotOpen(false);
    setAttachOpen(false);
    setEmojiOpen(false);
    setQuickOpen(false);
    setComposerMenuOpen(false);
    setAttachmentFiles([]);
    setDraft("");
    discardRecordingRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
    setListening(false);
    stopWaveform();
  }, [canReply, selectedId]);
  const filteredQuickReplies = quickReplies.filter(q => (q.title + " " + q.content + " " + (q.category || "") + " " + (q.shortcut || "")).toLocaleLowerCase("pt-BR").includes(quickSearch.toLocaleLowerCase("pt-BR")));
  function applyQuickReply(item: QuickReply) {
    const content = resolveQuickReply(item.content);
    setDraft(value => value ? value + "\n" + content : content);
    setQuickOpen(false); setQuickSearch(""); setQuickActiveIndex(0);
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  function insertCatalogText(text: string) {
    const value = composerTab === "note" ? attendantNote : draft;
    const caret = composerCaretRef.current ?? composerRef.current?.selectionStart ?? value.length;
    const start = Math.min(Math.max(0, caret), value.length);
    const before = value.slice(0, start);
    const after = value.slice(start);
    const lead = before && !/\n$/.test(before) ? "\n\n" : "";
    const tail = after && !/^\n/.test(after) ? "\n\n" : "";
    const next = before + lead + text + tail + after;
    const pos = (before + lead + text).length;
    if (composerTab === "note") setAttendantNote(next); else { composerCaretRef.current = pos; setDraft(next); }
    setQuickPanel(null);
    requestAnimationFrame(() => { composerRef.current?.focus(); composerRef.current?.setSelectionRange(pos, pos); });
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
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [listW, setListW] = useState<number | null>(() => { try { const v = Number(window.localStorage.getItem("vx:inbox-list-w")); return Number.isFinite(v) && v >= 240 && v <= 520 ? v : null; } catch { return null; } });
  const [fichaW, setFichaW] = useState<number | null>(() => { try { const v = Number(window.localStorage.getItem("vx:inbox-ficha-w")); return Number.isFinite(v) && v >= 260 && v <= 520 ? v : null; } catch { return null; } });
  useEffect(() => { try { if (listW) window.localStorage.setItem("vx:inbox-list-w", String(listW)); if (fichaW) window.localStorage.setItem("vx:inbox-ficha-w", String(fichaW)); } catch { /* ignore */ } }, [listW, fichaW]);
  const startResize = (side: "list" | "ficha") => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const root = workspaceRef.current;
    if (!root) return;
    const listEl = root.querySelector<HTMLElement>("[data-testid='inbox-list']");
    const fichaEl = root.querySelector<HTMLElement>("[data-testid='contact-profile']");
    const startX = event.clientX;
    const startList = listEl?.offsetWidth ?? 340;
    const startFicha = fichaEl?.offsetWidth ?? 380;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      if (side === "list") setListW(Math.min(520, Math.max(240, Math.round(startList + dx))));
      else setFichaW(Math.min(520, Math.max(260, Math.round(startFicha - dx))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  const resizeByKey = (side: "list" | "ficha") => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -16 : 16;
    if (side === "list") setListW((v) => Math.min(520, Math.max(240, (v ?? 340) + delta)));
    else setFichaW((v) => Math.min(520, Math.max(260, (v ?? 380) - delta)));
  };
  const visibleConversations = useMemo(
    () => filterInboxConversations(conversations, inboxListFilters, serviceProtocol?.code || "", selectedId),
    [conversations, inboxListFilters, serviceProtocol, selectedId],
  );
  const startPhoneConversation = (event: { currentTarget: HTMLElement }) => {
    const digits = phoneDigits(phoneDraft);
    if (digits.length < 8) {
      setPhoneNotice("Informe um número com DDD (10 ou 11 dígitos).");
      return;
    }
    setInboxListFilters((current) => ({ ...current, phone: phoneDraft.trim() }));
    const match = conversations.find((item) => loosePhoneMatch(item.contact.phone, digits) || loosePhoneMatch(item.contact.externalId, digits));
    if (!match) {
      setPhoneNotice("Nenhuma conversa com esse número nesta fila. O filtro Número foi aplicado.");
      return;
    }
    notificationFocus.current = null;
    setSelectedId(match.id);
    setMobileThreadOpen(true);
    setPhoneDraft("");
    setPhoneNotice("");
    event.currentTarget.closest("details")?.removeAttribute("open");
  };
  return <section ref={workspaceRef} style={{ "--inbox-list-w": `${listW ?? 340}px`, "--inbox-ficha-w": `${fichaW ?? 380}px` } as CSSProperties} data-testid="inbox-workspace" data-fullscreen={fullScreen ? "true" : "false"} data-mobile-thread={mobileThreadOpen ? "true" : "false"} data-ficha-open={fichaOpen ? "true" : "false"} data-ficha-compact={!selected || !contactProfileExpanded ? "true" : "false"} className="flex h-ib-workspace min-h-ib-workspace gap-3 rw-laptop:flex-col">
    <aside data-testid="inbox-list" className="flex w-(--inbox-list-w) shrink-0 min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-zinc-100 p-0 shadow-md">
      <div className="m-0 flex flex-none items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5"><h2 className="text-xs font-extrabold">Conversas</h2><button className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-zinc-400" title="Atualizar" aria-label="Atualizar conversas" onClick={() => { void loadConversations(); void loadChannels(); }}><RotateCw size={15} aria-hidden="true" /></button></div>
      {supervision ? <section className="grid gap-1.5 border-b border-gray-200 px-4 py-2.5 text-xs" aria-label="Supervisão operacional">
        <div className="grid grid-cols-4 gap-1.5">
          <span className="grid gap-px"><strong className="text-xs tabular-nums">{supervision.totals.waiting}</strong><small className="text-xs text-slate-600">Aguardando</small></span>
          <span className="grid gap-px"><strong className="text-xs tabular-nums">{supervision.totals.open}</strong><small className="text-xs text-slate-600">Abertas</small></span>
          <span className="grid gap-px"><strong className="text-xs tabular-nums">{supervision.totals.pending}</strong><small className="text-xs text-slate-600">Pausadas</small></span>
          <span className="grid gap-px"><strong className={"text-xs tabular-nums " + (supervision.totals.stale ? "text-red-600" : "")}>{supervision.totals.stale}</strong><small className="text-xs text-slate-600">Fora do SLA</small></span>
        </div>
      </section> : null}
      {conversationLoadError ? <div className="grid gap-1 rounded-md border border-red-600 bg-red-100 p-3 text-xs text-slate-950" data-testid="inbox-list-error" role="alert"><strong>Não foi possível atualizar as conversas</strong><span>{conversationLoadError || "Verifique sua conexão e toque em Tentar novamente."}</span><button type="button" onClick={() => void loadConversations()}>Tentar novamente</button></div> : null}
      <nav className="flex flex-wrap gap-1.5 border-b border-gray-200 px-3 py-2.5" aria-label="Filas de atendimento">
        {([{ id: "new", label: "Novas" }, { id: "mine", label: "Minhas" }, { id: "team", label: "Equipes" }] as const).map((item) => <button key={item.id} type="button" data-testid="inbox-queue-button" data-active={queueView === item.id ? "true" : "false"} className={"inline-flex min-h-7 items-center gap-1.5 rounded-full border border-gray-200 px-2 text-xs font-bold " + (queueView === item.id ? "border-blue-600 bg-blue-600 text-white" : "text-slate-600 hover:bg-zinc-300")} aria-current={queueView === item.id ? "page" : undefined} aria-pressed={queueView === item.id} onClick={() => { setQueueView(item.id); setMobileThreadOpen(false); }}><span>{item.label}</span><span className={"inline-grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-xs font-extrabold tabular-nums " + (queueView === item.id ? "bg-white text-blue-800" : "bg-blue-100 text-blue-800 ring-1 ring-blue-600")}>{queueCounts[item.id] ?? 0}</span></button>)}
        <details className="relative" onToggle={(event) => setQueueMoreOpen(event.currentTarget.open)}>
          <summary ref={queueMoreRef} data-testid="inbox-queue-more-trigger" className="inline-flex min-h-7 min-w-6 items-center justify-center gap-1 rounded-full border border-gray-200 px-2 text-xs font-bold text-slate-600 hover:bg-zinc-300" aria-label="Demais filas" title="Demais filas" data-tip="Todas · Concluídos · Arquivados · Lixeira"><ChevronDown size={15} aria-hidden="true" /></summary>
          <AnchoredPopover open={queueMoreOpen} anchorRef={queueMoreRef} testId="inbox-queue-more-menu" align="end" className="grid min-w-44 gap-0.5 rounded-md border border-gray-200 bg-zinc-100 p-1.5 shadow-xl" role="menu" ariaLabel="Outras filas">
            <button type="button" role="menuitem" onClick={() => { setQueueView("all-open"); setMobileThreadOpen(false); }}><MessagesSquare size={12} aria-hidden="true" /> Todas</button>
            <button type="button" role="menuitem" onClick={() => { setQueueView("completed"); setMobileThreadOpen(false); }}><CheckCircle2 size={12} aria-hidden="true" /> Concluídos</button>
            <button type="button" role="menuitem" onClick={() => { setQueueView("archived"); setMobileThreadOpen(false); }}><Archive size={12} aria-hidden="true" /> Arquivados</button>
            <button type="button" role="menuitem" onClick={() => { setQueueView("trash"); setMobileThreadOpen(false); }}><Trash2 size={12} aria-hidden="true" /> Lixeira</button>
            <InboxSupportQueue menuItem />
            <InboxTrack menuItem />
          </AnchoredPopover>
        </details>
      </nav>
      <ConversationList conversations={visibleConversations} conversationsLoading={conversationsLoading} selectedId={selectedId} queueView={queueView} onSelect={(item) => { notificationFocus.current = null; setSelectedId(item.id); setMobileThreadOpen(true); }} />
      <div data-testid="inbox-list-tools" className="flex flex-none shrink-0 flex-wrap items-center gap-1.5 border-t border-gray-200 px-3 py-2">
        <details data-testid="inbox-phone-tools" className="relative" onToggle={(event) => setPhoneToolsOpen(event.currentTarget.open)}>
          <summary ref={phoneToolsRef} data-testid="inbox-phone-trigger" className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-gray-200 px-2 text-xs font-bold text-slate-600 hover:bg-zinc-300" aria-label="Iniciar conversa por telefone" title="Iniciar conversa por telefone"><Phone size={13} aria-hidden="true" /> Conversar</summary>
          <AnchoredPopover open={phoneToolsOpen} anchorRef={phoneToolsRef} testId="inbox-phone-popover" side="top" className="grid w-72 gap-2 rounded-lg border border-gray-200 bg-zinc-100 p-2.5 shadow-xl" role="dialog" ariaLabel="Iniciar conversa por telefone">
            <label className="grid gap-1 text-xs font-bold text-slate-600">Número<input data-testid="inbox-phone-input" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={phoneDraft} maxLength={24} placeholder="(00) 00000-0000" aria-label="Número para conversar" onChange={(event) => { setPhoneDraft(event.target.value); setPhoneNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); startPhoneConversation(event); } }} /></label>
            <button type="button" data-testid="inbox-phone-conversar" className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 text-xs font-bold text-white transition-colors hover:bg-blue-700" onClick={startPhoneConversation}>Conversar</button>
            {phoneNotice ? <small data-testid="inbox-phone-notice" className="text-xs text-slate-600" role="status">{phoneNotice}</small> : null}
          </AnchoredPopover>
        </details>
        <details data-testid="inbox-search-filters" className="relative" onToggle={(event) => setSearchFiltersOpen(event.currentTarget.open)}>
          <summary ref={searchFiltersRef} data-testid="inbox-search-trigger" className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-gray-200 px-2 text-xs font-bold text-slate-600 hover:bg-zinc-300" aria-label="Buscar conversas" title="Buscar conversas"><Search size={13} aria-hidden="true" /> Buscar</summary>
          <AnchoredPopover open={searchFiltersOpen} anchorRef={searchFiltersRef} testId="inbox-search-popover" side="top" className="grid max-h-96 w-80 gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-zinc-100 p-2.5 shadow-xl" role="dialog" ariaLabel="Filtrar conversas">
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-bold text-slate-600">Tag<input data-testid="inbox-filter-tag" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={inboxListFilters.tag} placeholder="Etiqueta" aria-label="Filtrar por tag" onChange={(event) => setInboxListFilters((current) => ({ ...current, tag: event.target.value }))} /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Nome<input data-testid="inbox-filter-name" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={inboxListFilters.name} placeholder="Nome do contato" aria-label="Filtrar por nome" onChange={(event) => setInboxListFilters((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Número<input data-testid="inbox-filter-phone" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={inboxListFilters.phone} placeholder="DDD + número" aria-label="Filtrar por número" onChange={(event) => setInboxListFilters((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Rede Social<input data-testid="inbox-filter-network" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={inboxListFilters.network} placeholder="WhatsApp, Instagram…" aria-label="Filtrar por rede social" onChange={(event) => setInboxListFilters((current) => ({ ...current, network: event.target.value }))} /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">palavra-chave<input data-testid="inbox-filter-keyword" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={inboxListFilters.keyword} placeholder="Texto da mensagem" aria-label="Filtrar por palavra-chave" onChange={(event) => setInboxListFilters((current) => ({ ...current, keyword: event.target.value }))} /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-600">Protocolo<input data-testid="inbox-filter-protocol" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-slate-950" value={inboxListFilters.protocol} placeholder="AT-2026-…" aria-label="Filtrar por protocolo" onChange={(event) => setInboxListFilters((current) => ({ ...current, protocol: event.target.value }))} /></label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-2"><small className="text-xs tabular-nums text-slate-600">{visibleConversations.length} de {conversations.length} conversas</small><button type="button" data-testid="inbox-filter-clear" className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-xs font-bold text-blue-600 hover:bg-zinc-300" onClick={() => { setInboxListFilters(EMPTY_INBOX_LIST_FILTERS); setPhoneNotice(""); }}>Limpar</button></div>
          </AnchoredPopover>
        </details>
      </div>
    </aside>
    <div className="flex w-2 shrink-0 cursor-col-resize border-l-2 border-gray-200 rw-laptop:hidden hover:border-blue-600 focus-visible:border-blue-600" role="separator" aria-orientation="vertical" aria-label="Ajustar a largura da lista de conversas" tabIndex={0} onPointerDown={startResize("list")} onKeyDown={resizeByKey("list")} />
    <div data-testid="inbox-thread" className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-zinc-100 p-0 shadow-md">
      {selected ? <>
        {canReply&&copilotOpen&&<InboxCopilot key={selected.id+":"+(copilotMessage?.id||"draft")} conversationId={selected.id} view={queueView} draft={draft} message={copilotMessage?{id:copilotMessage.id,content:copilotMessage.content}:undefined} onUse={setDraft} onClose={()=>{setCopilotOpen(false);setCopilotMessage(null);}} onNote={()=>{void loadMessages(selected.id);}} onSend={async text=>{await api("/api/backend/conversations/"+selected.id+"/messages?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({content:text})});setDraft("");await loadMessages(selected.id);await loadConversations();}}/>}
                <header data-testid="thread-heading" className="relative m-0 flex flex-none flex-nowrap items-center gap-2 border-b border-gray-200 px-4 py-2.5 ib-narrow:px-3"><ContactAvatar contact={selected.contact} className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600 text-base font-extrabold text-white"/><div className="grid min-w-0 flex-1 gap-0.5"><h2 title={selected.contact.name} className="truncate">{contactDisplayName(selected.contact,selected.botState)}</h2><div className="truncate text-xs text-slate-600">{selected.department?.name ?? "Atendimento"}</div><div className="mt-px flex min-w-0 items-center gap-2"><small className="whitespace-nowrap text-xs tabular-nums text-slate-600" title="Protocolo do atendimento">Protocolo {serviceProtocol ? serviceProtocol.code : "—"}</small><details data-testid="thread-status-pill" className="relative inline-flex" onToggle={(event) => setStatusPillOpen(event.currentTarget.open)}><summary ref={statusPillRef}>{conversationStatusPill(selected)}<ChevronDown size={13} aria-hidden="true" /></summary><AnchoredPopover open={statusPillOpen} anchorRef={statusPillRef} testId="thread-status-pill-menu" className="grid min-w-52 gap-1 rounded-lg border border-gray-200 bg-zinc-100 p-2 shadow-xl"><InboxSupportContext key={selected.id} conversationId={selected.id} customerName={contactDisplayName(selected.contact,selected.botState)} menuItem />{!selected.assignee ? <button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void assumeConversation();}}><UserPlus size={13} aria-hidden="true" /> Assumir esta conversa</button> : null}{selected.assignee && selected.handlingMode === "HUMAN" && selected.department?.id && departments.some((d) => d.id === selected.department!.id && d.isMine) ? <button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void assumeConversation();}}><UserPlus size={13} aria-hidden="true" /> Assumir como atendente do setor</button> : null}<button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void setConversationStatus("PENDING");}}><Clock3 size={13} aria-hidden="true" /> Pendente</button><button type="button" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void setConversationStatus("RESOLVED");}}><CheckCircle2 size={13} aria-hidden="true" /> Resolvida</button></AnchoredPopover></details></div></div><div data-testid="thread-primary-actions" className="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
<button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" aria-label={fullScreen ? "Sair de tela cheia" : "Tela cheia"} title={fullScreen ? "Sair de tela cheia · Esc" : "Tela cheia"} onClick={() => setFullScreen((value) => !value)}>{fullScreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}</button>
{!selected.assignee ? <button type="button" data-testid="thread-assume-button" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950 ib-narrow:hidden" aria-label="Assumir conversa" title="Assumir conversa" onClick={() => void assumeConversation()} disabled={actionBusy}><UserPlus size={17} aria-hidden="true" /></button> : null}
{selected.handlingMode === "HUMAN" ? <button type="button" aria-label="Devolver ao chatbot" className="grid size-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void returnToBot()} disabled={actionBusy || selected.status === "RESOLVED" || selected.status === "CLOSED"} title="Devolver ao chatbot" data-tip="Devolver ao chatbot"><Bot size={17} aria-hidden="true" /></button> : null}
<details data-testid="handoff-menu" className="relative inline-flex ib-narrow:hidden" onToggle={(event) => setHandoffOpen(event.currentTarget.open)}>
            <summary data-testid="thread-transfer-button" ref={handoffRef} className="grid size-10 shrink-0 place-items-center rounded-lg border border-blue-600 bg-blue-50 text-blue-600 hover:bg-blue-100" aria-label="Direcionar conversa" title="Direcionar conversa" data-tip="Direcionar conversa"><ArrowRightLeft size={16} aria-hidden="true" /></summary>
            <AnchoredPopover open={handoffOpen} anchorRef={handoffRef} testId="handoff-popover" align="end" className="grid max-h-96 w-80 gap-3 overflow-auto rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-xl">
              <div data-testid="handoff-popover-heading" className="flex items-center justify-between gap-3"><div><strong>Para quem vai?</strong><small>Escolha a equipe ou uma pessoa</small></div><span data-testid="handoff-popover-mark" className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><Users size={17}/></span></div>
              <div className="flex items-center gap-2 pt-0.5 text-xs font-sans uppercase tracking-widest text-slate-600 after:h-px after:flex-1 after:bg-gray-200">EQUIPES</div>
              <button type="button" data-testid="handoff-option" data-selected={!handoffDepartment && !handoffAssignee ? "true" : "false"} className={"flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors " + (!handoffDepartment && !handoffAssignee ? "border-blue-600 bg-blue-50" : "hover:border-gray-200 hover:bg-zinc-200")} onClick={()=>{setHandoffDepartment("");setHandoffAssignee("");}}><span data-testid="handoff-option-icon" className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600"><Users size={15}/></span><span data-testid="handoff-option-copy" className="grid min-w-0 flex-1 gap-px"><strong>Fila geral</strong></span>{!handoffDepartment&&!handoffAssignee?<Check size={15}/>:null}</button>
              {departments.filter(d=>d.isActive).map(d=>{const tint=handoffHue(d.name);return <button type="button" key={d.id} data-testid="handoff-option" data-selected={handoffDepartment===d.id?"true":"false"} className={"flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors "+(handoffDepartment===d.id?"border-blue-600 bg-blue-50":"hover:border-gray-200 hover:bg-zinc-200")} onClick={()=>setHandoffDepartment(d.id)}><span className={"grid size-9 shrink-0 place-items-center rounded-lg border " + handoffToneTw[tint % handoffToneTw.length]}><Users size={15}/></span><span data-testid="handoff-option-copy" className="grid min-w-0 flex-1 gap-px"><strong>{d.name}</strong></span>{handoffDepartment===d.id?<Check size={15}/>:null}</button>})}
              <div className="flex items-center gap-2 pt-0.5 text-xs font-sans uppercase tracking-widest text-slate-600 after:h-px after:flex-1 after:bg-gray-200">ATENDENTE ESPECÍFICO</div>
              <button type="button" data-testid="handoff-option" data-selected={!handoffAssignee?"true":"false"} className={"flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors "+(!handoffAssignee?"border-blue-600 bg-blue-50":"hover:border-gray-200 hover:bg-zinc-200")} onClick={()=>setHandoffAssignee("")}><span data-testid="handoff-option-icon" className="grid size-9 shrink-0 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600"><UserRound size={15}/></span><span data-testid="handoff-option-copy" className="grid min-w-0 flex-1 gap-px"><strong>Sem atendente específico</strong></span>{!handoffAssignee?<Check size={15}/>:null}</button>
              {agents.map(a=><button type="button" key={a.id} data-testid="handoff-option" data-selected={handoffAssignee===a.id?"true":"false"} className={"flex w-full items-center gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors "+(handoffAssignee===a.id?"border-blue-600 bg-blue-50":"hover:border-gray-200 hover:bg-zinc-200")} onClick={()=>setHandoffAssignee(a.id)}><span className={"grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ring-1 ring-inset ring-gray-200 " + agentToneTw[handoffHue(a.name) % agentToneTw.length]}>{a.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span data-testid="handoff-option-copy" className="grid min-w-0 flex-1 gap-px"><strong>{a.name}</strong></span>{handoffAssignee===a.id?<Check size={15}/>:null}</button>)}
              <div className="grid gap-1.5 rounded-lg border border-dashed border-gray-300 bg-zinc-200 p-2.5"><label>WhatsApp do setor · opcional<input value={handoffPhone} maxLength={24} onChange={e=>setHandoffPhone(e.target.value)} placeholder="Código do país, DDD e número"/></label><button type="button" className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-zinc-400" disabled={!/^\d{10,15}$/.test(handoffPhone.replace(/\D/g,""))} onClick={e=>{const phone=handoffPhone.replace(/\D/g,"");const name=departments.find(d=>d.id===handoffDepartment)?.name||"setor responsável";setDraft("Você pode continuar com "+name+" pelo WhatsApp: +"+phone+"\nhttps://wa.me/"+phone);e.currentTarget.closest("details")?.removeAttribute("open");composerRef.current?.focus();}}>Preparar contato para o cliente</button><small>Revise e envie a mensagem ao cliente antes de transferir. O contexto abaixo fica somente com a equipe.</small></div>
              <label className="grid gap-1.5 rounded-lg border border-dashed border-gray-300 bg-zinc-200 p-2.5">Contexto para quem recebe<textarea rows={3} maxLength={4000} value={handoffNote} onChange={e=>setHandoffNote(e.target.value)} placeholder="Informações importantes para o próximo atendente ou setor…"/><small>Nota interna. Não será enviada ao cliente.</small></label>
              <div data-testid="handoff-popover-footer" className="flex items-center justify-between gap-3 border-t border-gray-200 pt-2.5"><span>Destino: <b>{handoffDepartment?departments.find(d=>d.id===handoffDepartment)?.name:"Fila geral"}{handoffAssignee?" · "+agents.find(a=>a.id===handoffAssignee)?.name:""}</b></span><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 font-sans text-sm text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={actionBusy} onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");void handoffToHuman();}}><ArrowRightLeft size={14}/> Transferir</button></div>
            </AnchoredPopover>
          </details>
<button type="button" data-testid="thread-finalize-button" aria-label="Finalizar atendimento" className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ib-narrow:hidden" onClick={() => { setFinalizationOpen(true); setFinalizationOutcome(""); setFinalizationReason(""); }} disabled={actionBusy} title="Finalizar atendimento" data-tip="Finalizar atendimento"><CheckCircle2 size={17} aria-hidden="true" /></button>
<button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" aria-label="Mais ações" title="Mais ações" aria-expanded={moreActionsOpen} aria-controls="thread-header-actions" onClick={() => setMoreActionsOpen(v => !v)}><MoreVertical size={19} aria-hidden="true" /></button>
</div>
<div data-testid="thread-header-actions" data-open={moreActionsOpen ? "true" : "false"} id="thread-header-actions" className={moreActionsOpen ? "flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 p-2 shadow-xl" : "hidden"} onClick={() => setMoreActionsOpen(false)}>
<button type="button" className="grid size-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" aria-label={fichaOpen ? "Ocultar ficha do cliente" : "Abrir ficha do cliente"} title="Ficha do cliente · Alt+C" aria-keyshortcuts="Alt+C" onClick={toggleContactProfile}><UserRound size={17} aria-hidden="true" /></button>
<details className="relative inline-flex" onToggle={(event) => setInviteOpen(event.currentTarget.open)}><summary data-testid="inbox-invite-trigger" ref={inviteRef} className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-600 bg-amber-100 text-amber-600 hover:bg-amber-100" aria-label="Convidar atendente" title="Convidar atendente" data-tip="Convidar atendente"><UserPlus size={16} aria-hidden="true" /></summary><AnchoredPopover open={inviteOpen} anchorRef={inviteRef} testId="inbox-invite-popover" align="end" role="dialog" ariaLabel="Convidar atendente" className="grid max-h-96 w-80 gap-3 overflow-auto rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-xl"><div className="flex items-center justify-between gap-3"><div><strong>Convidar atendente</strong><small>Escolha uma pessoa da equipe</small></div><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"><UserPlus size={17} aria-hidden="true" /></span></div>{agents.map(a=><div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-transparent p-2 hover:border-gray-200 hover:bg-zinc-200"><span className={"grid size-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ring-1 ring-inset ring-gray-200 " + agentToneTw[handoffHue(a.name) % agentToneTw.length]}>{a.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span><span data-testid="handoff-option-copy" className="grid min-w-0 flex-1 gap-px"><strong>{a.name}</strong><small>{a.email}</small></span><button type="button" aria-label={"Convidar "+a.name} title={"Convidar "+a.name} className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-600 bg-amber-100 text-amber-600 transition-transform hover:-translate-y-px" onClick={(event)=>{event.currentTarget.closest("details")?.removeAttribute("open");setInviteAssignee(a.id);void api("/api/backend/conversations/"+selected.id+"/invite?view="+queueView,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({userId:a.id})}).then(()=>{setInviteAssignee("");return loadConversations();}).catch(e=>setError(e instanceof Error?e.message:"Não foi possível convidar o atendente."));}}><UserPlus size={14}/></button></div>)}{!agents.length?<p className="m-1 text-xs text-slate-600">Nenhum atendente disponível.</p>:null}</AnchoredPopover></details>
{selected.archivedAt || selected.deletedAt ? <button type="button" className="grid size-8 place-items-center rounded-lg border border-blue-700 bg-blue-100 text-blue-700 hover:bg-blue-100" onClick={() => void api("/api/backend/conversations/" + selected.id + "/restore?view=" + queueView, { method: "POST" }).then(() => loadConversations()).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível restaurar."))} aria-label="Restaurar conversa" title="Restaurar conversa" data-tip="Restaurar conversa"><RotateCcw size={16} aria-hidden="true" /></button> : <><button type="button" className="grid size-8 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600 hover:bg-zinc-400 hover:text-slate-950" onClick={() => void api("/api/backend/conversations/" + selected.id + "/archive?view=" + queueView, { method: "POST" }).then(() => loadConversations()).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível arquivar."))} aria-label="Arquivar conversa" title="Arquivar conversa" data-tip="Arquivar conversa"><Archive size={16} aria-hidden="true" /></button><button type="button" className="grid size-8 place-items-center rounded-lg border border-red-600 bg-red-100 text-red-600 hover:bg-red-100" onClick={() => void api("/api/backend/conversations/" + selected.id + "/trash?view=" + queueView, { method: "POST" }).then(() => loadConversations()).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível mover para a lixeira."))} aria-label="Mover para a lixeira" title="Mover para a lixeira" data-tip="Mover para a lixeira"><Trash2 size={16} aria-hidden="true" /></button></>}
<div data-testid="thread-mobile-actions" className="hidden items-center gap-2 ib-narrow:flex">{!selected.assignee ? <button type="button" data-testid="thread-assume-mobile-button" className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-600" aria-label="Assumir conversa" onClick={() => void assumeConversation()} disabled={actionBusy}><UserPlus size={17} aria-hidden="true" /></button> : null}<button type="button" data-testid="thread-transfer-mobile-button" className="grid size-8 shrink-0 place-items-center rounded-lg text-blue-600" aria-label="Direcionar conversa" onClick={() => window.dispatchEvent(new Event("vexora:mobile-transfer"))}><ArrowRightLeft size={17} aria-hidden="true" /></button><button type="button" data-testid="thread-finalize-mobile-button" className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-white" aria-label="Finalizar atendimento" onClick={() => window.dispatchEvent(new Event("vexora:mobile-finalize"))}><CheckCircle2 size={17} aria-hidden="true" /></button></div>
</div></header>
        
        {canReply&&selected.channel!=='WHATSAPP'&&<WhatsappBridge conversationId={selected.id} view={queueView} onOpen={id=>{notificationFocus.current=id;setQueueView('all-open');setSelectedId(id);void loadConversations();setMobileThreadOpen(true)}}/>}
        {channels.filter(c=>c.provider==='WAHA'&&(c.status!=='CONNECTED'||!c.healthCheckedAt||Date.now()-Date.parse(c.healthCheckedAt)>90000)).map(c=><div className="m-2 flex flex-wrap items-start gap-2 rounded-lg border border-dashed border-red-600 bg-red-100 p-2.5 text-xs leading-relaxed text-slate-600" role="alert" key={c.id}><strong>{c.name}: {c.status==='CONNECTED'?'verificação desatualizada':c.status==='UNKNOWN'?'conexão não verificada':'WhatsApp desconectado ou aguardando conexão'}</strong><span>{c.lastError||'Mensagens podem não ser recebidas nem respondidas.'} Última verificação: {c.healthCheckedAt?new Date(c.healthCheckedAt).toLocaleTimeString('pt-BR'):'ainda não realizada'}.</span><a href="/?module=Canais%20e%20integra%C3%A7%C3%B5es">Ver conexões</a></div>)}<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4" ref={threadScrollRef} onScroll={e=>{const el=e.currentTarget;threadPinnedRef.current=el.scrollHeight-el.scrollTop-el.clientHeight<110}}>
          {hasOlderMessages&&<button type="button" className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={olderMessagesLoading} onClick={()=>void loadOlderMessages()}>{olderMessagesLoading ? "Carregando mensagens anteriores…" : "Carregar mensagens anteriores"}</button>}
          {messages.map((message, index) => {
            const showDateSeparator = index === 0 || messageDateKey(messages[index - 1]!.occurredAt) !== messageDateKey(message.occurredAt);
            const hasMedia = message.metadata?.hasMedia === true || typeof message.metadata?.mediaUrl === "string";
            const isHandoffContext = message.metadata?.kind === "handoff_context" || message.senderName === "Contexto do atendimento";
            const internalTone = internalToneTw[isHandoffContext ? "context" : "private"];
            const mediaUrl = ["audio", "image", "video", "file"].includes(message.contentType) ? mediaUrlOf(message) : "";
            return <Fragment key={message.id}>{showDateSeparator&&<div data-testid="message-date-separator" className="self-center rounded-full border border-gray-200 px-3 py-0.5 text-xs text-slate-600" role="separator" aria-label={messageDateLabel(message.occurredAt)}><span>{messageDateLabel(message.occurredAt)}</span></div>}{message.direction === "INTERNAL" ? <div className="flex justify-center px-3 py-0.5"><div className={"grid w-full max-w-xl gap-1.5 rounded-lg " + internalTone.card}><header className="flex flex-wrap items-center gap-1.5"><span className={"grid size-5 shrink-0 place-items-center " + internalTone.icon} aria-hidden="true">{message.metadata?.kind === "handoff_context" || message.senderName === "Contexto do atendimento" ? <Sparkles size={12}/> : <StickyNote size={12}/>}</span><strong className={internalTone.title}>{message.metadata?.kind === "handoff_context" || message.senderName === "Contexto do atendimento" ? "Contexto do atendimento" : "Nota privada de " + (message.senderName || "Equipe")}</strong><small className={internalTone.badge}>Só a equipe vê</small><time className={internalTone.time}>{new Date(message.occurredAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time></header><div className={internalTone.body}><MessageText content={message.content || "Anexo recebido (" + message.contentType + ")"} deleted={message.metadata?.deleted===true}/></div>{message.metadata?.linkedConversationId&&/^[a-f0-9-]{36}$/i.test(message.metadata.linkedConversationId) ? <div className="flex justify-end"><button type="button" className={"inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-bold " + internalTone.link} onClick={() => { const linked = message.metadata!.linkedConversationId!; notificationFocus.current = linked; setQueueView("all-open"); setSelectedId(linked); void loadConversations(); setMobileThreadOpen(true); }}>Abrir conversa vinculada</button></div> : null}{message.metadata?.kind === "handoff_context" && !selected.assignee && (selected.status === "OPEN" || selected.status === "PENDING") ? <div className="mt-0.5 flex justify-end"><button type="button" className={"inline-flex min-h-8 items-center justify-center gap-2 rounded-md border border-transparent px-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 " + internalTone.action} onClick={() => void assumeConversation()} disabled={actionBusy}>{actionBusy ? "Assumindo…" : "Assumir conversa"}</button></div> : null}</div></div> : <div data-testid="message-line" data-direction={message.direction} className={message.direction === "OUTBOUND" ? "flex justify-end" : "flex justify-start"}><div data-testid="message-bubble" data-internal={message.direction === "INTERNAL" ? "true" : "false"} className={"max-w-2xl break-words rounded-xl border p-2.5 font-sans text-sm shadow " + (message.direction === "OUTBOUND" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 bg-zinc-100 text-slate-950")} onContextMenu={event=>{event.preventDefault();setMessageMenu({message,x:Math.min(event.clientX,window.innerWidth-220),y:Math.min(event.clientY,window.innerHeight-130)})}}>{message.direction==="OUTBOUND"&&message.senderName&&<strong className="mb-0.5 flex items-center gap-1.5"><b>{message.senderName}</b>{message.metadata?.departmentName?<small className="text-white/75">{message.metadata.departmentName}</small>:null}</strong>}{message.direction==="INTERNAL"&&<strong className="text-xs font-bold text-slate-600">Interno · {message.senderName||"Equipe"}{message.metadata?.departmentName?" · "+message.metadata.departmentName:""} · não enviado ao cliente</strong>}{mediaUrl ? (<>{message.contentType==="audio" ? <AudioMessage src={mediaUrl}/> : message.contentType==="image" ? <img data-testid="inbox-image-message" className="cursor-zoom-in rounded-lg" src={mediaUrl} alt={typeof message.metadata?.filename==="string" ? message.metadata.filename : "Imagem recebida"} loading="lazy" role="button" tabIndex={0} aria-label="Ampliar imagem" onClick={() => setLightboxSrc(mediaUrl)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLightboxSrc(mediaUrl); } }}/> : message.contentType==="video" ? <video className="max-h-80 rounded-lg" controls preload="metadata" src={mediaUrl} aria-label="Vídeo recebido"/> : <a className="inline-flex items-center gap-1.5 text-sm font-bold underline underline-offset-2" href={mediaUrl} target="_blank" rel="noreferrer"><Paperclip size={15}/>{typeof message.metadata?.filename==="string" ? message.metadata.filename : "Abrir arquivo"}</a>}{message.content ? <MessageText content={message.content} deleted={message.metadata?.deleted===true}/> : null}</>) : <>{message.metadata?.linkPreview ? <LinkPreview preview={message.metadata.linkPreview}/> : null}<MessageText content={message.content || "Anexo recebido (" + message.contentType + ")"} deleted={message.metadata?.deleted===true}/></>}{hasMedia&&message.metadata?.mediaDelivery==="UNAVAILABLE"?<span data-testid="inbox-media-placeholder" className="inline-flex items-center gap-1.5 rounded-md border border-current px-2 py-1 text-xs font-bold" title="Anexo sem download disponível"><Paperclip size={14} aria-hidden="true" />Anexo: {message.metadata.filename||message.metadata.contentType||"arquivo"}{message.metadata.mimetype?" · "+message.metadata.mimetype:""} · download indisponível</span>:null}{message.direction==='INTERNAL'&&message.metadata?.linkedConversationId&&/^[a-f0-9-]{36}$/i.test(message.metadata.linkedConversationId)&&<button type="button" className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-zinc-400" onClick={()=>{const id=message.metadata!.linkedConversationId!;notificationFocus.current=id;setQueueView('all-open');setSelectedId(id);void loadConversations();setMobileThreadOpen(true)}}>Abrir conversa vinculada</button>}<small><span className="text-white/75">{new Date(message.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><MessageStatus message={message} onBrand /></small>{messageMenu?.message.id===message.id?createPortal(<div data-testid="message-context-menu" className="fixed z-40 grid max-h-60 min-w-48 gap-1.5 overflow-auto rounded-lg border border-gray-200 bg-zinc-100 p-1.5 shadow-xl" style={{left:messageMenu.x,top:messageMenu.y}} role="menu" aria-label="Ações da mensagem" onClick={event=>event.stopPropagation()}><button type="button" role="menuitem" onClick={()=>{quoteReply(message)}}><Quote size={15} aria-hidden="true"/>Responder</button>{mediaUrl?<><button type="button" role="menuitem" onClick={()=>{downloadMedia(message)}}><Download size={15} aria-hidden="true"/>Baixar</button><button type="button" role="menuitem" onClick={()=>{void copyMediaLink(message)}}><Link2 size={15} aria-hidden="true"/>Copiar link</button></>:null}<button type="button" role="menuitem" onClick={()=>void deleteMessage(message,"ME")}><Trash2 size={15} aria-hidden="true"/>Excluir para mim</button>{message.direction==="OUTBOUND"&&<button type="button" role="menuitem" className="text-red-600" onClick={()=>void deleteMessage(message,"ALL")}><Trash2 size={15} aria-hidden="true"/>Excluir para todos</button>}</div>,document.body):null}{message.direction==="OUTBOUND"&&(message.metadata&&(message.metadata as Record<string,unknown>).engine===true||message.metadata&&(message.metadata as Record<string,unknown>).bot===true||message.senderName==="Véxora Intelligence Engine"||message.senderName==="Assistente virtual")?<span className="flex items-center gap-1.5 px-3.5 pt-1 text-xs text-blue-100"><Sparkles size={11} aria-hidden="true" /><em>{message.senderName||"Véxora Intelligence Engine"} · IA</em></span>:null}</div></div>}</Fragment>;
          })}
          {messagesLoading ? <p className="grid place-items-center p-7 text-center text-slate-600" role="status">Carregando mensagens…</p> : null}
          {!messagesLoading && messageLoadError ? <div className="grid gap-1 rounded-md border border-red-600 bg-red-100 p-3 text-xs text-slate-950" data-testid="inbox-list-error" role="alert"><strong>Não foi possível carregar as mensagens</strong><span>{messageLoadError || "Verifique sua conexão e toque em Tentar novamente."}</span><button type="button" onClick={() => selectedId && void loadMessages(selectedId)}>Tentar novamente</button></div> : null}
          {!messagesLoading && !messageLoadError && !messages.length ? <p className="grid place-items-center p-7 text-center text-slate-600">Aguardando a primeira mensagem…</p> : null}
        </div>
        {canReply ? <>
        {quickPanel === "proposal" && selected ? <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-3.5 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setQuickPanel(null); }}><section tabIndex={-1} className="grid max-h-screen w-full max-w-3xl shrink-0 grid-rows-2 overflow-hidden rounded-lg border border-gray-200 bg-zinc-100 shadow-xl" style={{ width: "min(760px, calc(100vw - 24px))", maxHeight: "min(560px, calc(100dvh - 100px))" }} role="dialog" aria-modal="true" aria-label="Orçamento"><header><strong>Orçamento · {contactDisplayName(selected.contact, selected.botState)}</strong><button type="button" aria-label="Fechar" title="Fechar · Esc" onClick={() => setQuickPanel(null)}><X size={17} /></button></header><CatalogQuotePanel conversationId={selected.id} contactName={contactDisplayName(selected.contact, selected.botState)} onClose={() => setQuickPanel(null)} onNotice={() => {}} onInsert={(text) => insertCatalogText(text)} /></section></div> : null}{quickPanel && quickPanel !== "proposal" ?<div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-3.5 backdrop-blur-sm" onClick={(event)=>{if(event.target===event.currentTarget)setQuickPanel(null);}}><section ref={quickPanel==="appointments"?appointmentModalRef:undefined} tabIndex={-1} className="grid max-h-screen w-full max-w-3xl shrink-0 grid-rows-2 overflow-hidden rounded-lg border border-gray-200 bg-zinc-100 shadow-xl" style={quickPanel==="appointments"?{width:"min(760px, calc(100vw - 24px))",height:"min(720px, calc(100dvh - 100px))"}:{width:quickPanelSize.width,height:quickPanelSize.height}} role={quickPanel==="appointments"?"dialog":"region"} aria-modal={quickPanel==="appointments"?true:undefined} aria-label="Ações rápidas"><header><strong>{quickPanel==="billing"?"Cobranças · "+contactDisplayName(selected.contact,selected.botState):quickPanel==="appointments"?"Agendamentos":quickPanel==="attachments"?"Anexos":"Atalhos de teclado"}</strong><button type="button" aria-label="Fechar" title="Fechar · Esc" onClick={()=>setQuickPanel(null)}><X size={17}/></button></header>{quickPanel==="billing"?<div><p className="text-sm text-slate-600">Consulte os débitos e envie ao cliente sem sair da conversa.</p><div className="flex gap-2"><input aria-label="CPF ou CNPJ do cliente" maxLength={18} autoComplete="off" inputMode="numeric" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void lookupDebts()}}} placeholder="CPF ou CNPJ" value={debtDocument} onChange={e=>{debtRequestVersion.current++;setDebtDocument(e.target.value);setDebtLookupError("");setDebtResult(null);setDebtSelected([]);setFinanceRecipientConfirmed(false);setDebtLoading(false)}}/><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={debtLoading||debtDocument.replace(/\D/g,"").length<11} onClick={()=>void lookupDebts()}>{debtLoading?"Consultando…":"Consultar"}</button></div>{debtLookupError?<p role="alert" className="text-xs text-red-600">{debtLookupError}</p>:null}{debtResult?<><div className="grid gap-0.5"><strong>{debtResult.customerName||"Cliente"}</strong><small>{debtResult.environment} · {debtResult.debts.length} débitos{debtResult.partial?" · consulta parcial":""}</small></div><div className="flex items-center justify-between gap-2"><label><input type="checkbox" checked={debtResult.debts.length>0&&debtSelected.length===debtResult.debts.length} onChange={e=>setDebtSelected(e.target.checked?debtResult.debts.map(d=>d.id):[])}/> Selecionar todos os débitos</label><span>{debtSelected.length} de {debtResult.debts.length} selecionados</span></div><div className="grid gap-1.5">{debtResult.debts.map(d=><label key={d.id}><input type="checkbox" checked={debtSelected.includes(d.id)} onChange={e=>setDebtSelected(v=>e.target.checked?[...v,d.id]:v.filter(id=>id!==d.id))}/><span>{d.description||"Cobrança"} · {/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)?d.dueDate.slice(8,10)+"/"+d.dueDate.slice(5,7)+"/"+d.dueDate.slice(0,4):d.dueDate}<small>{d.status==="OVERDUE"?"Vencida":"Pendente"}</small></span><strong>{d.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></label>)}</div>{debtResult.debts.length?<><div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-2"><span>Total em aberto</span><strong>{debtResult.debts.reduce((a,d)=>a+d.value,0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong></div><label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={financeRecipientConfirmed} onChange={e=>setFinanceRecipientConfirmed(e.target.checked)}/> Confirmei que esta conversa pertence ao destinatário correto.</label><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={!financeRecipientConfirmed||debtSending||debtResult.partial} onClick={()=>void sendFinanceText(financeSummary())}>Enviar lista de débitos</button></>:<p>Nenhuma cobrança pendente encontrada.</p>}<label>Forma de pagamento<select value={debtFormat} onChange={e=>setDebtFormat(e.target.value)}><option value="invoice">Fatura completa (link)</option><option value="boleto">Boleto completo (link)</option></select></label><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={!financeRecipientConfirmed||debtSending||!debtSelected.length||debtResult.partial||debtResult.debts.filter(d=>debtSelected.includes(d.id)).some(d=>!(debtFormat==="boleto"?d.bankSlipUrl:d.invoiceUrl))} onClick={()=>void sendFinanceText(financePayment())}>Enviar cobrança selecionada</button><small>Pix copia e cola e linha digitável exigem consulta específica ao Asaas e serão adicionados depois.</small></>:null}</div>:quickPanel==="appointments"?<InboxAppointments key={selected.id} contact={{...selected.contact, name:contactDisplayName(selected.contact,selected.botState), email:selected.contact.email}} onConfirm={text=>{setDraft(current=>current.trim()?current+"\n\n"+text:text);setQuickPanel(null);composerRef.current?.focus();}}/>:quickPanel==="attachments"?<div><p>Envie arquivos, localização ou um contato para esta conversa.</p>{attachmentFiles.length?<div className="grid gap-1.5">{attachmentFiles.map((file,index)=><div key={index}><span>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</span><button type="button" onClick={()=>setAttachmentFiles(v=>v.filter((_,i)=>i!==index))} aria-label={"Remover "+file.name}><X size={14}/></button></div>)}</div>:<p className="text-xs text-slate-600">Escolha um ou mais arquivos no clipe para preparar o envio.</p>}<div className="flex flex-wrap gap-2"><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy||!attachmentFiles.length} onClick={()=>void sendAttachmentFiles()}>Enviar arquivos</button><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} onClick={()=>void sendCurrentLocation()}>Enviar localização</button><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} onClick={()=>void sendCurrentContact()}>Enviar contato</button></div></div>:<div className="grid gap-0.5">{[["Alt+M","Menu lateral"],["Alt+P","Responder / Nota privada"],["Alt+C","Ficha do cliente"],["Alt+F","Cobranças"],["Alt+A","Agendamentos"],["Alt+U","Anexos"],["Alt+E","Emojis"],["/","Respostas rápidas"],["Alt+/","Esta lista"],["Esc","Fechar janela"]].map(([key,label])=><div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div>}<button type="button" className="grid size-8 shrink-0 cursor-nwse-resize place-items-center justify-self-end text-slate-600" style={{display:quickPanel==="appointments"?"none":undefined}} aria-label="Redimensionar janela de ações rápidas" title="Arraste para ajustar largura e altura; use as setas com foco" onPointerDown={e=>{quickResize.current={x:e.clientX,y:e.clientY,width:quickPanelSize.width,height:quickPanelSize.height};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const r=quickResize.current;if(!r)return;setQuickPanelSize({width:Math.max(Math.min(260,window.innerWidth-36),Math.min(window.innerWidth-36,r.width+r.x-e.clientX)),height:Math.max(240,Math.min(window.innerHeight-100,r.height+e.clientY-r.y))})}} onPointerUp={()=>{quickResize.current=null}} onPointerCancel={()=>{quickResize.current=null}} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){e.preventDefault();setQuickPanelSize(v=>({width:Math.max(260,Math.min(window.innerWidth-36,v.width+(e.key==="ArrowLeft"?20:e.key==="ArrowRight"?-20:0))),height:Math.max(240,Math.min(window.innerHeight-100,v.height+(e.key==="ArrowDown"?20:e.key==="ArrowUp"?-20:0)))}))}}}><MoveDiagonal2 size={14} aria-hidden="true" /></button></section></div>:null}
        <input ref={attachmentInputRef} type="file" accept={attachmentAccept} multiple style={{display:"none"}} onChange={e=>{const files=Array.from(e.target.files||[]);const valid=files.filter(file=>file.size<=16*1024*1024);setAttachmentFiles(valid);if(valid.length!==files.length)setError("Alguns arquivos excedem o limite provisório de 16 MB e não foram selecionados.");if(valid.length)setQuickPanel("attachments");e.currentTarget.value="";}}/>
        <form data-testid="inbox-composer" data-note={composerTab === "note" ? "true" : "false"} style={composerHeight ? { height: `${composerHeight}px` } : undefined} className={"relative grid min-h-0 shrink-0 gap-2 border-t border-gray-200 p-2.5 " + (composerTab === "note" ? "rounded-lg border border-dashed border-amber-600 bg-amber-100" : "")} onSubmit={composerTab === "note" ? handleNoteSubmit : sendMessage}>
        <MentionPopover mentionQuery={mentionQuery} mentionList={mentionList} mentionIndex={mentionIndex} onPick={applyMention} /><div className="flex h-2 shrink-0 cursor-row-resize items-center justify-center border-t border-transparent focus-visible:border-blue-600" role="separator" aria-orientation="horizontal" aria-label="Ajustar altura da área de mensagem" tabIndex={0} title="Arraste para ajustar a altura da área de mensagem" onPointerDown={event=>{const shell=event.currentTarget.parentElement;if(!shell)return;composerResizeStart.current={pointerY:event.clientY,height:shell.getBoundingClientRect().height};event.currentTarget.setPointerCapture(event.pointerId);setComposerHeight(shell.getBoundingClientRect().height)}} onPointerMove={event=>{const start=composerResizeStart.current;if(!start||!(event.buttons&1))return;setComposerHeight(Math.max(58,Math.min(280,start.height+start.pointerY-event.clientY)))}} onPointerUp={()=>{composerResizeStart.current=null}} onPointerCancel={()=>{composerResizeStart.current=null}} onKeyDown={event=>{if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();const current=event.currentTarget.parentElement?.getBoundingClientRect().height??58;setComposerHeight(Math.max(58,Math.min(280,(composerHeight||current)+(event.key==="ArrowUp"?16:-16))))}}}><span /></div>
{improveError ? <p className="mx-3.5 mt-1 text-xs leading-tight text-red-600" role="alert">{improveError}</p> : null}{listening ? <div className="mb-2 flex flex-wrap items-center gap-2.5 rounded-lg border border-red-600 bg-zinc-100 p-2.5 shadow" role="status" aria-live="polite"><span className="size-3 shrink-0 rounded-full bg-red-600 ring-2 ring-blue-100" aria-hidden="true" /><span className="min-w-44 text-sm font-extrabold tabular-nums text-red-600">{formatVoiceTimer(recordingSeconds)}</span><div data-testid="voice-wave" className="flex h-10 min-w-0 flex-1 items-center gap-0.5 overflow-hidden" aria-hidden="true">{recordingLevels.map((level, index) => <span key={index} style={{ height: `${Math.max(4, Math.round(level * 30))}px` }} />)}</div><span className="shrink-0 whitespace-nowrap text-xs text-slate-600">Gravando a sua fala…</span><button type="button" className="grid size-9 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 transition-transform hover:scale-105" onClick={() => stopVoiceRecording(false)} aria-label="Descartar áudio" data-tip="Descartar áudio"><Trash2 size={16} aria-hidden="true" /></button><button type="button" className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-md transition-transform hover:scale-105" onClick={() => stopVoiceRecording(true)} aria-label="Enviar áudio" data-tip="Enviar áudio"><Check size={16} aria-hidden="true" /></button></div> : null}<div className="flex flex-nowrap items-center gap-2 ib-narrow:flex-wrap ib-narrow:items-stretch ib-narrow:justify-between ib-narrow:gap-y-2">
<textarea data-testid="inbox-composer-input" className="order-2 min-w-0 flex-1 resize-none ib-narrow:order-first ib-narrow:basis-full rounded-md border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-sm text-slate-950 focus:border-blue-600 focus:outline-none" ref={composerRef} style={{ height: `${composerTextHeight}px`, minHeight: "34px", maxHeight: "132px", overflowY: "auto" }} rows={1} maxLength={4000} value={composerTab === "note" ? attendantNote : draft} onChange={handleComposerChange} onKeyDown={handleComposerKeyDown} placeholder={composerTab === "note" ? "Escreva sua anotação privada…" : "Digite sua mensagem..."} aria-label={composerTab === "note" ? "Anotação privada" : "Mensagem"}/><div data-testid="composer-tools" className="order-1 flex flex-nowrap shrink-0 items-center gap-1"><div data-composer-tool-wrap="true" className="relative inline-flex" ref={composerMenuRef}><button type="button" className="grid size-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" onClick={()=>{setComposerMenuOpen(v=>!v);setAttachOpen(false);setEmojiOpen(false);setQuickOpen(false)}} aria-label="Ferramentas da conversa" aria-expanded={composerMenuOpen} aria-haspopup="menu" title="Ferramentas da conversa"><Plus size={19} aria-hidden="true" /></button>{composerMenuOpen?<div className="absolute bottom-full left-2 z-30 grid min-w-52 gap-2.5 rounded-xl border border-gray-200 bg-zinc-100 p-3 shadow-xl" role="menu" aria-label="Mais ações"><button type="button" role="menuitem" onClick={()=>{setQuickPanel(v=>v==="help"?null:"help");setComposerMenuOpen(false)}}><HelpCircle size={18} aria-hidden="true"/>Atalhos<small>Alt+/</small></button><button type="button" role="menuitem" onClick={()=>{setQuickPanel(v=>v==="billing"?null:"billing");setComposerMenuOpen(false)}}><Wallet size={18} aria-hidden="true"/>Cobranças<small>Alt+F</small></button><button type="button" role="menuitem" onClick={()=>{setQuickPanel(v=>v==="appointments"?null:"appointments");setComposerMenuOpen(false)}}><CalendarDays size={18} aria-hidden="true"/>Agendamentos<small>Alt+A</small></button><button type="button" role="menuitem" onClick={()=>{setQuickPanel(v=>v==="proposal"?null:"proposal");setComposerMenuOpen(false)}}><PackageSearch size={18} aria-hidden="true"/>Orçamento<small>Alt+O ou +D</small></button><button type="button" role="menuitem" onClick={()=>{setQuickOpen(v=>!v);setQuickActiveIndex(0);setEmojiOpen(false);setComposerMenuOpen(false)}}><BookmarkPlus size={18} aria-hidden="true"/>Respostas rápidas<small>/</small></button></div>:null}{quickOpen?<div data-testid="quick-replies-popover" className="absolute bottom-full left-2 z-30 grid max-h-screen w-full max-w-xl gap-2.5 overflow-y-auto rounded-xl border border-gray-200 bg-zinc-100 p-3 shadow-xl"><div className="flex min-w-0 items-center justify-between gap-2.5"><strong>Respostas rápidas</strong><div className="flex items-center gap-1.5"><button type="button" className="inline-flex min-h-6 items-center gap-1 rounded-full border border-gray-200 bg-zinc-200 px-2 text-xs font-bold text-slate-600 transition-colors hover:border-gray-300 hover:text-slate-950" onClick={()=>{resetQuickEditor();setQuickEditorOpen(true);setQuickSettingsOpen(false)}}><Plus size={13}/> Nova</button><button type="button" className="inline-flex min-h-6 items-center gap-1 rounded-full border border-gray-200 bg-zinc-200 px-2 text-xs font-bold text-slate-600 transition-colors hover:border-gray-300 hover:text-slate-950" onClick={()=>setQuickSettingsOpen(v=>!v)}>{quickSettingsOpen?"Voltar":"Configurar frases"}</button><button type="button" className="grid size-7 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" onClick={()=>setQuickOpen(false)} aria-label="Fechar respostas rápidas"><X size={15}/></button></div></div>{quickSettingsOpen ? <div className="grid max-h-96 gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-zinc-200 p-2.5"><label>Nome da empresa<input value={quickReplySettings.companyName} onChange={e=>setQuickReplySettings(v=>({...v,companyName:e.target.value}))} placeholder="Nome usado em {{empresa}}"/></label><strong>Saudações por horário</strong>{([{key:"dawn",label:"Madrugada"},{key:"morning",label:"Manhã"},{key:"afternoon",label:"Tarde"},{key:"evening",label:"Noite"}] as const).map(period=><label key={"g-"+period.key}>{period.label}<input value={quickReplySettings.greetings[period.key]} onChange={e=>setQuickReplySettings(v=>({...v,greetings:{...v.greetings,[period.key]:e.target.value}}))}/></label>)}<strong>Despedidas por horário</strong>{([{key:"dawn",label:"Madrugada"},{key:"morning",label:"Manhã"},{key:"afternoon",label:"Tarde"},{key:"evening",label:"Noite"}] as const).map(period=><label key={"f-"+period.key}>{period.label}<input value={quickReplySettings.farewells[period.key]} onChange={e=>setQuickReplySettings(v=>({...v,farewells:{...v.farewells,[period.key]:e.target.value}}))}/></label>)}<button type="button" onClick={()=>void saveQuickReplySettings()} disabled={quickSettingsSaving}>{quickSettingsSaving?"Salvando…":"Salvar frases da empresa"}</button></div> : <><input className="min-h-8 w-full px-2.5 text-sm" value={quickSearch} onChange={e=>setQuickSearch(e.target.value)} placeholder="Buscar por nome, categoria, atalho ou conteúdo…" aria-label="Buscar respostas rápidas"/>{filteredQuickReplies.map((q,index)=><div className="flex items-stretch gap-1.5" key={q.id}><button type="button" data-testid="quick-reply-use" data-active={quickActiveIndex===index?"true":"false"} className={"min-w-0 flex-1 rounded-lg border p-2 text-left transition-colors "+(quickActiveIndex===index?"border-blue-600 bg-blue-50":"border-gray-200 bg-zinc-200 hover:border-gray-300")} onClick={()=>applyQuickReply(q)}><b>{q.title}</b><small>{q.category || "Geral"}{q.shortcut ? " · /"+q.shortcut : ""}</small><small>{resolveQuickReply(q.content)}</small></button><button type="button" className="grid w-8 shrink-0 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600 hover:bg-zinc-400 hover:text-slate-950" aria-label={"Editar "+q.title} title="Editar resposta" onClick={()=>editQuickReply(q)}><Keyboard size={14}/></button><button type="button" className="grid w-8 shrink-0 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600 hover:bg-red-100 hover:text-red-600" aria-label="Excluir resposta" onClick={()=>saveQuickReplies(quickReplies.filter(x=>x.id!==q.id))}><X size={14}/></button></div>)}{quickEditorOpen ? <div className="grid gap-2 rounded-lg border border-gray-200 bg-zinc-200 p-2.5"><div className="flex items-center justify-between gap-2"><strong>{quickEditingId?"Editar resposta rápida":"Nova resposta rápida"}</strong><button type="button" onClick={resetQuickEditor} aria-label="Fechar editor"><X size={15}/></button></div><input value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} placeholder="Nome da resposta"/><div className="grid grid-cols-2 gap-1.5"><input value={quickCategory} onChange={e=>setQuickCategory(e.target.value)} placeholder="Categoria (ex.: Cobrança)"/><input value={quickShortcut} onChange={e=>setQuickShortcut(e.target.value.replace(/\s/g,""))} placeholder="Atalho opcional (ex.: oi)"/></div><textarea ref={quickContentRef} rows={3} value={quickContent} onChange={e=>setQuickContent(e.target.value)} placeholder="Texto da resposta. Use as variáveis abaixo…"/><div className="grid gap-1.5"><strong>Inserir variável no cursor</strong><div>{quickReplyVariableCatalog().map(variable=><button type="button" key={variable.token} title={variable.hint} onClick={()=>insertQuickToken(variable.token)}>{variable.token}</button>)}</div></div><div className="grid gap-1.5"><strong>Prévia</strong><p>{resolveQuickReply(quickContent || "Olá, {{novo_nome}}! {{saudacao}} {{despedida}}")}</p></div><button ref={quickReplyEmojiRef} type="button" className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-xs font-bold text-slate-600 hover:bg-zinc-400" title="Inserir emoji no texto da resposta" aria-haspopup="dialog" aria-expanded={emojiOpen && emojiTarget === "quick-reply"} aria-controls="composer-emoji-popover" onClick={(event)=>{emojiTriggerRef.current=event.currentTarget;setEmojiAnchorRef(quickReplyEmojiRef);setEmojiTarget("quick-reply");setEmojiOpen(true);}}><Smile size={14} aria-hidden="true"/> Inserir emoji</button><button type="button" onClick={createQuickReply} disabled={!quickTitle.trim()||!quickContent.trim()}><Plus size={14}/> {quickEditingId?"Salvar alterações":"Criar resposta"}</button></div> : null}</> }</div>:null}</div><button type="button" className="grid size-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" data-testid="composer-mode-button" aria-pressed={composerTab === "note"} aria-keyshortcuts="Alt+P" aria-label={composerTab === "note" ? "Nota privada" : "Responder"} title={composerTab === "note" ? "Nota privada · Alt+P para responder" : "Responder · Alt+P para nota privada"} onClick={() => setComposerTab(v => v === "reply" ? "note" : "reply")}>{composerTab === "note" ? <Lock size={17} aria-hidden="true" /> : <MessageCircle size={17} aria-hidden="true" />}</button><div data-composer-tool-wrap="true" className="relative inline-flex"><button ref={emojiRef} type="button" className="grid size-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" data-tip="Emojis · Alt+E" onClick={(event)=>{emojiTriggerRef.current=event.currentTarget;setEmojiAnchorRef(emojiRef);setEmojiTarget("composer");setEmojiOpen(v=>!v);setQuickOpen(false);setAttachOpen(false);setComposerMenuOpen(false)}} aria-label="Emojis" aria-haspopup="dialog" aria-expanded={emojiOpen && emojiTarget === "composer"} aria-controls="composer-emoji-popover"><Smile size={18} aria-hidden="true"/></button>{emojiOpen?<AnchoredPopover open={emojiOpen} anchorRef={emojiAnchorRef} testId="composer-emoji-popover" id="composer-emoji-popover" side="top" align="center" portal role="dialog" ariaLabel="Emojis" className="grid w-full max-w-3xl gap-2.5 rounded-xl border border-gray-200 bg-zinc-100 p-3 shadow-xl"><div className="flex min-w-0 items-center justify-between gap-2.5"><strong>Emojis</strong><button type="button" className="grid size-7 place-items-center rounded-lg border border-gray-200 bg-zinc-200 text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950" onClick={()=>closeEmoji(true)} aria-label="Fechar emojis"><X size={15} aria-hidden="true"/></button></div><input className="min-h-8 w-full px-2.5 text-sm" value={emojiSearch} onChange={e=>setEmojiSearch(e.target.value)} placeholder="Buscar emoji ou categoria…" aria-label="Buscar emoji"/><div data-testid="emoji-category-tabs" className="flex gap-1 overflow-x-auto pb-0.5">{recentEmojis.length ? <button type="button" data-testid="emoji-category" data-active={emojiCategory==="Recentes"?"true":"false"} className={"rounded-full px-2 py-0.5 text-xs font-bold "+(emojiCategory==="Recentes"?"bg-blue-600 text-white":"text-slate-600 hover:bg-zinc-400")} onClick={()=>setEmojiCategory("Recentes")}>Recentes</button> : null}<button type="button" data-testid="emoji-category" data-active={emojiCategory==="Todos"?"true":"false"} className={"rounded-full px-2 py-0.5 text-xs font-bold "+(emojiCategory==="Todos"?"bg-blue-600 text-white":"text-slate-600 hover:bg-zinc-400")} onClick={()=>setEmojiCategory("Todos")}>Todos</button>{Object.keys(emojiGroups).map(group=><button type="button" key={group} data-testid="emoji-category" data-active={emojiCategory===group?"true":"false"} className={"rounded-full px-2 py-0.5 text-xs font-bold "+(emojiCategory===group?"bg-blue-600 text-white":"text-slate-600 hover:bg-zinc-400")} onClick={()=>setEmojiCategory(group)}>{group}</button>)}</div><div data-testid="emoji-grid" className="grid max-h-64 grid-cols-6 gap-0.5 overflow-y-auto p-0.5">{visibleEmojis.flatMap(([group,values])=>values.map(x=><button type="button" key={group+x} title={EMOJI_NAME_BY_VALUE[x] || group} aria-label={"Inserir emoji "+(EMOJI_NAME_BY_VALUE[x] || x)} onClick={()=>insertEmoji(x)}>{x}</button>))}</div>{!visibleEmojis.length?<small className="m-0 text-xs text-slate-600">Nenhum emoji encontrado. Tente outra busca.</small>:null}</AnchoredPopover>:null}</div><div data-composer-tool-wrap="true" className="relative inline-flex"><button type="button" className="grid size-8 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" title="Anexar" aria-label="Anexar" aria-haspopup="menu" aria-expanded={attachOpen} aria-controls="composer-attachments" onClick={()=>{setAttachOpen(v=>!v);setEmojiOpen(false);setQuickOpen(false);setComposerMenuOpen(false)}}><Paperclip size={18} aria-hidden="true" /></button>{attachOpen?<div className="absolute bottom-full left-2 z-30 grid min-w-44 gap-1 rounded-xl border border-gray-200 bg-zinc-100 p-2 shadow-xl" role="menu" id="composer-attachments" aria-label="O que você quer anexar"><button type="button" role="menuitem" onClick={()=>{setAttachmentAccept("image/*");attachmentInputRef.current?.click();setAttachOpen(false)}}><ImagePlus size={16} aria-hidden="true"/>Imagem</button><button type="button" role="menuitem" onClick={()=>{setAttachmentAccept("video/mp4,video/3gpp,video/quicktime");attachmentInputRef.current?.click();setAttachOpen(false)}}><Film size={16} aria-hidden="true"/>Vídeo</button><button type="button" role="menuitem" onClick={()=>{setAttachmentAccept(".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip");attachmentInputRef.current?.click();setAttachOpen(false)}}><FileText size={16} aria-hidden="true"/>Documentos</button><button type="button" role="menuitem" onClick={()=>{setQuickPanel("appointments");setAttachOpen(false)}}><CalendarDays size={16} aria-hidden="true"/>Evento</button><button type="button" role="menuitem" onClick={()=>{setAttachOpen(false);void sendCurrentLocation()}}><MapPin size={16} aria-hidden="true"/>Localização atual</button><button type="button" role="menuitem" onClick={insertCompanyMap}><MapPinned size={16} aria-hidden="true"/>Localização da empresa</button><button type="button" role="menuitem" onClick={()=>{setAttachOpen(false);void sendCurrentContact()}}><UserRound size={16} aria-hidden="true"/>Enviar contato</button></div>:null}</div><button type="button" className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void improveDraftWithAi()} disabled={improveBusy || !(composerTab === "note" ? attendantNote.trim() : draft.trim())} aria-label="Melhorar texto com IA" title="Melhorar texto com IA">{improveBusy ? <Sparkles size={17} className="animate-spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}</button></div><div className="order-3 flex shrink-0 items-center gap-1">{composerTab !== "note" ? <button type="button" data-testid="composer-icon-button" data-recording={listening ? "true" : "false"} className={"grid size-8 place-items-center rounded-lg " + (listening ? "border border-red-600 bg-red-100 text-red-600" : "text-slate-600 hover:bg-zinc-400 hover:text-slate-950")} data-tip={listening ? "Parar gravação" : "Gravar áudio"} aria-label={listening ? "Parar gravação" : "Gravar áudio"} onClick={toggleVoice}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button> : null}{composerTab !== "note" ? <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" type="submit" aria-label={busy ? "Enviando mensagem" : "Enviar mensagem"} disabled={busy||listening||!draft.trim()}>{busy?<RotateCcw size={16}/>:<Send size={16}/>}<span>{busy?"Enviando":"Enviar"}</span></button> : <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" type="submit" aria-label="Salvar anotação" disabled={attendantNoteBusy||!attendantNote.trim()}>{attendantNoteBusy?<RotateCcw size={16}/>:<Check size={16}/>}<span>{attendantNoteBusy?"Salvando":"Salvar nota"}</span></button>}</div></div></form>
        </> : isOpen ? <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-gray-200 p-2 text-sm text-slate-600">
          <span>{selected.handlingMode === "BOT" ? "Em atendimento pelo chatbot." : "Assuma a conversa para responder ao cliente."}</span>
          <button type="button" data-testid="inbox-assume-button" className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void assumeConversation()} disabled={actionBusy}><UserPlus size={16} aria-hidden="true" /> Assumir conversa</button>
        </div> : null}
      </> : <div className="grid flex-1 place-items-center gap-2.5 border-0 p-12 text-center text-slate-600"><span className="grid mb-1 size-20 place-items-center rounded-xl bg-blue-50 text-blue-600"><MessagesSquare size={22} aria-hidden="true" /></span><p>As mensagens recebidas aparecerão aqui.</p></div>}
    </div>
    {selected && contactProfileExpanded ? <div className="flex w-2 shrink-0 cursor-col-resize border-l-2 border-gray-200 rw-laptop:hidden hover:border-blue-600 focus-visible:border-blue-600" role="separator" aria-orientation="vertical" aria-label="Ajustar a largura da ficha do cliente" tabIndex={0} onPointerDown={startResize("ficha")} onKeyDown={resizeByKey("ficha")} /> : null}
    {selected ? <div className={"flex min-h-0 shrink-0 " + (contactProfileExpanded ? "w-(--inbox-ficha-w)" : "w-14")}><ContactProfilePanel contact={selected.contact} conversationId={selected.id} status={selected.status} createdAt={selected.createdAt} displayName={contactDisplayName(selected.contact,selected.botState)} channel={selected.channel} expanded={contactProfileExpanded} onOpenAppointments={() => setQuickPanel("appointments")} onOpenBilling={() => setQuickPanel("billing")} onExpandedChange={expanded => { setContactProfileExpanded(expanded); if (!expanded) setFichaOpen(false); }} /></div> : null}

    {finalizationOpen && selected ? <VexoraDialog open title="Finalizar atendimento" subtitle={`Qual foi o resultado comercial de ${selected.contact.name}?`} icon={<CheckCircle2 size={22}/>} onClose={() => { if (!actionBusy) setFinalizationOpen(false); }} footer={<><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-zinc-100 px-3.5 text-xs font-bold text-slate-950 transition-colors hover:bg-zinc-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={actionBusy} onClick={() => setFinalizationOpen(false)}>Cancelar</button><button type="button" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-transparent bg-blue-600 px-4 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={!finalizationOutcome || (finalizationOutcome === "LOST" && !finalizationReason) || actionBusy} onClick={() => void confirmConversationFinalization()}>{actionBusy ? "Finalizando…" : "Confirmar finalização"}</button></>}><div data-testid="finalization-outcomes" className="grid grid-cols-2 gap-2.5"><button type="button" data-testid="finalization-outcome" data-outcome="WON" data-selected={finalizationOutcome === "WON" ? "true" : "false"} className={"flex min-h-9 items-center gap-3 rounded-lg border border-gray-200 bg-zinc-200 p-3.5 text-left " + (finalizationOutcome === "WON" ? "border-blue-700 bg-blue-100" : "hover:border-gray-300")} onClick={() => { setFinalizationOutcome("WON"); setFinalizationReason(""); }}><Check size={17}/><span><strong>Ganho</strong><small>Converter lead em cliente</small></span></button><button type="button" data-testid="finalization-outcome" data-outcome="LOST" data-selected={finalizationOutcome === "LOST" ? "true" : "false"} className={"flex min-h-9 items-center gap-3 rounded-lg border border-gray-200 bg-zinc-200 p-3.5 text-left " + (finalizationOutcome === "LOST" ? "border-red-600 bg-red-100" : "hover:border-gray-300")} onClick={() => setFinalizationOutcome("LOST")}><X size={17}/><span><strong>Perda</strong><small>Registrar motivo da perda</small></span></button></div>{finalizationOutcome === "LOST" ? <label className="mt-3 grid gap-1.5 text-sm font-bold">Motivo da perda<select required value={finalizationReason} onChange={(event) => setFinalizationReason(event.target.value)}><option value="">Selecione o motivo…</option>{lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label> : null}<p className="mt-2.5 text-xs leading-relaxed text-slate-600">A conversa sairá da fila de mensagens e o contato será retirado do Kanban. O histórico continuará disponível em Contatos.</p></VexoraDialog> : null}
    {initialListError ? <div className="fixed bottom-4 right-4 z-30 grid max-w-xl gap-2 rounded-lg border border-red-600 bg-zinc-100 p-3 shadow-xl" role="alert" aria-live="assertive"><span>{initialListError}</span><button type="button" onClick={() => void loadInitialLists()}>Tentar novamente</button><button type="button" onClick={() => setInitialListError("")} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button></div> : null}{error ? <div className="fixed bottom-4 right-4 z-30 grid max-w-xl gap-2 rounded-lg border border-red-600 bg-zinc-100 p-3 shadow-xl" role="alert" aria-live="assertive"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button></div> : null}
    {lightboxSrc ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Imagem ampliada" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightboxSrc(null); }} onKeyDown={(event) => { if (event.key === "Escape") setLightboxSrc(null); }}><button type="button" className="absolute right-4 top-4 grid size-11 place-items-center rounded-lg bg-zinc-200 text-slate-950 transition-transform hover:scale-105" aria-label="Fechar imagem" autoFocus onClick={() => setLightboxSrc(null)}><X size={20} aria-hidden="true" /></button><img src={lightboxSrc} alt="Imagem ampliada" /></div> : null}
  </section>;
}

