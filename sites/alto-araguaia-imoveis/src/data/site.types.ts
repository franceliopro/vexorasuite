export type NavItem = { label: string; href: string };

export type Feature = {
  icon: string;
  title: string;
  description: string;
};

export type SiteConfig = {
  /** Nome curto da marca, usado na navegação e no JSON-LD. */
  name: string;
  /** Título padrão das páginas. */
  title: string;
  /** Descrição padrão para SEO. */
  description: string;
  /** URL canônica raiz, sem barra final. */
  url: string;
  locale: string;
  themeColor: string;
  logo: string;
  email: string;
  phone: string;
  /** Apenas dígitos, com DDI (ex.: 5564999999999). */
  whatsapp: string;
  whatsappMessage: string;
  address: string;
  hero: {
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    primaryLabel: string;
    /** Destino do CTA principal. Vazio = WhatsApp (se configurado) ou /contato/. */
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
  features: Feature[];
  navigation: NavItem[];
  social: NavItem[];
};
