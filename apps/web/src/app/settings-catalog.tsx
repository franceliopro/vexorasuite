"use client";

import {
  Building2,
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
};

const sections: { title: string; cards: CatalogCard[] }[] = [
  {
    title: "Sua empresa",
    cards: [
      { title: "Empresas e ambientes", description: "Crie, altere e troque entre empresas clientes.", icon: Building2, action: "companies", tone: "blue" },
      { title: "Usuários e atendentes", description: "Cadastre pessoas, acessos e perfis de atendimento.", icon: UsersRound, action: "module", target: "Atendentes", tone: "violet" },
      { title: "Departamentos e permissões", description: "Organize equipes e defina o que cada setor pode acessar.", icon: BriefcaseBusiness, action: "module", target: "Atendentes", tone: "indigo" },
      { title: "Identidade visual", description: "Nome, logo, favicon e cores que aparecem no painel.", icon: Palette, action: "advanced", tone: "pink" },
    ],
  },
  {
    title: "Conexões",
    cards: [
      { title: "Conexões e inboxes", description: "Veja e conecte todos os canais da empresa em um só lugar.", icon: Network, action: "module", target: "Canais e integrações", tone: "green" },
      { title: "Redes sociais · Zernio", description: "Instagram, Facebook e outras contas sociais conectadas.", icon: Radio, action: "module", target: "Canais e integrações", tone: "purple" },
      { title: "WhatsApp · Waha", description: "Números do WhatsApp conectados por QR Code.", icon: MessageSquareText, action: "module", target: "Canais e integrações", tone: "teal" },
      { title: "Meta Oficial", description: "WhatsApp, Instagram e Messenger quando habilitados.", icon: PanelTop, action: "module", target: "Canais e integrações", tone: "blue" },
      { title: "Google Drive e Agenda", description: "Contas e calendários usados pela empresa.", icon: FileSliders, action: "module", target: "Canais e integrações", tone: "yellow" },
      { title: "Asaas", description: "Credenciais, cobrança e sincronização financeira.", icon: CircleDollarSign, action: "module", target: "Financeiro", tone: "orange" },
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
      { title: "Fluxos de trabalho", description: "Modelos que automatizam tarefas, mensagens e follow-ups.", icon: Workflow, action: "module", target: "Workflows", tone: "purple" },
      { title: "Marca e publicação", description: "Biblioteca, Drive e conteúdo para o Marketing.", icon: Image, action: "module", target: "Marketing", tone: "pink" },
      { title: "Chaves e integrações", description: "Credenciais e tokens das conexões autorizadas.", icon: KeyRound, action: "advanced", tone: "slate" },
    ],
  },
];

export function SettingsCatalog({ onNavigate, onAdvanced, onCompanies }: CatalogProps) {
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
      </header>
      {sections.map((section) => (
        <section className="settings-catalog-section" key={section.title} aria-labelledby={"settings-section-" + section.title}>
          <h2 id={"settings-section-" + section.title}>{section.title}</h2>
          <div className="settings-catalog-grid">
            {section.cards.map((card) => {
              const Icon = card.icon;
              return (
                <button type="button" className="settings-catalog-card" key={card.title} onClick={() => open(card)}>
                  <span className={"settings-catalog-icon " + (card.tone || "")}><Icon size={19} strokeWidth={1.8} /></span>
                  <span className="settings-catalog-copy"><strong>{card.title}</strong><small>{card.description}</small></span>
                  <span className="settings-catalog-arrow" aria-hidden="true">↗</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="settings-catalog-note"><Settings2 size={15} /> Os ajustes avançados continuam disponíveis pelos cartões correspondentes.</p>
    </section>
  );
}
