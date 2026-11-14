/** Fotos curadas para inspiração do site — todas do Unsplash (gratuitas, sem atribuição obrigatória). */
const unsplash = (id: string, w = 1600, q = 80): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=${q}`;

const captionAt = (captions: string[], i: number): string => captions[i] ?? captions[0] ?? "Inspiração";
const byId = (ids: string[], captions: string[]): { url: string; caption: string }[] =>
  ids.map((id, i) => ({ url: unsplash(id), caption: captionAt(captions, i) }));

const GENERAL = [
  "photo-1560518883-ce09059eeffa",
  "photo-1512917774080-9991f1c4c750",
  "photo-1576091160399-112ba8d25d1d",
  "photo-1616401782426-2c2e3a164e30",
  "photo-1497366216548-37526070297",
  "photo-1560478812-1b4f0f4b6a3a",
];
const BEAUTY = [
  "photo-1570172619644-dfd03a3d97b7",
  "photo-1522337664840-dc4e3f3f5f52",
  "photo-1616394584738-fc6e612e71b9",
  "photo-1596178075881-2a34505f8e66",
  "photo-1512690451617-c73894812d7a",
  "photo-1595476108010-b4d1f102221c",
];
const FOOD = [
  "photo-1414238498840-ec0b8b59ac2e",
  "photo-1495474472287-4d71bcdd2085",
  "photo-1466978913421-dad2ebd01d17",
  "photo-1504674900247-0877df9cc836",
  "photo-1482049016688-8cc7229ab3",
  "photo-1476224203421-9ac61da983a7",
];

const IMOBILIARIA = ["Casa moderna", "Cozinha de luxo", "Fachada premium", "Apartamento com vista", "Sala de visitas", "Antes e depois"];
const AESTETICA = ["Sala de tratamento", "Spa relaxante", "Equipamento premium", "Área de lounge", "Antes e depois", "Atendimento personalizado"];
const CLINICA_ESTETICA = ["Consultório elegante", "Procedimento premium", "Resultados naturais", "Spa urbano", "Espaço acolhedor", "Excelência"];
const CLINICA_MEDICA = ["Recepção moderna", "Consultório", "Equipe médica", "Sala de exames", "Tecnologia hospitalar", "Atendimento humanizado"];
const ADVOCACIA = ["Escritório elegante", "Sala de reunião", "Biblioteca jurídica", "Recepção", "Consciência", "Confiança"];
const CONSTRUTORA = ["Obra em andamento", "Construtor premium", "Arquitetura moderna", "Entrega-chave", "Engenharia", "Acabamento"];
const SERVICOS = ["Atendimento", "Equipe técnica", "Ferramentas", "Resultado", "Organização", "Confiança"];
const ECOMMERCE = ["Estoque organizado", "Entrega rápida", "Loja moderna", "Detalhe do produto", "Packaging", "Cliente satisfeito"];
const BLOG = ["Mesa de trabalho", "Escrita", "Café e ideias", "Colaboração", "Lançamento", "Pesquisa"];
const ESCOLA_MUSICA = ["Sala de aula", "Instrumento", "Músico", "Produção", "Composição", "Palco"];
const ESCOLA_TEOLOGIA = ["Bíblia", "Comunidade", "Estudo", "Reflexão", "Formação", "Sermão"];
const ESCOLA_CURSOS = ["Sala de aula", "Grupo de estudo", "Apresentação", "Certificação", "Mentoria", "Networking"];
const VEXORA = ["Dashboard", "Equipe", "Produto", "Resultado", "Tecnologia", "Parceria"];
const SIMPLES = ["Escritório", "Equipe", "Visão", "Produto", "Clientes", "Crescimento"];
const RASTREAMENTO = ["Central 24h", "Frota", "Logística", "Tecnologia", "Segurança", "Resultado"];
const PROTECAO = ["Proteção", "Assistência", "Guincho", "Garantia", "Central", "Confiança"];
const FOOD_CAPTIONS = ["Prato principal", "Sobremesa", "Ambiente do restaurante", "Coquetel", "Receita", "Bem-vindo"];

export const INSPIRATIONS: Record<string, { url: string; caption: string }[]> = {
  imobiliaria: byId(GENERAL, IMOBILIARIA),
  estetica_geral: byId(BEAUTY, AESTETICA),
  clinica_estetica: byId(BEAUTY, CLINICA_ESTETICA),
  clinica_medica: byId(GENERAL, CLINICA_MEDICA),
  advocacia: byId(GENERAL, ADVOCACIA),
  construtora: byId(GENERAL, CONSTRUTORA),
  prestacao_servicos: byId(GENERAL, SERVICOS),
  ecommerce: byId(GENERAL, ECOMMERCE),
  blog: byId(GENERAL, BLOG),
  escola_musica: byId(GENERAL, ESCOLA_MUSICA),
  escola_teologia: byId(GENERAL, ESCOLA_TEOLOGIA),
  escola_cursos: byId(GENERAL, ESCOLA_CURSOS),
  vexora: byId(GENERAL, VEXORA),
  site_simples: byId(GENERAL, SIMPLES),
  rastreamento: byId(GENERAL, RASTREAMENTO),
  protecao: byId(GENERAL, PROTECAO),
  food: byId(FOOD, FOOD_CAPTIONS),
};

const FALLBACK = byId(GENERAL, SIMPLES);

/** Retorna as inspirações do nicho informado (ou as do "site simples" como fallback). */
export const inspirationAreasFor = (area: string): { url: string; caption: string }[] =>
  INSPIRATIONS[area] ?? FALLBACK;
