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
  Trash2,
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
      { title: "Conexões e inboxes", description: "Veja e conecte todos os canais da empresa em um só lugar.", icon: Network, action: "module", target: "Conexões", tone: "green", metricKey: "inboxes" },
      { title: "Redes sociais · Zernio", description: "Instagram, Facebook e outras contas sociais conectadas.", icon: Radio, action: "module", target: "Conexões", tone: "purple", metricKey: "zernio" },
      { title: "WhatsApp · Waha", description: "Números do WhatsApp conectados por QR Code.", icon: MessageSquareText, action: "module", target: "Conexões", tone: "teal", metricKey: "waha" },
      { title: "Meta Oficial", description: "WhatsApp, Instagram e Messenger quando habilitados.", icon: PanelTop, action: "module", target: "Conexões", tone: "blue", metricKey: "meta" },
      { title: "Google Drive e Calendários", description: "Contas e calendários usados pela empresa.", icon: FileSliders, action: "module", target: "Conexões", tone: "yellow", metricKey: "google" },
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

const sectionTw = "grid gap-6";
const headingTw = "flex flex-wrap items-end justify-between gap-token";
const headingCopyTw = "grid gap-1.5";
const eyebrowTw = "inline-flex items-center gap-2 text-catalog-eyebrow font-extrabold uppercase text-blue-600 before:inline-block before:h-px before:w-catalog-eyebrow-rule before:bg-current before:opacity-55";
const subtitleTw = "text-body text-slate-600";
const searchTw = "flex min-h-control flex-1 basis-catalog-search-basis items-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-3 font-medium shadow-catalog-sheen transition-colors duration-150 focus-within:border-blue-600 focus-within:shadow-ring focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-catalog-focus";
const searchInputTw = "min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-slate-950 shadow-none outline-none placeholder:text-slate-600 focus-visible:outline-none";
const searchClearTw = "grid size-6 shrink-0 place-items-center rounded-token-sm text-slate-600 transition-colors hover:bg-zinc-400 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const catalogSectionTw = "grid gap-3";
const gridTw = "grid grid-cols-catalog-grid gap-token";
const cardTw = "grid min-h-catalog-card grid-cols-catalog-card items-center gap-3 rounded-token border border-transparent bg-zinc-100 py-catalog-card-y px-catalog-card-x text-left transition-colors hover:border-gray-300 hover:bg-zinc-400 focus-visible:border-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const iconTw = "grid size-catalog-icon place-items-center rounded-catalog-icon bg-catalog-icon text-blue-800 shadow-catalog-icon";
const copyTw = "grid min-w-0 gap-0.5";
const cardTitleTw = "text-catalog-card-title font-bold text-slate-950";
const cardDescTw = "text-small text-slate-600";
const metricTw = "inline-grid h-catalog-metric min-w-catalog-metric place-items-center rounded-catalog-metric bg-blue-50 px-catalog-metric-x text-catalog-metric font-extrabold tabular-nums text-blue-800";
const arrowTw = "text-slate-600";
const emptyTw = "grid place-items-center gap-2 rounded-token border border-dashed border-gray-300 bg-zinc-100 p-8 text-center text-slate-600";
const emptyTitleTw = "text-catalog-card-title font-bold text-slate-950";
const emptyHintTw = "text-small";
const noteTw = "flex items-center gap-2 text-slate-600";
const clearTw = "mt-4 flex min-h-catalog-clear w-full items-center gap-3 rounded-token border border-dashed border-gray-300 bg-transparent py-catalog-card-y px-catalog-card-x text-left text-slate-600 transition-colors hover:border-blue-600 hover:bg-zinc-200 hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const clearIconTw = "shrink-0 text-blue-800";
const clearCopyTw = "grid min-w-0 gap-px";
const clearTitleTw = "font-display text-catalog-clear-title font-extrabold";
const clearSmallTw = "text-catalog-metric text-slate-600";

async function clearSystemCache(){try{const keys=Object.keys(localStorage).filter(k=>/^(vx|vexora)/i.test(k));for(const k of keys)localStorage.removeItem(k);if(typeof caches!=="undefined"){const names=await caches.keys();await Promise.all(names.map(n=>caches.delete(n)));}if(typeof navigator!=="undefined"&&navigator.serviceWorker){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()));}}catch{/* prosseguir */}finally{window.location.reload();}}
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
    <section className={sectionTw} aria-labelledby="settings-catalog-title">
      <header className={headingTw}>
        <div className={headingCopyTw}>
          <p className={eyebrowTw}>ADMINISTRAÇÃO</p>
          <h1 id="settings-catalog-title">Configurações</h1>
          <p className={subtitleTw}>Tudo que você pode ajustar na Véxora, em um só lugar.</p>
        </div>
        <label className={searchTw}>
          <Search size={16} aria-hidden="true" />
          <input className={searchInputTw} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar uma configuração…" aria-label="Buscar configurações" />
          {query ? <button type="button" className={searchClearTw} aria-label="Limpar busca" onClick={() => setQuery("")}><X size={16} aria-hidden="true" /></button> : null}
        </label>
      </header>
      {filteredSections.length ? filteredSections.map((section) => (
        <section className={catalogSectionTw} key={section.title} aria-labelledby={"settings-section-" + section.title}>
          <h2 id={"settings-section-" + section.title}>{section.title}</h2>
          <div className={gridTw}>
            {section.cards.map((card) => {
              const Icon = card.icon;
              return (
                <button type="button" className={cardTw} key={card.title} onClick={() => open(card)}>
                  <span className={iconTw} data-tone={card.tone}><Icon size={19} strokeWidth={1.8} /></span>
                  <span className={copyTw}><strong className={cardTitleTw}>{card.title}</strong><small className={cardDescTw}>{card.description}</small></span>
                  {card.metricKey && metrics[card.metricKey] !== undefined ? <span className={metricTw} title={typeof metrics[card.metricKey] === "number" ? "Quantidade atual" : "Situação atual"}>{metrics[card.metricKey]}</span> : null}
                  <span className={arrowTw} aria-hidden="true"><ArrowUpRight size={15} aria-hidden="true" /></span>
                </button>
              );
            })}
          </div>
        </section>
      )) : <div className={emptyTw}><Search size={20} aria-hidden="true" /><strong className={emptyTitleTw}>Nenhuma configuração encontrada</strong><span className={emptyHintTw}>Tente buscar por conexão, usuário, Asaas, Waha, saudação ou automação.</span></div>}
      <p className={noteTw}><Settings2 size={15} /> Os ajustes avançados continuam disponíveis pelos cartões correspondentes.</p>
      <button type="button" className={clearTw} onClick={() => void clearSystemCache()}><Trash2 size={17} aria-hidden="true" className={clearIconTw} /><span className={clearCopyTw}><strong className={clearTitleTw}>Limpar cache</strong><small className={clearSmallTw}>Apaga o cache local (Service Worker + Cache Storage + localStorage) e recarrega a página.</small></span></button>
    </section>
  );
}
