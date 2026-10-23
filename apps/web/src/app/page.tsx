"use client";

import { useEffect, useRef, useState } from "react";
import { AuthScreen, type AuthSession } from "./auth-screen";
import { InboxWorkspace } from "./inbox-workspace";
import { OperationsSettings } from "./operations-settings";
import {
  CalendarDays,
  Activity,
  ChevronLeft,
  ChevronRight,
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

const navigation: { section: string; items: { label: string; icon: keyof typeof iconMap }[] }[] = [
  { section: "OPERAÇÃO", items: [{ label: "Visão geral", icon: "layout-dashboard" }, { label: "Atendimento", icon: "messages" }, { label: "CRM", icon: "users" }, { label: "Agenda", icon: "calendar" }] },
  { section: "RESULTADOS", items: [{ label: "Automação", icon: "workflow" }, { label: "Marketing", icon: "megaphone" }, { label: "Financeiro", icon: "wallet" }] },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActive("Visão geral"); }}>
          <span className="brand-mark">V</span>
          <span className="brand-copy"><strong>véxora</strong><small>SUITE</small></span>
        </a>
        <button className="sidebar-collapse" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}><Icon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} size={16} /></button>
        <div className="workspace-switcher">
          <span className="workspace-avatar">V</span>
          <span className="workspace-copy"><strong>{session?.tenant.name || "Minha empresa"}</strong><small>{session?.tenant.slug || "Workspace"}</small></span>
          <span className="switch-chevron">⌄</span>
        </div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map((group) => {
            const visibleItems = group.items.filter((item) => item.label !== "Configurações" || canConfigure);
            if (!visibleItems.length) return null;
            return <div className="nav-group" key={group.section}>
              <p className="nav-section">{group.section}</p>
              {visibleItems.map((item) => (
                <button key={item.label} title={sidebarCollapsed ? item.label : undefined} className={"nav-item " + (active === item.label ? "active" : "")} onClick={() => { setActive(item.label); setMenuOpen(false); }}>
                  <span className="nav-glyph"><Icon name={item.icon} size={18} /></span><span>{item.label}</span>
                </button>
              ))}
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
            <label className="search-box"><span>⌕</span><input ref={searchInputRef} aria-label="Buscar" placeholder="Buscar..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button" aria-label="Notificações">♧<i /></button>
            <button className="logout-button" onClick={async () => { await fetch("/api/backend/auth/logout", { method: "POST" }); setSession(null); setAuthStatus("anonymous"); }} title="Sair da conta">Sair</button>
          </div>
        </header>

        <div className="page-content">
          {active !== "Atendimento" ? <section className="page-heading">
            <div><p className="eyebrow">CENTRAL DE OPERAÇÕES</p><h1>{isHome ? "Bom dia! 👋" : active}</h1><p className="page-subtitle">{isHome ? "Acompanhe a operação da sua empresa em um só lugar." : `Esta área será construída e conectada aos serviços da Véxora: ${active.toLowerCase()}.`}</p></div>
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
          ) : active === "Atendimento" ? (
            <InboxWorkspace />
          ) : active === "Configurações" ? (
            canConfigure ? <OperationsSettings /> : <section className="module-placeholder content-card"><h2>Acesso restrito</h2><p>Somente responsáveis pela configuração da empresa podem acessar este ambiente.</p></section>
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
