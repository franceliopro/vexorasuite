'use client';

/**
 * Véxora Sites — Editor Visual: árvore de camadas.
 * Mostra a árvore de nós do site com seleção simples/múltipla, visibilidade e bloqueio por nó.
 * Acessibilidade: role="tree", aria-selected, aria-expanded, navegação por teclado.
 * Consome shared-types (SiteNode). Sem tipos próprios.
 * Classes CSS em editor.css (tokens Véxora, sem hex direto).
 */

import { useCallback, useState } from 'react';
import type { SiteNode } from '../../../../../../packages/shared-types/src/site-document';
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
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
  disabled?: boolean;
}

export function LayerTree({
  nodes,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onLock,
  disabled = false,
}: LayerTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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

  const handleVisibility = useCallback(
    (id: string, visible: boolean, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleVisibility?.(id, visible);
    },
    [onToggleVisibility],
  );

  const handleLock = useCallback(
    (id: string, locked: boolean, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onLock?.(id, locked);
    },
    [onLock],
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
      <div className="vx-layer-tree-scroll">
        <ul role="tree" aria-multiselectable={true} className="vx-layer-tree-list">
          {nodes.map((node) => (
            <LayerTreeNode
              key={node.id}
              node={node}
              depth={0}
              isSelected={isSelected(node.id)}
              expanded={!!expanded[node.id]}
              onSelect={(id, e, multi) => handleSelect(id, e, multi)}
              onVisibility={(id, v) => handleVisibility(id, v, e as React.MouseEvent)}
              onLock={(id, l) => handleLock(id, l, e as React.MouseEvent)}
              onToggleExpanded={() => toggleExpanded(node.id)}
              onKeyDown={(e) => handleKeyDown(e, node.id)}
              disabled={disabled}
            />
          ))}
        </ul>
      </div>
      {disabled && (
        <div className="vx-layer-tree-empty">
          <Lock size={16} aria-hidden="true" />
          <span>Edição bloqueada — sem permissão.</span>
        </div>
      )}
    </section>
  );
}

interface LayerTreeNodeProps {
  node: SiteNode;
  depth: number;
  isSelected: boolean;
  expanded: boolean;
  onSelect: (id: string, e: any, multi: boolean) => void;
  onVisibility: (id: string, visible: boolean) => void;
  onLock: (id: string, locked: boolean) => void;
  onToggleExpanded: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled: boolean;
}

function LayerTreeNode({
  node,
  depth,
  isSelected,
  expanded,
  onSelect,
  onVisibility,
  onLock,
  onToggleExpanded,
  onKeyDown,
  disabled,
}: LayerTreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const visible = node.props.visible !== false;
  const locked = node.props.locked === true;

  return (
    <li
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={0}
      className={`vx-layer-tree-node ${isSelected ? 'is-selected' : ''} ${
        disabled ? 'is-disabled' : ''
      }`}
      style={{ paddingLeft: 16 + depth * 18 }}
      onClick={(e) => onSelect(node.id, e, false)}
      onKeyDown={onKeyDown}
    >
      <div className="vx-layer-tree-node-content">
        {hasChildren ? (
          <button
            type="button"
            className="vx-layer-tree-expand"
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpanded();
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
            aria-label={visible ? 'Ocultar' : 'Mostrar'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onVisibility(node.id, !visible);
            }}
          >
            {visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}
          </button>
          {disabled ? (
            <Lock size={13} aria-hidden="true" />
          ) : (
            <button
              type="button"
              className="vx-layer-tree-node-lock"
              aria-label={locked ? 'Desbloquear' : 'Bloquear'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onLock(node.id, !locked);
              }}
            >
              {locked ? <Lock size={13} aria-hidden="true" /> : <Unlock size={13} aria-hidden="true" />}
            </button>
          )}
        </div>
        <span className="vx-layer-tree-node-label">{NODE_LABELS[node.type] || node.type}</span>
        <span className="vx-layer-tree-node-id">{node.id.slice(0, 6)}</span>
        {disabled && <span className="vx-layer-tree-node-disabled-tag">bloqueado</span>}
      </div>
      {hasChildren && expanded && (
        <ul role="group" className="vx-layer-tree-children">
          {node.children.map((child) => (
            <LayerTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isSelected={isSelected(child.id)}
              expanded={!!expanded[child.id]}
              onSelect={onSelect}
              onVisibility={onVisibility}
              onLock={onLock}
              onToggleExpanded={() => toggleExpanded(child.id)}
              onKeyDown={onKeyDown}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
