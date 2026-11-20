'use client';

/**
 * Véxora Sites — Editor Visual: árvore de camadas.
 * Mostra a árvore de nós do site com seleção simples/múltipla, visibilidade, bloqueio
 * e reordenação por arraste. Acessibilidade: role="tree", aria-selected,
 * aria-expanded, navegação por teclado. Consome shared-types (SiteNode).
 */

import { useCallback, useState } from 'react';
import type { SiteNode } from '@/shared-types/site-document';
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import { readDragPayload, writeDragPayload, type DragPayload } from './dnd';
import {
  canReceiveChildren,
  isDescendantId,
  isEffectivelyLocked,
  isNodeLocked,
  type DropPosition,
} from './site-tree';
import './editor.css';

const NODE_LABELS: Record<string, string> = {
  section: 'Seção',
  container: 'Container',
  text: 'Texto',
  image: 'Imagem',
  button: 'Botão',
  form: 'Formulário',
  'post-list': 'Posts',
  'product-grid': 'Produtos',
  video: 'Vídeo',
};

interface LayerTreeProps {
  nodes: SiteNode[];
  selectedIds: string[];
  onSelect: (id: string, multi: boolean) => void;
  onToggleVisibility?: (id: string, visible: boolean) => void;
  onLock?: (id: string, locked: boolean) => void;
  /** Transient busy state (save/publish). Selection must keep working. */
  disabled?: boolean;
  /** Real permission state. Only this produces the read-only message. */
  readOnly?: boolean;
  rootId?: string | null;
  draggingNodeId?: string | null;
  onDragNodeStart?: (nodeId: string, event: React.DragEvent<HTMLLIElement>) => void;
  onDragTarget?: (targetId: string, position: DropPosition) => void;
  onDragTargetClear?: () => void;
  onDropNode?: (targetId: string, position: DropPosition, payload?: DragPayload | null) => void;
  onDragEnd?: () => void;
}

interface DropState {
  id: string;
  position: DropPosition;
}

