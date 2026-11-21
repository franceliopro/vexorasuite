'use client';

/**
 * Véxora Sites — Editor Visual: paleta de blocos à esquerda do canvas.
 * Renderiza os descritores do BLOCK_REGISTRY. Blocos podem ser clicados ou
 * arrastados para o canvas/árvore de camadas; o clique permanece como fallback.
 */

import { useCallback, useState } from 'react';
import type { BlockDescriptor, NodeType } from '@/shared-types/site-document';
import { Layout, AlertCircle, Loader2 } from 'lucide-react';
import { writeDragPayload } from './dnd';
import './editor.css';

const ICONS: Record<string, React.ElementType> = {
  layout: Layout,
  type: Layout,
  image: Layout,
  square: Layout,
  mail: Layout,
  list: Layout,
  shoppingBag: Layout,
  play: Layout,
  box: Layout,
};

function blockIcon(name: string) {
  const Icon = ICONS[name] || Layout;
  return <Icon size={16} aria-hidden="true" />;
}

interface PaletteProps {
  blocks: BlockDescriptor[];
  onAdd: (type: NodeType) => void;
  onDragStart?: (type: NodeType, event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Palette({
  blocks,
  onAdd,
  onDragStart,
  onDragEnd,
  disabled = false,
  loading = false,
}: PaletteProps) {
  const categories = ['layout', 'content', 'media', 'commerce'] as const;
  const categoryLabels: Record<string, string> = {
    layout: 'Estrutura',
    content: 'Conteúdo',
    media: 'Mídia',
    commerce: 'Comércio',
  };
  const [draggingType, setDraggingType] = useState<NodeType | null>(null);

  function categoryOf(block: BlockDescriptor): (typeof categories)[number] {
    const c = block.category as (typeof categories)[number] | undefined;
    if (c) return c;
    const t = block.type;
    if (t === 'section' || t === 'container' || t === 'div' || t === 'header' ||
        t === 'footer' || t === 'aside' || t === 'hero' || t === 'columns') return 'layout';
    if (t === 'text' || t === 'heading' || t === 'button' || t === 'form' ||
        t === 'post-list' || t === 'faq') return 'content';
    if (t === 'image' || t === 'video' || t === 'image-text') return 'media';
    if (t === 'product-grid') return 'commerce';
    return 'content';
  }

  const handleAdd = useCallback(
    (type: NodeType) => {
      if (disabled) return;
      onAdd(type);
    },
    [disabled, onAdd],
  );

  const handleDragStart = useCallback(
    (type: NodeType, event: React.DragEvent<HTMLDivElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      writeDragPayload(event.dataTransfer, { kind: 'palette', nodeType: type }, String(type));
      setDraggingType(type);
      onDragStart?.(type, event);
    },
    [disabled, onDragStart],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingType(null);
    onDragEnd?.();
  }, [onDragEnd]);

  if (loading) {
    return (
      <aside className="vx-palette vx-palette-loading" aria-label="Paleta de blocos">
        <div className="vx-palette-header">
          <h2 className="vx-palette-title">Blocos</h2>
          <span className="vx-palette-count">0</span>
        </div>
        <div className="vx-palette-empty">
          <Loader2 size={18} className="vx-spin" aria-hidden="true" />
          <span>Carregando blocos…</span>
        </div>
      </aside>
    );
  }

  if (!blocks.length) {
    return (
      <aside className="vx-palette vx-palette-empty-state" aria-label="Paleta de blocos">
        <div className="vx-palette-header">
          <h2 className="vx-palette-title">Blocos</h2>
          <span className="vx-palette-count">0</span>
        </div>
        <div className="vx-palette-empty">
          <AlertCircle size={16} aria-hidden="true" />
          <span>Nenhum bloco disponível.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="vx-palette" aria-label="Paleta de blocos">
      <div className="vx-palette-header">
        <h2 className="vx-palette-title">Blocos</h2>
        <span className="vx-palette-count">{blocks.length}</span>
      </div>
      <div className="vx-palette-search-wrap">
        <input
          type="text"
          className="vx-palette-search"
          placeholder="Buscar bloco…"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      <div className="vx-palette-categories">
        {categories.map((cat) => {
          const catBlocks = blocks.filter((b) => categoryOf(b) === cat);
          if (!catBlocks.length) return null;
          return (
            <div key={cat} className="vx-palette-category">
              <h3 className="vx-palette-category-title">{categoryLabels[cat]}</h3>
              <div className="vx-palette-grid">
                {catBlocks.map((block) => (
                  <div
                    key={block.type}
                    className={`vx-palette-item ${disabled ? 'vx-palette-item-disabled' : ''} ${
                      draggingType === block.type ? 'vx-palette-item-dragging' : ''
                    }`}
                    draggable={!disabled}
                    onDragStart={(event) => handleDragStart(block.type as NodeType, event)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleAdd(block.type as NodeType)}
                    title={block.label}
                  >
                    <div className="vx-palette-item-icon">{blockIcon(block.icon)}</div>
                    <span className="vx-palette-item-label">{block.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {disabled && (
        <div className="vx-palette-empty vx-palette-disabled">
          <AlertCircle size={16} aria-hidden="true" />
          <span>Você não tem permissão para adicionar blocos.</span>
        </div>
      )}
    </aside>
  );
}
