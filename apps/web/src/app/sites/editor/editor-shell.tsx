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
import type { SiteDocument, SiteNode } from '@/shared-types/site-document';
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
import type { DragPayload, DragTarget } from './dnd';
import {
  appendNode,
  findNodeById,
  insertNodeAt,
  moveNode,
  replaceNodeById,
  type DropPosition,
} from './site-tree';
import {
  Save,
  Play,
  Undo,
  Redo,
  X,
  Minimize2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import './editor.css';

interface EditorShellProps {
  siteId: string;
  doc: SiteDocument | null;
  onChange: (doc: SiteDocument) => void;
  /** Retorna false quando a persistência falhou, para o aviso não mentir. */
  onSave: () => void | Promise<boolean | void>;
  onPublish: () => void;
  onMinimize?: () => void;
  dirty?: boolean;
  onSelectNode: (id: string | null, multi: boolean) => void;
  onPropChange: (nodeId: string, key: string, value: string | number | boolean) => void;
  onAIChange: (prompt: string, nodeId: string) => void;
  aiBusy: boolean;
  /** Resultado do patch da IA, exibido ao lado do prompt e na barra da janela. */
  aiFeedback?: { text: string; error: boolean } | null;
  device: 'desktop' | 'tablet' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'tablet' | 'mobile') => void;
  /** Permissão real do usuário. Não deve ser trocada por saving/publishing. */
  readOnly: boolean;
  /** Estados transitórios: bloqueiam alterações enquanto duram, sem alegar falta de permissão. */
  saving?: boolean;
  publishing?: boolean;
  loading: boolean;
  onClose: () => void;
}

