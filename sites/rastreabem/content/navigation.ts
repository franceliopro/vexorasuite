export type SitePage = {
  slug: string;
  path: string;
  label: string;
  title: string;
  description: string;
  group: "principal" | "institucional";
};

export const navigation: SitePage[] = [
  {
    slug: "index",
    path: "/",
    label: "Início",
    title: "Rastreabem",
    description: "Rastreamento veicular, gestão de frotas e Rastreacard em Rondonópolis.",
    group: "principal",
  },
  {
    slug: "rastreamento",
    path: "/rastreamento/",
    label: "Rastreamento",
    title: "Rastreamento – Rastreabem",
    description: "Rastreamento automotivo com planos mensal e anual.",
    group: "principal",
  },
  {
    slug: "gestao-de-frotas",
    path: "/gestao-de-frotas/",
    label: "Gestão de Frotas",
    title: "Gestão de Frotas – Rastreabem",
    description: "Gerencie todos os processos da frota em um só lugar.",
    group: "principal",
  },
  {
    slug: "rastreacard",
    path: "/rastreacard/",
    label: "Rastreacard",
    title: "Rastreacard – Rastreabem",
    description: "Cartão de descontos e assistência automotiva 24 horas.",
    group: "principal",
  },
  {
    slug: "lp-info",
    path: "/lp-info/",
    label: "Seja digital",
    title: "Rastreabem Digital | Planos de rastreamento",
    description: "Planos digitais de rastreamento e agendamento de instalação.",
    group: "institucional",
  },
  {
    slug: "politica-de-privacidade",
    path: "/politica-de-privacidade/",
    label: "Política de Privacidade",
    title: "Política de Privacidade | Rastreabem",
    description: "Como a Rastreabem trata os dados dos usuários.",
    group: "institucional",
  },
  {
    slug: "termos-e-condicoes",
    path: "/termos-e-condicoes/",
    label: "Termos e Condições",
    title: "Termos e Condições | Rastreabem",
    description: "Regras de uso do site e dos serviços da Rastreabem.",
    group: "institucional",
  },
];

export function findPage(slug: string): SitePage | undefined {
  return navigation.find((page) => page.slug === slug);
}
