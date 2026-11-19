import type { SiteDocument, SiteNode } from '../../../../../../../../../../packages/shared-types/src/site-document';

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
    children: overrides.children ?? [],
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
};

export const BLOCK_TYPES: NodeType[] = Object.keys(BLOCK_REGISTRY) as NodeType[];




