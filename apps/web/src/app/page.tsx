"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
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
  "chart-no-axes-combined": ChartNoAxesCombined,
  sparkles: Sparkles,
};

function Icon({ name, size = 18 }: { name: keyof typeof iconMap; size?: number }) {
  const IconComponent = iconMap[name] ?? MessagesSquare;
  return <IconComponent aria-hidden="true" size={size} strokeWidth={1.7} />;
}

const navigation = [
  { section: "OPERAÇÃO", items: [{ label: "Visão geral", icon: "layout-dashboard" }, { label: "Atendimento", icon: "messages" }, { label: "CRM", icon: "users" }, { label: "Agenda", icon: "calendar" }] },
  { section: "RESULTADOS", items: [{ label: "Automação", icon: "workflow" }, { label: "Marketing", icon: "megaphone" }, { label: "Financeiro", icon: "wallet" }] },
  { section: "ADMINISTRAÇÃO", items: [{ label: "Configurações", icon: "settings" }] },
];

const metrics = [
  { label: "Conversas abertas", value: "—", note: "Aguardando conexão com os dados", icon: "messages" },
  { label: "Leads em andamento", value: "—", note: "CRM ainda não conectado", icon: "users" },
  { label: "Agentes ativos", value: "—", note: "Configure seus agentes", icon: "sparkles" },
  { label: "Resolução automática", value: "—", note: "Disponível após ativar a operação", icon: "chart-no-axes-combined" },
];

export default function HomePage() {
  const [active, setActive] = useState("Visão geral");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isHome = active === "Visão geral";

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
          <span className="workspace-copy"><strong>Minha empresa</strong><small>Ambiente de demonstração</small></span>
          <span className="switch-chevron">⌄</span>
        </div>
        <nav className="side-nav" aria-label="Navegação principal">
          {navigation.map((group) => (
            <div className="nav-group" key={group.section}>
              <p className="nav-section">{group.section}</p>
              {group.items.map((item) => (
                <button key={item.label} title={sidebarCollapsed ? item.label : undefined} className={`nav-item ${active === item.label ? "active" : ""}`} onClick={() => { setActive(item.label); setMenuOpen(false); }}>
                  <span className="nav-glyph"><Icon name={item.icon} size={18} /></span><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">?</span><div><strong>Precisa de ajuda?</strong><small>Consulte a central de suporte</small></div><span className="help-arrow">↗</span></div>
          <div className="profile-row"><span className="profile-avatar">ES</span><span className="profile-copy"><strong>Administrador</strong><small>Conta da plataforma</small></span><button className="profile-more" aria-label="Opções do perfil">···</button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">☰</button>
          <div className="breadcrumbs"><span>Véxora Suite</span><span className="crumb-slash">/</span><strong>{active}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><span>⌕</span><input aria-label="Buscar" placeholder="Buscar..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button" aria-label="Notificações">♧<i /></button>
            <span className="top-avatar">ES</span>
          </div>
        </header>

        <div className="page-content">
          <div className="environment-banner"><span className="environment-dot" /><span><strong>Ambiente de implantação</strong><small> Interface inicial · dados reais ainda não conectados</small></span><span className="environment-tag">STAGING</span></div>
          <section className="page-heading">
            <div><p className="eyebrow">CENTRAL DE OPERAÇÕES</p><h1>{isHome ? "Bom dia! 👋" : active}</h1><p className="page-subtitle">{isHome ? "Acompanhe a operação da sua empresa em um só lugar." : `Esta área será construída e conectada aos serviços da Véxora: ${active.toLowerCase()}.`}</p></div>
            <button className="primary-button" onClick={() => setActive("Atendimento")}><span>＋</span> Abrir atendimento</button>
          </section>

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
                    {[{name:"Central de atendimento",desc:"Conversas e equipes",icon:"messages",target:"Atendimento"},{name:"CRM",desc:"Contatos e oportunidades",icon:"users",target:"CRM"},{name:"Agenda",desc:"Atendimentos e reuniões",icon:"calendar",target:"Agenda"},{name:"Automação",desc:"IA, bots e regras",icon:"workflow",target:"Automação"},{name:"Marketing",desc:"Campanhas e criações",icon:"megaphone",target:"Marketing"}].map((item) => <button className="shortcut-item" key={item.name} onClick={() => setActive(item.target)}><span className="shortcut-icon"><Icon name={item.icon} size={18} /></span><span className="shortcut-copy"><strong>{item.name}</strong><small>{item.desc}</small></span><span className="shortcut-arrow">↗</span></button>)}
                  </div>
                </article>
              </section>
              <section className="bottom-note"><span className="note-icon">i</span><p><strong>Próxima etapa:</strong> implementar autenticação, isolamento por empresa e conexão segura com a API. Os indicadores acima são intencionalmente exibidos sem números fictícios.</p></section>
            </>
          ) : (
            <section className="module-placeholder content-card">
              <span className="module-placeholder-icon"><Icon name={navigation.flatMap((group) => group.items).find((item) => item.label === active)?.icon ?? "messages"} size={25} /></span>
              <p className="eyebrow">MÓDULO DA PLATAFORMA</p><h2>{active}</h2>
              <p>O espaço de trabalho de <strong>{active}</strong> será implementado nesta nova plataforma. Nenhuma ação ou dado de produção é alterado por esta prévia.</p>
              <div className="placeholder-status"><span /> Interface em preparação</div>
              <button className="secondary-button" onClick={() => setActive("Visão geral")}>← Voltar à visão geral</button>
            </section>
          )}
          <footer className="page-footer"><span>© 2026 Véxora Suite</span><span>Uma plataforma. Vários módulos.</span></footer>
        </div>
      </main>
    </div>
  );
}
