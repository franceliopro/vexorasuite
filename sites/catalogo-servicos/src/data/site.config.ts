import type { SiteConfig } from "./site.types";

/**
 * Configuração central de Véxora Serviços.
 * Valores vazios ou de exemplo não viram links publicados.
 */
export const site: SiteConfig = {
  "name": "Véxora Serviços",
  "title": "Véxora Serviços — Catálogo online",
  "description": "Catálogo público dos serviços Véxora, com origem no catálogo interno da plataforma.",
  "url": "https://catalogo.example.com",
  "locale": "pt-BR",
  "themeColor": "#071329",
  "logo": "/logo.svg",
  "email": "contato@example.com",
  "phone": "",
  "whatsapp": "",
  "whatsappMessage": "Olá! Vim pelo site e gostaria de mais informações.",
  "address": "Brasil",
  "hero": {
    "eyebrow": "Catálogo de serviços",
    "title": "Serviços Véxora",
    "accent": "em um só lugar",
    "description": "Navegue pelos serviços divulgados no catálogo ativo e solicite uma proposta pelo link informado em cada item.",
    "primaryLabel": "Ver serviços",
    "primaryHref": "/servicos/",
    "secondaryLabel": "Saiba mais",
    "secondaryHref": "/sobre/"
  },
  "features": [
    {
      "icon": "01",
      "title": "Fonte única",
      "description": "Os itens vêm do catálogo da Véxora; a vitrine não cria um segundo cadastro."
    },
    {
      "icon": "02",
      "title": "Sem cobrança automática",
      "description": "A vitrine não efetua cobranças nem confirma pedidos. A proposta depende do contato informado no catálogo."
    },
    {
      "icon": "03",
      "title": "Dados públicos",
      "description": "Nome, código, categoria, preço, unidade, descrição, imagem e link públicos são divulgados quando informados."
    }
  ],
  "navigation": [
    {
      "label": "Início",
      "href": "/"
    },
    {
      "label": "Serviços",
      "href": "/servicos/"
    },
    {
      "label": "Contato",
      "href": "/contato/"
    }
  ],
  "social": []
};
