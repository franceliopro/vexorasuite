"use client";

import { useState } from "react";

const iconPaths: Record<string, string[]> = {
  "layout-dashboard": ["M3 3h7v7H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 14h7v7H3z"],
  messages: ["M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M20 8v6", "M23 11h-6"],
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z", "M8 14h.01", "M12 14h.01", "M16 14h.01", "M8 17h.01", "M12 17h.01"],
  workflow: ["M12 3v6", "M6 15v6", "M18 15v6", "M6 12h12", "M6 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M18 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  megaphone: ["M3 11v2a2 2 0 0 0 2 2h2l4 5V4l-4 5H5a2 2 0 0 0-2 2z", "M11 9l9-4v14l-9-4", "M7 15l1 5"],
  wallet: ["M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6", "M20 12h-5a2 2 0 0 0 0 4h5z", "M16 14h.01"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.5 2.6-.2-.1a1.7 1.7 0 0 0-1.8.1 1.7 1.7 0 0 0-.8 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1.2-1.6 1.7 1.7 0 0 0-1.8.1l-.2.1-1.5-2.6.1-.1A1.7 1.7 0 0 0 8.2 15a1.7 1.7 0 0 0-1.5-.8h-.2v-3h.2a1.7 1.7 0 0 0 1.6-1.2 1.7 1.7 0 0 0-.1-1.8l-.1-.2 2.6-1.5.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 .8-1.5v-.2h3v.2a1.7 1.7 0 0 0 1.2 1.6 1.7 1.7 0 0 0 1.8-.1l.2-.1 1.5 2.6-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5.8h.2v3h-.2a1.7 1.7 0 0 0-1.7.8z"],
  "chevron-left": ["m15 18-6-6 6-6"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "chart-no-axes-combined": ["M3 3v18h18", "m19 9-5 5-4-4-5 5", "M17 9h2v2"],
  sparkles: ["m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z", "m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14z"],
};
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{(iconPaths[name] ?? iconPaths.messages).map((d, index) => <path key={index} d={d} />)}</svg>;
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
