/**
 * Páginas secundárias geradas junto com o site.
 *
 * Todos os dados abaixo são fictícios e estão marcados como rascunho. O objetivo
 * é entregar um site navegável desde a criação — com páginas de conteúdo, páginas
 * legais e contato — para que o proprietário substitua textos, fotos, logos e
 * dados cadastrais no editor antes de publicar. Nada aqui é apresentado como
 * informação jurídica válida ou dado real da empresa.
 */

type PageNode = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<string, string>;
  children: PageNode[];
};

export type GeneratedPage = {
  slug: string;
  title: string;
  kind: 'content' | 'legal';
  root: PageNode;
};

import type { SiteIllustrations } from "./site-images";

export type FakeIdentity = {
  name: string;
  slug: string;
  legalName: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
  logoUrl?: string | null;
};

const INK = '#101d33';
const MUTED = '#5c6677';
const LINE = '#e5e8ef';
const SURFACE = '#ffffff';
const SOFT = '#f5f7fb';

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  styles: Record<string, string> = {},
  children: PageNode[] = [],
): PageNode {
  return { id, type, props, styles, children };
}

function text(id: string, content: string, tag = 'p', styles: Record<string, string> = {}): PageNode {
  return node(id, 'text', { content, tag }, { color: tag === 'p' ? MUTED : INK, lineHeight: '1.7', margin: '0 0 1rem', ...styles });
}

function imageNode(id: string, src: string, alt: string): PageNode {
  return node(id, 'image', { src, alt }, {
    borderRadius: '1rem',
    display: 'block',
    margin: '0 0 1rem',
    objectFit: 'cover',
    width: '100%',
  });
}

function link(id: string, label: string, href: string, primary = '#0e7a5c'): PageNode {
  return node(id, 'button', { label, href }, {
    color: primary,
    display: 'inline-block',
    fontSize: '0.9rem',
    fontWeight: '700',
    marginRight: '1rem',
    textDecoration: 'none',
  });
}

function brandNode(id: string, title: string, primary: string, accent: string, logoUrl?: string | null): PageNode {
  const children: PageNode[] = logoUrl
    ? [node(`${id}_logo`, 'image', { src: logoUrl, alt: `Logo de ${title}` }, {
        height: '2rem',
        maxWidth: '9rem',
        objectFit: 'contain',
        width: 'auto',
      })]
    : [
        node(`${id}_logo_fake`, 'text', {
          content: title.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'VX',
          tag: 'span',
        }, {
          alignItems: 'center',
          background: `linear-gradient(135deg, ${primary}, ${accent})`,
          borderRadius: '0.5rem',
          color: '#ffffff',
          display: 'inline-flex',
          fontSize: '0.75rem',
          fontWeight: '700',
          height: '2rem',
          justifyContent: 'center',
          width: '2rem',
        }),
        node(`${id}_logo_fake_label`, 'text', { content: 'LOGO PROVISÓRIO', tag: 'span' }, {
          color: MUTED,
          fontSize: '0.625rem',
          fontWeight: '700',
          letterSpacing: '0.12em',
        }),
      ];
  return node(`${id}_brand_wrap`, 'container', {}, { alignItems: 'center', display: 'flex', gap: '0.5rem' }, [
    ...children,
    node(`${id}_brand`, 'text', { content: title, tag: 'span' }, { color: INK, fontSize: '1rem', fontWeight: '700' }),
  ]);
}

