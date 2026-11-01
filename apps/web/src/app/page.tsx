"use client";
import { formatDateTimeBR } from "../lib/date-format";
import {PresentationHome} from "./presentation-home";
import {ChangePasswordScreen} from "./change-password-screen";
import {CompanySwitcher} from "./company-switcher";
import { SettingsCatalog } from "./settings-catalog";
import { MentionNotifications } from "./mention-notifications";
import { PwaControls, disableDeviceNotifications } from "./pwa-controls";
const WorkflowsWorkspace=dynamic(()=>import("./workflows-workspace").then(m=>m.WorkflowsWorkspace));
import { brandTextColor } from "../lib/tenant-cache";
const CreativeLibraryWorkspace=dynamic(()=>import("./creative-library-workspace").then(module=>module.CreativeLibraryWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});

import { WorkspaceAlerts } from "./workspace-alerts";
import { SidebarProfile } from "./sidebar-profile";
const TeamWorkspace=dynamic(()=>import("./team-workspace").then(m=>m.TeamWorkspace));
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AuthScreen, type AuthSession } from "./auth-screen";
const InboxWorkspace=dynamic(()=>import("./inbox-workspace").then(module=>module.InboxWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const OperationsSettings=dynamic(()=>import("./operations-settings").then(module=>module.OperationsSettings),{loading:()=> <p role="status">Carregando módulo…</p>});
const CrmWorkspace=dynamic(()=>import("./crm-workspace").then(module=>module.CrmWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const FinanceWorkspace=dynamic(()=>import("./finance-workspace").then(module=>module.FinanceWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const ChannelsIntegrations=dynamic(()=>import("./channels-integrations").then(module=>module.ChannelsIntegrations),{loading:()=> <p role="status">Carregando módulo…</p>});
const CalendarWorkspace=dynamic(()=>import("./calendar-workspace").then(module=>module.CalendarWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const TasksWorkspace=dynamic(()=>import("./tasks-workspace").then(module=>module.TasksWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const ChatbotWorkspace=dynamic(()=>import("./chatbot-workspace").then(module=>module.ChatbotWorkspace),{loading:()=> <p role="status">Carregando módulo…</p>});
const AiAgentsWorkspace=dynamic(()=>import("./ai-agents-workspace").then(module=>module.AiAgentsWorkspace));
const PersonalAssistantPanel=dynamic(()=>import("./ai-agents-workspace").then(module=>module.PersonalAssistantPanel));

const workspacePreloaders:Partial<Record<string,()=>Promise<unknown>>>={
  "Atendimento":()=>import("./inbox-workspace"),
  "CRM":()=>import("./crm-workspace"),
  "Agenda":()=>import("./calendar-workspace"),
  "Tarefas":()=>import("./tasks-workspace"),
  "Chatbots":()=>import("./chatbot-workspace"),
  "Workflows":()=>import("./workflows-workspace"),
  "Agentes de IA":()=>import("./ai-agents-workspace"),
  "Criações":()=>import("./creative-library-workspace"),
  "Postagens":()=>import("./creative-library-workspace"),
  "Marketing":()=>import("./creative-library-workspace"),
  "Referências criativas":()=>import("./creative-library-workspace"),
  "Google Drive":()=>import("./creative-library-workspace"),
  "Financeiro":()=>import("./finance-workspace"),
  "Gestão":()=>import("./finance-workspace"),
  "Canais e integrações":()=>import("./channels-integrations"),
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
  Download, CircleHelp,
  MoreHorizontal,\n  Image,
} from "lucide-react";

const iconMap = {
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
  more: MoreHorizontal,\n  image: Image,
};

function Icon({ name, size = 18 }: { name: keyof typeof iconMap; size?: number }) {
  const IconComponent = iconMap[name] ?? MessagesSquare;
  return <IconComponent aria-hidden="true" size={size} strokeWidth={1.7} />;
}

type NavigationChild = { label: string; icon?: keyof typeof iconMap };
type NavigationItem = { label: string; icon: keyof typeof iconMap; children?: NavigationChild[] };
const navigation: { section: string; items: NavigationItem[] }[] = [
  { section: "OPERAÇÃO", items: [{ label: "Visão geral", icon: "layout-dashboard" }, { label: "Atendimento", icon: "messages" }, { label: "CRM", icon: "users" }, { label: "Agenda", icon: "calendar" }, { label: "Tarefas", icon: "tasks" }] },
  { section: "RESULTADOS", items: [
    { label: "Automação", icon: "workflow", children: [{ label: "Chatbots", icon: "sparkles" }, { label: "Workflows", icon: "workflow" }, { label: "Agentes de IA", icon: "sparkles" }] },
    { label: "Marketing", icon: "megaphone", children: [{ label: "Criações", icon: "megaphone" }, { label: "Referências criativas", icon: "image" }, { label: "Google Drive", icon: "share" }] },
    { label: "Financeiro", icon: "wallet" },
  ] },
  { section: "ADMINISTRAÇÃO", items: [{ label: "Atendentes", icon: "users" }, { label: "Conexões", icon: "share", children: [{ label: "Canais e integrações", icon: "share" }] }, { label: "Configurações", icon: "settings" }] },
];

const workspaceTabs: Record<string, { label: string; target: string }[]> = {
  automation: [{ label: "Chatbots", target: "Chatbots" }, { label: "Workflows", target: "Workflows" }, { label: "Agentes de IA", target: "Agentes de IA" }],
  marketing: [{ label: "Criações", target: "Criações" }, { label: "Referências criativas", target: "Referências criativas" }, { label: "Google Drive", target: "Google Drive" }],
  connections: [{ label: "Conexões", target: "Canais e integrações" }],
};
const workspaceTabKey = (value: string) => ["Chatbots", "Workflows", "Agentes de IA"].includes(value)
  ? "automation"
  : ["Criações", "Referências criativas", "Google Drive"].includes(value)
    ? "marketing"
    : value === "Canais e integrações" ? "connections" : null;

const metrics = [
  { key:"openConversations",label: "Conversas abertas", value: "—", note: "Abertas e pendentes, conforme suas permissões", icon: "messages" },
  { key:"contacts",label: "Contatos", value: "—", note: "Cadastros desta empresa", icon: "users" },
  { key:"activeAgents",label: "Agentes ativos", value: "—", note: "Agentes habilitados na configuração", icon: "sparkles" },
  { key:"completedConversations",label: "Atendimentos finalizados", value: "—", note: "Total atual, conforme suas permissões", icon: "chart-no-axes-combined" },
] as const;

export default function HomePage() {
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
  const [active, setActive] = useState("");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [workflowTab, setWorkflowTab] = useState("Campanhas de mensagens");
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => {
    const validModules = new Set(["Atendentes","Canais e integrações",...navigation.flatMap((group) => group.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)]))]);
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("module");
    if (requested === "Gestão") setActive("Financeiro");
    else if (requested === "Integrações (API)") setActive("Configurações");
    else if (requested === "Origem dos Leads") setActive("CRM");
    else if (requested === "Relatórios" || requested === "Inteligência Operacional") { setActive("CRM"); params.set("crmTab", "reports"); }
    else if (requested && validModules.has(requested)) {
      preloadWorkspace(requested);
      setActive(requested);
    }
    setNavigationReady(true);
  }, []);
  useEffect(() => {
    if (!navigationReady) return;
    const url = new URL(window.location.href);
    if (active === "") url.searchParams.delete("module");
    else url.searchParams.set("module", active);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [active, navigationReady]);
  useEffect(()=>{try{localStorage.removeItem("vexora:quick-replies");localStorage.removeItem("vexora-chatbot-rastreabem-draft-v2")}catch{}},[]);
  const [overview,setOverview]=useState<{openConversations:number;contacts:number;activeAgents:number;completedConversations:number;recent:{id:string;status:string;updatedAt:string;contact:{name:string}}[]}|null>(null);
  const [overviewError,setOverviewError]=useState("");
  useEffect(()=>{if(!session||session.user.mustChangePassword||active!=="Visão geral")return;let live=true;setOverview(null);const load=()=>fetch("/api/backend/overview",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(live){setOverview(data);setOverviewError("")}}).catch(()=>{if(live)setOverviewError("Não foi possível atualizar os indicadores.")});void load();const timer=setInterval(()=>void load(),60000);return()=>{live=false;clearInterval(timer)}},[active,session?.tenant.id]);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  useEffect(() => { const handler=(event:KeyboardEvent)=>{if(event.altKey&&!event.ctrlKey&&!event.shiftKey&&event.code==="KeyM"){event.preventDefault();setSidebarCollapsed(v=>!v);}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
  const [workspaceInfoOpen, setWorkspaceInfoOpen] = useState(false);
  const [settingsAdvanced, setSettingsAdvanced] = useState(false);
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
  type BrandAssets = {primaryColor:string;logoLight:string;logoDark:string;favicon:string;logoShape:"square"|"round"|"rectangular";showCompanyName:boolean};
  const defaultBrandAssets:BrandAssets={primaryColor:"#6258DF",logoLight:"",logoDark:"",favicon:"",logoShape:"rectangular",showCompanyName:true};
  const [theme, setTheme] = useState<ThemeMode>("hybrid");
  const [themeReady,setThemeReady]=useState(false);
  const [brandAssets,setBrandAssets] = useState<BrandAssets>(defaultBrandAssets);
  const [greeting,setGreeting] = useState("Bom dia");
  useEffect(() => { try { const saved = localStorage.getItem("vexora:theme"); if(saved==="dark"||saved==="hybrid"||saved==="light")setTheme(saved); } catch {} finally{setThemeReady(true)} }, []);
  useEffect(() => { if(!themeReady)return; document.documentElement.dataset.theme = theme; try { localStorage.setItem("vexora:theme", theme); } catch {} }, [theme,themeReady]);
  useEffect(() => { const updateGreeting=()=>{const hour=new Date().getHours();setGreeting(hour>=5&&hour<12?"Bom dia":hour>=12&&hour<18?"Boa tarde":hour>=18?"Boa noite":"Boa madrugada");};updateGreeting();const timer=window.setInterval(updateGreeting,60000);return()=>window.clearInterval(timer); }, []);
  useEffect(() => { if (!session||session.user.mustChangePassword) return; let live=true; const apply=(v:any)=>{if(!live||!v)return;const next={...defaultBrandAssets,...v};if(!/^#[0-9a-fA-F]{6}$/.test(next.primaryColor))next.primaryColor=defaultBrandAssets.primaryColor;setBrandAssets(next);document.documentElement.style.setProperty("--primary",next.primaryColor);const hex=next.primaryColor.slice(1);const rgb={r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16)};const luminance=(0.2126*rgb.r+0.7152*rgb.g+0.0722*rgb.b)/255;document.documentElement.style.setProperty("--primary-contrast",brandTextColor(next.primaryColor));document.documentElement.style.setProperty("--primary-soft",`color-mix(in srgb, ${next.primaryColor} 13%, var(--card))`);if(next.favicon){let link=document.querySelector<HTMLLinkElement>('link[rel~="icon"]');if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}link.href=next.favicon;}};void fetch("/api/backend/contacts/brand-settings",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(apply).catch(()=>{});const onBrandUpdate=(event:Event)=>apply((event as CustomEvent).detail);window.addEventListener("vexora:brand-updated",onBrandUpdate);return()=>{live=false;window.removeEventListener("vexora:brand-updated",onBrandUpdate);}; }, [session?.tenant.slug]);
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
  const moduleForLabel:Record<string,string>={'Visão geral':'INBOX','Atendentes':'SETTINGS','Atendimento':'INBOX','CRM':'CRM','Agenda':'CALENDAR','Tarefas':'TASKS','Automação':'AUTOMATION','Chatbots':'AUTOMATION','Workflows':'AUTOMATION','Agentes de IA':'AUTOMATION','Marketing':'MARKETING','Postagens':'MARKETING','Criações':'MARKETING','E-mails':'EMAIL','Referências criativas':'MARKETING','Google Drive':'MARKETING','Financeiro':'FINANCE','Canais e integrações':'CHANNELS','Configurações':'SETTINGS'};
  const moduleVisible=(label:string)=>session?.user.isPlatformAdmin===true||!moduleForLabel[label]||(session?.allowedModules||[]).includes(moduleForLabel[label]!);
  const platformPanel=session?.tenant.kind==="PLATFORM"&&session?.user.isPlatformAdmin===true;
  const isOverview = active === "Visão geral";
  useEffect(() => { if (active !== "Configurações") setSettingsAdvanced(false); }, [active]);
  const currentWorkspaceTab = workspaceTabKey(active);
  const presentationHome=active==="";
  const canManage = ["OWNER", "ADMIN"].includes((session?.role || "").toUpperCase());
  const canConfigure = ["OWNER", "ADMIN", "MANAGER"].includes((session?.role || "").toUpperCase());

  if (authStatus === "checking") {
    return <div className="auth-screen"><div className="auth-panel"><span className="brand-mark">V</span><h1>Véxora Suite</h1><p>Conectando ao seu ambiente...</p></div></div>;
  }
  if (authStatus === "anonymous") {
    return <AuthScreen onAuthenticated={(value) => { setSession(value); setAuthStatus("authenticated");void refreshProfile(); }} />;
  }

  if(session?.user.mustChangePassword)return <ChangePasswordScreen/>;
  return (
    <div className={"suite-app"+(presentationHome?" home-mode":"")}>
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-compact" : ""}`}>
        <div className="sidebar-brand-row"><a className="brand" href="/" aria-label="Página inicial" onClick={(event) => { event.preventDefault(); setActive("");setMenuOpen(false); }}>
          {(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)&&brandAssets.logoShape==="rectangular"?<img className="brand-full-logo" src={theme==="light"?brandAssets.logoLight:brandAssets.logoDark} alt={session?.tenant.name||"Logo da empresa"}/>:<><span className={"brand-mark "+((theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?"has-custom-logo ":"")+(brandAssets.logoShape==="round"?"custom-round":brandAssets.logoShape==="square"?"custom-square":"")}>{(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?<img src={theme==="light"?brandAssets.logoLight:brandAssets.logoDark} alt=""/>:"V"}</span>{(brandAssets.logoShape==="rectangular"||brandAssets.showCompanyName||!(theme==="light"?brandAssets.logoLight:brandAssets.logoDark))?<span className="brand-copy"><strong>{brandAssets.logoShape!=="rectangular"&&(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?session?.tenant.name||"Véxora":"véxora"}</strong><small>{brandAssets.logoShape==="rectangular"?"SUITE":""}</small></span>:null}</>}
        </a></div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) => moduleVisible(item.label) && (!["Financeiro","Marketing"].includes(item.label) || canManage) && (!["Configurações","Conexões"].includes(item.label) || canConfigure));
            if (!visibleItems.length) return null;
            return <div className="nav-group" key={group.section}>
              <p className="nav-section">{group.section}</p>
              {visibleItems.map((item) => {
                const expanded = expandedModules.includes(item.label);
                const childActive = item.children?.some((child) => child.label === active) || false;
                const familyActive = (item.label === "Automação" && workspaceTabKey(active) === "automation") || (item.label === "Marketing" && workspaceTabKey(active) === "marketing") || (item.label === "Conexões" && workspaceTabKey(active) === "connections");
                return <div className={"nav-accordion " + (expanded ? "expanded" : "")} key={item.label}>
                  <button type="button" title={sidebarCollapsed ? item.label : undefined} aria-expanded={item.children ? expanded : undefined} onPointerEnter={()=>{if(!item.children)preloadWorkspace(item.label)}} onFocus={()=>{if(!item.children)preloadWorkspace(item.label)}} className={"nav-item " + ((active === item.label || childActive || familyActive) ? "active" : "") + (item.children ? " nav-parent" : "")}
                    onClick={() => {
                      if (item.children) {
                        setExpandedModules((current) => current.includes(item.label) ? [] : [item.label]);
                      } else {
                        setExpandedModules([]);preloadWorkspace(item.label);setActive(item.label); setMenuOpen(false); setSidebarCollapsed(true);
                      }
                    }}>
                    <span className="nav-glyph"><Icon name={item.icon} size={18} /></span><span>{item.label}</span>
                    {item.children ? <ChevronDown className="nav-accordion-chevron" size={14} aria-hidden="true" /> : null}
                  </button>
                  {item.children && expanded ? <div className="nav-submenu nav-submenu-panel" role="menu" aria-label={item.label}>{item.children.filter(child=>moduleVisible(child.label)).map((child) => <button key={child.label} type="button" role="menuitem" className={"nav-subitem " + (active === child.label ? "active" : "")} onPointerEnter={()=>preloadWorkspace(child.label)} onFocus={()=>preloadWorkspace(child.label)} onClick={() => { preloadWorkspace(child.label); setActive(child.label); setMenuOpen(false); setExpandedModules([]); setSidebarCollapsed(true); }}><span className="nav-subitem-glyph"><Icon name={child.icon || "more"} size={15} /></span><span>{child.label}</span></button>)}</div> : null}
                </div>;
              })}
            </div>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-utilities"><button type="button" className="sidebar-icon" aria-label="Instalar Véxora" title="Instalar Véxora" onClick={()=>window.dispatchEvent(new Event('vexora:install'))}><Download size={18}/></button><details className="sidebar-help"><summary className="sidebar-icon" aria-label="Ajuda" title="Ajuda"><CircleHelp size={18}/></summary><div><strong>Precisa de ajuda?</strong><p>Consulte as configurações dos canais ou peça orientação no assistente Véxora.</p><button className="text-button" onClick={()=>setAssistantOpen(true)}>Abrir assistente</button></div></details></div>
          {session&&<SidebarProfile user={session.user} canManage={canManage&&moduleVisible("Atendentes")} onUpdated={refreshProfile} onTeam={()=>{setActive('Atendentes');setMenuOpen(false)}}/>}
        </div>
      </aside>
      {menuOpen ? <button type="button" className="mobile-sidebar-backdrop" aria-label="Fechar menu lateral" onClick={() => setMenuOpen(false)} /> : null}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">☰</button>
          <div className="breadcrumbs"><span>Véxora Suite</span>{active&&<><span className="crumb-slash">/</span><strong>{active}</strong></>}</div>
          <div className="topbar-actions">
            {moduleVisible("Atendimento")&&session&&<MentionNotifications key={session.tenant.id+":"+session.user.id} tenantId={session.tenant.id} userId={session.user.id}/>}
            <PwaControls tenantId={session?.tenant.id||""} userId={session?.user.id||""}/>
            <button type="button" className="ai-assistant-trigger" aria-label="Abrir assistente Véxora" title="Assistente pessoal (sob demanda)" onClick={() => setAssistantOpen(v => !v)}><Sparkles size={17}/><span>Assistente</span></button>
            {session?.role==="OWNER"&&<CompanySwitcher current={session.tenant} canCreate={session.user.isPlatformAdmin===true}/>}
            <label className="search-box"><span>⌕</span><input ref={searchInputRef} aria-label="Buscar contatos" placeholder="Buscar contatos…" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing&&globalSearch.trim()){preloadWorkspace("CRM");setCrmSearch(globalSearch.trim());setActive("CRM");e.currentTarget.blur()}}} /><kbd>⌘ K</kbd></label>
            <button className="icon-button theme-toggle" onClick={() => setTheme(value => value==="hybrid"?"light":value==="light"?"dark":"hybrid")} aria-label={"Tema atual: "+({hybrid:"Híbrido",light:"Claro",dark:"Escuro"}[theme])+". Clique para alternar."} title={"Tema: "+({hybrid:"Híbrido",light:"Claro",dark:"Escuro"}[theme])+" · clique para alternar"}>{theme==="hybrid"?<SunMoon size={17}/>:theme==="light"?<Sun size={17}/>:<Moon size={17}/>}</button>
            
            <button className="logout-button" onClick={async () => { await disableDeviceNotifications().catch(()=>{}); await fetch("/api/backend/auth/logout", { method: "POST" }); setSession(null); setAuthStatus("anonymous"); }} title="Sair da conta">Sair</button>
          </div>
        </header>

        {!presentationHome && currentWorkspaceTab ? <nav className="persistent-module-tabs" aria-label="Seção atual">{workspaceTabs[currentWorkspaceTab!]!.map((tab) => <button key={tab.target} type="button" className={active === tab.target ? "active" : ""} onClick={() => { preloadWorkspace(tab.target); setActive(tab.target); setExpandedModules([]); }}>{tab.label}</button>)}</nav> : null}
        <div className={"page-content"+(presentationHome?" presentation-page":"")}>{!presentationHome&&<WorkspaceAlerts admin={session?.role==='OWNER'||session?.role==='ADMIN'}/>}
          {isOverview ? <section className="page-heading">
            <div><h1>{greeting+"! 👋"}</h1><p className="page-subtitle">{platformPanel?"Painel da Véxora · Administração da plataforma":"Painel da empresa · "+session?.tenant.name}</p></div>
            <button className="primary-button" onClick={() => setActive("Atendimento")}><span>＋</span> Abrir atendimento</button>
          </section> : null}

          {presentationHome?<PresentationHome key={session?.tenant.id}/>:!moduleVisible(active)?<section className="content-card"><h2>Acesso não permitido</h2><p>Este módulo não está habilitado para seu usuário.</p></section>:isOverview ? (
            <>
              {overviewError&&<p role="status">{overviewError}</p>}<section className="metrics-grid" aria-label="Indicadores da operação">
                {metrics.map((metric) => <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon name={metric.icon} size={17} /></span></div><strong className="metric-value">{overview?overview[metric.key].toLocaleString("pt-BR"):metric.value}</strong><p>{metric.note}</p></article>)}
              </section>
              <section className="overview-insights" aria-label="Resumo visual da operação">
                <article className="content-card insight-chart-card"><div className="card-heading"><div><h2>Status da operação</h2><p>Distribuição dos atendimentos atuais</p></div></div><div className="donut-chart donut-open"><strong>{overview?.openConversations ?? "—"}</strong><small>abertas</small></div><div className="chart-legend"><span><i className="legend-dot open"/>Abertas</span><span><i className="legend-dot done"/>Finalizadas</span></div></article>
                <article className="content-card insight-chart-card"><div className="card-heading"><div><h2>Capacidade</h2><p>Contatos e agentes habilitados</p></div></div><div className="bar-chart"><div><span>Contatos</span><b><i style={{width: overview ? `${Math.min(100, Math.max(8, overview.contacts))}%` : "8%"}}/></b><strong>{overview?.contacts ?? "—"}</strong></div><div><span>Agentes</span><b><i className="bar-agents" style={{width: overview ? `${Math.min(100, Math.max(8, overview.activeAgents * 12))}%` : "8%"}}/></b><strong>{overview?.activeAgents ?? "—"}</strong></div></div></article>
                <article className="content-card insight-chart-card"><div className="card-heading"><div><h2>Atividade recente</h2><p>Volume finalizado e aberto</p></div></div><div className="mini-stat-row"><div><strong>{overview?.completedConversations ?? "—"}</strong><span>finalizados</span></div><div><strong>{overview?.openConversations ?? "—"}</strong><span>em andamento</span></div></div><button className="secondary-button" onClick={() => setActive("Atendimento")}>Abrir atendimento <span>→</span></button></article>
              </section>
              <section className="dashboard-grid">
                <article className="content-card activity-card">
                  <div className="card-heading"><div><h2>Atividade recente</h2><p>Movimentações da sua operação</p></div><button className="text-button" onClick={() => setActive("Atendimento")}>Ver atendimento <span>→</span></button></div>
                  {overview?.recent.length?<ul className="overview-recent">{overview.recent.map(item=><li key={item.id}><strong>{item.contact.name}</strong><span>{({OPEN:"Aberto",PENDING:"Pendente",RESOLVED:"Finalizado",CLOSED:"Concluído"} as Record<string,string>)[item.status]||item.status}</span><small>{formatDateTimeBR(item.updatedAt)}</small></li>)}</ul>:<div className="empty-state"><span className="empty-illustration"><span>◫</span><i>✳</i></span><h3>Sua operação começa aqui</h3><p>Os atendimentos desta empresa aparecerão aqui conforme suas permissões.</p><button className="secondary-button" onClick={() => setActive("Atendimento")}>Conhecer atendimento <span>→</span></button></div>}
                </article>
                <article className="content-card shortcuts-card">
                  <div className="card-heading"><div><h2>Acesso rápido</h2><p>Vá direto ao que precisa</p></div></div>
                  <div className="shortcut-list">
                    {[{name:"Central de atendimento",desc:"Conversas e equipes",icon:"messages",target:"Atendimento"},{name:"CRM",desc:"Contatos e oportunidades",icon:"users",target:"CRM"},{name:"Agenda",desc:"Atendimentos e reuniões",icon:"calendar",target:"Agenda"},{name:"Automação",desc:"IA, bots e regras",icon:"workflow",target:"Automação"},{name:"Marketing",desc:"Conteúdos e referências",icon:"megaphone",target:"Marketing"}].map((item) => <button className="shortcut-item" key={item.name} onPointerEnter={()=>preloadWorkspace(item.target)} onFocus={()=>preloadWorkspace(item.target)} onClick={() => {preloadWorkspace(item.target);setActive(item.target)}}><span className="shortcut-icon"><Icon name={item.icon as keyof typeof iconMap} size={18} /></span><span className="shortcut-copy"><strong>{item.name}</strong><small>{item.desc}</small></span><span className="shortcut-arrow">↗</span></button>)}
                  </div>
                </article>
              </section>
              <section className="bottom-note"><span className="note-icon">i</span><p><strong>Dados reais:</strong> os indicadores refletem o estado atual da sua empresa. Consulte a Inteligência Operacional para comparar períodos.</p></section>
            </>
          ) : active === "Tarefas" ? (
            <TasksWorkspace />
          ) : active === "Agenda" ? (
            <CalendarWorkspace />
          ) : active === "CRM" ? (
            <CrmWorkspace key={(session?.tenant.id||"")+":"+crmSearch} initialSearch={crmSearch} />
          ) : active === "Financeiro" || active === "Gestão" ? (
            canManage ? <FinanceWorkspace /> : <section className="module-placeholder content-card"><h2>Acesso restrito</h2><p>Somente a administração pode consultar dados financeiros.</p></section>
          ) : active === "Agentes de IA" ? (
            canConfigure ? <AiAgentsWorkspace /> : <section className="content-card"><h2>Acesso restrito</h2></section>
          ) : active === "Chatbots" ? (
            canConfigure ? <ChatbotWorkspace key={session?.tenant.id} tenantId={session?.tenant.id||""} /> : <section className="content-card"><h2>Acesso restrito</h2></section>
          ) : active === "Referências criativas" || active === "Google Drive" || active === "Postagens" || active === "Criações" || active === "Marketing" ? (
            canManage ? <CreativeLibraryWorkspace key={active} initialTab={active==="Google Drive"?"drive":["Postagens","Criações","Marketing"].includes(active)?"creations":"references"} /> : <section className="content-card"><h2>Acesso restrito</h2><p>Somente a administração pode gerenciar criações e referências.</p></section>
          ) : active === "Atendentes" ? (
            canManage ? <TeamWorkspace platformAdmin={session?.user.isPlatformAdmin===true}/> : <section className="content-card"><h2>Acesso restrito</h2></section>
          ) : active === "E-mails" ? (
            <section className="content-card"><h2>Recurso fora do escopo atual</h2></section>
          ) : active === "Workflows" ? (
            canManage ? <WorkflowsWorkspace/> : <section className="content-card"><h2>Acesso restrito</h2></section>
          ) : active === "Atendimento" ? (
            <InboxWorkspace key={session?.tenant.id} tenantId={session?.tenant.id||""} canManageChannels={canConfigure} />
          ) : active === "Canais e integrações" ? (
            canConfigure ? <ChannelsIntegrations /> : <section className="module-placeholder content-card"><h2>Acesso restrito</h2><p>Somente responsáveis pela configuração da empresa podem acessar este ambiente.</p></section>
          ) : active === "Configurações" ? (
            canConfigure ? (settingsAdvanced ? <><button type="button" className="settings-back-link" onClick={() => setSettingsAdvanced(false)}>← Voltar para Configurações</button><OperationsSettings canConfigureAsaas={["OWNER", "ADMIN"].includes((session?.role || "").toUpperCase())} companyName={session?.tenant.name||"Sua empresa"} isPlatformAdmin={session?.user.isPlatformAdmin===true} /></> : <SettingsCatalog onNavigate={(target) => { preloadWorkspace(target); setActive(target); }} onAdvanced={() => setSettingsAdvanced(true)} onCompanies={() => window.dispatchEvent(new Event("vexora:open-companies"))} />) : <section className="module-placeholder content-card"><h2>Acesso restrito</h2><p>Somente responsáveis pela configuração da empresa podem acessar este ambiente.</p></section>
          ) : (
            <section className="module-placeholder content-card">
              <span className="module-placeholder-icon"><Icon name={navigation.flatMap((group) => group.items).find((item) => item.label === active)?.icon ?? "messages"} size={25} /></span>
              <p className="eyebrow">MÓDULO DA PLATAFORMA</p><h2>{active}</h2>
              <p>O espaço de trabalho de <strong>{active}</strong> será conectado aos serviços operacionais na próxima etapa. Nenhuma ação ou dado da Véxora antiga é alterado por esta versão.</p>
              <div className="placeholder-status"><span /> Interface em preparação</div>
              <button className="secondary-button" onClick={() => setActive("Visão geral")}>← Voltar à visão geral</button>
            </section>
          )}
          {!presentationHome&&active !== "Atendimento" ? <footer className="page-footer"><span>© 2026 Véxora Suite</span><span>Uma plataforma. Vários módulos.</span></footer> : null}
        </div>
      </main>
      {assistantOpen ? <PersonalAssistantPanel onClose={() => setAssistantOpen(false)} /> : null}
      <nav className="mobile-bottom-nav" aria-label="Navegação principal no celular">
        <button type="button" className={presentationHome ? "active" : ""} onClick={() => { setActive(""); setMenuOpen(false); }}><Icon name="layout-dashboard" size={20}/><span>Início</span></button>
        <button type="button" className={active === "Atendimento" ? "active" : ""} onPointerEnter={()=>preloadWorkspace("Atendimento")} onFocus={()=>preloadWorkspace("Atendimento")} onClick={() => { preloadWorkspace("Atendimento");setActive("Atendimento"); setMenuOpen(false); }}><Icon name="messages" size={20}/><span>Conversas</span></button>
        <button type="button" className={active === "CRM" ? "active" : ""} onPointerEnter={()=>preloadWorkspace("CRM")} onFocus={()=>preloadWorkspace("CRM")} onClick={() => { preloadWorkspace("CRM");setActive("CRM"); setMenuOpen(false); }}><Icon name="users" size={20}/><span>CRM</span></button>
        <button type="button" className={menuOpen ? "active" : ""} onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen}><Icon name="more" size={20}/><span>Mais</span></button>
      </nav>
    </div>
  );
}

