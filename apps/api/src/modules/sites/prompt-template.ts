/**
 * Rascunho premium a partir da descrição informada no wizard.
 *
 * Regras determinísticas vêm antes de qualquer modelo: a descrição é usada como
 * texto de apoio e para escolher segmento, chamada, benefícios, serviços e etapas.
 * Nada aqui chama IA externa, publica conteúdo ou afirma que o site está pronto —
 * o resultado é sempre um rascunho para revisão no editor.
 *
 * Fotos, logos, números, depoimentos e dados cadastrais reais não são inventados:
 * o template reserva esses espaços para o proprietário preencher antes de publicar.
 */

import type { SiteKindValue } from "./sites.service";
import { landingDocument } from "./landing-template";
import { fakeIdentity, generatedPages, type GeneratedPage } from "./site-pages";
import type { SiteIllustrations } from "./site-images";

type TemplateNode = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<string, string>;
  children: TemplateNode[];
};

export type PromptDocumentInput = {
  prompt: string;
  name: string;
  kind: SiteKindValue;
  primary: string;
  accent: string;
  logoUrl?: string | null;
  images?: SiteIllustrations;
};

type SegmentRule = {
  pattern: RegExp;
  eyebrow: string;
  headline: string;
  panelTitle: string;
  benefitsTitle: string;
  benefitsText: string;
  benefits: Array<[string, string]>;
  services: Array<[string, string]>;
  process: Array<[string, string]>;
  cta: string;
  contactTitle: string;
  contactText: string;
};

const CONTENT_LIMIT = 240;

/** Texto seguro para o documento: sem controles, sem marcação e com tamanho limitado. */
function cleanText(value: string, limit = CONTENT_LIMIT): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit)
    .trim();
}

function firstSentence(value: string): string {
  const match = value.match(/^[^.!?]+[.!?]?/);
  return cleanText(match?.[0] ?? value);
}

function findRule(prompt: string, rules: Array<[RegExp, string]>, fallback: string): string {
  return rules.find(([pattern]) => pattern.test(prompt))?.[1] ?? fallback;
}