function shell(id: string, title: string, primary: string, accent: string, logoUrl: string | null | undefined, children: PageNode[]): PageNode {
  return node(`${id}_root`, 'section', { padding: '0' }, { background: SOFT, color: INK, fontFamily: 'Inter, system-ui, sans-serif' }, [
    node(`${id}_nav`, 'section', { padding: '1rem clamp(1rem, 5vw, 4rem)' }, {
      alignItems: 'center',
      background: SURFACE,
      borderBottom: `1px solid ${LINE}`,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.75rem',
      justifyContent: 'space-between',
    }, [
      brandNode(id, title, primary, accent, logoUrl),
      node(`${id}_nav_links`, 'container', {}, { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }, [
        link(`${id}_nav_home`, 'Início', '/'),
        link(`${id}_nav_services`, 'Serviços', '/servicos/'),
        link(`${id}_nav_contact`, 'Contato', '/contato/'),
      ]),
    ]),
    node(`${id}_body`, 'section', {
      padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1rem, 6vw, 5rem)',
    }, { margin: '0 auto', maxWidth: '54rem' }, [
      node(`${id}_banner`, 'section', { padding: '1rem 1.25rem' }, {
        background: `linear-gradient(135deg, ${primary}, ${accent})`,
        borderRadius: '1rem',
        color: '#ffffff',
        marginBottom: '2.5rem',
      }, [
        text(`${id}_banner_text`, 'RASCUNHO: conteúdo e dados fictícios criados automaticamente. Substitua e revise antes de publicar.', 'p', {
          color: '#ffffff',
          fontSize: '0.9rem',
          fontWeight: '700',
          margin: '0',
        }),
      ]),
      ...children,
    ]),
    node(`${id}_footer`, 'section', { padding: '1.5rem clamp(1rem, 6vw, 5rem)' }, {
      background: SURFACE,
      borderTop: `1px solid ${LINE}`,
    }, [
      node(`${id}_footer_links`, 'container', {}, { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }, [
        link(`${id}_footer_privacy`, 'Política de Privacidade', '/privacidade/'),
        link(`${id}_footer_terms`, 'Termos de Uso', '/termos/'),
        link(`${id}_footer_cookies`, 'Cookies', '/cookies/'),
        link(`${id}_footer_data`, 'Exclusão de dados', '/exclusao-de-dados/'),
      ]),
    ]),
  ]);
}

function heading(id: string, content: string): PageNode {
  return text(id, content, 'h1', {
    fontSize: 'clamp(2rem, 5vw, 3.25rem)',
    letterSpacing: '-0.04em',
    lineHeight: '1.1',
    margin: '0 0 1rem',
  });
}

function sectionTitle(id: string, content: string): PageNode {
  return text(id, content, 'h2', {
    fontSize: '1.4rem',
    letterSpacing: '-0.02em',
    margin: '2rem 0 0.75rem',
  });
}

export function fakeIdentity(name: string, slug: string, logoUrl?: string | null): FakeIdentity {
  const domain = slug.replace(/[^a-z0-9-]/g, '') || 'exemplo';
  return {
    name,
    slug,
    legalName: `${name} (dados fictícios)`,
    cnpj: '00.000.000/0001-00',
    email: `contato@${domain}.com.br`,
    phone: '(11) 4000-0000',
    address: 'Rua das Empresas, 123 — Centro, São Paulo/SP',
    hours: 'Segunda a sexta, das 9h às 18h',
    logoUrl,
  };
}

function contactLines(prefix: string, identity: FakeIdentity): PageNode[] {
  return [
    text(`${prefix}_contact_email`, `E-mail: ${identity.email}`),
    text(`${prefix}_contact_phone`, `Telefone: ${identity.phone}`),
    text(`${prefix}_contact_address`, `Endereço: ${identity.address}`),
    text(`${prefix}_contact_hours`, `Horário: ${identity.hours}`),
    text(`${prefix}_contact_cnpj`, `CNPJ: ${identity.cnpj}`),
  ];
}

