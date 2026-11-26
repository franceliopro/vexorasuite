"use client";
import {ChangePasswordScreen} from "./change-password-screen";
import {CompanySwitcher} from "./company-switcher";
import { SettingsCatalog } from "./settings-catalog";
import { CatalogSettings } from "./catalog-settings";
import { MentionNotifications } from "./mention-notifications";
import { PwaControls, disableDeviceNotifications } from "./pwa-controls";
import { ReminderCenter } from "./reminder-center";
import { AlarmCenter } from "./alarm-center";
import { DashboardWidgets } from "./dashboard-widgets";
import { OnboardingChecklist } from "./onboarding-checklist";
import { DashboardWelcome } from "./dashboard-welcome";
const DocumentsWorkspace=dynamic(()=>import("./documents-workspace").then(module=>module.DocumentsWorkspace),{loading:()=> <p role="status">Carregando módulo.</p>});
const CourseWorkspace=dynamic(()=>import("./course-workspace").then(module=>module.CourseWorkspace),{loading:()=> <p role="status">Carregando curso.</p>});
const WorkflowsWorkspace=dynamic(()=>import("./workflows-workspace").then(m=>m.WorkflowsWorkspace));
import { applyBrandAll, sanitizeHex, wcagRatio, HYBRID_SIDEBAR_DEFAULTS } from "../lib/brand-theme";
import { TailwindColorPicker, TailwindPalettePreview } from "./tailwind-color-picker";
import { applyThemeColor } from "../lib/theme-color";
const CreativeLibraryWorkspace=dynamic(()=>import("./creative-library-workspace").then(module=>module.CreativeLibraryWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const ClientPlansWorkspace=dynamic(()=>import("./client-plans-workspace").then(module=>module.ClientPlansWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const ReportsWorkspace=dynamic(()=>import("./reports-workspace").then(module=>module.ReportsWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const PlatformAdminWorkspace=dynamic(()=>import("./platform-admin-workspace").then(module=>module.PlatformAdminWorkspace),{loading:()=> <p role="status">Carregando painel…</p>});

import { WorkspaceAlerts } from "./workspace-alerts";
import { OverviewIntelligence, type OverviewSnapshot } from "./overview-intelligence";
import { SidebarProfile } from "./sidebar-profile";
import { useGlobalPhoneMask } from "../hooks/useGlobalPhoneMask";
const TeamWorkspace=dynamic(()=>import("./team-workspace").then(m=>m.TeamWorkspace));
import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AuthScreen, type AuthSession } from "./auth-screen";
const InboxWorkspace=dynamic(()=>import("./inbox-workspace").then(module=>module.InboxWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const OperationsSettings=dynamic(()=>import("./operations-settings").then(module=>module.OperationsSettings),{loading:()=> <p role="status">Carregando módulo…</p>});
const CrmWorkspace=dynamic(()=>import("./crm-workspace").then(module=>module.CrmWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const FinanceWorkspace=dynamic(()=>import("./finance-workspace").then(module=>module.FinanceWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const FinanceProviderWorkspace=dynamic(()=>import("./finance-provider-workspace").then(module=>module.FinanceProviderWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const ChannelsIntegrations=dynamic(()=>import("./channels-integrations").then(module=>module.ChannelsIntegrations),{loading:()=> <p role="status">Carregando módulo…</p>});
const CalendarWorkspace=dynamic(()=>import("./calendar-workspace").then(module=>module.CalendarWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const TasksWorkspace=dynamic(()=>import("./tasks-workspace").then(module=>module.TasksWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const ChatbotWorkspace=dynamic(()=>import("./chatbot-workspace").then(module=>module.ChatbotWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const AiAgentsWorkspace=dynamic(()=>import("./ai-agents-workspace").then(module=>module.AiAgentsWorkspace));
const PersonalAssistantPanel=dynamic(()=>import("./ai-agents-workspace").then(module=>module.PersonalAssistantPanel));

const workspacePreloaders:Partial<Record<string,()=>Promise<unknown>>>={
  "Atendimento":()=>import("./inbox-workspace"),
  "CRM":()=>import("./crm-workspace"),
  "Calendários":()=>import("./calendar-workspace"),
  "Agenda":()=>import("./calendar-workspace"),
  "Tarefas":()=>import("./tasks-workspace"),
  "Chatbots":()=>import("./chatbot-workspace"),
  "Workflows":()=>import("./workflows-workspace"),
  "Agentes de IA":()=>import("./ai-agents-workspace"),
  "Planos e preços":()=>import("./client-plans-workspace"),
  "Biblioteca de referências":()=>import("./creative-library-workspace"),
  "Referências criativas":()=>import("./creative-library-workspace"),
  "Google Drive":()=>import("./creative-library-workspace"),
  "Relatórios":()=>import("./reports-workspace"),
  "Financeiro":()=>import("./finance-workspace"),
  "Gestão":()=>import("./finance-workspace"),
  "Asaas":()=>import("./finance-provider-workspace"),
  "Stripe":()=>import("./finance-provider-workspace"),
  "InfinitePay":()=>import("./finance-provider-workspace"),
  "Conexões":()=>import("./channels-integrations"),
  "Configurações":()=>import("./operations-settings"),
  "Atendentes":()=>import("./team-workspace"),
};
function preloadWorkspace(label:string){
  const targets=label==="Automação"?["Chatbots","Workflows","Agentes de IA"]:[label];
  for(const target of targets){const load=workspacePreloaders[target];if(load)void load().catch(()=>{});}
}
import {
  CalendarDays,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  SunMoon,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Settings2,
  Sparkles,
  Wallet,
  Workflow,
  ListTodo,
  UsersRound,
  Share2,
  Download,
  MoreHorizontal,
  Image,
  Globe,
  ExternalLink,
  Menu,
  Search,
  Plus,
  ArrowRight,
  ArrowRightLeft,
  UserRoundPlus,
  CheckCircle2,
  FileText,
  GraduationCap,
  X,
} from "lucide-react";

const iconMap = {
  chart: Activity,
  "layout-dashboard": LayoutDashboard,
  messages: MessagesSquare,
  users: UsersRound,
  calendar: CalendarDays,
  workflow: Workflow,
  tasks: ListTodo,
  megaphone: Megaphone,
  wallet: Wallet,
  settings: Settings2,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chart-no-axes-combined": Activity,
  sparkles: Sparkles,
  share: Share2,
  more: MoreHorizontal,
  transfer: ArrowRightLeft,
  image: Image,
  globe: Globe,
  assume: UserRoundPlus,
  finalize: CheckCircle2,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
};

function Icon({ name, size = 18, className }: { name: keyof typeof iconMap; size?: number; className?: string }) {
  const IconComponent = iconMap[name] ?? MessagesSquare;
  return <IconComponent aria-hidden="true" size={size} strokeWidth={1.7} className={className} />;
}

/** Utilities TW padrão da home: literais completas, sem tokens decorativos legados. */
const primaryButton="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-blue-950 shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-zinc-100 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60";
const authScreenTw="grid min-h-dvh place-items-center bg-zinc-50 p-5";
const authPanelTw="mx-auto grid w-full max-w-md content-center gap-4 p-8";
const contrastOkTw="inline-flex self-start rounded-full border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-bold tracking-wide text-blue-700";
const contrastWarnTw="inline-flex self-start rounded-full border border-amber-600 bg-amber-100 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-600";
const colorPickerTw="flex flex-wrap items-center gap-2.5";
const colorInputTw="h-10 w-12 flex-none cursor-pointer rounded-lg border border-gray-200 bg-zinc-100 p-0.5";
const colorHexTw="min-w-0 flex-1";
const crumbSlashTw="hidden text-slate-600";
const themeToggleTw="grid size-11 min-h-11 place-items-center rounded-lg border-0 bg-transparent text-slate-600 transition-colors hover:bg-zinc-200 hover:text-slate-950";
const textButtonTw="inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap px-1.5 text-sm font-bold text-blue-700";
const textButtonMutedTw="inline-flex min-h-8 items-center justify-center gap-2 whitespace-nowrap px-1.5 text-sm font-bold text-slate-600";
const settingsFieldTw="grid gap-1.5 text-xs font-bold text-slate-600";
const settingsHintTw="mt-1 block text-xs leading-normal text-slate-600";
const settingsBackLinkTw="inline-flex items-center gap-2 text-sm font-bold text-blue-700";
const cardTw="min-w-0 rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-md";
const placeholderTw="grid min-w-0 content-start gap-3 rounded-xl border border-gray-200 bg-zinc-100 p-4 shadow-md";
const placeholderIconTw="grid size-20 place-items-center rounded-2xl bg-blue-50 text-blue-700";
const eyebrowTw="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-blue-700";
const placeholderStatusTw="flex items-center gap-2 text-xs text-slate-600";
const pageHeadingTw="flex flex-wrap items-start justify-between gap-4 bg-transparent hover:bg-transparent";
const colorPopoverTw="fixed z-50 grid max-h-screen w-80 gap-3 overflow-auto rounded-xl border border-gray-200 bg-zinc-100 p-3.5 text-slate-950 shadow-lg";
const colorPopoverHeaderTw="flex items-start justify-between gap-2.5";
const colorPopoverTitleTw="m-0 font-sans text-sm font-extrabold tracking-normal";
const colorPopoverCopyTw="mb-0 mt-0.5 text-xs leading-relaxed text-slate-600";
const colorCloseTw="grid size-8 flex-none place-items-center rounded-lg border border-gray-200 bg-transparent text-slate-600 hover:bg-zinc-200 hover:text-slate-950";
const colorWarningTw="m-0 rounded-lg border border-amber-600 bg-amber-100 p-2 text-xs leading-relaxed text-amber-600";
const colorFooterTw="flex items-center justify-between gap-2.5 border-t border-gray-200 pt-2.5";
const colorActionsTw="flex items-center gap-2";
const colorErrorTw="m-0 text-xs text-red-600";

const BRAND_MARK_TW:Record<string,string>={
  default:"grid h-10 w-10 flex-none place-items-center rounded-lg bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md",
  round:"grid h-10 w-10 flex-none place-items-center rounded-full bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md",
  square:"grid h-10 w-10 flex-none place-items-center rounded-md bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md",
  logo:"grid h-10 w-10 flex-none place-items-center rounded-lg bg-transparent font-sans text-base font-extrabold text-blue-950 shadow-none",
  logoRound:"grid h-10 w-10 flex-none place-items-center rounded-full bg-transparent font-sans text-base font-extrabold text-blue-950 shadow-none",
  logoSquare:"grid h-10 w-10 flex-none place-items-center rounded-md bg-transparent font-sans text-base font-extrabold text-blue-950 shadow-none",
};
const BRAND_LOGO_IMG_TW="max-h-9 max-w-9 object-contain";
const BRAND_LOGO_HORIZONTAL_IMG_TW="max-w-none max-h-none object-contain";
function brandMarkClass(hasLogo:boolean,shape:string){
  if(hasLogo){
    if(shape==="round")return BRAND_MARK_TW.logoRound;
    if(shape==="square")return BRAND_MARK_TW.logoSquare;
    return BRAND_MARK_TW.logo;
  }
  if(shape==="round")return BRAND_MARK_TW.round;
  if(shape==="square")return BRAND_MARK_TW.square;
  return BRAND_MARK_TW.default;
}

/** Estados resolvem mapas Record para strings completas — nunca fragmentos concatenados. */
const SIDEBAR_STATE_TW:Record<string,string>={
  expanded:"sidebar",
  expandedOpen:"sidebar sidebar-open",
  compact:"sidebar sidebar-compact",
  compactOpen:"sidebar sidebar-open sidebar-compact",
};
function sidebarClass(menuOpen:boolean,collapsed:boolean){
  if(collapsed)return menuOpen?SIDEBAR_STATE_TW.compactOpen:SIDEBAR_STATE_TW.compact;
  return menuOpen?SIDEBAR_STATE_TW.expandedOpen:SIDEBAR_STATE_TW.expanded;
}
const ACCORDION_STATE_TW:Record<string,string>={idle:"nav-accordion",expanded:"nav-accordion expanded"};
function accordionClass(expanded:boolean){return expanded?ACCORDION_STATE_TW.expanded:ACCORDION_STATE_TW.idle;}
const NAV_ITEM_STATE_TW:Record<string,string>={idle:"nav-item",active:"nav-item active"};
function navItemClass(active:boolean){return active?NAV_ITEM_STATE_TW.active:NAV_ITEM_STATE_TW.idle;}
const NAV_SUBITEM_STATE_TW:Record<string,string>={idle:"nav-subitem",active:"nav-subitem active"};
function navSubitemClass(active:boolean){return active?NAV_SUBITEM_STATE_TW.active:NAV_SUBITEM_STATE_TW.idle;}
const MODULE_TAB_STATE_TW:Record<string,string>={idle:"",active:"active"};
function moduleTabClass(active:boolean){return active?MODULE_TAB_STATE_TW.active:MODULE_TAB_STATE_TW.idle;}
const PAGE_CONTENT_STATE_TW:Record<string,string>={normal:"page-content",fixed:"page-content page-content--fixed"};
function pageContentClass(fixed:boolean){return fixed?PAGE_CONTENT_STATE_TW.fixed:PAGE_CONTENT_STATE_TW.normal;}

const DOCK_ITEM_STATE_TW:Record<string,string>={
  overviewIdle:"grid min-h-14 place-items-center gap-0.5 rounded-lg px-3.5 py-0.5 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-zinc-200 hover:text-slate-950",
  overviewActive:"grid min-h-14 place-items-center gap-0.5 rounded-lg bg-blue-600 px-3.5 py-0.5 text-xs font-semibold text-blue-950 shadow-md transition-colors duration-150",
  overviewMenuOpen:"grid min-h-14 place-items-center gap-0.5 rounded-lg bg-blue-600 px-3.5 py-0.5 text-xs font-bold text-blue-950 shadow-md transition-colors duration-150",
  idle:"",
  menuOpen:"active",
};
function dockItemClass(isOverview:boolean,menuOpen:boolean){
  if(isOverview)return menuOpen?DOCK_ITEM_STATE_TW.overviewMenuOpen:DOCK_ITEM_STATE_TW.overviewIdle;
  return menuOpen?DOCK_ITEM_STATE_TW.menuOpen:DOCK_ITEM_STATE_TW.idle;
}
const DOCK_ICON_STATE_TW:Record<string,string>={idle:"",active:"text-blue-950"};
function dockIconClass(active:boolean){return active?DOCK_ICON_STATE_TW.active:DOCK_ICON_STATE_TW.idle;}
const MOBILE_NAV_STATE_TW:Record<string,string>={
  dock:"mobile-bottom-nav mobile-bottom-nav--overview",
  actions:"mobile-bottom-nav",
};
function mobileNavClass(isOverview:boolean){return isOverview?MOBILE_NAV_STATE_TW.dock:MOBILE_NAV_STATE_TW.actions;}

type NavigationChild = { label: string; icon?: keyof typeof iconMap };
type NavigationItem = { label: string; icon: keyof typeof iconMap; children?: NavigationChild[] };
const navigation: { section: string; items: NavigationItem[] }[] = [
  { section: "OPERAÇÃO", items: [{ label: "Visão geral", icon: "layout-dashboard" }, { label: "Atendimento", icon: "messages" }, { label: "CRM", icon: "users" }, { label: "Calendários", icon: "calendar" }, { label: "Tarefas", icon: "tasks" }, { label: "Relatórios", icon: "chart" }] },
  { section: "RESULTADOS", items: [
    { label: "Automação", icon: "workflow", children: [{ label: "Chatbots", icon: "sparkles" }, { label: "Workflows", icon: "workflow" }, { label: "Agentes de IA", icon: "sparkles" }] },
    { label: "Financeiro", icon: "wallet", children: [{ label: "Asaas", icon: "wallet" }, { label: "Stripe", icon: "globe" }, { label: "InfinitePay", icon: "sparkles" }] },
    { label: "Documentos", icon: "file-text" },
  ] },
  { section: "ADMINISTRAÇÃO", items: [{ label: "Atendentes", icon: "users" }, { label: "Conexões", icon: "share" }, { label: "Curso", icon: "graduation-cap" }, { label: "Planos e preços", icon: "sparkles" }, { label: "Configurações", icon: "settings" }] },
];

const workspaceTabs: Record<string, { label: string; target: string }[]> = {
  automation: [{ label: "Chatbots", target: "Chatbots" }, { label: "Workflows", target: "Workflows" }, { label: "Agentes de IA", target: "Agentes de IA" }],
  connections: [{ label: "Conexões", target: "Conexões" }],
};
const workspaceTabKey = (value: string) => ["Chatbots", "Workflows", "Agentes de IA"].includes(value)
  ? "automation"
  : value === "Conexões" || value === "Canais e integrações" ? "connections" : null;

export default function HomePage() {
  useGlobalPhoneMask();
  const [authStatus, setAuthStatus] = useState<"checking" | "anonymous" | "authenticated">("checking");
  const [session, setSession] = useState<AuthSession | null>(null);
  useEffect(() => {
    let mounted = true;
    fetch("/api/backend/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("not authenticated");
        return response.json();
      })
      .then((value) => { if (mounted) { setSession(value); setAuthStatus("authenticated"); void refreshProfile(); } })
      .catch(() => { if (mounted) setAuthStatus("anonymous"); });
    return () => { mounted = false; };
  }, []);

  const refreshProfile=async()=>{const r=await fetch('/api/backend/auth/me',{cache:'no-store'});if(r.ok)setSession(await r.json());};
  useEffect(()=>{const refresh=()=>{void refreshProfile();};window.addEventListener("vexora:team-updated",refresh);return()=>window.removeEventListener("vexora:team-updated",refresh);},[]);
  useEffect(()=>{if(!session||session.user.mustChangePassword)return;const sync=()=>{if(document.visibilityState!=='visible')return;if(session.user.avatarSource==='GOOGLE')void fetch('/api/backend/profile/google-photo',{method:'POST'}).then(()=>refreshProfile());else void refreshProfile();};const timer=setInterval(sync,300000);window.addEventListener('focus',sync);return()=>{clearInterval(timer);window.removeEventListener('focus',sync)}},[session?.user.id,session?.user.avatarSource]);
  const [active, setActive] = useState("Visão geral");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [workflowTab, setWorkflowTab] = useState("Campanhas de mensagens");
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => {
    const validModules = new Set(["Atendentes","Conexões","Canais e integrações","Relatórios","Clientes","Planos e preços","Biblioteca de referências","Referências criativas","Google Drive",...navigation.flatMap((group) => group.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)]))]);
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("module");
    if (requested === "Gestão") setActive("Financeiro");
    else if (requested === "Integrações (API)") setActive("Configurações");
    else if (requested === "Origem dos Leads") setActive("CRM");
    else if (requested === "Inteligência Operacional") { setActive("CRM"); params.set("crmTab", "reports"); }
    else if (["Marketing","Sites","Briefings","Criações","Postagens","Planos e pacotes"].includes(requested || "")) setActive("Configurações");
    else if (requested === "Referências criativas") setActive("Biblioteca de referências");
    else if (requested && validModules.has(requested)) {
      preloadWorkspace(requested);
      setActive(requested);
      const parent = navigation.find((group) => group.items.some((item) => item.children?.some((child) => child.label === requested)));
      if (parent) {
        const parentItem = parent.items.find((item) => item.children?.some((child) => child.label === requested));
        if (parentItem) setExpandedModules([parentItem.label]);
      }
    }
    setNavigationReady(true);
  }, []);
  useEffect(() => {
    if (!navigationReady) return;
    const url = new URL(window.location.href);
    if (active === "Visão geral") url.searchParams.delete("module");
    else url.searchParams.set("module", active);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [active, navigationReady]);
  useEffect(()=>{try{localStorage.removeItem("vexora:quick-replies")}catch{}},[]);
  const [overview,setOverview]=useState<OverviewSnapshot|null>(null);
  const [overviewError,setOverviewError]=useState("");
  useEffect(()=>{if(!session||session.user.mustChangePassword||active!=="Visão geral")return;let live=true;setOverview(null);const load=()=>fetch("/api/backend/overview",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(live){setOverview(data);setOverviewError("")}}).catch(()=>{if(live)setOverviewError("Não foi possível carregar os indicadores. O painel tenta de novo em 60 segundos; se o problema continuar, verifique a conexão do WhatsApp em Conexões.")});void load();const timer=setInterval(()=>void load(),60000);return()=>{live=false;clearInterval(timer)}},[active,session?.tenant.id]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcomeExpanded, setWelcomeExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 981);
  useEffect(() => { const handler=(event:KeyboardEvent)=>{if(event.altKey&&!event.ctrlKey&&!event.shiftKey&&event.code==="KeyM"){event.preventDefault();setSidebarCollapsed(v=>!v);}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
  useEffect(() => { const handler=(event: Event) => { const name = (event as CustomEvent<string>).detail; if (typeof name === "string" && name.trim()) { preloadWorkspace(name); setActive(name); } }; window.addEventListener("vexora:open-module", handler); return () => window.removeEventListener("vexora:open-module", handler); }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const update = () => setSidebarCollapsed(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [workspaceInfoOpen, setWorkspaceInfoOpen] = useState(false);
  const [settingsAdvanced, setSettingsAdvanced] = useState(false);
  const [settingsCatalogOpen, setSettingsCatalogOpen] = useState(false);
  const [catalogReturnTo, setCatalogReturnTo] = useState<"settings" | "finance-products" | "finance-subscriptions">("settings");
  const [catalogEditId, setCatalogEditId] = useState("");
  const [financeInitialTab, setFinanceInitialTab] = useState<"overview" | "products" | "subscriptions">("products");
  const catalogBackLabel = catalogReturnTo === "finance-products" ? "Voltar aos Produtos" : catalogReturnTo === "finance-subscriptions" ? "Voltar às Assinaturas" : "Voltar às Configurações";
  function closeCatalog(){if(catalogReturnTo === "finance-products" || catalogReturnTo === "finance-subscriptions"){setFinanceInitialTab(catalogReturnTo === "finance-products" ? "products" : "subscriptions");setActive("Financeiro")}else setSettingsCatalogOpen(false);setCatalogReturnTo("settings");setCatalogEditId("")}
  useEffect(() => { const openCatalog = (event: Event) => { if (!["OWNER", "ADMIN", "MANAGER"].includes(String(session?.role || "").toUpperCase())) return; const detail = (event as CustomEvent<{ origin?: string; itemId?: string }>).detail || {}; const raw = detail.origin || "settings"; const origin = raw === "finance-products:new" ? "finance-products" : raw; const itemId = typeof detail.itemId === "string" ? detail.itemId : ""; setCatalogReturnTo(origin === "finance-products" || origin === "finance-subscriptions" ? origin : "settings"); setCatalogEditId(itemId); if (origin === "finance-products") setFinanceInitialTab("products"); if (origin === "finance-subscriptions") setFinanceInitialTab("subscriptions"); preloadWorkspace("Configurações"); setActive("Configurações"); setSettingsAdvanced(false); setSettingsCatalogOpen(true); }; window.addEventListener("vexora:open-catalog", openCatalog); return () => window.removeEventListener("vexora:open-catalog", openCatalog); }, [session?.role]);
  useEffect(() => {
    if (!menuOpen && !workspaceInfoOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (menuOpen && !event.target.closest(".sidebar") && !event.target.closest(".mobile-menu")) setMenuOpen(false);
      if (workspaceInfoOpen && !event.target.closest(".workspace-info-wrap")) setWorkspaceInfoOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setWorkspaceInfoOpen(false);
      }
    };
    document.addEventListener("click", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, workspaceInfoOpen]);
    type ThemeMode = "hybrid" | "light" | "dark";
  type BrandAssets = {primaryColor:string;logoLight:string;logoDark:string;favicon:string;logoShape:"square"|"round"|"rectangular";logoMaxWidth?:number;logoMaxHeight?:number;showCompanyName:boolean;fontScalePercent?:number;sidebarBackground?:string;sidebarForeground?:string;sidebarHover?:string};
  const defaultBrandAssets:BrandAssets={primaryColor:"#4F46E5",logoLight:"",logoDark:"",favicon:"",logoShape:"rectangular",logoMaxWidth:160,logoMaxHeight:40,showCompanyName:true,fontScalePercent:100,sidebarBackground:"",sidebarForeground:"",sidebarHover:""};
  const brandApplyRef = useRef<((themeName: string) => void) | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("hybrid");
  const [themeReady,setThemeReady]=useState(false);
  const [sidebarColorMenu,setSidebarColorMenu]=useState<{x:number;y:number}|null>(null);
  const [sidebarColorSaving,setSidebarColorSaving]=useState(false);
  const [sidebarColorError,setSidebarColorError]=useState("");
  const [sidebarDraft,setSidebarDraft]=useState<{sidebarBackground:string;sidebarForeground:string;sidebarHover:string}|null>(null);
  const [brandAssets,setBrandAssets] = useState<BrandAssets>(defaultBrandAssets);
  const [greeting,setGreeting] = useState("Bom dia");
  const currentTheme = () => (typeof document !== "undefined" ? document.documentElement.dataset.theme || "hybrid" : "hybrid");
  const validOrEmpty = (v: string) => v === "" || /^#[0-9a-fA-F]{6}$/.test(v);
  const setSidebarField = (key: "sidebarBackground" | "sidebarForeground" | "sidebarHover", rawValue: string) => {
    setSidebarDraft(prev => {
      const base = prev || { sidebarBackground: brandAssets.sidebarBackground || "", sidebarForeground: brandAssets.sidebarForeground || "", sidebarHover: brandAssets.sidebarHover || "" };
      const next = { ...base, [key]: rawValue.trim().toUpperCase() };
      if (validOrEmpty(next.sidebarBackground) && validOrEmpty(next.sidebarForeground) && validOrEmpty(next.sidebarHover)) {
        applyBrandAll({ ...brandAssets, ...next }, currentTheme());
      }
      return next;
    });
  };
  const openSidebarColorMenu = (x: number, y: number) => {
    setSidebarColorError("");
    setSidebarDraft({ sidebarBackground: brandAssets.sidebarBackground || "", sidebarForeground: brandAssets.sidebarForeground || "", sidebarHover: brandAssets.sidebarHover || "" });
    setSidebarColorMenu({ x, y });
  };
  const closeSidebarColorMenu = (revert: boolean) => {
    setSidebarColorMenu(null);
    setSidebarDraft(null);
    if (revert) applyBrandAll(brandAssets, currentTheme());
  };
  const saveSidebarColors = async () => {
    if (!sidebarDraft) return;
    setSidebarColorSaving(true);
    setSidebarColorError("");
    try {
      const clean = {
        sidebarBackground: sanitizeHex(sidebarDraft.sidebarBackground),
        sidebarForeground: sanitizeHex(sidebarDraft.sidebarForeground),
        sidebarHover: sanitizeHex(sidebarDraft.sidebarHover),
      };
      const payload = { ...brandAssets, ...clean };
      const response = await fetch("/api/backend/contacts/brand-settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result && typeof result.message === "string" ? result.message : "Não foi possível salvar as cores.");
      const saved = { ...defaultBrandAssets, ...result };
      setBrandAssets(saved);
      applyBrandAll(saved, currentTheme());
      brandApplyRef.current = (themeName: string) => applyBrandAll(saved, themeName);
      window.dispatchEvent(new CustomEvent("vexora:brand-updated", { detail: saved }));
      setSidebarColorMenu(null);
      setSidebarDraft(null);
    } catch (caught) {
      setSidebarColorError(caught instanceof Error ? caught.message : "Não foi possível salvar as cores.");
    } finally {
      setSidebarColorSaving(false);
    }
  };
  useEffect(() => {
    if (!sidebarColorMenu) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeSidebarColorMenu(true); };
    const onDown = (event: MouseEvent) => { const target = event.target as Element | null; if (target?.closest('[data-testid="sidebar-color-popover"]')) return; closeSidebarColorMenu(true); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarColorMenu, brandAssets]);
  useEffect(() => { try { const saved = localStorage.getItem("vexora:theme"); if(saved==="dark"||saved==="hybrid"||saved==="light")setTheme(saved); } catch {} finally{setThemeReady(true)} }, []);
  useEffect(() => { if(!themeReady)return; document.documentElement.dataset.theme = theme; applyThemeColor(theme); try { localStorage.setItem("vexora:theme", theme); } catch {} brandApplyRef.current?.(theme); }, [theme,themeReady]);
  useEffect(() => { const updateGreeting=()=>{const hour=new Date().getHours();setGreeting(hour>=5&&hour<12?"Bom dia":hour>=12&&hour<18?"Boa tarde":hour>=18?"Boa noite":"Boa madrugada");};updateGreeting();const timer=window.setInterval(updateGreeting,60000);return()=>window.clearInterval(timer); }, []);
  useEffect(() => { if (!session||session.user.mustChangePassword) return; let live=true; const apply=(v:any)=>{if(!live||!v)return;const next={...defaultBrandAssets,...v};if(!/^#[0-9a-fA-F]{6}$/.test(next.primaryColor))next.primaryColor=defaultBrandAssets.primaryColor;const fontScales=new Set([100,110,120,130,140,150]);const fontScale=fontScales.has(Number(next.fontScalePercent))?Number(next.fontScalePercent):100;if(document.documentElement)document.documentElement.style.setProperty("--type-scale",String(fontScale/100));setBrandAssets(next);applyBrandAll(next,document.documentElement.dataset.theme);brandApplyRef.current=(themeName:string)=>applyBrandAll(next,themeName);if(next.favicon){let link=document.querySelector<HTMLLinkElement>('link[rel~="icon"]');if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}link.href=next.favicon;}};void fetch("/api/backend/contacts/brand-settings",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(apply).catch(()=>{});const onBrandUpdate=(event:Event)=>apply((event as CustomEvent).detail);window.addEventListener("vexora:brand-updated",onBrandUpdate);return()=>{live=false;window.removeEventListener("vexora:brand-updated",onBrandUpdate);}; }, [session?.tenant.slug]);
  useEffect(()=>{if(!assistantOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setAssistantOpen(false)};const outside=(e:MouseEvent)=>{if(e.target instanceof Element&&!e.target.closest(".ai-assistant-panel,.ai-assistant-trigger"))setAssistantOpen(false)};document.addEventListener("keydown",onKey);document.addEventListener("mousedown",outside);return()=>{document.removeEventListener("keydown",onKey);document.removeEventListener("mousedown",outside)}},[assistantOpen]);
  const [globalSearch,setGlobalSearch]=useState("");
  const [crmSearch,setCrmSearch]=useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  const moduleForLabel:Record<string,string>={'Visão geral':'INBOX','Atendentes':'SETTINGS','Atendimento':'INBOX','CRM':'CRM','Calendários':'CALENDAR','Agenda':'CALENDAR','Tarefas':'TASKS','Automação':'AUTOMATION','Chatbots':'AUTOMATION','Workflows':'AUTOMATION','Agentes de IA':'AUTOMATION','Relatórios':'INBOX','Clientes':'SETTINGS','Canais e integrações':'CHANNELS','E-mails':'EMAIL','Biblioteca de referências':'SETTINGS','Referências criativas':'SETTINGS','Google Drive':'SETTINGS','Planos e preços':'PLANS','Financeiro':'FINANCE','Asaas':'FINANCE','Stripe':'FINANCE','InfinitePay':'FINANCE','Documentos':'CRM','Conexões':'CHANNELS','Configurações':'SETTINGS'};
  const moduleVisible=(label:string)=>label==="Visão geral"||session?.user.isPlatformAdmin===true||!moduleForLabel[label]||(session?.allowedModules||[]).includes(moduleForLabel[label]!);
  const platformPanel=session?.tenant.kind==="PLATFORM"&&session?.user.isPlatformAdmin===true;
  // Planos e preços é capacidade da plataforma: cliente só vê quando a Véxora libera o módulo PLANS.
  // Mesmo um admin da plataforma olhando um tenant cliente não faz o item reaparecer sem a liberação.
  const plansMenuVisible = session?.tenant.kind !== "PLATFORM" && (session?.allowedModules || []).includes("PLANS");
  const isOverview = active === "Visão geral";
  useEffect(() => { if (active !== "Configurações") { setSettingsAdvanced(false); setSettingsCatalogOpen(false); setCatalogReturnTo("settings"); setCatalogEditId(""); } }, [active]);
  const currentWorkspaceTab = workspaceTabKey(active);
  const canManage = ["OWNER", "ADMIN"].includes((session?.role || "").toUpperCase());
  const canConfigure = ["OWNER", "ADMIN", "MANAGER"].includes((session?.role || "").toUpperCase());

  if (authStatus === "checking") {
    return <div className={authScreenTw}><div className={authPanelTw}><span className={BRAND_MARK_TW.default}>V</span><h1>Véxora Suite</h1><p>Conectando ao seu ambiente...</p></div></div>;
  }
  if (authStatus === "anonymous") {
    return <AuthScreen onAuthenticated={(value) => { setSession(value); setAuthStatus("authenticated");void refreshProfile(); }} />;
  }

  if(session?.user.mustChangePassword)return <ChangePasswordScreen/>;
  return (
    <div className="suite-app">
      <aside id="mobile-navigation-menu" className={sidebarClass(menuOpen, sidebarCollapsed)} onContextMenu={(event) => { const target = event.target as Element; if (target.closest("button,a,summary,input,select,textarea,img,details,[role=\"menuitem\"]")) return; event.preventDefault(); const padding = 300; openSidebarColorMenu(Math.max(8, Math.min(event.clientX, window.innerWidth - padding)), Math.max(8, Math.min(event.clientY, window.innerHeight - 340))); }}>
        <div className="sidebar-brand-row"><a className="brand" href="/" aria-label="Página inicial" onClick={(event) => { event.preventDefault(); setActive("Visão geral");setMenuOpen(false); }}>
          {(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)&&brandAssets.logoShape==="rectangular"?<img className={BRAND_LOGO_HORIZONTAL_IMG_TW} style={{maxWidth:brandAssets.logoMaxWidth||160,maxHeight:brandAssets.logoMaxHeight||40}} src={theme==="light"?brandAssets.logoLight:brandAssets.logoDark} alt={session?.tenant.name||"Logo da empresa"}/>:<><span className={brandMarkClass(Boolean(theme==="light"?brandAssets.logoLight:brandAssets.logoDark),brandAssets.logoShape||"")}>{(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?<img className={BRAND_LOGO_IMG_TW} src={theme==="light"?brandAssets.logoLight:brandAssets.logoDark} alt=""/>:"V"}</span>{(brandAssets.logoShape==="rectangular"||brandAssets.showCompanyName||!(theme==="light"?brandAssets.logoLight:brandAssets.logoDark))?<span className="brand-copy"><strong>{brandAssets.logoShape!=="rectangular"&&(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?session?.tenant.name||"Véxora":"véxora"}</strong><small>{brandAssets.logoShape==="rectangular"?"SUITE":""}</small></span>:null}</>}
        </a></div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) => (item.label !== "Planos e preços" || plansMenuVisible) && moduleVisible(item.label) && (!["Financeiro","Relatórios","Planos e preços"].includes(item.label) || canManage) && (!["Configurações","Conexões"].includes(item.label) || canConfigure));
            if (!visibleItems.length) return null;
            return <div className="nav-group" key={group.section}>
              <p className="nav-section">{group.section}</p>
              {visibleItems.map((item) => {
                const expanded = expandedModules.includes(item.label);
                const childActive = item.children?.some((child) => child.label === active) || false;
                const familyActive = (item.label === "Automação" && workspaceTabKey(active) === "automation") || (item.label === "Conexões" && workspaceTabKey(active) === "connections");
                return <div className={accordionClass(expanded)} key={item.label}>
                  <button type="button" title={sidebarCollapsed ? item.label : undefined} aria-expanded={item.children ? expanded : undefined} onPointerEnter={()=>{if(!item.children)preloadWorkspace(item.label)}} onFocus={()=>{if(!item.children)preloadWorkspace(item.label)}} className={navItemClass(active === item.label || childActive || familyActive)}
                    onClick={() => {
                      if (item.children) {
                        setExpandedModules((current) => current.includes(item.label) ? [] : [item.label]);
                      } else {
                        setExpandedModules([]);preloadWorkspace(item.label);setActive(item.label); setMenuOpen(false);
                      }
                    }}>
                    <span className="nav-glyph"><Icon name={item.icon} size={18} /></span><span>{item.label}</span>
                    {item.children ? <ChevronDown className="nav-accordion-chevron" size={14} aria-hidden="true" /> : null}
                  </button>
                  {item.children && expanded ? <div className="nav-submenu" role="menu" aria-label={item.label}>{item.children.filter(child=>moduleVisible(child.label)).map((child) => <button key={child.label} type="button" role="menuitem" className={navSubitemClass(active === child.label)} onPointerEnter={()=>preloadWorkspace(child.label)} onFocus={()=>preloadWorkspace(child.label)} onClick={() => { preloadWorkspace(child.label); setActive(child.label); setMenuOpen(false); }}><span className="nav-subitem-glyph"><Icon name={child.icon || "more"} size={15} /></span><span>{child.label}</span></button>)}</div> : null}
                </div>;
              })}
            </div>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-utilities"><button type="button" className="sidebar-collapse" aria-label={sidebarCollapsed ? "Expansir menu" : "Recolher menu"} onClick={() => setSidebarCollapsed(v => !v)}>{sidebarCollapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}</button><button type="button" className="sidebar-icon" aria-label="Instalar Véxora" title="Instalar Véxora" onClick={()=>window.dispatchEvent(new Event('vexora:install'))}><Download size={18}/></button></div>
          {session&&<SidebarProfile user={session.user} canManage={canManage&&moduleVisible("Atendentes")} onUpdated={refreshProfile} onTeam={()=>{setActive('Atendentes');setMenuOpen(false)}}/>}
        </div>
      </aside>
      {sidebarColorMenu && sidebarDraft ? (
        <div className={colorPopoverTw} data-testid="sidebar-color-popover" role="dialog" aria-labelledby="sidebar-color-title" style={{ left: sidebarColorMenu.x, top: sidebarColorMenu.y }}>
          <header className={colorPopoverHeaderTw}>
            <div><h3 id="sidebar-color-title" className={colorPopoverTitleTw}>Cor Modo Híbrido</h3><p className={colorPopoverCopyTw}>Fundo, texto e ícones e hover da sidebar. Vale no tema Híbrido; o item ativo segue a cor da marca.</p></div>
            <button type="button" className={colorCloseTw} onClick={() => closeSidebarColorMenu(true)} aria-label="Fechar"><X size={16} aria-hidden="true" /></button>
          </header>
          {theme !== "hybrid" ? <p className={colorWarningTw}>Você está no tema {theme === "light" ? "Claro" : "Escuro"} — as cores valem para o Modo Híbrido (a prévia só aparece nele).</p> : null}
          {([
            { key: "sidebarBackground", label: "Fundo da sidebar", hint: "Cor da coluna de navegação" },
            { key: "sidebarForeground", label: "Texto e ícones", hint: "Letras, ícones e divisores" },
            { key: "sidebarHover", label: "Hover", hint: "Destaque ao passar o mouse" },
          ] as const).map(item => {
            const value = sidebarDraft[item.key];
            return (
              <div key={item.key} className={settingsFieldTw}>
                <span>{item.label}<small className={settingsHintTw}>{item.hint}</small></span>
                <TailwindColorPicker
                  value={value}
                  label={item.label}
                  ariaLabel={item.label + " (HEX)"}
                  swatchAriaLabel={"Escolher " + item.label.toLowerCase()}
                  fallback={item.key === "sidebarBackground" ? { family: "slate", weight: 950 } : item.key === "sidebarForeground" ? { family: "slate", weight: 50 } : { family: "slate", weight: 900 }}
                  onChange={hex => setSidebarField(item.key, hex)}
                />
              </div>
            );
          })}
          <TailwindPalettePreview colors={{primary:brandAssets.primaryColor,sidebarBackground:sidebarDraft.sidebarBackground,sidebarForeground:sidebarDraft.sidebarForeground,sidebarHover:sidebarDraft.sidebarHover}} />
          {(() => {
            const ratio = wcagRatio(sanitizeHex(sidebarDraft.sidebarBackground) || HYBRID_SIDEBAR_DEFAULTS.background, sanitizeHex(sidebarDraft.sidebarForeground) || HYBRID_SIDEBAR_DEFAULTS.foreground);
            const ok = ratio >= 4.5;
            return <p className={ok ? contrastOkTw : contrastWarnTw}>Contraste {ratio.toFixed(2)}:1 · {ok ? "excelente para leitura" : "abaixo de 4,5:1 — recomendamos ajustar"}</p>;
          })()}
          <footer className={colorFooterTw}>
            <button type="button" className={textButtonTw} onClick={() => { setSidebarDraft({ sidebarBackground: "", sidebarForeground: "", sidebarHover: "" }); applyBrandAll({ ...brandAssets, sidebarBackground: "", sidebarForeground: "", sidebarHover: "" }, currentTheme()); }}>Restaurar padrão</button>
            <span className={colorActionsTw}>
              <button type="button" className={textButtonMutedTw} onClick={() => closeSidebarColorMenu(true)}>Cancelar</button>
              <button type="button" className={primaryButton} onClick={saveSidebarColors} disabled={sidebarColorSaving}>{sidebarColorSaving ? "Salvando…" : "Salvar"}</button>
            </span>
          </footer>
          {sidebarColorError ? <p className={colorErrorTw} role="alert">{sidebarColorError}</p> : null}
        </div>
      ) : null}
      {menuOpen ? <button type="button" className="mobile-sidebar-backdrop" aria-label="Fechar menu lateral" onClick={() => setMenuOpen(false)} /> : null}

      <main className="main-area">
        <header className="topbar">
          <button type="button" className="mobile-menu" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="mobile-navigation-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}><Menu size={20} aria-hidden="true" /></button>
          <div className="breadcrumbs">
            <span>Véxora Suite</span>
            {active ? <><span className={crumbSlashTw} aria-hidden="true">/</span>{active === "Atendimento"
              ? <h1 className="m-0 truncate font-display text-base font-bold leading-tight text-ink">{active}</h1>
              : <strong>{active}</strong>}</> : null}
          </div>
          <div className="topbar-actions">
            {moduleVisible("Atendimento")&&session&&<MentionNotifications key={session.tenant.id+":"+session.user.id} tenantId={session.tenant.id} userId={session.user.id}/>}
            <PwaControls tenantId={session?.tenant.id||""} userId={session?.user.id||""}/>
            {/* ReminderCenter and AlarmCenter are rendered at the app root so their fixed overlays escape the topbar stacking context. */}
            <button type="button" className="ai-assistant-trigger" aria-label="Abrir assistente Véxora" title="Assistente pessoal (sob demanda)" onClick={() => setAssistantOpen(v => !v)}><Sparkles size={17}/><span>Assistente</span></button>
            {session?.role==="OWNER"&&<CompanySwitcher current={session.tenant} canCreate={session.user.isPlatformAdmin===true}/>}
            <label className="search-box"><span><Search size={18} aria-hidden="true" /></span><input ref={searchInputRef} aria-label="Buscar contatos" placeholder="Buscar contatos…" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing&&globalSearch.trim()){preloadWorkspace("CRM");setCrmSearch(globalSearch.trim());setActive("CRM");e.currentTarget.blur()}}} /><kbd>⌘ K</kbd></label>
            <button className={themeToggleTw} onClick={() => setTheme(value => value==="hybrid"?"light":value==="light"?"dark":"hybrid")} aria-label={"Tema atual: "+({hybrid:"Híbrido",light:"Claro",dark:"Escuro"}[theme])+". Clique para alternar."} title={"Tema: "+({hybrid:"Híbrido",light:"Claro",dark:"Escuro"}[theme])+" · clique para alternar"}>{theme==="hybrid"?<SunMoon size={17}/>:theme==="light"?<Sun size={17}/>:<Moon size={17}/>}</button>
            
            <button className="logout-button" onClick={async () => { await disableDeviceNotifications().catch(()=>{}); await fetch("/api/backend/auth/logout", { method: "POST" }); setSession(null); setAuthStatus("anonymous"); }} title="Sair da conta">Sair</button>
          </div>
        </header>

        {currentWorkspaceTab && currentWorkspaceTab !== "automation" ? <nav className="persistent-module-tabs" aria-label="Seção atual">{workspaceTabs[currentWorkspaceTab!]!.map((tab) => <button key={tab.target} type="button" className={moduleTabClass(active === tab.target)} onClick={() => { preloadWorkspace(tab.target); setActive(tab.target); setExpandedModules([]); }}>{tab.label}</button>)}</nav> : null}
        <div className={pageContentClass(active === "Atendimento")}><WorkspaceAlerts admin={session?.role==='OWNER'||session?.role==='ADMIN'}/>
          {isOverview ? <section className={pageHeadingTw}>
            <div className="bg-transparent"><h1>{greeting+", "+((session?.user?.name||"").trim().split(/\s+/)[0]||"você")+"! 👋"}</h1></div>
            <button className={primaryButton} onClick={() => setActive("Atendimento")}><Plus size={16} aria-hidden="true" /> Abrir atendimento</button>
          </section> : null}
          {isOverview ? <DashboardWidgets /> : null}
          {isOverview && session?.tenant.slug === "rastreabem" ? <section className={cardTw} aria-label="Site externo da Rastreabem">
            <h2 className="text-body-lg font-bold text-slate-950">Site da Rastreabem</h2>
            <p className="text-sm text-slate-600">Acesso ao site externo da empresa. A Véxora não hospedou nem publicou esta página.</p>
            <a className={primaryButton} href="https://rastreabem.com.br" target="_blank" rel="noreferrer">Abrir rastreabem.com.br em nova janela <ExternalLink size={16} aria-hidden="true" /></a>
          </section> : null}
          {isOverview ? <div className={welcomeExpanded ? "grid w-full gap-4 bg-transparent hover:bg-transparent lg:grid-cols-1" : "grid w-full gap-4 bg-transparent hover:bg-transparent lg:grid-cols-2"}>
            <OnboardingChecklist onNavigate={(target) => { setActive(target); setMenuOpen(false); }} onDismiss={() => setWelcomeExpanded(true)} />
            <DashboardWelcome onNavigate={(target) => { preloadWorkspace(target); setActive(target); setMenuOpen(false); }} />
          </div> : null}

          {!moduleVisible(active)?<section className={cardTw}><h2>Acesso não permitido</h2><p>Este módulo não está habilitado para seu usuário.</p><button type="button" className={secondaryButton} onClick={() => setActive("Visão geral")}>Ir para Visão geral</button></section>:isOverview ? (
            <>
              {overviewError&&!overview&&<p role="status">{overviewError}</p>}
              <OverviewIntelligence data={overview} onOpenQueue={() => setActive("Atendimento")} />
            </>
          ) : active === "Tarefas" ? (
            <TasksWorkspace />
          ) : active === "Calendários" || active === "Agenda" ? (
            <CalendarWorkspace />
          ) : active === "CRM" ? (
            <CrmWorkspace key={(session?.tenant.id||"")+":"+crmSearch} initialSearch={crmSearch} />
          ) : active === "Financeiro" || active === "Gestão" ? (
            canManage ? <FinanceWorkspace initialTab={financeInitialTab} /> : <section className={placeholderTw}><h2>Acesso restrito</h2><p>Somente a administração pode consultar dados financeiros.</p></section>
          ) : active === "Asaas" || active === "Stripe" || active === "InfinitePay" ? (
            canManage ? <FinanceProviderWorkspace provider={active} /> : <section className={placeholderTw}><h2>Acesso restrito</h2><p>Somente a administração pode consultar dados financeiros.</p></section>
          ) : active === "Documentos" ? (
            <DocumentsWorkspace />
          ) : active === "Curso" ? (
            <CourseWorkspace companyName={session?.tenant?.name || "Sua empresa"} />
          ) : active === "Agentes de IA" ? (
            canConfigure ? <AiAgentsWorkspace /> : <section className={cardTw}><h2>Acesso restrito</h2></section>
          ) : active === "Chatbots" ? (
            canConfigure ? <ChatbotWorkspace key={session?.tenant.id} tenantId={session?.tenant.id||""} /> : <section className={cardTw}><h2>Acesso restrito</h2></section>
          ) : active === "Biblioteca de referências" || active === "Referências criativas" || active === "Google Drive" ? (
            canManage ? <CreativeLibraryWorkspace key={active} initialTab={active==="Google Drive"?"drive":"references"} /> : <section className={cardTw}><h2>Acesso restrito</h2><p>Somente a administração pode gerenciar referências e arquivos do Drive.</p></section>
          ) : active === "Relatórios" ? (
            canManage ? <ReportsWorkspace /> : <section className={cardTw}><h2>Acesso restrito</h2><p>Somente a administração pode visualizar relatórios.</p></section>
          ) : active === "Clientes" ? (
            platformPanel ? <PlatformAdminWorkspace initialTab="plans" /> : <section className={cardTw}><h2>Acesso restrito</h2><p>Este painel pertence à administração da Véxora.</p></section>
          ) : active === "Planos e preços" ? (
            platformPanel ? <section className={cardTw}><h2>Este painel é para clientes</h2></section>
              : plansMenuVisible && canManage ? <ClientPlansWorkspace currentPlanCode={session?.tenant?.plan?.code||null} currentPlanName={session?.tenant?.plan?.name||null} /> : <section className={cardTw}><h2>Acesso não permitido</h2><p>Este painel só aparece quando a Véxora libera Planos e preços para a sua empresa.</p></section>
          ) : active === "Atendentes" ? (
            canManage ? <TeamWorkspace platformAdmin={session?.user.isPlatformAdmin===true} canManageAdmin={session?.user.isPlatformAdmin===true||session?.role==="OWNER"}/> : <section className={cardTw}><h2>Acesso restrito</h2></section>
          ) : active === "E-mails" ? (
            <section className={cardTw}><h2>Recurso fora do escopo atual</h2></section>
          ) : active === "Workflows" ? (
            canManage ? <WorkflowsWorkspace/> : <section className={cardTw}><h2>Acesso restrito</h2></section>
          ) : active === "Atendimento" ? (
            <InboxWorkspace key={session?.tenant.id} tenantId={session?.tenant.id||""} userId={session?.user.id||""} canManageChannels={canConfigure} />
          ) : active === "Conexões" || active === "Canais e integrações" ? (
            canConfigure ? <ChannelsIntegrations /> : <section className={placeholderTw}><h2>Acesso restrito</h2><p>Somente responsáveis pela configuração da empresa podem acessar este ambiente.</p></section>
          ) : active === "Configurações" ? (
            canConfigure ? (
              settingsCatalogOpen ? <><button type="button" className={settingsBackLinkTw} onClick={closeCatalog}>← {catalogBackLabel}</button><CatalogSettings canManage={canManage} initialItemId={catalogEditId} backLabel={catalogBackLabel} onBack={closeCatalog} /></>
                : settingsAdvanced ? <><button type="button" className={settingsBackLinkTw} onClick={() => setSettingsAdvanced(false)}>← Voltar para Configurações</button><OperationsSettings canConfigureAsaas={["OWNER", "ADMIN"].includes((session?.role || "").toUpperCase())} companyName={session?.tenant.name||"Sua empresa"} isPlatformAdmin={session?.user.isPlatformAdmin===true} /></>
                  : <SettingsCatalog onNavigate={(target) => { preloadWorkspace(target); setActive(target); }} onAdvanced={() => setSettingsAdvanced(true)} onCompanies={() => window.dispatchEvent(new Event("vexora:open-companies"))} onCatalog={() => { setCatalogReturnTo("settings"); setCatalogEditId(""); setSettingsCatalogOpen(true); }} />
            ) : <section className={placeholderTw}><h2>Acesso restrito</h2><p>Somente responsáveis pela configuração da empresa podem acessar este ambiente.</p></section>
          ) : (
            <section className={placeholderTw}>
              <span className={placeholderIconTw}><Icon name={navigation.flatMap((group) => group.items).find((item) => item.label === active)?.icon ?? "messages"} size={25} /></span>
              <p className={eyebrowTw}>MÓDULO DA PLATAFORMA</p><h2>{active}</h2>
              <p>O espaço de trabalho de <strong>{active}</strong> será conectado aos serviços operacionais na próxima etapa. Nenhuma ação ou dado da Véxora antiga é alterado por esta versão.</p>
              <div className={placeholderStatusTw}><span /> Interface em preparação</div>
              <button className={secondaryButton} onClick={() => setActive("Visão geral")}>← Voltar à visão geral</button>
            </section>
          )}
          {active !== "Atendimento" ? <footer className="page-footer"><span>© 2026 Véxora Suite</span><span>Uma plataforma. Vários módulos.</span></footer> : null}
        </div>
      </main>
      {assistantOpen ? <PersonalAssistantPanel onClose={() => setAssistantOpen(false)} /> : null}
      <ReminderCenter />
      <AlarmCenter />
      <nav className={mobileNavClass(active === "Visão geral")} data-testid={active === "Visão geral" ? "ov-dock" : undefined} aria-label={active === "Atendimento" ? "Ações da conversa" : "Navegação principal no celular"}>
        {active === "Atendimento" ? (
          <>
            <button type="button" className="active" aria-current="page" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent("vexora:mobile-conversation-list")); }}><Icon name="messages" size={20}/><span>Conversa</span></button>
            <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent("vexora:mobile-assume")); }}><Icon name="assume" size={20}/><span>Assumir</span></button>
            <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent("vexora:mobile-transfer")); }}><Icon name="transfer" size={20}/><span>Transferir</span></button>
            <button type="button" onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent("vexora:mobile-finalize")); }}><Icon name="finalize" size={20}/><span>Finalizar</span></button>
          </>
        ) : (
          <>
            <button type="button" className={dockItemClass(active === "Visão geral", false)} onPointerEnter={()=>preloadWorkspace("Atendimento")} onFocus={()=>preloadWorkspace("Atendimento")} onClick={() => { preloadWorkspace("Atendimento");setActive("Atendimento"); setMenuOpen(false); }}><Icon name="messages" size={20}/><span>Conversa</span></button>
            {active !== "Visão geral" && <>
            <button type="button" className={dockItemClass(active === "Visão geral", false)} onClick={() => { setActive("Atendimento"); setMenuOpen(false); window.dispatchEvent(new CustomEvent("vexora:mobile-transfer")); }}><Icon name="transfer" size={20}/><span>Transferir</span></button>
            <button type="button" className={dockItemClass(active === "Visão geral", menuOpen)} onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="mobile-navigation-menu" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}><Icon name="more" size={20} className={dockIconClass(active === "Visão geral" && menuOpen) || undefined}/><span>Mais</span></button>
            </>}
          </>
        )}
      </nav>
    </div>
  );
}