const SEGMENTS: SegmentRule[] = [
  {
    pattern: /veterin|pet|animal/i,
    eyebrow: "CLÍNICA VETERINÁRIA · CUIDADO COM CARINHO",
    headline: "Cuidado veterinário com atenção em cada detalhe",
    panelTitle: "Do primeiro contato ao acompanhamento, seu pet em boas mãos.",
    benefitsTitle: "Um cuidado que tranquiliza",
    benefitsText: "Estrutura, atenção e orientação clara para cada fase da vida do seu pet.",
    benefits: [
      ["Consultas com atenção", "Espaço para ouvir, examinar e explicar cada orientação."],
      ["Vacinação e prevenção", "Rotina de cuidados organizada conforme a necessidade do seu pet."],
      ["Acompanhamento contínuo", "Retornos e ajustes combinados com quem convive com ele."],
    ],
    services: [
      ["Consultas e avaliações", "Uma conversa inicial para entender o quadro e definir os próximos passos."],
      ["Vacinação e prevenção", "Rotina de cuidados organizada para cada fase da vida do animal."],
      ["Acompanhamento", "Retornos e orientações para manter a evolução sob controle."],
    ],
    process: [
      ["Conversa inicial", "Conte o que aconteceu e o que você observou."],
      ["Avaliação", "A gente analisa o quadro e explica os próximos passos."],
      ["Acompanhamento", "Você recebe orientações e retorna quando precisar."],
    ],
    cta: "Agendar horário",
    contactTitle: "Agende seu horário",
    contactText: "Conte o que seu pet precisa e deixe seus dados para entrarmos em contato.",
  },
  {
    pattern: /sa[uú]de|m[eé]dic|cl[ií]nica|terap|psic[oó]|odont/i,
    eyebrow: "SAÚDE E BEM-ESTAR · ATENDIMENTO HUMANO",
    headline: "Atendimento humano, com tempo para ouvir você",
    panelTitle: "Um cuidado organizado, respeitoso e alinhado ao que você precisa.",
    benefitsTitle: "Um atendimento que acolhe",
    benefitsText: "Agenda clara, escuta atenta e acompanhamento do seu progresso.",
    benefits: [
      ["Escuta atenta", "Sua história e suas dúvidas ganham espaço na conversa."],
      ["Agenda organizada", "Horários combinados com antecedência e menos espera."],
      ["Acompanhamento", "Cada retorno analisa o que evoluiu e o que ajustar."],
    ],
    services: [
      ["Atendimento individual", "Uma conversa focada no que você está vivendo agora."],
      ["Acompanhamento de rotina", "Retornos organizados para avaliar a evolução."],
      ["Orientação contínua", "Dúvidas tratadas com contexto e sem pressa."],
    ],
    process: [
      ["Primeiro contato", "Conte sua necessidade e tire as primeiras dúvidas."],
      ["Atendimento", "A conversa acontece com calma e foco no seu caso."],
      ["Continuidade", "Você tem orientações claras para os próximos passos."],
    ],
    cta: "Agendar consulta",
    contactTitle: "Agende sua consulta",
    contactText: "Deixe seus dados e conte, sem detalhes demais, o que você gostaria de tratar.",
  },
  {
    pattern: /im[oó]vel|imobili|apartamento|casa pr[oó]pria/i,
    eyebrow: "IMÓVEIS · ESCOLHA COM CLAREZA",
    headline: "Encontre um lugar que combine com a sua vida",
    panelTitle: "Menos ruído, mais informação útil para decidir com segurança.",
    benefitsTitle: "Mais clareza para decidir",
    benefitsText: "Seleção cuidadosa, informações objetivas e apoio em cada visita.",
    benefits: [
      ["Seleção alinhada", "Imóveis escolhidos a partir do que realmente importa para você."],
      ["Informação objetiva", "Dados e condições apresentados de forma clara."],
      ["Visitas organizadas", "A agenda é montada para você comparar com tranquilidade."],
    ],
    services: [
      ["Seleção de imóveis", "Opções filtradas pelo seu perfil, orçamento e prioridades."],
      ["Visitas organizadas", "A agenda é montada para você comparar sem correr."],
      ["Apoio na decisão", "Informações claras para você avançar no seu tempo."],
    ],
    process: [
      ["Entendimento", "Conte o perfil do imóvel e o seu orçamento."],
      ["Seleção", "Receba opções alinhadas ao que você procura."],
      ["Visita", "Acompanhamos a análise e os próximos passos."],
    ],
    cta: "Agendar visita",
    contactTitle: "Vamos encontrar seu lugar",
    contactText: "Conte o que você procura e deixe seus dados para alinharmos as opções.",
  },
  {
    pattern: /curso|escola|educa|aula|treinamento|mentoria/i,
    eyebrow: "EDUCAÇÃO · APRENDIZADO COM DIREÇÃO",
    headline: "Aprenda no seu ritmo, com direção e suporte",
    panelTitle: "Conteúdo organizado, prática constante e espaço para tirar dúvidas.",
    benefitsTitle: "Um jeito mais leve de aprender",
    benefitsText: "Conteúdo objetivo, trilha organizada e acompanhamento quando você precisar.",
    benefits: [
      ["Trilha clara", "Você sabe o que estudar em cada momento e por quê."],
      ["Aplicação prática", "Exercícios e exemplos para transformar teoria em habilidade."],
      ["Suporte próximo", "Dúvidas tratadas sem pressa e com contexto."],
    ],
    services: [
      ["Trilhas de estudo", "Conteúdo organizado do básico ao que você quer alcançar."],
      ["Prática guiada", "Exercícios e exemplos para aplicar o que aprendeu."],
      ["Suporte ao aluno", "Espaço para dúvidas e ajustes no caminho."],
    ],
    process: [
      ["Diagnóstico", "Entendemos seu ponto de partida e seu objetivo."],
      ["Trilha", "Você recebe um plano de estudos alinhado ao seu ritmo."],
      ["Prática", "Avança com exercícios e acompanhamento constante."],
    ],
    cta: "Quero saber mais",
    contactTitle: "Comece pelo seu objetivo",
    contactText: "Conte o que você quer aprender e deixe seus dados para receber mais informações.",
  },
  {
    pattern: /restaurante|comida|delivery|card[aá]pio|pizz|hamb[uú]rg/i,
    eyebrow: "GASTRONOMIA · SABOR E PRATICIDADE",
    headline: "Sabor e praticidade em cada pedido",
    panelTitle: "Cardápio, reservas e novidades organizados para você escolher sem complicação.",
    benefitsTitle: "Por que voltar sempre",
    benefitsText: "Cardápio claro, pedido simples e atenção do começo ao fim.",
    benefits: [
      ["Cardápio objetivo", "As opções são apresentadas de forma direta e organizada."],
      ["Pedido sem atrito", "Você escolhe, confirma e acompanha sem etapas extras."],
      ["Novidades perto de você", "Receba novidades e combine reservas com facilidade."],
    ],
    services: [
      ["Cardápio", "As opções organizadas para você escolher com calma."],
      ["Pedidos e reservas", "Um caminho curto para confirmar o que você deseja."],
      ["Novidades", "Avisos de novidades e combinações especiais."],
    ],
    process: [
      ["Escolha", "Veja as opções e monte seu pedido ou reserva."],
      ["Confirmação", "Você recebe os detalhes e o próximo passo."],
      ["Aproveite", "Tudo organizado para você curtir sem preocupação."],
    ],
    cta: "Falar com a gente",
    contactTitle: "Peça ou reserve",
    contactText: "Conte o que você procura e deixe seus dados para continuarmos por aqui.",
  },
  {
    pattern: /loja|produto|ecommerce|e-commerce|venda|marca/i,
    eyebrow: "LOJA E PRODUTOS · ESCOLHA BEM",
    headline: "Produtos escolhidos com cuidado para você",
    panelTitle: "Informação clara, pedido simples e suporte depois da compra.",
    benefitsTitle: "Por que comprar com a gente",
    benefitsText: "Seleção cuidadosa, detalhes bem explicados e atendimento após a compra.",
    benefits: [
      ["Seleção cuidadosa", "Cada item é escolhido com atenção ao que realmente entrega."],
      ["Compra simples", "Informações objetivas para você decidir sem pressa."],
      ["Suporte depois", "Dúvidas e ajustes acompanhados após a compra."],
    ],
    services: [
      ["Produtos selecionados", "Itens escolhidos com atenção ao que realmente entregam."],
      ["Pedidos e orçamentos", "Informações objetivas para você decidir sem pressa."],
      ["Suporte pós-compra", "Dúvidas e ajustes acompanhados depois da compra."],
    ],
    process: [
      ["Descubra", "Conheça as opções e encontre o que faz sentido."],
      ["Escolha", "Tire dúvidas e confirme os detalhes."],
      ["Receba", "Acompanhe os próximos passos com tranquilidade."],
    ],
    cta: "Pedir orçamento",
    contactTitle: "Peça seu orçamento",
    contactText: "Conte o que você procura e deixe seus dados para enviarmos as opções.",
  },
  {
    pattern: /advog|jur[ií]dic|cont[aá]bil|financ|consultoria/i,
    eyebrow: "SERVIÇOS PROFISSIONAIS · ORIENTAÇÃO CLARA",
    headline: "Orientação clara para decisões importantes",
    panelTitle: "Contexto, prazos e responsabilidades explicados antes de qualquer decisão.",
    benefitsTitle: "Um trabalho feito com método",
    benefitsText: "Atendimento confidencial, prazos combinados e orientação em cada etapa.",
    benefits: [
      ["Escuta qualificada", "Entendemos o contexto antes de apontar caminhos."],
      ["Prazos claros", "Você sabe o que acontece em cada momento."],
      ["Acompanhamento", "Cada avanço é comunicado com objetividade."],
    ],
    services: [
      ["Análise da situação", "Entendimento do contexto antes de apontar caminhos."],
      ["Planejamento", "Escopo, prazos e responsabilidades alinhados."],
      ["Execução e retornos", "Cada avanço comunicado com objetividade."],
    ],
    process: [
      ["Contexto", "Conte a situação e o resultado que você espera."],
      ["Plano", "Alinhamos escopo, prazos e próximos passos."],
      ["Execução", "Você acompanha cada etapa com orientação constante."],
    ],
    cta: "Solicitar orientação",
    contactTitle: "Conte sua necessidade",
    contactText: "Deixe seus dados e uma breve descrição para analisarmos o seu caso.",
  },
];

