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

/* Paleta do editor: utilities TW sobre tokens do preset. Os estados de
   carregamento, arraste e permissão continuam sendo props/hooks, não classes
   componente. */
const paletteTw = 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto';
const paletteHeaderTw = 'flex items-baseline justify-between border-b border-line px-4 py-3.5';
const paletteTitleTw = 'm-0 text-base font-bold text-ink';
const paletteCountTw = 'text-2xs text-ink-secondary';
const paletteSearchWrapTw = 'border-b border-line px-4 py-2.5';
const paletteSearchTw = 'w-full rounded-token-sm border border-line bg-surface-2 px-3.5 py-2 text-catalog-card-title text-ink disabled:cursor-not-allowed disabled:opacity-50';
const paletteCategoriesTw = 'flex min-h-0 flex-col gap-2.5 overflow-y-auto px-4 py-3';
const paletteCategoryTw = 'grid gap-2';
const paletteCategoryTitleTw = 'm-0 mb-2 text-2xs font-extrabold uppercase tracking-wider text-ink-secondary';
const paletteGridTw = 'grid grid-cols-fm-picker gap-2';
const paletteItemTw = 'flex cursor-grab select-none items-center gap-2 rounded-token-sm border border-line bg-surface px-3.5 py-2.5 text-catalog-card-title text-ink transition-colors hover:border-blue-600 hover:bg-brand-soft active:cursor-grabbing';
const paletteItemDraggingTw = 'border-blue-600 bg-brand-soft shadow-token-lg';
const paletteItemDisabledTw = 'pointer-events-none cursor-not-allowed opacity-50';
const paletteItemIconTw = 'inline-flex size-7 shrink-0 items-center justify-center rounded-square border border-line bg-surface-2';
const paletteItemLabelTw = 'min-w-0 truncate';
const paletteEmptyTw = 'flex flex-col items-center gap-2.5 px-4 py-10 text-ink-secondary';
const paletteDisabledTw = 'pointer-events-none';

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
      <aside className={paletteTw} aria-label="Paleta de blocos">
        <div className={paletteHeaderTw}>
          <h2 className={paletteTitleTw}>Blocos</h2>
          <span className={paletteCountTw}>0</span>
        </div>
        <div className={paletteEmptyTw}>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          <span>Carregando blocos…</span>
        </div>
      </aside>
    );
  }

  if (!blocks.length) {
    return (
      <aside className={paletteTw} aria-label="Paleta de blocos">
        <div className={paletteHeaderTw}>
          <h2 className={paletteTitleTw}>Blocos</h2>
          <span className={paletteCountTw}>0</span>
        </div>
        <div className={paletteEmptyTw}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>Nenhum bloco disponível.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className={paletteTw} aria-label="Paleta de blocos">
      <div className={paletteHeaderTw}>
        <h2 className={paletteTitleTw}>Blocos</h2>
        <span className={paletteCountTw}>{blocks.length}</span>
      </div>
      <div className={paletteSearchWrapTw}>
        <input
          type="text"
          className={paletteSearchTw}
          placeholder="Buscar bloco…"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      <div className={paletteCategoriesTw}>
        {categories.map((cat) => {
          const catBlocks = blocks.filter((b) => categoryOf(b) === cat);
          if (!catBlocks.length) return null;
          return (
            <div key={cat} className={paletteCategoryTw}>
              <h3 className={paletteCategoryTitleTw}>{categoryLabels[cat]}</h3>
              <div className={paletteGridTw}>
                {catBlocks.map((block) => (
                  <div
                    key={block.type}
                    className={`${paletteItemTw} ${disabled ? paletteItemDisabledTw : ''} ${
                      draggingType === block.type ? paletteItemDraggingTw : ''
                    }`}
                    draggable={!disabled}
                    onDragStart={(event) => handleDragStart(block.type as NodeType, event)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleAdd(block.type as NodeType)}
                    title={block.label}
                  >
                    <div className={paletteItemIconTw}>{blockIcon(block.icon)}</div>
                    <span className={paletteItemLabelTw}>{block.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {disabled && (
        <div className={`${paletteEmptyTw} ${paletteDisabledTw}`}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>Você não tem permissão para adicionar blocos.</span>
        </div>
      )}
    </aside>
  );
}