export function LayerTree({
  nodes,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onLock,
  disabled = false,
  readOnly = false,
  rootId = null,
  draggingNodeId = null,
  onDragNodeStart,
  onDragTarget,
  onDragTargetClear,
  onDropNode,
  onDragEnd,
}: LayerTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const effectiveLocked = useCallback(
    (id: string) => nodes.some((root) => isEffectivelyLocked(root, id)),
    [nodes],
  );

  const canDrag = useCallback(
    (node: SiteNode) => !readOnly && !disabled && node.id !== rootId && !effectiveLocked(node.id),
    [disabled, effectiveLocked, readOnly, rootId],
  );

  const canDropOn = useCallback(
    (node: SiteNode) => {
      if (readOnly || disabled || effectiveLocked(node.id)) return false;
      if (!draggingNodeId && !dragId) return true;
      const sourceId = draggingNodeId ?? dragId;
      if (!sourceId || sourceId === node.id) return false;
      return !nodes.some((root) => isDescendantId(root, sourceId, node.id));
    },
    [disabled, dragId, draggingNodeId, effectiveLocked, nodes, readOnly],
  );

  const clearDrop = useCallback(() => {
    setDrop(null);
    onDragTargetClear?.();
  }, [onDragTargetClear]);

  const clearDrag = useCallback(() => {
    setDragId(null);
    clearDrop();
    onDragEnd?.();
  }, [clearDrop, onDragEnd]);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLLIElement>, node: SiteNode) => {
      if (!canDropOn(node)) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      const offset = event.clientY - rect.top;
      const allowInside = canReceiveChildren(node) && !isNodeLocked(node);
      const position: DropPosition =
        allowInside && offset > rect.height * 0.3 && offset < rect.height * 0.7
          ? 'inside'
          : offset < rect.height / 2
            ? 'before'
            : 'after';
      setDrop((previous) =>
        previous?.id === node.id && previous.position === position
          ? previous
          : { id: node.id, position },
      );
      onDragTarget?.(node.id, position);
    },
    [canDropOn, onDragTarget],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLIElement>, node: SiteNode) => {
      event.preventDefault();
      event.stopPropagation();
      if (canDropOn(node)) {
        const rect = event.currentTarget.getBoundingClientRect();
        const offset = event.clientY - rect.top;
        const allowInside = canReceiveChildren(node) && !isNodeLocked(node);
        const position: DropPosition =
          allowInside && offset > rect.height * 0.3 && offset < rect.height * 0.7
            ? 'inside'
            : offset < rect.height / 2
              ? 'before'
              : 'after';
        onDropNode?.(node.id, position, readDragPayload(event.dataTransfer));
      }
      clearDrag();
    },
    [canDropOn, clearDrag, onDropNode],
  );

  const handleSelect = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, multi = false) => {
      e.preventDefault();
      e.stopPropagation();
      if (multi && (e.ctrlKey || e.metaKey || e.shiftKey)) {
        onSelect(id, true);
      } else {
        onSelect(id, false);
      }
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(id, e, true);
      }
    },
    [handleSelect],
  );

  return (
    <section className="vx-layer-tree" aria-label="Camadas do site">
      <header className="vx-layer-tree-head">
        <h2 className="vx-layer-tree-title">Camadas</h2>
        <span className="vx-layer-tree-count">{nodes.length}</span>
      </header>
      <div className="vx-layer-tree-scroll" onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDrop();
      }}>
        <ul role="tree" aria-multiselectable={true} className="vx-layer-tree-list">
          {nodes.map((node) => (
            <LayerTreeNode
              key={node.id}
              node={node}
              depth={0}
              isSelected={isSelected}
              expanded={!!expanded[node.id]}
              onSelect={(id, e, multi) => handleSelect(id, e, multi)}
              expandedMap={expanded}
              onVisibility={(id, v) => onToggleVisibility?.(id, v)}
              onLock={(id, l) => onLock?.(id, l)}
              onToggleExpanded={toggleExpanded}
              onKeyDown={(e) => handleKeyDown(e, node.id)}
              disabled={disabled}
              readOnly={readOnly}
              canDragNode={canDrag}
              dragActiveId={draggingNodeId ?? dragId}
              drop={drop}
              onDragStartNode={(dragged, event) => {
                writeDragPayload(
                  event.dataTransfer,
                  { kind: 'node', nodeId: dragged.id },
                  NODE_LABELS[dragged.type] || dragged.type,
                );
                setDragId(dragged.id);
                onDragNodeStart?.(dragged.id, event);
              }}
              onDragOverNode={handleDragOver}
              onDropNode={handleDrop}
              onDragEnd={clearDrag}
            />
          ))}
        </ul>
      </div>
      {readOnly ? (
        <div className="vx-layer-tree-empty" role="status">
          <Eye size={16} aria-hidden="true" />
          <span>Somente leitura: selecione blocos para inspecionar.</span>
        </div>
      ) : null}
    </section>
  );
}

