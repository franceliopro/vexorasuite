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
import { EDITOR_PAGE_ID } from './contracts';
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

const SHELL = 'flex h-dvh min-h-0 flex-col bg-slate-900 font-sans text-slate-50';
const SHELL_TOPBAR = 'flex h-14 flex-none items-center justify-between gap-2.5 border-b border-slate-700 bg-slate-800 px-4';
const SHELL_TOPBAR_SECTION = 'flex min-w-0 items-center gap-2.5';
const SHELL_SITE_INFO = 'flex min-w-0 flex-col';
const SHELL_SITE_ID = 'truncate text-xs text-slate-200';
const SHELL_SITE_TITLE = 'truncate text-sm font-bold text-slate-50';
const SHELL_NODE_COUNT = 'px-2.5 text-sm text-slate-200';
const SHELL_ICON_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-slate-200 hover:bg-slate-700';
const SHELL_DEVICE_GROUP = 'flex gap-1.5 rounded-md border border-slate-700 bg-slate-800';
const SHELL_DEVICE_BUTTON = 'inline-flex h-8 w-8 items-center justify-center bg-transparent text-slate-200 hover:bg-slate-700';
const SHELL_DEVICE_BUTTON_ACTIVE = 'inline-flex h-8 w-8 items-center justify-center bg-slate-700 text-slate-50 hover:bg-slate-700';
const SHELL_DEVICE_BUTTON_CLASS = {
  active: SHELL_DEVICE_BUTTON_ACTIVE,
  idle: SHELL_DEVICE_BUTTON,
} as const;
const SHELL_DEVICE_ICON = 'inline-block h-3.5 w-3.5';
const SHELL_SECONDARY_BUTTON = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-50 hover:bg-slate-700';
const SHELL_SECONDARY_DISABLED = 'inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-50 opacity-50 hover:bg-slate-700';
const SHELL_SECONDARY_BUTTON_CLASS = {
  enabled: SHELL_SECONDARY_BUTTON,
  disabled: SHELL_SECONDARY_DISABLED,
} as const;
const SHELL_PRIMARY_BUTTON = 'inline-flex h-9 items-center gap-2 rounded-md border-0 bg-blue-600 px-4 text-sm font-bold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50';
const SHELL_MAIN = 'flex min-h-0 flex-1 overflow-hidden';
const SHELL_SIDEBAR_LEFT = 'flex w-80 flex-none flex-col overflow-hidden border-r border-slate-700 bg-slate-800';
const SHELL_CANVAS_AREA = 'relative min-w-0 flex-1 overflow-hidden bg-slate-900';
const SHELL_SIDEBAR_RIGHT = 'flex w-80 flex-none flex-col overflow-hidden border-l border-slate-700 bg-slate-800';
const SHELL_NOTICE = 'mx-3 my-2 inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-50';
const SHELL_READONLY_BANNER = 'mx-3 my-2 inline-flex items-center gap-2 rounded-md border border-amber-600/45 bg-amber-950 px-3 py-2 text-sm text-amber-200';
const SHELL_PAGE_LABEL = 'mr-1.5 text-xs font-semibold';
const SHELL_PAGE_SELECT = 'max-w-64 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-50';