const DEFAULT_SEGMENT: SegmentRule = {
  pattern: /.*/,
  eyebrow: "PRESENÇA PROFISSIONAL · FEITA PARA GERAR CONFIANÇA",
  headline: "Uma presença clara, bonita e pronta para o próximo passo",
  panelTitle: "Sua mensagem em primeiro lugar, com uma jornada simples até o contato.",
  benefitsTitle: "Por que escolher a gente?",
  benefitsText: "Cada seção foi pensada para comunicar valor com clareza e conduzir o visitante ao próximo passo.",
  benefits: [
    ["Atendimento próximo", "Ouvimos o que você precisa antes de sugerir qualquer caminho."],
    ["Comunicação clara", "Informação objetiva, sem termos difíceis e sem surpresas."],
    ["Atenção aos detalhes", "Do primeiro contato ao acompanhamento, cada etapa é cuidada."],
  ],
  services: [
    ["Consultoria inicial", "Entendemos o contexto e o resultado que você espera."],
    ["Soluções sob medida", "Uma proposta alinhada ao que realmente importa para você."],
    ["Acompanhamento", "Ajustes e dúvidas tratados com atenção ao longo do caminho."],
  ],
  process: [
    ["Conversa inicial", "Conte o contexto e o resultado que você espera alcançar."],
    ["Alinhamento", "Receba uma proposta clara, com escopo e próximos passos."],
    ["Acompanhamento", "Siga com orientação e espaço para ajustar o que for preciso."],
  ],
  cta: "Falar com a gente",
  contactTitle: "Vamos conversar?",
  contactText: "Preencha os campos e conte um pouco sobre o que você precisa.",
};

