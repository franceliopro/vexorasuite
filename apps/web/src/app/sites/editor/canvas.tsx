'use client';

/**
 * Véxora Sites — Editor Visual: canvas com iframe isolado.
 * Preview do site dentro de <iframe sandbox>. O editor injeta um runtime de
 * seleção (outline/handles) via postMessage, evitando que o CSS do site quebre o editor.
 * Consome shared-types (SiteDocument, SiteNode). Sem tipos próprios.
 * Estados visuais: seleção, hover, drag-over/drop, vazio, loading.
 * Classes CSS em editor.css (tokens Véxora, sem hex direto).
 *
 * Integração com o programador: o runtime de seleção dentro do iframe responde a
 * postMessage (highlight) e emite mensagens de volta (select/hover/ready).
 */

import { useEffect, useRef, useState } from 'react';
import type { SiteDocument, SiteNode } from '@/shared-types/site-document';
import { Loader2, Eye, Maximize, Minimize } from 'lucide-react';
import './editor.css';

interface CanvasProps {
  doc: SiteDocument;
  selectedId: string | null;
  hoverId: string | null;
  dragOverId: string | null;
  dropTarget: 'before' | 'after' | 'inside' | null;
  loading: boolean;
  onSelectNode: (nodeId: string, multi: boolean) => void;
  onDrop: (nodeId: string, position: 'before' | 'after' | 'inside') => void;
  device: 'desktop' | 'tablet' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'tablet' | 'mobile') => void;
}

export function Canvas({
  doc,
  selectedId,
  hoverId,
  dragOverId,
  dropTarget,
  loading,
  onSelectNode,
  onDrop,
  device,
  onDeviceChange,
}: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Serializa o documento para o iframe (preview determinístico)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = buildIframeHtml(doc);
  }, [doc]);

  // Recebe seleções/hover do runtime do iframe
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (!e.data || e.data.source !== 'vexora-runtime') return;
      if (e.data.type === 'select') onSelectNode(e.data.id, false);
      if (e.data.type === 'hover') {
        // hover é apenas visual; o shell gerencia via selectedId quando clica
      }
      if (e.data.type === 'ready') setReady(true);
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSelectNode]);

  // Envia seleção atual para o iframe (highlight)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !ready) return;
    iframe.contentWindow.postMessage({ source: 'vexora-editor', type: 'highlight', id: selectedId }, '*');
  }, [selectedId, ready]);

  const deviceLabel = device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Celular';

  if (loading) {
    return (
      <section className="vx-canvas vx-canvas-loading" aria-label="Preview do site">
        <div className="vx-canvas-empty">
          <Loader2 size={24} className="vx-spin" aria-hidden="true" />
          <span>Carregando preview…</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`vx-canvas ${isFullscreen ? 'vx-canvas-fullscreen' : ''}`}
      aria-label={`Preview do site (${device})`}
    >
      <header className="vx-canvas-toolbar">
        <span className="vx-canvas-device-label">{deviceLabel}</span>
        <div className="vx-canvas-device-buttons">
          {['desktop', 'tablet', 'mobile'].map((d) => (
            <button
              key={d}
              type="button"
              className={`vx-canvas-device-btn ${d === device ? 'is-active' : ''}`}
              aria-label={`Visualizar em ${d === 'desktop' ? 'desktop' : d === 'tablet' ? 'tablet' : 'celular'}`}
              onClick={() => onDeviceChange(d as 'desktop' | 'tablet' | 'mobile')}
            >
              <span className="vx-canvas-device-btn-icon" aria-hidden="true" />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="vx-canvas-fullscreen-btn"
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          onClick={() => setIsFullscreen((p) => !p)}
        >
          {isFullscreen ? <Minimize size={15} aria-hidden="true" /> : <Maximize size={15} aria-hidden="true" />}
        </button>
      </header>

      <div className="vx-canvas-frame-wrap">
        <iframe
          ref={iframeRef}
          className="vx-canvas-frame"
          sandbox="allow-same-origin allow-scripts"
          title="canvas"
        />
        <div className="vx-canvas-selection-overlay" aria-hidden="true" />
      </div>

      {(!doc || !doc.root) && (
        <div className="vx-canvas-empty">
          <Eye size={24} aria-hidden="true" />
          <span>Sem preview. Adicione blocos ou importe um site para começar.</span>
        </div>
      )}
    </section>
  );
}

function escapePreview(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIframeHtml(doc: SiteDocument): string {
  const renderNode = (n: SiteNode): string => {
    const style = Object.entries(n.styles).map(([k, v]) => `${camelToKebab(k)}:${v}`).join(';');
    const inner = n.children.map(renderNode).join('');
    switch (n.type) {
      case 'text':
        return `<${(n.props as Record<string, string>)?.tag ?? 'p'} data-node="${n.id}" style="${style}">${(n.props as Record<string, unknown>).content ?? ''}</${(n.props as Record<string, string>)?.tag ?? 'p'}>`;
      case 'image':
        return `<img data-node="${n.id}" src="${(n.props as Record<string, unknown>).src ?? ''}" alt="${(n.props as Record<string, unknown>).alt ?? ''}" style="${style}" />`;
      case 'button':
        return `<a data-node="${n.id}" href="${(n.props as Record<string, unknown>).href ?? '#'}" style="${style}">${(n.props as Record<string, unknown>).label ?? ''}</a>`;
      case 'section':
      case 'container':
        return `<section data-node="${n.id}" style="${style}">${inner}</section>`;
      case 'video':
        return `<div data-node="${n.id}" style="${style}">video</div>`;
      case 'faq':
        return `<details data-node="${n.id}" style="${style}"><summary>${escapePreview((n.props as Record<string, unknown>).question)}</summary><p>${escapePreview((n.props as Record<string, unknown>).answer)}</p></details>`;
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
            if(el){ el.style.outline = '2px solid var(--primary, #0e7a5c)'; selected = el; }
          } else { selected = null; }
        }
      });
      parent.postMessage({ source:'vexora-runtime', type:'ready' }, '*');
    })();
    </script>
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Inter,sans-serif;background:var(--background, #f6f7f4)}</style></head><body>${renderNode(doc.root)}${runtime}</body></html>`;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}
