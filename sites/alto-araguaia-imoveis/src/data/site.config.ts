import type { SiteConfig } from "./site.types";

/**
 * Configuração central de Alto Araguaia Imóveis.
 * Valores vazios ou de exemplo não viram links publicados.
 */
export const site: SiteConfig = {
  "name": "Alto Araguaia Imóveis",
  "title": "Alto Araguaia Imóveis | Casas e Apartamentos em Alto Araguaia - MT",
  "description": "Imóveis residenciais e comerciais em Alto Araguaia e região. Encontre o lugar ideal com atendimento local e informações claras.",
  "url": "https://altoaraguaia-imoveis.example",
  "locale": "pt-BR",
  "themeColor": "#071329",
  "logo": "/logo.svg",
  "email": "",
  "phone": "",
  "whatsapp": "",
  "whatsappMessage": "Olá! Vim pelo site e gostaria de mais informações.",
  "address": "Alto Araguaia - MT",
  "hero": {
    "eyebrow": "Imóveis em Alto Araguaia - MT",
    "title": "O seu próximo endereço",
    "accent": "começa aqui",
    "description": "Casas, apartamentos e terrenos em Alto Araguaia e região. Informação clara, fotos e atendimento próximo para você decidir com segurança.",
    "primaryLabel": "Ver imóveis disponíveis",
    "primaryHref": "/imoveis/",
    "secondaryLabel": "Conheça a região",
    "secondaryHref": "/sobre/"
  },
  "features": [
    {
      "icon": "01",
      "title": "Portfólio selecionado",
      "description": "Imóveis com informações objetivas, fotos e dados essenciais para comparar."
    },
    {
      "icon": "02",
      "title": "Atendimento local",
      "description": "Quem conhece a região ajuda você a entender o bairro, a rua e a vizinhança."
    },
    {
      "icon": "03",
      "title": "Decisão sem pressão",
      "description": "Você consulta com calma e fala com a equipe quando quiser dar o próximo passo."
    }
  ],
  "navigation": [
    {
      "label": "Início",
      "href": "/"
    },
    {
      "label": "Imóveis",
      "href": "/imoveis/"
    },
    {
      "label": "Sobre",
      "href": "/sobre/"
    },
    {
      "label": "Contato",
      "href": "/contato/"
    }
  ],
  "social": []
};
