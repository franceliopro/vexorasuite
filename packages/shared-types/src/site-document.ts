// Véxora Sites — contrato de dados do editor visual

export type NodeType =
  | 'section'
  | 'text'
  | 'image'
  | 'button'
  | 'form'
  | 'post-list'
  | 'product-grid'
  | 'video'
  | 'container';

export type SiteKind = 'static' | 'landing' | 'blog' | 'real-estate' | 'ecommerce';

export interface ThemeTokens {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  fontHeading: string;
  fontBody: string;
}

export interface SiteNodeStyles {
  [key: string]: string;
}

export interface SiteNode {
  id: string;
  type: NodeType;
  props: Record<string, unknown>;
  styles: SiteNodeStyles;
  children: SiteNode[];
}

export interface SiteDocumentMeta {
  title: string;
  type: SiteKind;
  theme: ThemeTokens;
}

export interface SiteDocument {
  version: number;
  root: SiteNode;
  meta: SiteDocumentMeta;
}

export interface BlockDescriptor {
  type: NodeType;
  label: string;
  icon: string;
  category?: 'layout' | 'content' | 'media' | 'commerce';
  defaultProps: Record<string, unknown>;
  defaultStyles: SiteNodeStyles;
  schema: BlockPropSchema[];
  render: (node: SiteNode) => unknown; // renderer placeholder (React component on web)
}

export interface BlockPropSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'image' | 'boolean';
  options?: { value: string; label: string }[];
  placeholder?: string;
  aiEditable?: boolean;
}