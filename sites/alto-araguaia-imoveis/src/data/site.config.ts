import type { SiteConfig } from "./site.types";

/**
 * Dados extraídos do site público em 24/11/2026.
 * E-mail oficial não consta no site publicado (o link é `mailto:` vazio),
 * por isso o campo permanece vazio e nenhum envio é afirmado.
 */
export const site: SiteConfig = {
  name: "Alto Araguaia Imóveis",
  title: "Alto Araguaia Imóveis",
  description: "Página inicial criada a partir das seções atuais do site.",
  url: "https://altoaraguaiaimoveis.com.br",
  locale: "pt-BR",
  themeColor: "#082D54",
  logo: "/logo.svg",
  email: "",
  phone: "(66) 3481-2792",
  whatsapp: "556634812792",
  whatsappMessage: "Olá! Vim pelo site e gostaria de mais informações.",
  address: "Alto Araguaia - MT",
  hours: "Segunda a sexta, 8h às 18h",
  creci: "Inserir registro CRECI",
  channels: [
    {
      label: "Imóveis urbanos",
      phone: "(66) 3481-2792",
      whatsapp: "556634812792",
      description:
        "Casas, apartamentos, terrenos e imóveis comerciais em Alto Araguaia e região.",
    },
    {
      label: "Imóveis rurais",
      phone: "(66) 99999-0000",
      whatsapp: "5566999990000",
      description:
        "Fazendas, sítios e chácaras com equipe que conhece o campo e a documentação.",
    },
  ],
  hero: {
    eyebrow: "",
    title: "Encontre seu imóvel ideal",
    description:
      "Compra, locação e imóveis rurais com atendimento especializado.",
  },
  features: [
    {
      icon: "01",
      title: "Ampla experiência na região",
      description: "Conhecemos Alto Araguaia e os municípios vizinhos.",
    },
    {
      icon: "02",
      title: "Bom atendimento",
      description: "Um time disponível para ouvir, orientar e acompanhar você.",
    },
    {
      icon: "03",
      title: "Espaço para atendimento",
      description: "Conte com atendimento próximo e suporte em cada etapa.",
    },
  ],
  categories: [
    {
      title: "Casas e residências",
      description: "Conforto e qualidade de vida para sua família.",
      href: "/imoveis-urbanos/?property_type=Casa#imoveis",
      icon: "house",
    },
    {
      title: "Apartamentos",
      description: "Praticidade e localização privilegiada.",
      href: "/imoveis-urbanos/?property_type=Apartamento#imoveis",
      icon: "building",
    },
    {
      title: "Imóveis comerciais",
      description: "O espaço ideal para o seu negócio.",
      href: "/imoveis-urbanos/?property_type=Sala%20comercial#imoveis",
      icon: "store",
    },
    {
      title: "Imóveis rurais",
      description: "Grandes oportunidades no campo.",
      href: "/imoveis-rurais/?property_type=Fazenda#imoveis",
      icon: "field",
    },
  ],
  testimonials: [
    {
      quote: "Fomos muito bem atendidos desde a primeira visita.",
      author: "Família de Alto Araguaia",
    },
    {
      quote: "Atendimento ágil e muito atencioso.",
      author: "Cliente comercial",
    },
    {
      quote:
        "A equipe conhece as propriedades da região e nos orientou com clareza.",
      author: "Produtor rural",
    },
  ],
  navigation: [
    { label: "Início", href: "/" },
    { label: "Urbanos", href: "/imoveis-urbanos/" },
    { label: "Rurais", href: "/imoveis-rurais/" },
    { label: "Sobre nós", href: "/sobre/" },
    { label: "Contato", href: "/contato/" },
  ],
  social: [],
};
