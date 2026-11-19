'use client';

/**
 * Véxora Sites — Editor Visual: shell em tela cheia.
 *
 * Layout: topbar mínima | paleta (esquerda) + camadas | canvas (centro) | inspetor (direita).
 * Estados: seleção, hover, drag-over/drop, multiseleção, vazio, desabilitado, loading.
 * Consome os contratos existentes: shared-types (SiteNode, SiteDocument, BlockDescriptor)
 * e BLOCK_REGISTRY (schemas de props). Não define tipos próprios divergentes.
 *
 * Pontos de integração com o programador:
 *  - doc/onChange: documento e histórico (createHistory/pushHistory/undo/redo)
 *  - Canvas: doc, selectedId, onSelect, onHover (runtime de seleção via postMessage)
 *  - Inspector: schema do BLOCK_REGISTRY + onAIChange (lógica aiEditNode do programador)
 *  - onSave/onPublish/onUndo/onRedo: persistência e deploy
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SiteDocument, SiteNode } from '../../../../../../packages/shared-types/src/site-document';
import {
  BLOCK_REGISTRY,
  createNode,
  BLOCK_TYPES,
} from '../[siteId]/edit/nodes/registry';
import { Canvas } from './canvas';
import {
  createHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
} from '../[siteId]/edit/history';
import { Palette } from './palette';
import { Inspector } from './inspector';
import { LayerTree } from './layer-tree';
import {
  Save,
  Play,
  Undo,
  Redo,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import './editor.css';

interface EditorShellProps {
  siteId: string;
  doc: SiteDocument | null;
  onChange: (doc: SiteDocument) => void;
  onSave: () => void;
  onPublish: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectNode: (id: string | null, multi: boolean) => void;
  onPropChange: (nodeId: string, key: string, value: string | number | boolean) => void;
  onAIChange: (prompt: string, nodeId: string) => void;
  aiBusy: boolean;
  device: 'desktop' | 'tablet' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'tablet' | 'mobile') => void;
  disabled: boolean;
  loading: boolean;
  onClose: () => void;
}

export function EditorShell({
  siteId,
  doc,
  onChange,
  onSave,
  onPublish,
  onUndo,
  onRedo,
  onSelectNode,
  onPropChange,
  onAIChange,
  aiBusy,
  device,
  onDeviceChange,
  disabled,
  loading,
  onClose,
}: EditorShellProps) {
  const historyRef = useRef(
    doc ? createHistory(doc) : createHistory(emptyDocument()),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'info' | 'ok' | 'bad'>('info');

  const selectedNode = useMemo(() => {
    if (!doc || selectedIds.length === 0) return null;
    return findNodeById(doc.root, selectedIds[0]);
  }, [doc, selectedIds]);

  const schema = useMemo(() => {
    if (!selectedNode) return [];
    const desc = BLOCK_REGISTRY[selectedNode.type as keyof typeof BLOCK_REGISTRY];
    return desc ? desc.schema : [];
  }, [selectedNode]);

  const setDoc = useCallback((next: SiteDocument) => {
    historyRef.current = pushHistory(historyRef.current, next);
    onChange(next);
  }, [onChange]);

  // Sincroniza histórico com o doc recebido do programador
  useEffect(() => {
    if (!doc) return;
    if (
      historyRef.current.present.id !== doc.id ||
      historyRef.current.present.version !== doc.version
    ) {
      historyRef.current = createHistory(doc);
    }
  }, [doc]);

  const handleSave = useCallback(() => {
    onSave();
    setNotice('Site salvo.');
    setNoticeKind('ok');
    setTimeout(() => setNotice(''), 1500);
  }, [onSave]);

  const handlePublish = useCallback(() => {
    onPublish();
    setNotice('Publicando…');
    setNoticeKind('info');
  }, [onPublish]);

  const handleUndo = useCallback(() => {
    if (!canUndo(historyRef.current)) return;
    historyRef.current = undo(historyRef.current);
    setDoc(historyRef.current.present);
  }, [setDoc]);

  const handleRedo = useCallback(() => {
    if (!canRedo(historyRef.current)) return;
    historyRef.current = redo(historyRef.current);
    setDoc(historyRef.current.present);
  }, [setDoc]);

  const handleSelect = useCallback(
    (id: string | null, multi = false) => {
      if (!id) {
        setSelectedIds([]);
        onSelectNode(null, false);
        return;
      }
      if (multi && (selectedIds.includes(id) || selectedIds.length > 1)) {
        const next = selectedIds.includes(id)
          ? selectedIds.filter((i) => i !== id)
          : [...selectedIds, id];
        setSelectedIds(next);
        onSelectNode(next.length ? next[0] : null, true);
      } else {
        setSelectedIds([id]);
        onSelectNode(id, false);
      }
    },
    [selectedIds, onSelectNode],
  );

  const handlePropChange = useCallback(
    (key: string, value: string | number | boolean) => {
      if (!selectedNode) return;
      const next = {
        ...doc!,
        root: setNodeProp(doc!.root, selectedNode.id, key, value),
      };
      setDoc(next);
      onPropChange(selectedNode.id, key, value);
    },
    [doc, selectedNode, setDoc, onPropChange],
  );

  const handleAIChange = useCallback((prompt: string) => {
    if (!selectedNode) return;
    onAIChange(prompt, selectedNode.id);
  }, [selectedNode, onAIChange]);

  const nodeCount = useMemo(() => (doc ? countNodes(doc.root) : 0), [doc]);

  if (!doc) return null;

  return (
    <div className="vx-editor-shell" role="application" aria-label="Editor de sites Véxora">
      <header className="vx-editor-topbar">
        <div className="vx-editor-topbar-left">
          <button
            type="button"
            className="vx-editor-btn-icon"
            aria-label="Fechar editor"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <div className="vx-editor-site-info">
            <span className="vx-editor-site-id">{siteId}</span>
            <span className="vx-editor-site-title">{doc.meta.title}</span>
          </div>
        </div>

        <div className="vx-editor-topbar-center">
          <span className="vx-editor-node-count">{nodeCount} blocos</span>
        </div>

        <div className="vx-editor-topbar-right">
          <div className="vx-editor-device-group" role="group" aria-label="Dispositivo de preview">
            {['desktop', 'tablet', 'mobile'].map((d) => (
              <button
                key={d}
                type="button"
                className={`vx-editor-device-btn ${d === device ? 'is-active' : ''}`}
                aria-label={`Preview ${d}`}
                onClick={() => onDeviceChange(d)}
              >
                <span className="vx-editor-device-icon" aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`vx-editor-btn-secondary ${!canUndo(historyRef.current) || disabled || loading ? 'is-disabled' : ''}`}
            disabled={!canUndo(historyRef.current) || disabled || loading}
            onClick={handleUndo}
            title="Desfazer"
          >
            <Undo size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`vx-editor-btn-secondary ${!canRedo(historyRef.current) || disabled || loading ? 'is-disabled' : ''}`}
            disabled={!canRedo(historyRef.current) || disabled || loading}
            onClick={handleRedo}
            title="Refazer"
          >
            <Redo size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="vx-editor-btn-primary"
            disabled={disabled || loading}
            onClick={handleSave}
          >
            <Save size={15} aria-hidden="true" /> Salvar
          </button>
          <button
            type="button"
            className="vx-editor-btn-primary"
            disabled={disabled || loading}
            onClick={handlePublish}
          >
            <Play size={15} aria-hidden="true" /> Publicar
          </button>
        </div>
      </header>

      <div className="vx-editor-main">
        <aside className="vx-editor-sidebar-left">
          <Palette
            blocks={BLOCK_TYPES.map((t) => BLOCK_REGISTRY[t])}
            onAdd={(type) => {
              if (disabled || loading) return;
              const next = {
                ...doc,
                root: insertNode(doc.root, createNode(type)),
              };
              setDoc(next);
              setNotice(`Bloco "${BLOCK_REGISTRY[type as keyof typeof BLOCK_REGISTRY].label}" adicionado.`);
              setNoticeKind('ok');
              setTimeout(() => setNotice(''), 1500);
            }}
            disabled={disabled}
            loading={loading}
          />
          <LayerTree
            nodes={[doc.root]}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            disabled={disabled}
          />
        </aside>

        <main className="vx-editor-canvas-area">
          <Canvas
            doc={doc}
            selectedId={selectedIds.length ? selectedIds[0] : null}
            onSelect={handleSelect}
            onHover={() => {}}
          />
        </main>

        <aside className="vx-editor-sidebar-right">
          <Inspector
            selectedNode={selectedNode}
            schema={schema}
            onPropChange={handlePropChange}
            onAIChange={handleAIChange}
            aiBusy={aiBusy}
            disabled={disabled}
          />
        </aside>
      </div>

      {notice && (
        <div
          className={`vx-editor-notice is-${noticeKind}`}
          role="status"
          aria-live="polite"
        >
          {noticeKind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
          {noticeKind === 'bad' ? <AlertCircle size={14} aria-hidden="true" /> : null}
          <span>{notice}</span>
        </div>
      )}

      {disabled && (
        <div className="vx-editor-disabled-banner" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>Edição bloqueada — sem permissão para alterar este site.</span>
        </div>
      )}
    </div>
  );
}

function emptyDocument(): SiteDocument {
  return {
    version: 1,
    root: createNode('section', {
      props: { padding: '3rem 1rem' },
      styles: { background: 'var(--surface, #ffffff)' },
      children: [
        createNode('text', {
          props: { content: 'Novo site', tag: 'h1' },
          styles: {
            fontSize: '2rem',
            color: 'var(--text, #111827)',
            textAlign: 'center',
          },
        }),
      ],
    }),
    meta: {
      title: 'Novo site',
      type: 'static',
      theme: {
        primary: 'var(--primary, #0e7a5c)',
        secondary: 'var(--primary, #0e7a5c)',
        background: 'var(--background, #f6f7f4)',
        text: 'var(--text, #161a17)',
        fontHeading: 'Inter',
        fontBody: 'Inter',
      },
    },
  };
}

function findNodeById(root: SiteNode, id: string): SiteNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function setNodeProp(
  node: SiteNode,
  id: string,
  key: string,
  value: string | number | boolean,
): SiteNode {
  if (node.id === id) {
    return { ...node, props: { ...node.props, [key]: value } };
  }
  return {
    ...node,
    children: node.children.map((c) => setNodeProp(c, id, key, value)),
  };
}

function insertNode(root: SiteNode, node: SiteNode): SiteNode {
  return { ...root, children: [...root.children, node] };
}

function countNodes(node: SiteNode): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}
