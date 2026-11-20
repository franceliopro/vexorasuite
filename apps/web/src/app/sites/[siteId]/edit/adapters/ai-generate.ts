import type { SiteDocument } from '@/shared-types/site-document';
import { createNode } from '../nodes/registry';

// Adapter ai-generate: prompt -> árvore. Em produção chama a API de IA do Véxora.
// Aqui fornecemos um gerador determinístico baseado em palavras-chave do prompt.

export async function aiGenerate(prompt: string): Promise<SiteDocument> {
  const lower = prompt.toLowerCase();
  const root = createNode('section', { props: { padding: '3rem 1rem' }, styles: { background: '#ffffff' } });
  const children: any[] = [];

  // título
  const titleMatch = prompt.match(/(?:titulo|title|headline)[:：]?\s*(.+)/i);
  children.push(createNode('text', { props: { content: titleMatch?.[1]?.trim() ?? 'Bem-vindo', tag: 'h1' } }));

  if (lower.includes('blog') || lower.includes('post')) {
    children.push(createNode('post-list', { props: { count: 6, layout: 'grid' } }));
  }
  if (lower.includes('produto') || lower.includes('ecommerce') || lower.includes('loja')) {
    children.push(createNode('product-grid', { props: { count: 8, columns: 4 } }));
  }
  if (lower.includes('contato') || lower.includes('form')) {
    children.push(createNode('form', { props: { fields: ['nome', 'email', 'mensagem'], submitLabel: 'Enviar' } }));
  }
  if (lower.includes('video')) {
    children.push(createNode('video', { props: { src: '' } }));
  }
  if (children.length === 1) {
    children.push(createNode('text', { props: { content: 'Conteúdo gerado por IA.', tag: 'p' } }));
    children.push(createNode('button', { props: { label: 'Saiba mais', href: '#' } }));
  }

  root.children = children;

  return {
    version: 1,
    root,
    meta: { title: 'Site gerado por IA', type: lower.includes('blog') ? 'blog' : lower.includes('ecommerce') || lower.includes('loja') ? 'ecommerce' : 'static', theme: defaultTheme() },
  };
}

// A caixa de IA do inspetor chama POST /sites/:id/document/ai-edit. A edição determinística
// (regras rápidas) e o modelo real vivem no backend, para que o mesmo contrato valha para
// qualquer cliente e o documento publicado nunca dependa de lógica local do navegador.

function defaultTheme() {
  return { primary: '#2563eb', secondary: '#1e40af', background: '#ffffff', text: '#111827', fontHeading: 'Inter', fontBody: 'Inter' };
}