interface LayerTreeNodeProps {
  node: SiteNode;
  depth: number;
  isSelected: (id: string) => boolean;
  expanded: boolean;
  expandedMap: Record<string, boolean>;
  onSelect: (id: string, e: React.MouseEvent | React.KeyboardEvent, multi: boolean) => void;
  onVisibility: (id: string, visible: boolean) => void;
  onLock: (id: string, locked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled: boolean;
  readOnly: boolean;
  canDragNode: (node: SiteNode) => boolean;
  dragActiveId: string | null;
  drop: DropState | null;
  onDragStartNode: (node: SiteNode, event: React.DragEvent<HTMLLIElement>) => void;
  onDragOverNode: (event: React.DragEvent<HTMLLIElement>, node: SiteNode) => void;
  onDropNode: (
    event: React.DragEvent<HTMLLIElement>,
    node: SiteNode,
  ) => void;
  onDragEnd: () => void;
}

function LayerTreeNode({
  node,
  depth,
  isSelected,
  expanded,
  expandedMap,
  onSelect,
  onVisibility,
  onLock,
  onToggleExpanded,
  onKeyDown,
  disabled,
  readOnly,
  canDragNode,
  dragActiveId,
  drop,
  onDragStartNode,
  onDragOverNode,
  onDropNode,
  onDragEnd,
}: LayerTreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const visible = node.props.visible !== false;
  const locked = node.props.locked === true;
  const draggable = canDragNode(node);
  const dragActive = dragActiveId === node.id;
  const dropState = drop?.id === node.id ? drop.position : null;
  const dropClass = dropState ? `is-drop-${dropState}` : '';

  return (
    <li
      role="treeitem"
      aria-selected={isSelected(node.id)}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={0}
      draggable={draggable}
      className={`vx-layer-tree-node ${isSelected(node.id) ? 'is-selected' : ''} ${
        disabled ? 'is-busy' : ''
      } ${readOnly ? 'is-readonly' : ''} ${dragActive ? 'is-dragging' : ''} ${dropClass}`}
      style={{ paddingLeft: 16 + depth * 18 }}
      onClick={(e) => onSelect(node.id, e, false)}
      onKeyDown={onKeyDown}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        onDragStartNode(node, event);
      }}
      onDragOver={(event) => onDragOverNode(event, node)}
      onDrop={(event) => onDropNode(event, node)}
      onDragEnd={onDragEnd}
    >
      <div className="vx-layer-tree-node-content">
        {hasChildren ? (
          <button
            type="button"
            className="vx-layer-tree-expand"
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
            draggable={false}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpanded(node.id);
            }}
          >
            {expanded ? (
              <ChevronDown size={14} aria-hidden="true" />
            ) : (
              <ChevronRight size={14} aria-hidden="true" />
            )}
          </button>
        ) : (
          <div className="vx-layer-tree-expand-placeholder" />
        )}
        <div className="vx-layer-tree-node-controls">
          <button
            type="button"
            className="vx-layer-tree-node-visibility"
            aria-label={readOnly ? 'Somente leitura: visibilidade indisponível' : visible ? 'Ocultar' : 'Mostrar'}
            title={readOnly ? 'Somente leitura' : visible ? 'Ocultar bloco' : 'Mostrar bloco'}
            disabled={disabled}
            draggable={false}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) onVisibility(node.id, !visible);
            }}
          >
            {visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="vx-layer-tree-node-lock"
            aria-label={readOnly ? 'Somente leitura: bloqueio indisponível' : locked ? 'Desbloquear' : 'Bloquear'}
            title={readOnly ? 'Somente leitura' : locked ? 'Desbloquear bloco' : 'Bloquear bloco'}
            disabled={disabled}
            draggable={false}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) onLock(node.id, !locked);
            }}
          >
            {locked ? <Lock size={13} aria-hidden="true" /> : <Unlock size={13} aria-hidden="true" />}
          </button>
        </div>
        <span className="vx-layer-tree-node-label">{NODE_LABELS[node.type] || node.type}</span>
        <span className="vx-layer-tree-node-id">{node.id.slice(0, 6)}</span>
        {locked ? <span className="vx-layer-tree-node-disabled-tag">bloqueado</span> : null}
      </div>
      {hasChildren && expanded && (
        <ul role="group" className="vx-layer-tree-children">
          {node.children.map((child) => (
            <LayerTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isSelected={isSelected}
              expanded={!!expandedMap[child.id]}
              expandedMap={expandedMap}
              onSelect={onSelect}
              onVisibility={onVisibility}
              onLock={onLock}
              onToggleExpanded={onToggleExpanded}
              onKeyDown={onKeyDown}
              disabled={disabled}
              readOnly={readOnly}
              canDragNode={canDragNode}
              dragActiveId={dragActiveId}
              drop={drop}
              onDragStartNode={onDragStartNode}
              onDragOverNode={onDragOverNode}
              onDropNode={onDropNode}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
