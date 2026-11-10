"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Landmark,
  BriefcaseBusiness,
  CircleDollarSign,
  FileSliders,
  Image,
  KeyRound,
  MessageSquareText,
  Network,
  Palette,
  PanelTop,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Variable,
  Workflow,
  Search,
  X,
  ArrowUpRight,
} from "lucide-react";

type CatalogProps = {
  onNavigate: (module: string) => void;
  onAdvanced: () => void;
  onCompanies: () => void;
};

type CatalogCard = {
  title: string;
  description: string;
  icon: typeof Settings2;
  action: "module" | "advanced" | "companies";
  target?: string;
  tone?: string;
  metricKey?: string;
};

const sections: { title: string; cards: CatalogCard[] }[] = [
  {
    title: "Sua empresa",
    cards: [
      { title: "Empresas e ambientes", description: "Crie, altere e troque entre empresas clientes.", icon: Building2, action: "companies", tone: "blue" },
      { title: "Usuários e atendentes", description: "Cadastre pessoas, acessos e perfis de atendimento.", icon: UsersRound, action: "module", target: "Atendentes", tone: "violet", metricKey: "team" },
      { title: "Departamentos e permissões", description: "Organize equipes e defina o que cada setor pode acessar.", icon: BriefcaseBusiness, action: "module", target: "Atendentes", tone: "indigo", metricKey: "departments" },
      { title: "Identidade visual", description: "Nome, logo, favicon e cores que aparecem no painel.", icon: Palette, action: "advanced", tone: "pink" },
      { title: "Organização e LGPD", description: "Dados da empresa, retenção, encarregado e documentos.", icon: Landmark, action: "advanced", tone: "blue" },
    ],
  },
  {
    title: "Conexões",
    cards: [
      { title: "Conexões e inboxes", description: "Veja e conecte todos os canais da empresa em um só lugar.", icon: Network, action: "module", target: "Canais e integrações", tone: "green", metricKey: "inboxes" },
      { title: "Redes sociais · Zernio", description: "Instagram, Facebook e outras contas sociais conectadas.", icon: Radio, action: "module", target: "Canais e integrações", tone: "purple", metricKey: "zernio" },
      { title: "WhatsApp · Waha", description: "Números do WhatsApp conectados por QR Code.", icon: MessageSquareText, action: "module", target: "Canais e integrações", tone: "teal", metricKey: "waha" },
      { title: "Meta Oficial", description: "WhatsApp, Instagram e Messenger quando habilitados.", icon: PanelTop, action: "module", target: "Canais e integrações", tone: "blue", metricKey: "meta" },
      { title: "Google Drive e Agenda", description: "Contas e calendários usados pela empresa.", icon: FileSliders, action: "module", target: "Canais e integrações", tone: "yellow", metricKey: "google" },
      { title: "Asaas", description: "Credenciais, cobrança e sincronização financeira.", icon: CircleDollarSign, action: "module", target: "Financeiro", tone: "orange", metricKey: "asaas" },
      { title: "Planos e cobranças", description: "Planos da Véxora, assinaturas e regras de vencimento.", icon: CircleDollarSign, action: "module", target: "Financeiro", tone: "orange" },
    ],
  },
  {
    title: "Atendimento e automação",
    cards: [
      { title: "Saudações e mensagens", description: "Mensagens de entrada, horários e respostas da operação.", icon: MessageSquareText, action: "advanced", tone: "cyan" },
      { title: "Respostas rápidas", description: "Textos prontos para responder com agilidade.", icon: Sparkles, action: "module", target: "Atendimento", tone: "violet" },
      { title: "Distribuição de atendimento", description: "Fila, rodízio, carga e prioridade para novas conversas.", icon: UsersRound, action: "advanced", tone: "indigo" },
      { title: "Variáveis e automações", description: "Valores e regras usados nos fluxos da empresa.", icon: Variable, action: "module", target: "Workflows", tone: "purple" },
    ],
  },
  {
    title: "Conta e sistema",
    cards: [
      { title: "Segurança e acesso", description: "Preferências administrativas e controle de acesso.", icon: ShieldCheck, action: "advanced", tone: "slate" },
      { title: "Configurações técnicas", description: "Ajustes avançados para integrações e ambiente.", icon: Settings2, action: "advanced", tone: "slate" },
      { title: "Fluxos de trabalho", description: "Modelos que automatizam tarefas, mensagens e follow-ups.", icon: Workflow, action: "module", target: "Workflows", tone: "purple", metricKey: "workflows" },
      { title: "Marca e publicação", description: "Biblioteca, Drive e conteúdo para o Marketing.", icon: Image, action: "module", target: "Marketing", tone: "pink" },
      { title: "Chaves e integrações", description: "Credenciais e tokens das conexões autorizadas.", icon: KeyRound, action: "advanced", tone: "slate" },
    ],
  },
];

