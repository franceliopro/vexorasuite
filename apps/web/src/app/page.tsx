"use client";

import { useEffect, useRef, useState } from "react";
import { AuthScreen, type AuthSession } from "./auth-screen";
import { InboxWorkspace } from "./inbox-workspace";
import { OperationsSettings } from "./operations-settings";
import { CrmWorkspace } from "./crm-workspace";
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
  UsersRound,
} from "lucide-react";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  messages: MessagesSquare,
  users: UsersRound,
  calendar: CalendarDays,
  workflow: Workflow,
  megaphone: Megaphone,
  wallet: Wallet,
  settings: Settings2,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chart-no-axes-combined": Activity,
  sparkles: Sparkles,
};

function Icon({ name, size = 18 }: { name: keyof typeof iconMap; size?: number }) {
  const IconComponent = iconMap[name] ?? MessagesSquare;
  return <IconComponent aria-hidden="true" size={size} strokeWidth={1.7} />;
}

type NavigationChild = { label: string };
type NavigationItem = { label: string; icon: keyof typeof iconMap; children?: NavigationChild[] };
const navigation: { section: string; items: NavigationItem[] }[] = [
  { section: "OPERAÇÃO", items: [{ label: "Visão geral", icon: "layout-dashboard" }, { label: "Atendimento", icon: "messages" }, { label: "CRM", icon: "users" }, { label: "Agenda", icon: "calendar" }] },
  { section: "RESULTADOS", items: [
    { label: "Automação", icon: "workflow", children: [{ label: "Chatbots" }, { label: "Workflows" }, { label: "Agentes de IA" }] },
    { label: "Marketing", icon: "megaphone", children: [{ label: "Postagens" }, { label: "Anúncios" }, { label: "Resultados" }] },
    { label: "Financeiro", icon: "wallet", children: [{ label: "Gestão" }, { label: "Integrações (API)" }] },
  ] },
  { section: "ADMINISTRAÇÃO", items: [{ label: "Configurações", icon: "settings" }] },
];

