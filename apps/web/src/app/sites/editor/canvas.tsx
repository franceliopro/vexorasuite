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

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // srcDoc controlado pelo React: o iframe pode ser remontado ao entrar/sair da
  // tela cheia e precisa receber o mesmo HTML de novo, sem depender de efeito.
  const frameHtml = useMemo(() => buildIframeHtml(doc), [doc]);

  useEffect(() => {
    setReady(false);
  }, [doc, isFullscreen]);

  // Tela cheia real: portal em document.body, travamento do scroll e saída por Esc.
  useEffect(() => {
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

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

  const toolbar = (
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
        aria-label={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
        title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
        onClick={() => setIsFullscreen((previous) => !previous)}
      >
        {isFullscreen ? <Minimize size={15} aria-hidden="true" /> : <Maximize size={15} aria-hidden="true" />}
      </button>
    </header>
  );

  const frame = (
    <>
      <div className="vx-canvas-frame-wrap">
        <iframe
          ref={iframeRef}
          className="vx-canvas-frame"
          srcDoc={frameHtml}
          sandbox="allow-same-origin allow-scripts"
          title="canvas"
          onLoad={() => setReady(true)}
        />
        <div className="vx-canvas-selection-overlay" aria-hidden="true" />
      </div>
      {(!doc || !doc.root) ? (
        <div className="vx-canvas-empty">
          <Eye size={24} aria-hidden="true" />
          <span>Sem preview. Adicione blocos ou importe um site para começar.</span>
        </div>
      ) : null}
    </>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <section className="vx-canvas vx-canvas-fullscreen-portal" aria-label={`Preview do site em tela cheia (${device})`}>
        {toolbar}
        {frame}
      </section>,
      document.body,
    );
  }

  return (
    <section className="vx-canvas" aria-label={`Preview do site (${device})`}>
      {toolbar}
      {frame}
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
    if (n.props?.visible === false) return '';
    const style = Object.entries(n.styles).map(([k, v]) => `${camelToKebab(k)}:${escapePreview(v)}`).join(';');
    const inner = n.children.map(renderNode).join('');
    const attrs = `data-node="${escapePreview(n.id)}" data-locked="${n.props?.locked === true ? 'true' : 'false'}" style="${style}"`;
    switch (n.type) {
      case 'text': {
        const wanted = String((n.props as Record<string, unknown>)?.tag ?? 'p');
        const tag = ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'strong', 'em'].includes(wanted) ? wanted : 'p';
        return `<${tag} ${attrs}>${escapePreview((n.props as Record<string, unknown>).content ?? '')}</${tag}>`;
      }
      case 'image':
        return `<img ${attrs} src="${escapePreview((n.props as Record<string, unknown>).src ?? '')}" alt="${escapePreview((n.props as Record<string, unknown>).alt ?? '')}" />`;
      case 'button':
        return `<a ${attrs} href="${escapePreview((n.props as Record<string, unknown>).href ?? '#')}">${escapePreview((n.props as Record<string, unknown>).label ?? '')}</a>`;
      case 'section':
      case 'container':
        return `<section ${attrs}>${inner}</section>`;
      case 'video':
        return `<div ${attrs}>video</div>`;
      case 'faq':
        return `<details ${attrs}><summary>${escapePreview((n.props as Record<string, unknown>).question)}</summary><p>${escapePreview((n.props as Record<string, unknown>).answer)}</p></details>`;
      default:
        return `<div ${attrs}>${inner}</div>`;
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
        if(t && t.getAttribute('data-node')){
          if(t.getAttribute('data-locked') === 'true') return;
          e.preventDefault(); e.stopPropagation(); post('select', t.getAttribute('data-node'));
        }
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