export function SettingsCatalog({ onNavigate, onAdvanced, onCompanies }: CatalogProps) {
  const [query, setQuery] = useState("");
  const [metrics, setMetrics] = useState<Record<string, number | string>>({});
  useEffect(() => {
    let live = true;
    const safe = async (url: string) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return undefined;
        return (await response.json()) as any;
      } catch {
        return undefined;
      }
    };
    void (async () => {
      const [team, departments, inboxPayload, google, workflows, asaas] = await Promise.all([
        safe("/api/backend/team"),
        safe("/api/backend/departments"),
        safe("/api/backend/channels/inboxes"),
        safe("/api/backend/integrations/google/connections"),
        safe("/api/backend/workflows"),
        safe("/api/backend/integrations/asaas"),
      ]);
      if (!live) return;
      const next: Record<string, number | string> = {};
      if (Array.isArray(team)) next.team = team.length;
      if (Array.isArray(departments)) next.departments = departments.length;
      const inboxes: any[] = Array.isArray(inboxPayload?.inboxes) ? inboxPayload.inboxes : [];
      if (Array.isArray(inboxPayload?.inboxes)) {
        next.inboxes = inboxes.length;
        next.zernio = inboxes.filter((item) => String(item?.provider || "").toUpperCase() === "ZERNIO").length;
        next.waha = inboxes.filter((item) => String(item?.provider || "").toUpperCase() === "WAHA").length;
        next.meta = inboxes.filter((item) => String(item?.provider || "").toUpperCase().includes("META")).length;
      }
      if (Array.isArray(google)) next.google = google.length;
      if (Array.isArray(workflows?.workflows)) next.workflows = workflows.workflows.length;
      if (asaas && typeof asaas === "object") next.asaas = asaas.enabled ? (asaas.sandbox ? "Sandbox" : "Produção") : "Desativado";
      setMetrics(next);
    })();
    return () => {
      live = false;
    };
  }, []);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredSections = sections.map((section) => ({ ...section, cards: section.cards.filter((card) => !normalizedQuery || `${section.title} ${card.title} ${card.description}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)) })).filter((section) => section.cards.length);
  const open = (card: CatalogCard) => {
    if (card.action === "companies") onCompanies();
    else if (card.action === "advanced") onAdvanced();
    else if (card.target) onNavigate(card.target);
  };

  return (
    <section className="settings-catalog" aria-labelledby="settings-catalog-title">
      <header className="settings-catalog-heading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1 id="settings-catalog-title">Configurações</h1>
          <p className="page-subtitle">Tudo que você pode ajustar na Véxora, em um só lugar.</p>
        </div>
        <label className="settings-catalog-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar uma configuração…" aria-label="Buscar configurações" />
          {query ? <button type="button" aria-label="Limpar busca" onClick={() => setQuery("")}><X size={16} aria-hidden="true" /></button> : null}
        </label>
      </header>
      {filteredSections.length ? filteredSections.map((section) => (
        <section className="settings-catalog-section" key={section.title} aria-labelledby={"settings-section-" + section.title}>
          <h2 id={"settings-section-" + section.title}>{section.title}</h2>
          <div className="settings-catalog-grid">
            {section.cards.map((card) => {
              const Icon = card.icon;
              return (
                <button type="button" className="settings-catalog-card" key={card.title} onClick={() => open(card)}>
                  <span className={"settings-catalog-icon " + (card.tone || "")}><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="settings-catalog-copy"><strong>{card.title}</strong><small>{card.description}</small></span>
                  {card.metricKey && metrics[card.metricKey] !== undefined ? <span className="settings-catalog-metric" title={typeof metrics[card.metricKey] === "number" ? "Quantidade atual" : "Situação atual"}>{metrics[card.metricKey]}</span> : null}
                  <span className="settings-catalog-arrow" aria-hidden="true"><ArrowUpRight size={15} aria-hidden="true" /></span>
                </button>
              );
            })}
          </div>
        </section>
      )) : <div className="settings-catalog-empty"><Search size={20} /><strong>Nenhuma configuração encontrada</strong><span>Tente buscar por conexão, usuário, Asaas, Waha, saudação ou automação.</span></div>}
      <p className="settings-catalog-note"><Settings2 size={15} /> Os ajustes avançados continuam disponíveis pelos cartões correspondentes.</p>
    </section>
  );
}
