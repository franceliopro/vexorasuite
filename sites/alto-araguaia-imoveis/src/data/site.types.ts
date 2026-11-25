export type NavItem = { label: string; href: string };

export type Feature = {
  icon: string;
  title: string;
  description: string;
};

export type CategoryTile = {
  title: string;
  description: string;
  href: string;
  icon: string;
};

export type Testimonial = {
  quote: string;
  author: string;
};

export type ContactChannel = {
  label: string;
  phone: string;
  whatsapp: string;
  description: string;
};

export type SiteConfig = {
  name: string;
  title: string;
  description: string;
  url: string;
  locale: string;
  themeColor: string;
  logo: string;
  email: string;
  phone: string;
  whatsapp: string;
  whatsappMessage: string;
  address: string;
  hours: string;
  creci: string;
  channels: ContactChannel[];
  hero: {
    eyebrow: string;
    title: string;
    description: string;
  };
  features: Feature[];
  categories: CategoryTile[];
  testimonials: Testimonial[];
  navigation: NavItem[];
  social: NavItem[];
};