const SHELL_NOTICE_KIND: Record<'info' | 'ok' | 'bad', string> = {
  info: SHELL_NOTICE,
  ok: 'mx-3 my-2 inline-flex items-center gap-2 rounded-md border border-emerald-600/40 bg-emerald-950 px-3 py-1.5 text-sm text-emerald-200',
  bad: 'mx-3 my-2 inline-flex items-center gap-2 rounded-md border border-red-600/40 bg-red-950 px-3 py-1.5 text-sm text-red-200',
};

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

  const handleStyleChange = useCallback(
    (key: string, value: string) => {
      if (!selectedNode || !activeRoot || readOnly || interactionDisabled) return;
      setDoc(withActiveRoot(setNodeStyle(activeRoot, selectedNode.id, key, value)));
    },
    [activeRoot, interactionDisabled, readOnly, selectedNode, setDoc, withActiveRoot],
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
    <div className={SHELL} role="application" aria-label="Editor de sites Véxora">
      <header className={SHELL_TOPBAR}>
        <div className={SHELL_TOPBAR_SECTION}>
          <button
            type="button"
            className={SHELL_ICON_BUTTON}
            aria-label="Fechar editor"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
          {onMinimize ? (
            <button
              type="button"
              className={SHELL_ICON_BUTTON}
              aria-label="Minimizar editor"
              title="Minimizar para a interface da Véxora"
              onClick={onMinimize}
            >
              <Minimize2 size={16} aria-hidden="true" />
            </button>
          ) : null}
          <div className={SHELL_SITE_INFO}>
            <span className={SHELL_SITE_ID}>v{doc.version}{dirty ? ' • não salvo' : ''}</span>
            <span className={SHELL_SITE_TITLE} title={siteId}>{doc.meta.title}</span>
          </div>
        </div>

        <div className={SHELL_TOPBAR_SECTION}>
          <label htmlFor={EDITOR_PAGE_ID} className={SHELL_PAGE_LABEL}>
            Página
          </label>
          <select
            id={EDITOR_PAGE_ID}
            className={SHELL_PAGE_SELECT}
            value={activePageSlug}
            onChange={(event) => setActivePageSlug(event.target.value)}
            disabled={loading}
          >
            <option value="__home__">Início (index)</option>
            {pages.map((page) => (
              <option key={page.slug} value={page.slug}>
                {page.title}{page.kind === 'legal' ? ' · rascunho legal' : ''}
              </option>
            ))}
          </select>
          <span className={SHELL_NODE_COUNT}>{nodeCount} blocos</span>
        </div>

        <div className={SHELL_TOPBAR_SECTION}>
          <div className={SHELL_DEVICE_GROUP} role="group" aria-label="Dispositivo de preview">
            {(['desktop', 'tablet', 'mobile'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={SHELL_DEVICE_BUTTON_CLASS[d === device ? 'active' : 'idle']}
                aria-label={`Preview ${d}`}
                onClick={() => onDeviceChange(d)}
              >
                <span className={SHELL_DEVICE_ICON} aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            className={SHELL_SECONDARY_BUTTON_CLASS[!canUndo(historyRef.current) || interactionDisabled ? 'disabled' : 'enabled']}
            disabled={!canUndo(historyRef.current) || interactionDisabled}
            onClick={handleUndo}
            title="Desfazer"
          >
            <Undo size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={SHELL_SECONDARY_BUTTON_CLASS[!canRedo(historyRef.current) || interactionDisabled ? 'disabled' : 'enabled']}
            disabled={!canRedo(historyRef.current) || interactionDisabled}
            onClick={handleRedo}
            title="Refazer"
          >
            <Redo size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={SHELL_PRIMARY_BUTTON}
            disabled={readOnly || loading || saving}
            onClick={() => void handleSave()}
            title={readOnly ? 'Somente leitura' : saving ? 'Salvando…' : undefined}
          >
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            className={SHELL_PRIMARY_BUTTON}
            disabled={readOnly || loading || saving || publishing}
            onClick={handlePublish}
            title={readOnly ? 'Somente leitura' : publishing ? 'Publicando…' : saving ? 'Aguarde o salvamento' : undefined}
          >
            {publishing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {publishing ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </header>

      <div className={SHELL_MAIN}>
        <aside className={SHELL_SIDEBAR_LEFT}>
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

        <main className={SHELL_CANVAS_AREA}>
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

        <aside className={SHELL_SIDEBAR_RIGHT}>
          <Inspector
            selectedNode={selectedNode}
            schema={schema}
            onPropChange={handlePropChange}
            onStyleChange={handleStyleChange}
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
          className={SHELL_NOTICE_KIND[noticeKind]}
          role="status"
          aria-live="polite"
        >
          {noticeKind === 'ok' ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
          {noticeKind === 'bad' ? <AlertCircle size={14} aria-hidden="true" /> : null}
          <span>{notice}</span>
        </div>
      )}

      {readOnly ? (
        <div className={SHELL_READONLY_BANNER} role="status">
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
    const updated: SiteNode = { ...node, props: { ...node.props, [key]: value } };
    return syncColumns(updated);
  }
  return {
    ...node,
    children: node.children.map((c) => setNodeProp(c, id, key, value)),
  };
}

/** Mantém a quantidade de colunas filhas alinhada ao prop `columnCount`. */
function syncColumns(node: SiteNode): SiteNode {
  if (node.type !== 'columns') return node;
  const requested = Number(node.props.columnCount);
  const count = Number.isFinite(requested) ? Math.min(8, Math.max(2, Math.round(requested))) : 3;
  if (node.children.length === count) return node;
  const children = [...node.children];
  while (children.length < count) {
    const i = children.length;
    children.push(
      createNode('div', {
        props: { title: `Coluna ${i + 1}`, content: 'Edite este conteúdo ou arraste blocos para dentro.' },
        styles: {
          flex: '1 1 0',
          minWidth: '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1.25rem',
          background: 'var(--background, #f6f7f4)',
          borderRadius: '0.75rem',
        },
      }),
    );
  }
  return { ...node, children: children.slice(0, count), props: { ...node.props, columnCount: count } };
}

function setNodeStyle(node: SiteNode, id: string, key: string, value: string): SiteNode {
  if (node.id === id) {
    const styles = { ...node.styles };
    if (value === '') delete styles[key];
    else styles[key] = value;
    return { ...node, styles };
  }
  return {
    ...node,
    children: node.children.map((c) => setNodeStyle(c, id, key, value)),
  };
}

function countNodes(node: SiteNode): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}
