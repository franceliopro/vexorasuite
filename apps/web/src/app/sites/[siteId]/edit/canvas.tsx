'use client';
import { useEffect, useRef, useState } from 'react';
import type { SiteDocument, SiteNode } from '@/shared-types/site-document';

// Canvas: iframe sandbox + runtime de seleção via postMessage.

interface CanvasProps {
  doc: SiteDocument;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export function Canvas({ doc, selectedId, onSelect, onHover }: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  // Serializa o documento para o iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const html = buildIframeHtml(doc);
    iframe.srcdoc = html;
  }, [doc]);

  // Recebe seleções do runtime do iframe
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (!e.data || e.data.source !== 'vexora-runtime') return;
      if (e.data.type === 'select') onSelect(e.data.id);
      if (e.data.type === 'hover') onHover?.(e.data.id);
      if (e.data.type === 'ready') setReady(true);
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSelect, onHover]);

  // Envia seleção atual para o iframe (highlight)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ source: 'vexora-editor', type: 'highlight', id: selectedId }, '*');
  }, [selectedId, ready]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      title="canvas"
    />
  );
}

function buildIframeHtml(doc: SiteDocument): string {
  // Render determinístico simples para preview.
  const renderNode = (n: SiteNode): string => {
    const style = Object.entries(n.styles).map(([k, v]) => `${camelToKebab(k)}:${v}`).join(';');
    const inner = n.children.map(renderNode).join('');
    switch (n.type) {
      case 'text':
        return `<${n.props.tag ?? 'p'} data-node="${n.id}" style="${style}">${n.props.content ?? ''}</${n.props.tag ?? 'p'}>`;
      case 'image':
        return `<img data-node="${n.id}" src="${n.props.src ?? ''}" alt="${n.props.alt ?? ''}" style="${style}" />`;
      case 'button':
        return `<a data-node="${n.id}" href="${n.props.href ?? '#'}" style="${style}">${n.props.label ?? ''}</a>`;
      case 'section':
      case 'container':
        return `<section data-node="${n.id}" style="${style}">${inner}</section>`;
      case 'video':
        return `<div data-node="${n.id}" style="${style}">video</div>`;
      default:
        return `<div data-node="${n.id}" style="${style}">${inner}</div>`;
    }
  };

  const runtime = `
    <script>
    (function(){
      var selected = null;
      function post(type, id){ parent.postMessage({ source:'vexora-runtime', type, id }, '*'); }
      document.addEventListener('click', function(e){
        var t = e.target;
        while(t && t !== document.body && !t.getAttribute('data-node')) t = t.parentNode;
        if(t && t.getAttribute('data-node')){ e.preventDefault(); e.stopPropagation(); post('select', t.getAttribute('data-node')); }
      }, true);
      document.addEventListener('mouseover', function(e){
        var t = e.target;
        while(t && t !== document.body && !t.getAttribute('data-node')) t = t.parentNode;
        if(t && t.getAttribute('data-node')) post('hover', t.getAttribute('data-node'));
      });
      window.addEventListener('message', function(e){
        if(!e.data || e.data.source !== 'vexora-editor') return;
        if(e.data.type === 'highlight'){
          if(selected) selected.style.outline = '';
          if(e.data.id){
            var el = document.querySelector('[data-node="'+e.data.id+'"]');
            if(el){ el.style.outline = '2px solid #2563eb'; selected = el; }
          } else { selected = null; }
        }
      });
      parent.postMessage({ source:'vexora-runtime', type:'ready' }, '*');
    })();
    </script>
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Inter,sans-serif}</style></head><body>${renderNode(doc.root)}${runtime}</body></html>`;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}





