import type { SiteDocument, SiteNode } from '../../../../../../../../packages/shared-types/src/site-document';
import { createNode } from '../nodes/registry';

// Adapter clone-url: baixa HTML, sanitiza e converte para árvore de nós.
// Implementação leve (sem jsdom): parse por regex de tags comuns.

export async function cloneUrl(url: string): Promise<SiteDocument> {
  const res = await fetch(`/api/proxy/fetch-url?url=${encodeURIComponent(url)}`);
  const html = await res.text();
  const sanitized = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');

  const root = createNode('section', { props: { padding: '0' } });
  const children: SiteNode[] = [];

  // headings
  const headingRe = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(sanitized))) {
    const level = m[1]!;
    const text = m[2]!.replace(/<[^>]+>/g, '').trim();
    if (text) children.push(createNode('text', { props: { content: text, tag: `h${level}` } }));
  }

  // paragraphs
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = pRe.exec(sanitized))) {
    const text = m[1]!.replace(/<[^>]+>/g, '').trim();
    if (text) children.push(createNode('text', { props: { content: text, tag: 'p' } }));
  }

  // images
  const imgRe = /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi;
  while ((m = imgRe.exec(sanitized))) {
    children.push(createNode('image', { props: { src: m[1]!, alt: m[2] } }));
  }

  // links -> buttons
  const aRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = aRe.exec(sanitized))) {
    const label = m[2]!.replace(/<[^>]+>/g, '').trim();
    if (label) children.push(createNode('button', { props: { label, href: m[1]! } }));
  }

  root.children = children.length ? children : [createNode('text', { props: { content: 'Conteúdo clonado' } })];

  return {
    version: 1,
    root,
    meta: { title: 'Site clonado', type: 'static', theme: defaultTheme() },
  };
}

function defaultTheme() {
  return { primary: '#2563eb', secondary: '#1e40af', background: '#ffffff', text: '#111827', fontHeading: 'Inter', fontBody: 'Inter' };
}