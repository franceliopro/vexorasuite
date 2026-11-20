/**
 * Gerador determinístico do wizard de marketing.
 *
 * A criação de capas, lâminas, CTA e legenda acontece por regras locais: nenhuma
 * chamada de modelo, pesquisa externa ou serviço de imagem é necessária para
 * deixar um rascunho completo e revisável. O texto do pedido é tratado como
 * dado não confiável e usado apenas como apoio.
 */
export type WizardTheme = "dark" | "light";
export type WizardFormat = "POST" | "CAROUSEL" | "STORIES";

export type WizardCover = {
  index: number;
  theme: WizardTheme;
  title: string;
  body: string;
  imageUrl?: string;
};

export type WizardSlide = {
  index: number;
  theme: WizardTheme;
  title: string;
  body: string;
  cta: string;
  imageUrl?: string;
};

export type WizardDraft = {
  title: string;
  caption: string;
  covers: WizardCover[];
  slides: WizardSlide[];
};

type Segment = { test: RegExp; subject: string; cta: string; benefit: string };

const SEGMENTS: Segment[] = [
  { test: /odont|cl[ií]nic|dent|consult[oó]rio|sa[uú]de|terapia|psic[oó]log|est[eé]tica/i, subject: "para quem busca cuidado e atendimento de confiança", cta: "Agendar consulta", benefit: "atendimento claro, humano e sem compromisso" },
  { test: /restaurante|pizzaria|lanchonete|caf[eé]|bistr[oô]|delivery|comida|card[aá]pio/i, subject: "para quem quer uma boa experiência à mesa", cta: "Reservar sua mesa", benefit: "sabor, agilidade e um momento agradável" },
  { test: /academia|fitness|treino|muscula[cç][aã]o|esporte/i, subject: "para quem quer começar com o pé direito", cta: "Começar agora", benefit: "rotina simples e acompanhamento de perto" },
  { test: /imobili[aá]ria|im[oó]vel|casa|apartamento|aluguel|constru[cç][aã]o/i, subject: "para quem está buscando o próximo endereço", cta: "Falar com um especialista", benefit: "informação clara antes de qualquer decisão" },
  { test: /advog|jur[ií]dic|cont[aá]bil|consultoria|empresa|neg[oó]cio|b2b/i, subject: "para quem precisa de orientação segura", cta: "Solicitar uma conversa", benefit: "diagnóstico honesto e próximos passos objetivos" },
  { test: /curso|escola|educa[cç][aã]o|treinamento|workshop|aula/i, subject: "para quem quer aprender na prática", cta: "Garantir sua vaga", benefit: "conteúdo direto e aplicável desde o primeiro dia" },
  { test: /loja|produto|e-?commerce|moda|beleza|marketplace/i, subject: "para quem procura algo novo com boa escolha", cta: "Conhecer a seleção", benefit: "opções selecionadas e atendimento próximo" },
];

const DEFAULT_SEGMENT: Segment = {
  test: /.*/,
  subject: "para quem quer entender mais sobre o assunto",
  cta: "Fale com a gente",
  benefit: "informação clara e um contato simples",
};

function cleanInput(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function firstSentence(value: string): string {
  const withoutCommands = value
    .replace(/^(crie|fa[cç]a|gere|monte|produza|quero|preciso de|prepara|a|o|as|os)\s+/gi, "")
    .replace(/^(um|uma|uns|umas)\s+/gi, "")
    .trim();
  const sentence = withoutCommands.split(/[.!?]/)[0]?.trim() || "Conteúdo em destaque";
  return sentence.charAt(0).toUpperCase() + sentence.slice(1).slice(0, 88);
}

function pickSegment(question: string): Segment {
  return SEGMENTS.find((segment) => segment.test.test(question)) || DEFAULT_SEGMENT;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Cria um rascunho completo: quatro capas (duas claras e duas escuras),
 * lâminas subsequentes com CTA e uma legenda revisável.
 */
export function buildWizardDraft(input: { question: unknown; format: WizardFormat; company?: string }): WizardDraft {
  const question = cleanInput(input.question);
  const segment = pickSegment(question);
  const topic = firstSentence(question);
  const company = cleanInput(input.company).slice(0, 40) || "sua empresa";
  const cta = segment.cta;
  const count = input.format === "POST" ? 1 : input.format === "STORIES" ? 5 : 6;

  const covers: WizardCover[] = [
    { index: 0, theme: "dark", title: topic, body: `Descubra como a ${company} pode ajudar ${segment.subject}.` },
    { index: 1, theme: "dark", title: question ? `${topic.slice(0, 58)}` : "Uma nova forma de comunicar", body: `Veja o que fazemos ${segment.subject}.` },
    { index: 2, theme: "light", title: topic, body: titleCase(segment.benefit) + "." },
    { index: 3, theme: "light", title: "Conheça a proposta", body: `Uma comunicação simples ${segment.subject}.` },
  ];

  const bodies = [
    `A ${company} apresenta ${segment.benefit} ${segment.subject}.`,
    "Mostramos o passo a passo de forma direta, sem promessas que dependam de confirmação.",
    "Você escolhe o que faz sentido para a sua rotina e decide o próximo passo com calma.",
    `Quer ver como funciona na prática? O contato é simples: ${segment.cta.toLowerCase()}.`,
    "Tire suas dúvidas e receba as informações necessárias antes de qualquer decisão.",
  ];

  const slides: WizardSlide[] = Array.from({ length: count }, (_, index) => {
    const last = index === count - 1;
    const theme: WizardTheme = index % 2 === 0 ? "dark" : "light";
    if (last) {
      return {
        index,
        theme,
        title: "Pronto para dar o próximo passo?",
        body: `${cta} e converse com a ${company}. Conteúdo em rascunho: revise antes de publicar.`,
        cta: `${cta.toUpperCase()} · SALVE · COMPARTILHE`,
      };
    }
    return {
      index,
      theme,
      title: index === 0 ? topic : ["Como podemos ajudar", "O que esperar", "Simples assim", "Seu próximo passo"][Math.min(index, 4)] ?? topic,
      body: bodies[Math.min(index, bodies.length - 1)]!,
      cta: index === count - 2 ? cta.toUpperCase() : "CONTINUE DESLIZANDO →",
    };
  });

  const caption = [
    `${topic} ${segment.subject}.`,
    `Na ${company}, ${segment.benefit}.`,
    `${cta}: converse com a gente e entenda os próximos passos.`,
    "Rascunho criado automaticamente para revisão. Confira textos, imagens e dados antes de publicar.",
  ].join("\n\n");

  return { title: topic.slice(0, 120), caption: caption.slice(0, 2000), covers, slides };
}
