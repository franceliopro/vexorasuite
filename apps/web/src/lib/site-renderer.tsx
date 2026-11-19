import React from 'react';
import type { SiteDocument, SiteNode } from '@/shared-types/site-document';

// Renderer determinístico de entrega: mesmo JSON usado no site publicado.

export function renderSite(doc: SiteDocument): React.ReactElement {
  return React.createElement('div', { className: 'site-root' }, renderNode(doc.root));
}

function renderNode(node: SiteNode): React.ReactElement {
  const style = node.styles as React.CSSProperties;
  switch (node.type) {
    case 'text': {
      const Tag = (node.props.tag as string) || 'p';
      return React.createElement(Tag, { style, key: node.id }, String(node.props.content ?? ''));
    }
    case 'image':
      return React.createElement('img', { src: node.props.src, alt: node.props.alt, style, key: node.id });
    case 'button':
      return React.createElement('a', { href: node.props.href, style, key: node.id }, String(node.props.label ?? ''));
    case 'section':
    case 'container':
      return React.createElement('section', { style, key: node.id }, node.children.map(renderNode));
    case 'video': {
      const src = String(node.props.src ?? '');
      if (!src) {
        return React.createElement('div', { style, key: node.id, className: 'video-empty' }, 'Vídeo não configurado');
      }
      return React.createElement('iframe', {
        src,
        style: { ...style, border: 'none' },
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true,
        key: node.id,
        title: 'video',
      });
    }
    case 'form': {
      const fields = Array.isArray(node.props.fields) ? (node.props.fields as string[]) : [];
      return React.createElement(
        'form',
        { style, key: node.id, onSubmit: (e: React.FormEvent) => e.preventDefault() },
        ...fields.map((f, i) =>
          React.createElement('input', { key: i, name: f, placeholder: f, style: { padding: '0.5rem', border: '1px solid var(--border, #d1d5db)', borderRadius: 6 } }),
        ),
        React.createElement('button', { type: 'submit', style: { padding: '0.5rem 1rem', background: 'var(--primary, #2563eb)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' } }, String(node.props.submitLabel ?? 'Enviar')),
      );
    }
    case 'post-list': {
      const items = Array.isArray(node.props.items) ? (node.props.items as any[]) : [];
      if (items.length === 0) {
        return React.createElement('div', { style, key: node.id, className: 'post-list-empty' }, 'Nenhum post disponível');
      }
      return React.createElement('div', { style, key: node.id }, items.map((it, i) => React.createElement('article', { key: i }, it.title ?? it)));
    }
    case 'product-grid': {
      const items = Array.isArray(node.props.items) ? (node.props.items as any[]) : [];
      if (items.length === 0) {
        return React.createElement('div', { style, key: node.id, className: 'product-grid-empty' }, 'Nenhum produto disponível');
      }
      return React.createElement('div', { style, key: node.id }, items.map((it, i) => React.createElement('div', { key: i }, it.name ?? it)));
    }
    default:
      return React.createElement('div', { style, key: node.id }, node.children.map(renderNode));
  }
}