const metrics = [
  { label: "Conversas abertas", value: "—", note: "Aguardando conexão com os dados", icon: "messages" },
  { label: "Leads em andamento", value: "—", note: "CRM ainda não conectado", icon: "users" },
  { label: "Agentes ativos", value: "—", note: "Configure seus agentes", icon: "sparkles" },
  { label: "Resolução automática", value: "—", note: "Disponível após ativar a operação", icon: "chart-no-axes-combined" },
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
      .then((value) => { if (mounted) { setSession(value); setAuthStatus("authenticated"); } })
      .catch(() => { if (mounted) setAuthStatus("anonymous"); });
    return () => { mounted = false; };
  }, []);

  const [active, setActive] = useState("Visão geral");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [workflowTab, setWorkflowTab] = useState("Campanhas de mensagens");
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => {
    const validModules = new Set(navigation.flatMap((group) => group.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)])));
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("module");
    if (requested === "Origem dos Leads") setActive("CRM");
    else if (requested === "Relatórios" || requested === "Inteligência Operacional") { setActive("CRM"); params.set("crmTab", "reports"); }
    else if (requested && validModules.has(requested)) {
      setActive(requested);
      const parent = navigation.flatMap((group) => group.items).find((item) => item.children?.some((child) => child.label === requested));
      if (parent) setExpandedModules([parent.label]);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceInfoOpen, setWorkspaceInfoOpen] = useState(false);
    type ThemeMode = "hybrid" | "light" | "dark";
  type BrandAssets = {primaryColor:string;logoLight:string;logoDark:string;favicon:string;logoShape:"square"|"round"|"rectangular";showCompanyName:boolean};
  const defaultBrandAssets:BrandAssets={primaryColor:"#6258DF",logoLight:"",logoDark:"",favicon:"",logoShape:"rectangular",showCompanyName:true};
  const [theme, setTheme] = useState<ThemeMode>("hybrid");
  const [brandAssets,setBrandAssets] = useState<BrandAssets>(defaultBrandAssets);
  const [greeting,setGreeting] = useState("Bom dia");
  useEffect(() => { try { const saved = localStorage.getItem("vexora:theme"); if(saved==="dark"||saved==="hybrid")setTheme(saved);else if(saved==="light")setTheme("hybrid"); } catch {} }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("vexora:theme", theme); } catch {} }, [theme]);
  useEffect(() => { const updateGreeting=()=>{const hour=new Date().getHours();setGreeting(hour>=5&&hour<12?"Bom dia":hour>=12&&hour<18?"Boa tarde":hour>=18?"Boa noite":"Boa madrugada");};updateGreeting();const timer=window.setInterval(updateGreeting,60000);return()=>window.clearInterval(timer); }, []);
  useEffect(() => { if (!session) return; let live=true; const apply=(v:any)=>{if(!live||!v)return;const next={...defaultBrandAssets,...v};if(!/^#[0-9a-fA-F]{6}$/.test(next.primaryColor))next.primaryColor=defaultBrandAssets.primaryColor;setBrandAssets(next);document.documentElement.style.setProperty("--primary",next.primaryColor);const hex=next.primaryColor.slice(1);const rgb={r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16)};const luminance=(0.2126*rgb.r+0.7152*rgb.g+0.0722*rgb.b)/255;document.documentElement.style.setProperty("--primary-contrast",luminance>0.62?"#20243a":"#ffffff");document.documentElement.style.setProperty("--primary-soft",`color-mix(in srgb, ${next.primaryColor} 13%, var(--card))`);if(next.favicon){let link=document.querySelector<HTMLLinkElement>('link[rel~="icon"]');if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}link.href=next.favicon;}};void fetch("/api/backend/contacts/brand-settings",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(apply).catch(()=>{});const onBrandUpdate=(event:Event)=>apply((event as CustomEvent).detail);window.addEventListener("vexora:brand-updated",onBrandUpdate);return()=>{live=false;window.removeEventListener("vexora:brand-updated",onBrandUpdate);}; }, [session?.tenant.slug]);
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
  const isHome = active === "Visão geral";
  const canConfigure = ["OWNER", "ADMIN", "MANAGER"].includes((session?.role || "").toUpperCase());

  if (authStatus === "checking") {
    return <div className="auth-screen"><div className="auth-panel"><span className="brand-mark">V</span><h1>Véxora Suite</h1><p>Conectando ao seu ambiente...</p></div></div>;
  }
  if (authStatus === "anonymous") {
    return <AuthScreen onAuthenticated={(value) => { setSession(value); setAuthStatus("authenticated"); }} />;
  }

  return (
    <div className="suite-app">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <div className="sidebar-brand-row"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActive("Visão geral"); }}>
          {(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)&&brandAssets.logoShape==="rectangular"?<img className="brand-full-logo" src={theme==="light"?brandAssets.logoLight:brandAssets.logoDark} alt={session?.tenant.name||"Logo da empresa"}/>:<><span className={"brand-mark "+(brandAssets.logoShape==="round"?"custom-round":brandAssets.logoShape==="square"?"custom-square":"")}>{(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?<img src={theme==="light"?brandAssets.logoLight:brandAssets.logoDark} alt=""/>:"V"}</span>{(brandAssets.logoShape==="rectangular"||brandAssets.showCompanyName||!(theme==="light"?brandAssets.logoLight:brandAssets.logoDark))?<span className="brand-copy"><strong>{brandAssets.logoShape!=="rectangular"&&(theme==="light"?brandAssets.logoLight:brandAssets.logoDark)?session?.tenant.name||"Véxora":"véxora"}</strong><small>{brandAssets.logoShape==="rectangular"?"SUITE":""}</small></span>:null}</>}
        </a><button className="sidebar-collapse" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}><Icon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} size={16} /></button></div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) => item.label !== "Configurações" || canConfigure);
            if (!visibleItems.length) return null;
            return <div className="nav-group" key={group.section}>
              <p className="nav-section">{group.section}</p>
              {visibleItems.map((item) => {
                const expanded = expandedModules.includes(item.label);
                const childActive = item.children?.some((child) => child.label === active) || false;
                return <div className={"nav-accordion " + (expanded ? "expanded" : "")} key={item.label}>
                  <button type="button" title={sidebarCollapsed ? item.label : undefined} aria-expanded={item.children ? expanded : undefined} className={"nav-item " + ((active === item.label || childActive) ? "active" : "") + (item.children ? " nav-parent" : "")}
                    onClick={() => {
                      if (item.children) {
                        setExpandedModules((current) => current.includes(item.label) ? current.filter((name) => name !== item.label) : [...current, item.label]);
                      } else {
                        setActive(item.label); setMenuOpen(false);
                      }
                    }}>
                    <span className="nav-glyph"><Icon name={item.icon} size={18} /></span><span>{item.label}</span>
                    {item.children ? <ChevronDown className="nav-accordion-chevron" size={14} aria-hidden="true" /> : null}
                  </button>
                  {item.children && expanded ? <div className="nav-submenu">{item.children.map((child) => <button key={child.label} type="button" className={"nav-subitem " + (active === child.label ? "active" : "")} onClick={() => { setActive(child.label); setMenuOpen(false); }}>{child.label}</button>)}</div> : null}
                </div>;
              })}
            </div>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">?</span><div><strong>Precisa de ajuda?</strong><small>Consulte a central de suporte</small></div><span className="help-arrow">↗</span></div>
          <div className="profile-row"><span className="profile-avatar">{(session?.user.name || "V").slice(0, 2).toUpperCase()}</span><span className="profile-copy"><strong>{session?.user.name || "Usuário"}</strong><small>{session?.user.email || ""}</small></span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">☰</button>
          <div className="breadcrumbs"><span>Véxora Suite</span><span className="crumb-slash">/</span><strong>{active}</strong></div>
          <div className="topbar-actions">
            {session?.role === "OWNER" ? <div className="workspace-info-wrap"><button type="button" className="workspace-info-button" onClick={() => setWorkspaceInfoOpen(v=>!v)} aria-expanded={workspaceInfoOpen} title="Informações do ambiente"><span className="workspace-avatar">V</span><span>Ambiente</span><Icon name="chevron-right" size={13}/></button>{workspaceInfoOpen?<div className="workspace-info-popover"><strong>{session?.tenant.name||"Minha empresa"}</strong><small>{session?.tenant.slug||"Workspace"}</small><p>Ambiente atual da empresa. A alternância entre empreendimentos será exibida quando houver mais de um vínculo disponível para sua conta.</p></div>:null}</div>:null}
            <label className="search-box"><span>⌕</span><input ref={searchInputRef} aria-label="Buscar" placeholder="Buscar..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button theme-toggle" onClick={() => setTheme(value => value==="hybrid"?"light":value==="light"?"dark":"hybrid")} aria-label={"Tema atual: "+({hybrid:"Híbrido",light:"Claro",dark:"Escuro"}[theme])+". Clique para alternar."} title={"Tema: "+({hybrid:"Híbrido",light:"Claro",dark:"Escuro"}[theme])+" · clique para alternar"}>{theme==="hybrid"?<SunMoon size={17}/>:theme==="light"?<Sun size={17}/>:<Moon size={17}/>}</button>
            <button className="icon-button" aria-label="Notificações">♧<i /></button>
            <button className="logout-button" onClick={async () => { await fetch("/api/backend/auth/logout", { method: "POST" }); setSession(null); setAuthStatus("anonymous"); }} title="Sair da conta">Sair</button>
          </div>
        </header>

        <div className="page-content">
          {active !== "Atendimento" && active !== "Configurações" && active !== "CRM" ? <section className="page-heading">
            <div><p className="eyebrow">CENTRAL DE OPERAÇÕES</p><h1>{isHome ? greeting+"! 👋" : active}</h1><p className="page-subtitle">{isHome ? "Acompanhe a operação da sua empresa em um só lugar." : `Esta área será construída e conectada aos serviços da Véxora: ${active.toLowerCase()}.`}</p></div>
            <button className="primary-button" onClick={() => setActive("Atendimento")}><span>＋</span> Abrir atendimento</button>
          </section> : null}

          {isHome ? (
            <>
              <section className="metrics-grid" aria-label="Indicadores da operação">
                {metrics.map((metric) => <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon name={metric.icon} size={17} /></span></div><strong className="metric-value">{metric.value}</strong><p>{metric.note}</p></article>)}
              </section>
              <section className="dashboard-grid">
                <article className="content-card activity-card">
                  <div className="card-heading"><div><h2>Atividade recente</h2><p>Movimentações da sua operação</p></div><button className="text-button" onClick={() => setActive("Atendimento")}>Ver atendimento <span>→</span></button></div>
                  <div className="empty-state"><span className="empty-illustration"><span>◫</span><i>✳</i></span><h3>Sua operação começa aqui</h3><p>Quando os módulos forem conectados, as conversas, leads e atividades recentes aparecerão neste painel.</p><button className="secondary-button" onClick={() => setActive("Atendimento")}>Conhecer atendimento <span>→</span></button></div>
                </article>
                <article className="content-card shortcuts-card">
                  <div className="card-heading"><div><h2>Acesso rápido</h2><p>Vá direto ao que precisa</p></div></div>
                  <div className="shortcut-list">
                    {[{name:"Central de atendimento",desc:"Conversas e equipes",icon:"messages",target:"Atendimento"},{name:"CRM",desc:"Contatos e oportunidades",icon:"users",target:"CRM"},{name:"Agenda",desc:"Atendimentos e reuniões",icon:"calendar",target:"Agenda"},{name:"Automação",desc:"IA, bots e regras",icon:"workflow",target:"Automação"},{name:"Marketing",desc:"Campanhas e criações",icon:"megaphone",target:"Marketing"}].map((item) => <button className="shortcut-item" key={item.name} onClick={() => setActive(item.target)}><span className="shortcut-icon"><Icon name={item.icon as keyof typeof iconMap} size={18} /></span><span className="shortcut-copy"><strong>{item.name}</strong><small>{item.desc}</small></span><span className="shortcut-arrow">↗</span></button>)}
                  </div>
                </article>
              </section>
              <section className="bottom-note"><span className="note-icon">i</span><p><strong>Próxima etapa:</strong> concluir a operação de WhatsApp em tempo real e conectar os módulos gradualmente. Os indicadores permanecem sem números fictícios até existirem dados reais.</p></section>
            </>
          ) : active === "CRM" ? (
            <CrmWorkspace />
          ) : active === "Workflows" ? (
            <section className="module-workspace">
              <header className="page-heading"><div><p className="eyebrow">AUTOMAÇÃO</p><h1>Workflows</h1><p className="page-subtitle">Organize campanhas e jornadas automatizadas em um espaço único.</p></div></header>
              <div className="module-tabs" role="tablist" aria-label="Áreas de Workflows">
                {["Campanhas de mensagens", "Sequências", "Ligações e SMS", "Regras e gatilhos"].map((tab) => <button key={tab} type="button" role="tab" aria-selected={workflowTab === tab} className={workflowTab === tab ? "active" : ""} onClick={() => setWorkflowTab(tab)}>{tab}</button>)}
              </div>
              <section className="content-card module-tab-content"><span className="module-placeholder-icon"><Icon name="workflow" size={24}/></span><p className="eyebrow">WORKFLOWS</p><h2>{workflowTab}</h2><p>Esta área está organizada para receber os recursos de {workflowTab.toLowerCase()}. As ações serão habilitadas conforme cada fluxo for conectado e validado.</p><div className="placeholder-status"><span/> Estrutura de navegação pronta · integração funcional em preparação</div></section>
            </section>
          ) : active === "Atendimento" ? (
            <InboxWorkspace />
          ) : active === "Configurações" ? (
            canConfigure ? <OperationsSettings canConfigureAsaas={["OWNER", "ADMIN"].includes((session?.role || "").toUpperCase())} companyName={session?.tenant.name||"Sua empresa"} /> : <section className="module-placeholder content-card"><h2>Acesso restrito</h2><p>Somente responsáveis pela configuração da empresa podem acessar este ambiente.</p></section>
          ) : (
            <section className="module-placeholder content-card">
              <span className="module-placeholder-icon"><Icon name={navigation.flatMap((group) => group.items).find((item) => item.label === active)?.icon ?? "messages"} size={25} /></span>
              <p className="eyebrow">MÓDULO DA PLATAFORMA</p><h2>{active}</h2>
              <p>O espaço de trabalho de <strong>{active}</strong> será conectado aos serviços operacionais na próxima etapa. Nenhuma ação ou dado da Véxora antiga é alterado por esta versão.</p>
              <div className="placeholder-status"><span /> Interface em preparação</div>
              <button className="secondary-button" onClick={() => setActive("Visão geral")}>← Voltar à visão geral</button>
            </section>
          )}
          {active !== "Atendimento" ? <footer className="page-footer"><span>© 2026 Véxora Suite</span><span>Uma plataforma. Vários módulos.</span></footer> : null}
        </div>
      </main>
    </div>
  );
}
