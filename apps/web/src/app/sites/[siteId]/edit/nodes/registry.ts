import type { SiteDocument, SiteNode, NodeType, BlockDescriptor } from '@/shared-types/site-document';

// Registry de blocos do editor visual.
// Cada bloco é um descritor com defaultProps/schema/render.

function uid(): string {
  return 'n_' + Math.random().toString(36).slice(2, 10);
}

export function createNode(type: NodeType, overrides: Partial<SiteNode> = {}): SiteNode {
  const desc = BLOCK_REGISTRY[type];
  return {
    id: overrides.id ?? uid(),
    type,
    props: { ...desc.defaultProps, ...(overrides.props ?? {}) },
    styles: { ...desc.defaultStyles, ...(overrides.styles ?? {}) },
    children: overrides.children ?? desc.createChildren?.() ?? [],
  };
}

export const BLOCK_REGISTRY: Record<NodeType, BlockDescriptor> = {
  section: {
    type: 'section',
    label: 'Seção',
    icon: 'layout',
    defaultProps: { padding: '4rem 1rem', background: 'var(--surface, var(--surface, #ffffff))' },
    defaultStyles: { display: 'block', width: '100%' },
    schema: [
      { key: 'padding', label: 'Espaçamento', type: 'text', aiEditable: true },
      { key: 'background', label: 'Cor de fundo', type: 'color', aiEditable: true },
    ],
    render: (n) => n,
  },

  // ---- Estrutura (aceita filhos e permite reordenar dentro) ----
  div: {
    type: 'div',
    label: 'Div',
    icon: 'box',
    category: 'layout',
    defaultProps: {},
    defaultStyles: { display: 'block', width: '100%', padding: '1rem' },
    schema: [],
    render: (n) => n,
  },
  header: {
    type: 'header',
    label: 'Cabeçalho',
    icon: 'layout',
    category: 'layout',
    defaultProps: {},
    defaultStyles: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      padding: '1rem 2rem',
      background: 'var(--surface, #ffffff)',
      borderBottom: '1px solid var(--border, #e5e8ef)',
      position: 'sticky',
      top: '0',
      zIndex: '10',
    },
    schema: [],
    render: (n) => n,
  },
  footer: {
    type: 'footer',
    label: 'Rodapé',
    icon: 'layout',
    category: 'layout',
    defaultProps: {},
    defaultStyles: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '3rem 1.5rem',
      background: 'var(--surface, #ffffff)',
      borderTop: '1px solid var(--border, #e5e8ef)',
    },
    schema: [],
    render: (n) => n,
  },
  aside: {
    type: 'aside',
    label: 'Barra lateral',
    icon: 'box',
    category: 'layout',
    defaultProps: {},
    defaultStyles: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      padding: '1.5rem',
      background: 'var(--background, #f6f7f4)',
      borderRadius: '0.75rem',
      width: '300px',
    },
    schema: [],
    render: (n) => n,
  },

  // ---- Blocos pré-prontos ----
  hero: {
    type: 'hero',
    label: 'Hero',
    icon: 'layout',
    category: 'layout',
    defaultProps: {
      heading: 'Bem-vindo ao seu novo site',
      subheading: 'Edite este texto, as cores e o espaçamento no painel de propriedades.',
      ctaLabel: 'Conheça mais',
      ctaUrl: '#',
    },
    defaultStyles: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: '1.25rem',
      padding: '5rem 1.5rem',
      minHeight: '60vh',
      background: 'var(--surface, #ffffff)',
      color: 'var(--text, #161a17)',
      borderRadius: '1rem',
    },
    schema: [
      { key: 'heading', label: 'Título', type: 'text', aiEditable: true },
      { key: 'subheading', label: 'Subtítulo', type: 'textarea', aiEditable: true },
      { key: 'ctaLabel', label: 'Texto do botão', type: 'text', aiEditable: true },
      { key: 'ctaUrl', label: 'Link do botão', type: 'text', aiEditable: true },
      { key: 'anchor', label: 'Âncora', type: 'text', aiEditable: false },
    ],
    render: (n) => n,
    createChildren: () => [
      createNode('heading', {
        props: { content: 'Bem-vindo ao seu novo site', level: 'h1' },
        styles: { fontSize: 'clamp(2rem, 5vw, 4rem)', margin: '0' },
      }),
      createNode('text', {
        props: { content: 'Edite este texto, as cores e o espaçamento no painel de propriedades.', tag: 'p' },
        styles: { fontSize: '1.125rem', maxWidth: '42rem', margin: '0' },
      }),
      createNode('button', { props: { label: 'Conheça mais', href: '#' } }),
    ],
  },
  columns: {
    type: 'columns',
    label: 'Colunas (2–8)',
    icon: 'layout',
    category: 'layout',
    defaultProps: { columnCount: 3, gap: '1rem' },
    defaultStyles: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '1rem',
      width: '100%',
      padding: '0.5rem',
    },
    schema: [
      {
        key: 'columnCount',
        label: 'Quantidade de colunas',
        type: 'select',
        options: [2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: String(n) })),
        aiEditable: false,
      },
      { key: 'gap', label: 'Distância entre colunas', type: 'text', aiEditable: true },
    ],
    render: (n) => n,
    createChildren: () =>
      Array.from({ length: 3 }, (_, i) =>
        createNode('div', {
          props: { title: `Coluna ${i + 1}`, content: 'Edite este conteúdo ou arraste blocos para dentro.' },
          styles: {
            flex: '1 1 0',
            minWidth: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1.25rem',
            background: 'var(--background, #f6f7f4)',
            borderRadius: '0.75rem',
          },
        }),
      ),
  },
  'image-text': {
    type: 'image-text',
    label: 'Imagem + Texto',
    icon: 'image',
    category: 'media',
    defaultProps: {
      heading: 'Título do bloco',
      body: 'Texto descritivo ao lado da imagem. Troque a imagem, o texto e a ordem dos elementos.',
      imageSrc: '',
      imageAlt: 'Imagem ilustrativa',
      imagePosition: 'left',
      buttonLabel: 'Saiba mais',
      buttonUrl: '#',
    },
    defaultStyles: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: '2rem',
      padding: '2rem',
      background: 'var(--surface, #ffffff)',
      borderRadius: '1rem',
      width: '100%',
    },
    schema: [
      { key: 'heading', label: 'Título', type: 'text', aiEditable: true },
      { key: 'body', label: 'Texto', type: 'textarea', aiEditable: true },
      { key: 'imageSrc', label: 'URL da imagem', type: 'image', aiEditable: true },
      { key: 'imageAlt', label: 'Texto alternativo', type: 'text', aiEditable: true },
      {
        key: 'imagePosition',
        label: 'Imagem',
        type: 'select',
        options: [
          { value: 'left', label: 'À esquerda' },
          { value: 'right', label: 'À direita' },
          { value: 'top', label: 'Acima' },
        ],
        aiEditable: false,
      },
      { key: 'buttonLabel', label: 'Texto do botão', type: 'text', aiEditable: true },
      { key: 'buttonUrl', label: 'Link do botão', type: 'text', aiEditable: true },
    ],
    render: (n) => n,
    createChildren: () => [
      createNode('image', {
        props: { src: '', alt: 'Imagem ilustrativa' },
        styles: { width: '40%', minWidth: '12rem', borderRadius: '0.75rem', objectFit: 'cover' },
      }),
      createNode('div', {
        styles: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
        children: [
          createNode('heading', { props: { content: 'Título do bloco', level: 'h2' }, styles: { fontSize: '1.5rem', margin: '0' } }),
          createNode('text', { props: { content: 'Texto descritivo ao lado da imagem.', tag: 'p' }, styles: { margin: '0' } }),
          createNode('button', { props: { label: 'Saiba mais', href: '#' } }),
        ],
      }),
    ],
  },
  heading: {
    type: 'heading',
    label: 'Título',
    icon: 'type',
    category: 'content',
    defaultProps: { content: 'Título da seção', level: 'h2' },
    defaultStyles: {
      fontSize: '1.875rem',
      fontWeight: '700',
      lineHeight: '1.2',
      color: 'var(--text, #161a17)',
      margin: '0 0 1rem 0',
    },
    schema: [
      { key: 'content', label: 'Texto', type: 'text', aiEditable: true },
      {
        key: 'level',
        label: 'Nível',
        type: 'select',
        options: [
          { value: 'h1', label: 'H1' },
          { value: 'h2', label: 'H2' },
          { value: 'h3', label: 'H3' },
          { value: 'h4', label: 'H4' },
        ],
        aiEditable: false,
      },
    ],
    render: (n) => n,
  },
  text: {
    type: 'text',
    label: 'Texto',
    icon: 'type',
    defaultProps: { content: 'Novo texto', tag: 'p' },
    defaultStyles: { fontSize: '1rem', color: 'var(--text, #111827)', lineHeight: '1.6' },
    schema: [
      { key: 'content', label: 'Conteúdo', type: 'textarea', aiEditable: true },
      { key: 'tag', label: 'Tag HTML', type: 'select', options: [{ value: 'p', label: 'Parágrafo' }, { value: 'h1', label: 'H1' }, { value: 'h2', label: 'H2' }, { value: 'h3', label: 'H3' }], aiEditable: false },
    ],
    render: (n) => n,
  },
  image: {
    type: 'image',
    label: 'Imagem',
    icon: 'image',
    defaultProps: { src: '', alt: 'Imagem', width: '100%' },
    defaultStyles: { display: 'block', maxWidth: '100%' },
    schema: [
      { key: 'src', label: 'URL da imagem', type: 'image', aiEditable: true },
      { key: 'alt', label: 'Texto alternativo', type: 'text', aiEditable: true },
      { key: 'width', label: 'Largura', type: 'text', aiEditable: false },
    ],
    render: (n) => n,
  },
  button: {
    type: 'button',
    label: 'Botão',
    icon: 'square',
    defaultProps: { label: 'Clique aqui', href: '#' },
    defaultStyles: { padding: '0.75rem 1.5rem', background: 'var(--primary, #2563eb)', color: 'var(--surface, #ffffff)', borderRadius: '0.5rem', border: 'none', cursor: 'pointer' },
    schema: [
      { key: 'label', label: 'Texto', type: 'text', aiEditable: true },
      { key: 'href', label: 'Link', type: 'text', aiEditable: true },
    ],
    render: (n) => n,
  },
  form: {
    type: 'form',
    label: 'Formulário',
    icon: 'mail',
    defaultProps: { fields: ['nome', 'email', 'mensagem'], submitLabel: 'Enviar' },
    defaultStyles: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    schema: [
      { key: 'submitLabel', label: 'Texto do botão', type: 'text', aiEditable: true },
    ],
    render: (n) => n,
  },
  'post-list': {
    type: 'post-list',
    label: 'Lista de posts',
    icon: 'list',
    defaultProps: { count: 6, layout: 'grid' },
    defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' },
    schema: [
      { key: 'count', label: 'Quantidade', type: 'number', aiEditable: false },
      { key: 'layout', label: 'Layout', type: 'select', options: [{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'Lista' }], aiEditable: false },
    ],
    render: (n) => n,
  },
  'product-grid': {
    type: 'product-grid',
    label: 'Grid de produtos',
    icon: 'shopping-bag',
    defaultProps: { count: 8, columns: 4 },
    defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' },
    schema: [
      { key: 'count', label: 'Quantidade', type: 'number', aiEditable: false },
      { key: 'columns', label: 'Colunas', type: 'number', aiEditable: false },
    ],
    render: (n) => n,
  },
  video: {
    type: 'video',
    label: 'Vídeo',
    icon: 'play',
    defaultProps: { src: '', poster: '' },
    defaultStyles: { width: '100%', aspectRatio: '16/9' },
    schema: [
      { key: 'src', label: 'URL do vídeo', type: 'text', aiEditable: true },
    ],
    render: (n) => n,
  },
  container: {
    type: 'container',
    label: 'Container',
    icon: 'box',
    defaultProps: { maxWidth: '1200px' },
    defaultStyles: { margin: '0 auto', width: '100%' },
    schema: [
      { key: 'maxWidth', label: 'Largura máxima', type: 'text', aiEditable: false },
    ],
    render: (n) => n,
  },
  faq: {
    type: 'faq',
    label: 'Pergunta frequente',
    icon: 'list',
    defaultProps: { question: 'Pergunta frequente', answer: 'Resposta objetiva.' },
    defaultStyles: { borderBottom: '1px solid var(--border, #e5e8ef)', padding: '1rem 0' },
    schema: [
      { key: 'question', label: 'Pergunta', type: 'text', aiEditable: true },
      { key: 'answer', label: 'Resposta', type: 'textarea', aiEditable: true },
    ],
    render: (n) => n,
  },
};

export const BLOCK_TYPES: NodeType[] = Object.keys(BLOCK_REGISTRY) as NodeType[];





