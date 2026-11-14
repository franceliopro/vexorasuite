"use client";
export type Site = any;
export type Form = any;
export type Item = any;
export type Page = any;
export type Block = any;

export const AREAS = [
  { key: "site_simples", label: "Site Simples", hint: "Site institucional sem segmento — você escolhe o conteúdo depois" },
  { key: "construtora", label: "Construtora", hint: "Obras, portfólio, captação de leads" },
  { key: "prestacao_servicos", label: "Prestação de Serviços", hint: "Serviços gerais, orçamento e contato rápido" },
  { key: "vexora", label: "Véxora Suite", hint: "O site da própria Véxora — catálogo de planos e produtos" },
  { key: "clinica_medica", label: "Clínica Médica", hint: "Consultórios, exames, agendamento online" },
  { key: "clinica_estetica", label: "Clínica de Estética", hint: "Procedimentos, pacotes, antes e depois" },
  { key: "estetica_geral", label: "Estética em Geral", hint: "Unhas, cílios, cabelo, sobrancelhas" },
  { key: "advocacia", label: "Advocacia", hint: "Áreas de atuação, quem somos, contato" },
  { key: "imobiliaria", label: "Imobiliária", hint: "Imóveis com filtros e visitas online" },
  { key: "rastreamento", label: "Rastreamento Veicular", hint: "Planos, instalação 24h, frota" },
  { key: "protecao", label: "Proteção Veicular", hint: "Produto, cobertura, benefícios" },
  { key: "ecommerce", label: "E-commerce", hint: "Loja completa com checkout" },
  { key: "blog", label: "Blog ou Notícias", hint: "Posts automáticos e busca" },
  { key: "escola_musica", label: "Escola de Música", hint: "Música, teoria e prática para todos" },
  { key: "escola_teologia", label: "Escola de Teologia", hint: "Formação e cursos com certificado" },
  { key: "escola_cursos", label: "Escola de Cursos", hint: "Idiomas, profissionalizantes, EAD" },
] as const;

export const BLOCKS_META: Record<string, { label: string; hint: string }> = {
  hero: { label: "Capa (Hero)", hint: "Título, subtítulo e botão principal" },
  richText: { label: "Texto rico", hint: "Seção com título e texto" },
  services: { label: "Serviços", hint: "Grade de serviços com ícones" },
  gallery: { label: "Galeria", hint: "Galeria de imagens" },
  testimonials: { label: "Depoimentos", hint: "Depoimentos de clientes" },
  faq: { label: "Perguntas frequentes", hint: "Perguntas e respostas" },
  cta: { label: "Chamada para ação", hint: "Botão final chamando para a próxima ação" },
  posts: { label: "Notícias / Posts", hint: "Grade de posts publicados" },
  properties: { label: "Imóveis", hint: "Grade de imóveis publicados" },
  contact: { label: "Contato", hint: "WhatsApps e redes por departamento" },
  spacer: { label: "Espaçador", hint: "Espaço vertical" },
  divider: { label: "Divisor", hint: "Linha separadora" },
  freeLayout: { label: "Layout livre", hint: "Composição editável em HTML e CSS" },
  layout: { label: "Seção de colunas", hint: "Layout flex com colunas, textos, imagens, botões e tudo" },
};

const sitesCache = new Map<string, Site[]>();

export function readSitesCache(tenantId?: string): Site[] | null {
  const key = tenantId || "__default__";
  const cached = sitesCache.get(key);
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("vx:sites-cache:" + key);
    if (stored) {
      const parsed = JSON.parse(stored);
      sitesCache.set(key, parsed);
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function writeSitesCache(tenantId: string | undefined, data: Site[]) {
  const key = tenantId || "__default__";
  sitesCache.set(key, data);
  if (typeof window !== "undefined") { try { window.localStorage.setItem("vx:sites-cache:" + key, JSON.stringify(data)); } catch { /* ignore */ } }
}

export class ApiError extends Error {
  status?: number;
  code?: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api/backend" + path, { cache: "no-store", headers: { "content-type": "application/json" }, ...init });
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok) {
    const raw = (data as any)?.message;
    const message = Array.isArray(raw) ? raw.join(" ") : typeof raw === "string" && raw.trim() ? raw : "Não foi possível completar a ação.";
    const error = new ApiError(message);
    error.status = r.status;
    const code = (data as any)?.code;
    if (typeof code === "string") error.code = code;
    throw error;
  }
  return data as T;
}

export const safeSlug = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