export function EditorShell({
  siteId,
  doc,
  onChange,
  onSave,
  onPublish,
  onMinimize,
  dirty = false,
  onSelectNode,
  onPropChange,
  onAIChange,
  aiBusy,
  aiFeedback = null,
  device,
  onDeviceChange,
  readOnly,
  saving = false,
  publishing = false,
  loading,
  onClose,
}: EditorShellProps) {
  // Saving/publishing are transient. Only readOnly means "sem permissão".
  const interactionDisabled = readOnly || loading || saving || publishing;
  const historyRef = useRef(
    doc ? createHistory(doc) : createHistory(emptyDocument()),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePageSlug, setActivePageSlug] = useState<string>('__home__');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'info' | 'ok' | 'bad'>('info');
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>({ targetId: null, position: null });

  const pages = useMemo(() => doc?.pages ?? [], [doc]);
  const activePage = useMemo(
    () => pages.find((page) => page.slug === activePageSlug) ?? null,
    [pages, activePageSlug],
  );
  const activeRoot = activePage?.root ?? doc?.root ?? null;

  useEffect(() => {
    setSelectedIds([]);
  }, [activePageSlug]);

  const selectedNode = useMemo(() => {
    if (!activeRoot || selectedIds.length === 0) return null;
    const firstId = selectedIds[0];
    if (!firstId) return null;
    return findNodeById(activeRoot, firstId);
  }, [activeRoot, selectedIds]);

  const canvasDoc = useMemo(
    () => (doc && activeRoot ? { ...doc, root: activeRoot } : doc),
    [doc, activeRoot],
  );

  const withActiveRoot = useCallback(
    (nextRoot: SiteNode): SiteDocument => {
      const current = doc!;
      if (!activePage) return { ...current, root: nextRoot };
      return {
        ...current,
        pages: (current.pages ?? []).map((page) =>
          page.slug === activePage.slug ? { ...page, root: nextRoot } : page,
        ),
      };
    },
    [doc, activePage],
  );

  const schema = useMemo(() => {
    if (!selectedNode) return [];
    const desc = BLOCK_REGISTRY[selectedNode.type as keyof typeof BLOCK_REGISTRY];
    return desc ? desc.schema : [];
  }, [selectedNode]);

  const setDoc = useCallback((next: SiteDocument) => {
    historyRef.current = pushHistory(historyRef.current, next);
    onChange(next);
  }, [onChange]);

  const notify = useCallback((text: string, kind: 'info' | 'ok' | 'bad' = 'info') => {
    setNotice(text);
    setNoticeKind(kind);
    setTimeout(() => setNotice(''), 1800);
  }, []);

  const setPayload = useCallback((payload: DragPayload | null) => {
    dragPayloadRef.current = payload;
    setDragPayload(payload);
    if (!payload) setDragTarget({ targetId: null, position: null });
  }, []);

  const clearDrag = useCallback(() => {
    dragPayloadRef.current = null;
    setDragPayload(null);
    setDragTarget({ targetId: null, position: null });
  }, []);

  const clearDragTarget = useCallback(() => {
    setDragTarget({ targetId: null, position: null });
  }, []);

  useEffect(() => {
    if (readOnly || interactionDisabled) clearDrag();
  }, [clearDrag, interactionDisabled, readOnly]);

  // Sincroniza histórico com o doc recebido do programador
  useEffect(() => {
    if (!doc) return;
    if (
      historyRef.current.present !== doc
    ) {
      historyRef.current = createHistory(doc);
    }
  }, [doc]);

  const handleSave = useCallback(async () => {
    let saved = true;
    try {
      saved = (await onSave()) !== false;
    } catch {
      saved = false;
    }
    setNotice(saved ? 'Site salvo.' : 'Não foi possível salvar. Tente novamente.');
    setNoticeKind(saved ? 'ok' : 'bad');
    setTimeout(() => setNotice(''), 2500);
  }, [onSave]);

  const handlePublish = useCallback(() => {
    if (readOnly || loading || saving || publishing) return;
    onPublish();
    setNotice('Publicando…');
    setNoticeKind('info');
  }, [loading, onPublish, publishing, readOnly, saving]);

  // Undo/redo já move o ponteiro do histórico: avisar o pai sem empurrar um novo snapshot,
  // senão desfazer viraria uma entrada nova e o botão nunca esvaziaria a pilha.
  const handleUndo = useCallback(() => {
    if (!canUndo(historyRef.current)) return;
    historyRef.current = undo(historyRef.current);
    onChange(historyRef.current.present);
  }, [onChange]);

  const handleRedo = useCallback(() => {
    if (!canRedo(historyRef.current)) return;
    historyRef.current = redo(historyRef.current);
    onChange(historyRef.current.present);
  }, [onChange]);

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
        onSelectNode(next.length ? next[0] ?? null : null, true);
      } else {
        setSelectedIds([id]);
        onSelectNode(id, false);
      }
    },
    [selectedIds, onSelectNode],
  );

  const applyDrop = useCallback(
    (
      targetId: string | null,
      position: DropPosition,
      payloadOverride?: DragPayload | null,
    ) => {
      // O drop dentro do iframe carrega o payload na mensagem para não sofrer
      // corrida com o dragend que limpa o estado transitório no painel.
      const payload = payloadOverride !== undefined ? payloadOverride : dragPayloadRef.current;
      if (!payload || !targetId || !activeRoot || readOnly || interactionDisabled) return;

      let nextRoot: SiteNode;
      let selectedId: string | null = null;
      let message = '';

      if (payload.kind === 'palette') {
        const node = createNode(payload.nodeType);
        nextRoot = insertNodeAt(activeRoot, node, targetId, position);
        if (nextRoot === activeRoot) {
          notify('Não foi possível adicionar o bloco nesse local.', 'bad');
          clearDrag();
          return;
        }
        selectedId = node.id;
        message = `Bloco "${BLOCK_REGISTRY[payload.nodeType as keyof typeof BLOCK_REGISTRY].label}" adicionado.`;
      } else {
        nextRoot = moveNode(activeRoot, payload.nodeId, targetId, position);
        if (nextRoot === activeRoot) {
          notify('Não foi possível mover o bloco para esse local.', 'bad');
          clearDrag();
          return;
        }
        selectedId = payload.nodeId;
        message = 'Bloco movido.';
      }

      setDoc(withActiveRoot(nextRoot));
      handleSelect(selectedId, false);
      notify(message, 'ok');
      clearDrag();
    },
    [activeRoot, clearDrag, handleSelect, interactionDisabled, notify, readOnly, setDoc, withActiveRoot],
  );

  const handlePropChange = useCallback(
    (key: string, value: string | number | boolean) => {
      if (!selectedNode) return;
      const next = withActiveRoot(setNodeProp(activeRoot!, selectedNode.id, key, value));
      setDoc(next);
      onPropChange(selectedNode.id, key, value);
    },
    [activeRoot, selectedNode, setDoc, onPropChange, withActiveRoot],
  );

  const handleNodeProp = useCallback(
    (nodeId: string, key: string, value: string | number | boolean) => {
      if (readOnly || interactionDisabled || !activeRoot) return;
      setDoc(withActiveRoot(setNodeProp(activeRoot, nodeId, key, value)));
    },
    [activeRoot, interactionDisabled, readOnly, setDoc, withActiveRoot],
  );

  const handleAIChange = useCallback((prompt: string) => {
    if (!selectedNode || readOnly || interactionDisabled) return;
    onAIChange(prompt, selectedNode.id);
  }, [interactionDisabled, onAIChange, readOnly, selectedNode]);

  const nodeCount = useMemo(() => (activeRoot ? countNodes(activeRoot) : 0), [activeRoot]);

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
          {onMinimize ? (
            <button
              type="button"
              className="vx-editor-btn-icon"
              aria-label="Minimizar editor"
              title="Minimizar para a interface da Véxora"
              onClick={onMinimize}
            >
              <Minimize2 size={16} aria-hidden="true" />
            </button>
          ) : null}
          <div className="vx-editor-site-info">
            <span className="vx-editor-site-id">v{doc.version}{dirty ? ' • não salvo' : ''}</span>
            <span className="vx-editor-site-title" title={siteId}>{doc.meta.title}</span>
          </div>
        </div>

        <div className="vx-editor-topbar-center">
          <label htmlFor="vx-editor-page" style={{ fontSize: '0.75rem', fontWeight: 600, marginRight: 6 }}>
            Página
          </label>
          <select
            id="vx-editor-page"
            value={activePageSlug}
            onChange={(event) => setActivePageSlug(event.target.value)}
            disabled={loading}
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--border, #e5e8ef)',
              borderRadius: 8,
              color: 'var(--text, #101d33)',
              fontSize: '0.8125rem',
              maxWidth: 220,
              padding: '0.35rem 0.5rem',
            }}
          >
            <option value="__home__">Início (index)</option>
            {pages.map((page) => (
              <option key={page.slug} value={page.slug}>
                {page.title}{page.kind === 'legal' ? ' · rascunho legal' : ''}
              </option>
            ))}
          </select>
          <span className="vx-editor-node-count">{nodeCount} blocos</span>
        </div>

        <div className="vx-editor-topbar-right">
          <div className="vx-editor-device-group" role="group" aria-label="Dispositivo de preview">
            {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
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
            className={`vx-editor-btn-secondary ${!canUndo(historyRef.current) || interactionDisabled ? 'is-disabled' : ''}`}
            disabled={!canUndo(historyRef.current) || interactionDisabled}
            onClick={handleUndo}
            title="Desfazer"
          >
            <Undo size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`vx-editor-btn-secondary ${!canRedo(historyRef.current) || interactionDisabled ? 'is-disabled' : ''}`}
            disabled={!canRedo(historyRef.current) || interactionDisabled}
            onClick={handleRedo}
            title="Refazer"
          >
            <Redo size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="vx-editor-btn-primary"
            disabled={readOnly || loading || saving}
            onClick={() => void handleSave()}
            title={readOnly ? 'Somente leitura' : saving ? 'Salvando…' : undefined}
          >
            {saving ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            className="vx-editor-btn-primary"
            disabled={readOnly || loading || saving || publishing}
            onClick={handlePublish}
            title={readOnly ? 'Somente leitura' : publishing ? 'Publicando…' : saving ? 'Aguarde o salvamento' : undefined}
          >
            {publishing ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {publishing ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </header>

      <div className="vx-editor-main">
        <aside className="vx-editor-sidebar-left">
          <Palette
            blocks={BLOCK_TYPES.map((t) => BLOCK_REGISTRY[t])}
            onAdd={(type) => {
              if (interactionDisabled || !activeRoot) return;
              const node = createNode(type);
              setDoc(withActiveRoot(appendNode(activeRoot, node)));
              handleSelect(node.id, false);
              notify(`Bloco "${BLOCK_REGISTRY[type as keyof typeof BLOCK_REGISTRY].label}" adicionado.`, 'ok');
            }}
            onDragStart={(type) => setPayload({ kind: 'palette', nodeType: type })}
            onDragEnd={clearDrag}
            disabled={interactionDisabled}
            loading={loading}
          />
          <LayerTree
            nodes={activeRoot ? [activeRoot] : []}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onToggleVisibility={(nodeId, visible) => handleNodeProp(nodeId, 'visible', visible)}
            onLock={(nodeId, locked) => handleNodeProp(nodeId, 'locked', locked)}
            rootId={activeRoot?.id ?? null}
            draggingNodeId={dragPayload?.kind === 'node' ? dragPayload.nodeId : null}
            onDragNodeStart={(nodeId) => setPayload({ kind: 'node', nodeId })}
            onDragTarget={(targetId, position) => setDragTarget({ targetId, position })}
            onDragTargetClear={clearDragTarget}
            onDropNode={applyDrop}
            onDragEnd={clearDrag}
            disabled={interactionDisabled}
            readOnly={readOnly}
          />
        </aside>

        <main className="vx-editor-canvas-area">
          <Canvas
            doc={canvasDoc ?? doc}
            selectedId={selectedIds.length ? selectedIds[0] ?? null : null}
            hoverId={null}
            dragOverId={dragTarget.targetId}
            dropTarget={dragTarget.position}
            draggingNodeId={dragPayload?.kind === 'node' ? dragPayload.nodeId : null}
            editable={!readOnly && !interactionDisabled}
            loading={loading}
            onSelectNode={(nodeId, multi) => handleSelect(nodeId, multi)}
            onDragOver={(targetId, position) => setDragTarget({ targetId, position })}
            onDrop={applyDrop}
            onNodeDragStart={(nodeId) => setPayload({ kind: 'node', nodeId })}
            onDragEnd={clearDrag}
            device={device}
            onDeviceChange={onDeviceChange}
          />
        </main>

        <aside className="vx-editor-sidebar-right">
          <Inspector
            selectedNode={selectedNode}
            schema={schema}
            onPropChange={handlePropChange}
            onAIChange={handleAIChange}
            aiBusy={aiBusy}
            aiFeedback={aiFeedback}
            disabled={interactionDisabled}
            readOnly={readOnly}
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

      {readOnly ? (
        <div className="vx-editor-readonly-banner" role="status">
          <AlertCircle size={15} aria-hidden="true" />
          <span>Somente leitura — você pode navegar pelo site, mas não alterar este documento.</span>
        </div>
      ) : null}
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

export { findNodeById, replaceNodeById };

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

function countNodes(node: SiteNode): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}
