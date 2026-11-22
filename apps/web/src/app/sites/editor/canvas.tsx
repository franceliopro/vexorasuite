'use client';

/**
 * Véxora Sites — Editor Visual: canvas com iframe isolado.
 * Preview do site dentro de <iframe sandbox>. O runtime injetado responde a
 * postMessage (highlight, editable, drag-source, drop-indicator) e emite
 * select/hover/ready/drag-start/drag-over/drop/drag-end de volta ao editor.
 * O HTML do iframe só muda quando o documento muda; arrastar atualiza apenas
 * mensagens e o indicador, sem remontar o preview.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SiteDocument, SiteNode } from '@/shared-types/site-document';
import { Loader2, Eye, Maximize, Minimize } from 'lucide-react';
import { DND_MIME_BLOCK, DND_MIME_NODE, isDragPayload, type DragPayload } from './dnd';
import type { DropPosition } from './site-tree';
import './editor.css';

const CANVAS = 'flex h-full w-full min-h-0 flex-col overflow-hidden bg-slate-800 text-slate-50';
const CANVAS_EMPTY = 'flex flex-1 flex-col items-center justify-center gap-2.5 text-center text-sm text-slate-200';
const CANVAS_TOOLBAR = 'flex flex-none items-center justify-between gap-2 border-b border-slate-700 bg-slate-800 px-2.5 py-1.5 text-slate-50';
const CANVAS_DEVICE_LABEL = 'text-sm font-bold text-slate-200';
const CANVAS_DEVICE_BUTTONS = 'flex gap-1';
const CANVAS_DEVICE_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-slate-200 hover:bg-slate-700';
const CANVAS_DEVICE_BUTTON_ACTIVE = 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-slate-50 hover:bg-slate-700';
const CANVAS_DEVICE_BUTTON_CLASS = {
  active: CANVAS_DEVICE_BUTTON_ACTIVE,
  idle: CANVAS_DEVICE_BUTTON,
} as const;
const CANVAS_DEVICE_ICON = 'inline-block h-3.5 w-3.5';
const CANVAS_FULLSCREEN_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-slate-200 hover:bg-slate-700';
const CANVAS_FRAME_WRAP = 'relative flex min-h-0 flex-1 justify-center overflow-auto bg-slate-800 p-3';
const CANVAS_FRAME = 'block h-full w-full rounded-lg border-0 bg-slate-900 shadow-lg';
const CANVAS_OVERLAY = 'pointer-events-none absolute inset-0 z-10';
const CANVAS_PORTAL = 'fixed inset-0 z-50 h-dvh w-screen bg-slate-900 text-slate-50';
const CANVAS_PORTAL_FRAME_WRAP = 'relative flex min-h-0 flex-1 justify-center overflow-auto bg-slate-800';
const CANVAS_PORTAL_FRAME = 'block h-full w-full border-0 bg-slate-900 shadow-lg';

interface CanvasProps {
  doc: SiteDocument;
  selectedId: string | null;
  hoverId: string | null;
  dragOverId: string | null;
  dropTarget: DropPosition | null;
  draggingNodeId?: string | null;
  editable?: boolean;
  loading: boolean;
  onSelectNode: (nodeId: string, multi: boolean) => void;
  onDragOver: (targetId: string | null, position: DropPosition | null) => void;
  onDrop: (targetId: string | null, position: DropPosition, payload?: DragPayload | null) => void;
  onNodeDragStart?: (nodeId: string) => void;
  onDragEnd?: () => void;
  device: 'desktop' | 'tablet' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'tablet' | 'mobile') => void;
}

function isDropPosition(value: unknown): value is DropPosition {
  return value === 'before' || value === 'after' || value === 'inside';
}

export function Canvas({
  doc,
  selectedId,
  hoverId,
  dragOverId,
  dropTarget,
  draggingNodeId = null,
  editable = true,
  loading,
  onSelectNode,
  onDragOver,
  onDrop,
  onNodeDragStart,
  onDragEnd,
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

  const postToFrame = useCallback((message: Record<string, unknown>) => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage({ source: 'vexora-editor', ...message }, '*');
  }, []);

  // Recebe seleções e eventos de arraste do runtime do iframe.
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (!e.data || e.data.source !== 'vexora-runtime') return;
      // Ignora mensagens de um iframe antigo após troca de doc/fullscreen.
      if (iframeRef.current?.contentWindow && e.source !== iframeRef.current.contentWindow) return;
      switch (e.data.type) {
        case 'select':
          if (typeof e.data.id === 'string') onSelectNode(e.data.id, false);
          break;
        case 'hover':
          // hover é apenas visual; o shell gerencia via selectedId quando clica.
          break;
        case 'ready':
          setReady(true);
          break;
        case 'drag-start':
          if (typeof e.data.id === 'string') onNodeDragStart?.(e.data.id);
          break;
        case 'drag-over':
          onDragOver(
            typeof e.data.targetId === 'string' ? e.data.targetId : null,
            isDropPosition(e.data.position) ? e.data.position : null,
          );
          break;
        case 'drop':
          if (typeof e.data.targetId === 'string' && isDropPosition(e.data.position)) {
            onDrop(
              e.data.targetId,
              e.data.position,
              isDragPayload(e.data.payload) ? e.data.payload : null,
            );
          }
          break;
        case 'drag-end':
          onDragEnd?.();
          break;
        default:
          break;
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onDragEnd, onDragOver, onDrop, onNodeDragStart, onSelectNode]);

  // Envia seleção atual para o iframe (highlight).
  useEffect(() => {
    if (!ready) return;
    postToFrame({ type: 'highlight', id: selectedId });
  }, [postToFrame, ready, selectedId]);

  useEffect(() => {
    if (!ready) return;
    postToFrame({ type: 'editable', enabled: editable });
  }, [editable, postToFrame, ready]);

  useEffect(() => {
    if (!ready) return;
    postToFrame({ type: 'drag-source', id: draggingNodeId });
  }, [draggingNodeId, postToFrame, ready]);

  useEffect(() => {
    if (!ready) return;
    postToFrame({ type: 'drop-indicator', targetId: dragOverId, position: dropTarget });
  }, [dragOverId, dropTarget, postToFrame, ready]);

  const deviceLabel = device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Celular';

  if (loading) {
    return (
      <section className={CANVAS} aria-label="Preview do site">
        <div className={CANVAS_EMPTY}>
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          <span>Carregando preview…</span>
        </div>
      </section>
    );
  }

  const toolbar = (
    <header className={CANVAS_TOOLBAR}>
      <span className={CANVAS_DEVICE_LABEL}>{deviceLabel}</span>
      <div className={CANVAS_DEVICE_BUTTONS}>
        {['desktop', 'tablet', 'mobile'].map((d) => (
          <button
            key={d}
            type="button"
            className={CANVAS_DEVICE_BUTTON_CLASS[d === device ? 'active' : 'idle']}
            aria-label={`Visualizar em ${d === 'desktop' ? 'desktop' : d === 'tablet' ? 'tablet' : 'celular'}`}
            onClick={() => onDeviceChange(d as 'desktop' | 'tablet' | 'mobile')}
          >
            <span className={CANVAS_DEVICE_ICON} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={CANVAS_FULLSCREEN_BUTTON}
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
      <div className={isFullscreen ? CANVAS_PORTAL_FRAME_WRAP : CANVAS_FRAME_WRAP}>
        <iframe
          ref={iframeRef}
          className={isFullscreen ? CANVAS_PORTAL_FRAME : CANVAS_FRAME}
          srcDoc={frameHtml}
          sandbox="allow-same-origin allow-scripts"
          title="canvas"
          onLoad={() => setReady(true)}
        />
        <div className={CANVAS_OVERLAY} aria-hidden="true" />
      </div>
      {(!doc || !doc.root) ? (
        <div className={CANVAS_EMPTY}>
          <Eye size={24} aria-hidden="true" />
          <span>Sem preview. Adicione blocos ou importe um site para começar.</span>
        </div>
      ) : null}
    </>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <section className={CANVAS_PORTAL} aria-label={`Preview do site em tela cheia (${device})`}>
        {toolbar}
        {frame}
      </section>,
      document.body,
    );
  }

  return (
    <section className={CANVAS} aria-label={`Preview do site (${device})`}>
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
  const renderNode = (n: SiteNode, isRoot = false): string => {
    if (n.props?.visible === false) return '';
    const style = Object.entries(n.styles).map(([k, v]) => `${camelToKebab(k)}:${escapePreview(v)}`).join(';');
    const inner = n.children.map((child) => renderNode(child)).join('');
    const locked = n.props?.locked === true;
    const container = n.type === 'section' || n.type === 'container';
    const draggable = !isRoot && !locked;
    const attrs = [
      `data-node="${escapePreview(n.id)}"`,
      `data-root="${isRoot ? 'true' : 'false'}"`,
      `data-locked="${locked ? 'true' : 'false'}"`,
      `data-container="${container ? 'true' : 'false'}"`,
      `data-draggable="${draggable ? 'true' : 'false'}"`,
      `draggable="${draggable ? 'true' : 'false'}"`,
      `style="${style}"`,
    ].join(' ');
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
      var MIME_BLOCK = ${JSON.stringify(DND_MIME_BLOCK)};
      var MIME_NODE = ${JSON.stringify(DND_MIME_NODE)};
      var editable = true;
      var selected = null;
      var draggingId = null;
      var lastTarget = null;
      var lastPosition = null;
      var indicator = null;

      function post(type, data){
        var payload = { source:'vexora-runtime', type:type };
        if (data) { for (var key in data) { if (Object.prototype.hasOwnProperty.call(data, key)) payload[key] = data[key]; } }
        parent.postMessage(payload, '*');
      }
      function byId(id){
        var nodes = document.querySelectorAll('[data-node]');
        for (var i = 0; i < nodes.length; i += 1) {
          if (nodes[i].getAttribute('data-node') === id) return nodes[i];
        }
        return null;
      }
      function nodeFrom(target){
        var node = target;
        while (node && node !== document.body) {
          if (node.getAttribute && node.getAttribute('data-node')) return node;
          node = node.parentNode;
        }
        return null;
      }
      function externalDrag(e){
        var types = e.dataTransfer && e.dataTransfer.types
          ? Array.prototype.slice.call(e.dataTransfer.types)
          : [];
        return types.indexOf(MIME_BLOCK) >= 0 || types.indexOf(MIME_NODE) >= 0;
      }
      function isInsideDragged(el){
        if (!draggingId || !el) return false;
        if (el.getAttribute('data-node') === draggingId) return true;
        var source = byId(draggingId);
        return !!(source && source.contains(el));
      }
      function positionFor(el, clientY){
        var rect = el.getBoundingClientRect();
        if (!rect.height) return 'after';
        var offset = clientY - rect.top;
        var container = el.getAttribute('data-container') === 'true' && el.getAttribute('data-locked') !== 'true';
        if (container) {
          if (offset < rect.height * 0.28) return 'before';
          if (offset > rect.height * 0.72) return 'after';
          return 'inside';
        }
        return offset < rect.height / 2 ? 'before' : 'after';
      }
      function report(targetId, position){
        if (lastTarget === targetId && lastPosition === position) return;
        lastTarget = targetId;
        lastPosition = position;
        post('drag-over', { targetId: targetId, position: position });
      }
      function dropPayload(e){
        if (!e.dataTransfer) return draggingId ? { kind:'node', nodeId:draggingId } : null;
        var rawBlock = e.dataTransfer.getData(MIME_BLOCK);
        if (rawBlock) {
          try {
            var block = JSON.parse(rawBlock);
            if (block && block.kind === 'palette' && typeof block.nodeType === 'string') return block;
          } catch (err) {}
        }
        var rawNode = e.dataTransfer.getData(MIME_NODE);
        if (rawNode) {
          try {
            var parsedNode = JSON.parse(rawNode);
            if (parsedNode && parsedNode.kind === 'node' && typeof parsedNode.nodeId === 'string') return parsedNode;
          } catch (err) {
            return { kind:'node', nodeId: rawNode };
          }
        }
        return draggingId ? { kind:'node', nodeId:draggingId } : null;
      }
      function clearIndicator(){
        if (indicator && indicator.parentNode) indicator.parentNode.removeChild(indicator);
        indicator = null;
      }
      function drawIndicator(targetId, position){
        clearIndicator();
        if (!editable || !targetId || !position) return;
        var el = byId(targetId);
        if (!el) return;
        var rect = el.getBoundingClientRect();
        indicator = document.createElement('div');
        indicator.setAttribute('data-drop-indicator', 'true');
        indicator.style.position = 'absolute';
        indicator.style.zIndex = '2147483647';
        indicator.style.pointerEvents = 'none';
        indicator.style.boxSizing = 'border-box';
        if (position === 'inside') {
          indicator.style.left = (rect.left + window.scrollX) + 'px';
          indicator.style.top = (rect.top + window.scrollY) + 'px';
          indicator.style.width = rect.width + 'px';
          indicator.style.height = rect.height + 'px';
          indicator.style.border = '2px dashed var(--primary, #0e7a5c)';
          indicator.style.background = 'var(--primary-soft, rgba(14, 122, 92, 0.12))';
        } else {
          var top = position === 'before' ? rect.top : rect.bottom - 3;
          indicator.style.left = (rect.left + window.scrollX) + 'px';
          indicator.style.top = (top + window.scrollY) + 'px';
          indicator.style.width = rect.width + 'px';
          indicator.style.height = '3px';
          indicator.style.borderRadius = '2px';
          indicator.style.background = 'var(--primary, #0e7a5c)';
        }
        document.body.appendChild(indicator);
      }

      document.addEventListener('click', function(e){
        var t = nodeFrom(e.target);
        if (!t) return;
        if (t.getAttribute('data-locked') === 'true') return;
        e.preventDefault(); e.stopPropagation(); post('select', { id: t.getAttribute('data-node') });
      }, true);
      document.addEventListener('mouseover', function(e){
        var t = nodeFrom(e.target);
        if (t) post('hover', { id: t.getAttribute('data-node') });
      });

      document.addEventListener('dragstart', function(e){
        var el = nodeFrom(e.target);
        if (!editable || !el || el.getAttribute('data-root') === 'true' ||
            el.getAttribute('data-locked') === 'true' || el.getAttribute('data-draggable') !== 'true') {
          e.preventDefault();
          return;
        }
        draggingId = el.getAttribute('data-node');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(MIME_NODE, draggingId);
        }
        e.stopPropagation();
        post('drag-start', { id: draggingId });
      }, true);

      document.addEventListener('dragover', function(e){
        if (!editable || (!draggingId && !externalDrag(e))) return;
        var el = nodeFrom(e.target);
        if (!el || isInsideDragged(el)) { report(null, null); return; }
        var position = positionFor(el, e.clientY);
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = draggingId ? 'move' : 'copy';
        report(el.getAttribute('data-node'), position);
      }, true);

      document.addEventListener('drop', function(e){
        if (!editable) return;
        var el = nodeFrom(e.target);
        if (el && !isInsideDragged(el)) {
          var position = positionFor(el, e.clientY);
          e.preventDefault();
          e.stopPropagation();
          post('drop', {
            targetId: el.getAttribute('data-node'),
            position: position,
            payload: dropPayload(e),
          });
        }
        report(null, null);
        draggingId = null;
        post('drag-end', {});
      }, true);

      document.addEventListener('dragend', function(){
        draggingId = null;
        report(null, null);
        post('drag-end', {});
      }, true);

      document.addEventListener('dragleave', function(e){
        if (!e.relatedTarget || !document.documentElement.contains(e.relatedTarget)) report(null, null);
      }, true);

      window.addEventListener('message', function(e){
        if (e.source !== parent) return;
        if (!e.data || e.data.source !== 'vexora-editor') return;
        if (e.data.type === 'highlight') {
          if (selected) selected.style.outline = '';
          selected = null;
          if (e.data.id) {
            var el = byId(e.data.id);
            if (el) { el.style.outline = '2px solid var(--primary, #0e7a5c)'; selected = el; }
          }
        } else if (e.data.type === 'editable') {
          editable = e.data.enabled !== false;
          if (!editable) { draggingId = null; report(null, null); clearIndicator(); }
        } else if (e.data.type === 'drag-source') {
          draggingId = typeof e.data.id === 'string' ? e.data.id : null;
          if (!draggingId) report(null, null);
        } else if (e.data.type === 'drop-indicator') {
          drawIndicator(e.data.targetId, e.data.position);
        }
      });
      parent.postMessage({ source:'vexora-runtime', type:'ready' }, '*');
    })();
    </script>
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Inter,sans-serif;background:var(--background, #f6f7f4)}</style></head><body>${renderNode(doc.root, true)}${runtime}</body></html>`;
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}
