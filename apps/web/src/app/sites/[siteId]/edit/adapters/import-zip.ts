import type { SiteDocument } from '../../../../../../../../../../packages/shared-types/src/site-document';
import { createNode } from '../nodes/registry';

// Adapter import-zip: aceita ZIP compatível Elementor/Divi.
// Implementa mapper real quando JSZip estiver disponível; caso contrário, fallback.

export async function importZip(file: File): Promise<SiteDocument> {
  let JSZip: any;
  try {
    JSZip = (await import('jszip' as any)).default;
  } catch {
    JSZip = null;
  }

  if (!JSZip) {
    // Fallback determinístico
    const root = createNode('section', { props: { padding: '2rem 1rem' } });
    root.children = [createNode('text', { props: { content: `Importado de ${file.name} (JSZip indisponível)`, tag: 'h1' } })];
    return { version: 1, root, meta: { title: file.name.replace(/\.zip$/i, ''), type: 'static', theme: defaultTheme() } };
  }

  const zip = await JSZip.loadAsync(file);
  const root = createNode('section', { props: { padding: '2rem 1rem' } });
  const children: any[] = [];

  // Procura por JSON do Elementor
  const elementorFile = Object.keys(zip.files).find((n) => n.endsWith('.json') && n.includes('elementor'));
  if (elementorFile) {
    const json = JSON.parse(await zip.files[elementorFile].async('text'));
    const elements = json.content ?? json.elements ?? [];
    for (const el of elements) {
      const node = mapElementor(el);
      if (node) children.push(node);
    }
  }

  // Procura por JSON do Divi
  const diviFile = Object.keys(zip.files).find((n) => n.endsWith('.json') && n.includes('divi'));
  if (diviFile && children.length === 0) {
    const json = JSON.parse(await zip.files[diviFile].async('text'));
    const modules = json.content ?? [];
    for (const m of modules) {
      const node = mapDivi(m);
      if (node) children.push(node);
    }
  }

  // Fallback se nada foi mapeado
  if (children.length === 0) {
    children.push(createNode('text', { props: { content: `Importado de ${file.name}`, tag: 'h1' } }));
  }
  root.children = children;

  return { version: 1, root, meta: { title: file.name.replace(/\.zip$/i, ''), type: 'static', theme: defaultTheme() } };
}

function mapElementor(el: any): any {
  const type = el.elType ?? el.widgetType;
  switch (type) {
    case 'heading':
      return createNode('text', { props: { content: el.settings?.title ?? '', tag: `h${el.settings?.header_size?.replace('h', '') ?? '2'}` } });
    case 'text-editor':
      return createNode('text', { props: { content: (el.settings?.editor ?? '').replace(/<[^>]+>/g, ''), tag: 'p' } });
    case 'image':
      return createNode('image', { props: { src: el.settings?.image?.url ?? '', alt: el.settings?.image?.alt ?? '' } });
    case 'button':
      return createNode('button', { props: { label: el.settings?.text ?? 'Botão', href: el.settings?.link?.url ?? '#' } });
    case 'video':
      return createNode('video', { props: { src: el.settings?.youtube_url ?? el.settings?.vimeo_url ?? '' } });
    case 'form':
      return createNode('form', { props: { fields: ['nome', 'email', 'mensagem'], submitLabel: el.settings?.button_text ?? 'Enviar' } });
    default:
      if (Array.isArray(el.elements)) {
        const section = createNode('section', {});
        section.children = el.elements.map(mapElementor).filter(Boolean);
        return section.children.length ? section : null;
      }
      return null;
  }
}

function mapDivi(m: any): any {
  const type = m.type ?? m.name;
  switch (type) {
    case 'et_pb_text':
      return createNode('text', { props: { content: (m.content ?? '').replace(/<[^>]+>/g, ''), tag: 'p' } });
    case 'et_pb_image':
      return createNode('image', { props: { src: m.src ?? '', alt: m.alt ?? '' } });
    case 'et_pb_button':
      return createNode('button', { props: { label: m.button_text ?? 'Botão', href: m.button_url ?? '#' } });
    case 'et_pb_video':
      return createNode('video', { props: { src: m.src ?? '' } });
    default:
      return null;
  }
}

function defaultTheme() {
  return { primary: 'var(--primary, #2563eb)', secondary: 'var(--secondary, #1e40af)', background: 'var(--background, #ffffff)', text: 'var(--text, #111827)', fontHeading: 'var(--font-heading, Inter)', fontBody: 'var(--font-body, Inter)' };
}