const CTA_LABELS: Array<[RegExp, string]> = [
  [/or[cç]amento|cota[rç]?|pre[cç]o|valor/i, "Pedir orçamento"],
  [/agendar|hor[aá]rio|consulta|visita|marcar/i, "Agendar horário"],
  [/contato|falar|whatsapp|mensagem/i, "Falar com a gente"],
];

const CONTACT_TITLES: Array<[RegExp, string]> = [
  [/or[cç]amento|cota[rç]?|pre[cç]o|valor/i, "Peça seu orçamento"],
  [/agendar|hor[aá]rio|consulta|visita|marcar/i, "Agende seu horário"],
];

function walk(node: TemplateNode, collected: TemplateNode[] = []): TemplateNode[] {
  collected.push(node);
  for (const child of node.children ?? []) walk(child, collected);
  return collected;
}

export function promptDocument({ prompt, name, kind, primary, accent, logoUrl, images }: PromptDocumentInput) {
  const cleanPrompt = cleanText(prompt, 2000);
  const document = JSON.parse(JSON.stringify(landingDocument(name, primary, accent, logoUrl))) as {
    version: number;
    root: TemplateNode;
    pages: GeneratedPage[];
    meta: Record<string, unknown>;
  };
  const nodes = walk(document.root);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const setContent = (id: string, value: string) => {
    const target = byId.get(id);
    if (target) target.props.content = value;
  };
  const setLabel = (id: string, value: string) => {
    const target = byId.get(id);
    if (target) target.props.label = value;
  };
  const setFaq = (id: string, question: string) => {
    const target = byId.get(id);
    if (target) target.props.question = question;
  };

  const segment = SEGMENTS.find((rule) => rule.pattern.test(cleanPrompt)) ?? DEFAULT_SEGMENT;
  const subtitle = firstSentence(cleanPrompt);
  const cta = findRule(cleanPrompt, CTA_LABELS, segment.cta);
  const contactTitle = findRule(cleanPrompt, CONTACT_TITLES, segment.contactTitle);

  setContent("landing_brand", name);
  setContent("landing_footer_brand", name);
  setLabel("landing_nav_cta", cta);
  setContent("landing_hero_eyebrow", segment.eyebrow);
  setContent("landing_hero_title", segment.headline);
  if (subtitle) setContent("landing_hero_subtitle", subtitle);
  setContent("landing_hero_note", "Um primeiro contato simples, sem compromisso.");
  setLabel("landing_hero_cta", cta);

  setContent("landing_panel_title", segment.panelTitle);
  setContent("landing_benefits_title", segment.benefitsTitle);
  setContent("landing_benefits_text", segment.benefitsText);
  setContent("landing_process_title", "Como trabalhamos, passo a passo");
  setContent("landing_process_text", "Você sabe o que esperar em cada momento — e pode seguir no seu ritmo.");
  setFaq("landing_faq_1", `Como faço para ${cta.toLowerCase()}?`);

  for (let index = 0; index < 3; index += 1) {
    const step = index + 1;
    const fallbackProcess: [string, string] = DEFAULT_SEGMENT.process[index] ?? ["Etapa", "Descrição da etapa."];
    const fallbackBenefit: [string, string] = DEFAULT_SEGMENT.benefits[index] ?? ["Benefício", "Descrição do benefício."];
    const fallbackService: [string, string] = DEFAULT_SEGMENT.services[index] ?? ["Serviço", "Descrição do serviço."];
    const [stepTitle, stepText] = segment.process[index] ?? fallbackProcess;
    const [benefitTitle, benefitText] = segment.benefits[index] ?? fallbackBenefit;
    const [serviceTitle, serviceText] = segment.services[index] ?? fallbackService;

    setContent(`landing_panel_step_${step}_title`, stepTitle);
    setContent(`landing_step_${step}_title`, stepTitle);
    setContent(`landing_step_${step}_text`, stepText);
    setContent(`landing_benefit_${step}_title`, benefitTitle);
    setContent(`landing_benefit_${step}_text`, benefitText);
    setContent(`landing_service_${step}_title`, serviceTitle);
    setContent(`landing_service_${step}_text`, serviceText);
  }

  setContent("landing_contact_title", contactTitle);
  setContent("landing_contact_text", segment.contactText);
  setContent("landing_contact_point_1", `Um formulário curto para ${cta.toLowerCase()}.`);

  if (images) {
    const aboutVisual = byId.get("landing_about_visual");
    if (aboutVisual) {
      setContent("landing_about_visual_label", "IMAGEM ILUSTRATIVA · TROQUE POR FOTO REAL");
      setContent("landing_about_visual_text", "Arte gerada automaticamente para dar forma ao rascunho. Substitua por uma imagem sua antes de publicar.");
      aboutVisual.children.push({
        id: "landing_about_visual_image",
        type: "image",
        props: { src: images.about, alt: "Ilustração automática do rascunho; troque por uma foto real antes de publicar." },
        styles: { borderRadius: "1rem", display: "block", marginTop: "1rem", objectFit: "cover", width: "100%" },
        children: [],
      });
    }
  }

  document.meta.title = name;
  document.meta.type = kind.toLowerCase().replace(/_/g, "-");
  document.meta.generatedFrom = "prompt";
  document.pages = generatedPages(fakeIdentity(name, slugify(name), logoUrl), primary, accent, images);
  return document;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "site"
  );
}