export function generatedPages(identity: FakeIdentity, primary: string, accent: string, images?: SiteIllustrations): GeneratedPage[] {
  const p = identity.slug;
  const i = fakeIdentity(identity.name, p, identity.logoUrl);

  const sobre = shell('page_sobre', i.name, primary, accent, i.logoUrl, [
    heading('page_sobre_title', `Sobre a ${i.name}`),
    text('page_sobre_intro', 'Somos uma equipe dedicada a resolver com clareza, atenção e respeito ao tempo de cada pessoa. Esta é uma descrição fictícia, criada apenas para dar estrutura ao site.'),
    sectionTitle('page_sobre_values_title', 'O que nos guia'),
    text('page_sobre_values', 'Escuta atenta, transparência nas etapas e acompanhamento depois da entrega. Substitua por missão, valores e história reais da sua equipe.'),
    sectionTitle('page_sobre_team_title', 'Nossa equipe'),
    text('page_sobre_team', 'Espaço reservado para foto real da equipe, do fundador ou do espaço físico. Adicione uma imagem exclusiva no editor.'),
    ...(images ? [imageNode('page_sobre_team_image', images.team, 'Ilustração automática do rascunho; troque por uma foto real antes de publicar.')] : []),
    ...(images ? [text('page_sobre_team_note', 'Imagem ilustrativa gerada automaticamente. Substitua por uma foto real antes de publicar.', 'span', { fontSize: '0.8rem' })] : []),
    ...contactLines('page_sobre', i),
  ]);

  const servicos = shell('page_servicos', i.name, primary, accent, i.logoUrl, [
    heading('page_servicos_title', 'Serviços e soluções'),
    text('page_servicos_intro', 'Apresente aqui os principais serviços da empresa. Os textos abaixo são exemplos e devem ser trocados pelo que você realmente oferece.'),
    ...(images ? [imageNode('page_servicos_image', images.service, 'Ilustração automática do rascunho; troque por uma imagem sua antes de publicar.')] : []),
    sectionTitle('page_servicos_1_title', 'Consultoria inicial'),
    text('page_servicos_1_text', 'Entendemos o contexto e o resultado esperado antes de propor qualquer caminho.'),
    sectionTitle('page_servicos_2_title', 'Execução organizada'),
    text('page_servicos_2_text', 'Escopo, prazos e responsabilidades alinhados para que você saiba o que acontece em cada etapa.'),
    sectionTitle('page_servicos_3_title', 'Acompanhamento'),
    text('page_servicos_3_text', 'Retornos e ajustes combinados, com atenção ao que importa para você.'),
    link('page_servicos_cta', 'Solicitar orçamento', '/contato/'),
  ]);

  const cases = shell('page_cases', i.name, primary, accent, i.logoUrl, [
    heading('page_cases_title', 'Cases e depoimentos'),
    text('page_cases_intro', 'Os relatos abaixo são fictícios. Substitua por depoimentos reais, com nome, cargo, empresa e imagem das pessoas citadas.'),
    sectionTitle('page_cases_1_title', 'Maria Silva — Gerente de Operações, Empresa Exemplo'),
    text('page_cases_1_text', 'Depoimento fictício: “O processo ficou claro do começo ao fim e conseguimos acompanhar cada etapa.”'),
    sectionTitle('page_cases_2_title', 'João Ribeiro — Sócio, Negócio Exemplo'),
    text('page_cases_2_text', 'Depoimento fictício: “A comunicação objetiva fez diferença na decisão e no acompanhamento.”'),
    sectionTitle('page_cases_3_title', 'Resultado verificável'),
    text('page_cases_3_text', 'Espaço reservado para print ou número real, com origem identificada. Não publique métricas sem comprovação.'),
  ]);

  const faq = shell('page_faq', i.name, primary, accent, i.logoUrl, [
    heading('page_faq_title', 'Perguntas frequentes'),
    text('page_faq_intro', 'Perguntas de exemplo. Ajuste as respostas com informações reais da sua empresa.'),
    node('page_faq_1', 'faq', {
      question: 'Como solicito um orçamento?',
      answer: 'Preencha o formulário de contato com o que você precisa. Esta resposta é fictícia e deve ser revisada.',
    }, { borderBottom: `1px solid ${LINE}`, padding: '1rem 0' }),
    node('page_faq_2', 'faq', {
      question: 'Quanto tempo leva?',
      answer: 'O prazo depende do escopo. Informe uma faixa real e verificável antes de publicar.',
    }, { borderBottom: `1px solid ${LINE}`, padding: '1rem 0' }),
    node('page_faq_3', 'faq', {
      question: 'Posso ajustar algo depois?',
      answer: 'Sim. Descreva aqui como os ajustes são combinados e acompanhados na sua operação.',
    }, { borderBottom: `1px solid ${LINE}`, padding: '1rem 0' }),
  ]);

  const contato = shell('page_contato', i.name, primary, accent, i.logoUrl, [
    heading('page_contato_title', 'Fale com a gente'),
    text('page_contato_intro', 'Preencha o formulário abaixo. Os dados exibidos ao lado são fictícios e devem ser substituídos.'),
    node('page_contato_form_card', 'section', { padding: 'clamp(1.5rem, 4vw, 2rem)' }, {
      background: SURFACE,
      border: `1px solid ${LINE}`,
      borderRadius: '1.25rem',
    }, [
      node('contato_form', 'form', {
        fields: ['nome', 'email', 'mensagem'],
        submitLabel: 'Enviar mensagem',
      }, { display: 'flex', flexDirection: 'column', gap: '0.9rem' }),
    ]),
    sectionTitle('page_contato_data_title', 'Dados para contato (fictícios)'),
    ...contactLines('page_contato', i),
  ]);

  const privacy = shell('page_privacidade', i.name, primary, accent, i.logoUrl, [
    heading('page_privacidade_title', 'Política de Privacidade — rascunho'),
    text('page_privacidade_note', 'Este texto é fictício e não substitui revisão jurídica. Substitua todas as seções antes de publicar.'),
    sectionTitle('page_privacidade_1_title', 'Dados que coletamos'),
    text('page_privacidade_1_text', `Exemplo: nome, e-mail e mensagem enviados pelos formulários de ${i.name}. Descreva os campos reais do seu site.`),
    sectionTitle('page_privacidade_2_title', 'Como usamos'),
    text('page_privacidade_2_text', 'Exemplo: responder contatos e organizar o relacionamento com a empresa. Ajuste às finalidades reais.'),
    sectionTitle('page_privacidade_3_title', 'Compartilhamento'),
    text('page_privacidade_3_text', 'Exemplo: compartilhamos apenas com ferramentas necessárias para operar o site. Liste os destinatários reais.'),
    sectionTitle('page_privacidade_4_title', 'Seus direitos'),
    text('page_privacidade_4_text', 'Exemplo: você pode solicitar acesso, correção ou exclusão dos seus dados pelo canal de contato abaixo.'),
    sectionTitle('page_privacidade_5_title', 'Contato'),
    ...contactLines('page_privacidade', i),
  ]);

  const terms = shell('page_termos', i.name, primary, accent, i.logoUrl, [
    heading('page_termos_title', 'Termos de Uso — rascunho'),
    text('page_termos_note', 'Este texto é fictício e não substitui revisão jurídica. Substitua todas as seções antes de publicar.'),
    sectionTitle('page_termos_1_title', 'Uso do site'),
    text('page_termos_1_text', 'Exemplo: o site serve para apresentar informações e receber contatos. Descreva o uso permitido conforme sua operação.'),
    sectionTitle('page_termos_2_title', 'Conteúdo'),
    text('page_termos_2_text', 'Exemplo: textos, imagens e marcas apresentados pertencem à empresa ou a terceiros autorizados. Confira a procedência real.'),
    sectionTitle('page_termos_3_title', 'Responsabilidades'),
    text('page_termos_3_text', 'Exemplo: buscamos manter as informações atualizadas, sem prometer disponibilidade ininterrupta. Ajuste com o jurídico.'),
    sectionTitle('page_termos_4_title', 'Contato'),
    ...contactLines('page_termos', i),
  ]);

  const cookies = shell('page_cookies', i.name, primary, accent, i.logoUrl, [
    heading('page_cookies_title', 'Política de Cookies — rascunho'),
    text('page_cookies_note', 'Este texto é fictício e não substitui revisão jurídica. Confira quais cookies o seu site realmente usa.'),
    sectionTitle('page_cookies_1_title', 'Cookies utilizados'),
    text('page_cookies_1_text', 'Exemplo: cookies necessários ao funcionamento do site. Liste categorias e finalidades reais.'),
    sectionTitle('page_cookies_2_title', 'Como gerenciar'),
    text('page_cookies_2_text', 'Exemplo: você pode configurar o navegador para bloquear cookies. Descreva as opções disponíveis no seu site.'),
    sectionTitle('page_cookies_3_title', 'Contato'),
    ...contactLines('page_cookies', i),
  ]);

  const dataDeletion = shell('page_exclusao', i.name, primary, accent, i.logoUrl, [
    heading('page_exclusao_title', 'Exclusão de Dados — rascunho'),
    text('page_exclusao_note', 'Este texto é fictício e não substitui revisão jurídica. Defina o procedimento real antes de publicar.'),
    sectionTitle('page_exclusao_1_title', 'Como solicitar'),
    text('page_exclusao_1_text', `Exemplo: envie uma mensagem para ${i.email} com o assunto “Exclusão de dados”. Substitua pelo canal real.`),
    sectionTitle('page_exclusao_2_title', 'Prazo e verificação'),
    text('page_exclusao_2_text', 'Exemplo: confirmamos o recebimento e respondemos conforme o prazo aplicável. Ajuste com o jurídico.'),
    sectionTitle('page_exclusao_3_title', 'Contato'),
    ...contactLines('page_exclusao', i),
  ]);

  return [
    { slug: 'sobre', title: 'Sobre', kind: 'content', root: sobre },
    { slug: 'servicos', title: 'Serviços', kind: 'content', root: servicos },
    { slug: 'cases', title: 'Cases e depoimentos', kind: 'content', root: cases },
    { slug: 'faq', title: 'FAQ', kind: 'content', root: faq },
    { slug: 'contato', title: 'Contato', kind: 'content', root: contato },
    { slug: 'privacidade', title: 'Política de Privacidade', kind: 'legal', root: privacy },
    { slug: 'termos', title: 'Termos de Uso', kind: 'legal', root: terms },
    { slug: 'cookies', title: 'Política de Cookies', kind: 'legal', root: cookies },
    { slug: 'exclusao-de-dados', title: 'Exclusão de Dados', kind: 'legal', root: dataDeletion },
  ];
}
