import type { SiteConfig } from "./site.types";

/**
 * Configuração central do site.
 * O script `scripts/scaffold-site.mjs` substitui este arquivo quando cria um site novo.
 * Valores com {{...}}, .example ou apenas zeros são tratados como "a configurar"
 * e nunca viram links quebrados nas interfaces.
 */
export const site: SiteConfig = {
  name: "{{SITE_NAME}}",
  title: "{{SITE_TITLE}}",
  description: "{{SITE_DESCRIPTION}}",
  url: "{{SITE_URL}}",
  locale: "pt-BR",
  themeColor: "#071329",
  logo: "/logo.svg",
  email: "{{SITE_EMAIL}}",
  phone: "{{SITE_PHONE}}",
  whatsapp: "{{SITE_WHATSAPP}}",
  whatsappMessage: "Olá! Vim pelo site e gostaria de mais informações.",
  address: "{{SITE_ADDRESS}}",
  hero: {
    eyebrow: "Sua marca, sua presença",
    title: "Uma presença digital",
    accent: "rápida e confiável",
    description:
      "{{SITE_DESCRIPTION}} Substitua os textos deste arquivo para adaptar o template ao seu negócio.",
    primaryLabel: "Fale conosco",
    primaryHref: "",
    secondaryLabel: "Conheça a estrutura",
    secondaryHref: "#estrutura",
  },
  features: [
    {
      icon: "01",
      title: "Velocidade real",
      description:
        "HTML estático por padrão, sem JavaScript desnecessário na página.",
    },
    {
      icon: "02",
      title: "SEO desde o início",
      description:
        "Título, canonical, Open Graph, JSON-LD, sitemap e robots gerados no build.",
    },
    {
      icon: "03",
      title: "Conteúdo simples",
      description:
        "Textos em Markdown com Content Collections e histórico no Git.",
    },
  ],
  navigation: [
    { label: "Início", href: "/" },
    { label: "Sobre", href: "/sobre/" },
    { label: "Contato", href: "/contato/" },
  ],
  social: [],
};
