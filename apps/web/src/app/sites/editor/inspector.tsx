'use client';

/**
 * Véxora Sites — Editor Visual: inspetor à direita do canvas.
 * Renderiza propriedades do nó selecionado a partir do schema de cada bloco do
 * BLOCK_REGISTRY (BlockPropSchema[]: key, label, type, options?, aiEditable?).
 * Inclui caixa de prompt da IA (lógica aiEditNode já existe no programador).
 * Consume shared-types (SiteNode, BlockPropSchema). Sem tipos próprios.
 * Estados: vazio (sem nó selecionado), desabilitado (sem permissão), loading.
 * Classes CSS em editor.css (tokens Véxora, sem hex direto).
 */

import { useCallback, useEffect, useState } from 'react';
import type { SiteNode, BlockPropSchema } from '@/shared-types/site-document';
import {
  Settings,
  Sparkles,
  AlertCircle,
  Loader2,
  Send,
  Minimize,
} from 'lucide-react';
import { StyleInspector } from './style-inspector';
import './editor.css';

const INSPECTOR = 'flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line';
const INSPECTOR_HEAD = 'flex items-center justify-between gap-2 border-b border-line px-4 py-3.5';
const INSPECTOR_ICON = 'inline-flex h-7.5 w-7.5 flex-none items-center justify-center rounded-token-sm border border-line bg-surface-2 text-ink-secondary';
const INSPECTOR_HEAD_TEXT = 'min-w-0';
const INSPECTOR_TITLE = 'm-0 truncate text-sm font-bold text-ink';
const INSPECTOR_SUB = 'm-0 truncate text-xs text-ink-secondary';
const INSPECTOR_ICON_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-token-sm border border-line bg-surface text-ink-secondary hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50';
const INSPECTOR_BODY = 'overflow-y-auto p-4';
const INSPECTOR_PROPERTIES = 'flex flex-col gap-3';
const INSPECTOR_FIELD = 'flex flex-col gap-1.5';
const INSPECTOR_FIELD_LABEL = 'text-xs font-bold text-ink-secondary';
const INSPECTOR_FIELD_CONTROL = 'flex flex-col gap-1';
const INSPECTOR_INPUT = 'w-full rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50';
const INSPECTOR_TEXTAREA = 'w-full min-h-15 resize-y rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50';
const INSPECTOR_COLOR_WRAP = 'flex items-center gap-2';
const INSPECTOR_COLOR = 'h-7 w-7 cursor-pointer rounded-square border border-line bg-surface disabled:cursor-not-allowed disabled:opacity-50';
const INSPECTOR_TOGGLE = 'inline-flex cursor-pointer items-center gap-2';
const INSPECTOR_TOGGLE_INPUT = 'peer hidden';
const INSPECTOR_TOGGLE_THUMB = 'relative h-5 w-10 rounded-full border border-line bg-line transition-control duration-control peer-checked:border-brand peer-checked:bg-brand';
const INSPECTOR_EMPTY_STATE = 'flex flex-col items-center gap-2.5 p-10 text-center text-sm text-ink-secondary';
const INSPECTOR_AI_PANEL = 'border-t border-line bg-surface-2';
const INSPECTOR_AI_HEAD = 'flex items-center gap-2 border-b border-line px-4 py-2.5';
const INSPECTOR_AI_ICON = 'text-brand';
const INSPECTOR_AI_TITLE = 'text-sm font-bold text-ink';
const INSPECTOR_AI_FORM = 'flex flex-col gap-2 p-4';
const INSPECTOR_AI_INPUT = 'w-full min-h-18 resize-y rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50';
const INSPECTOR_AI_ACTIONS = 'flex items-center justify-between gap-2';
const INSPECTOR_AI_HINT = 'm-0 text-xs text-ink-secondary';
const INSPECTOR_PRIMARY_BUTTON = 'inline-flex items-center gap-1.5 rounded-token-sm bg-brand px-4 py-2 text-sm font-bold text-brand-contrast disabled:cursor-not-allowed disabled:opacity-50';
const INSPECTOR_FEEDBACK_OK = 'mx-4 mb-3 rounded-token-sm border border-emerald-600 bg-emerald-100 p-2 text-xs leading-relaxed text-emerald-600';
const INSPECTOR_FEEDBACK_ERROR = 'mx-4 mb-3 rounded-token-sm border border-red-600 bg-red-100 p-2 text-xs leading-relaxed text-red-600';
const INSPECTOR_READONLY_BANNER = 'mx-3 my-2 inline-flex items-center gap-2 rounded-token-sm border border-amber-600/45 bg-amber-100 px-3 py-2 text-xs text-amber-600';

const INSPECTOR_FEEDBACK_KIND: Record<'ok' | 'error', string> = {
  ok: INSPECTOR_FEEDBACK_OK,
  error: INSPECTOR_FEEDBACK_ERROR,
};

interface InspectorProps {
  selectedNode: SiteNode | null;
  schema: BlockPropSchema[];
  onPropChange: (key: string, value: string | number | boolean) => void;
  /** Edição direta de CSS do bloco selecionado. */
  onStyleChange?: (key: string, value: string) => void;
  onAIChange?: (prompt: string, nodeId: string) => void;
  aiBusy?: boolean;
  /** Resultado visível do patch da IA, colado ao prompt. */
  aiFeedback?: { text: string; error: boolean } | null;
  /** Transient busy state, sem implication de permissão. */
  disabled?: boolean;
  /** Real permission state; only this produces the read-only notice. */
  readOnly?: boolean;
}

export function Inspector({
  selectedNode,
  schema,
  onPropChange,
  onStyleChange,
  onAIChange,
  aiBusy = false,
  aiFeedback = null,
  disabled = false,
  readOnly = false,
}: InspectorProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const controlsDisabled = disabled || readOnly;

  // O resultado da IA precisa aparecer junto ao prompt; abrir o painel evita que
  // a resposta fique escondida dentro de um detalhe recolhido.
  useEffect(() => {
    if (aiFeedback) setAiPanelOpen(true);
  }, [aiFeedback]);

  const handlePropChange = useCallback(
    (key: string, value: string | number | boolean) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      onPropChange(key, value);
    },
    [onPropChange],
  );

  const handleAiSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiPrompt.trim() || !selectedNode || !onAIChange) return;
      onAIChange(aiPrompt, selectedNode.id);
      setAiPrompt('');
    },
    [aiPrompt, selectedNode, onAIChange],
  );

  const handleAiKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (selectedNode && onAIChange && aiPrompt.trim()) {
          onAIChange(aiPrompt, selectedNode.id);
          setAiPrompt('');
        }
      }
    },
    [aiPrompt, selectedNode, onAIChange],
  );

  if (!selectedNode) {
    return (
      <section className={INSPECTOR} aria-label="Propriedades do bloco">
        <header className={INSPECTOR_HEAD}>
          <span className={INSPECTOR_ICON}>
            <Settings size={18} aria-hidden="true" />
          </span>
          <div className={INSPECTOR_HEAD_TEXT}>
            <h2 className={INSPECTOR_TITLE}>Propriedades do bloco</h2>
            <p className={INSPECTOR_SUB}>
              Selecione um elemento no canvas para editar suas propriedades.
            </p>
          </div>
        </header>
        <div className={INSPECTOR_EMPTY_STATE}>
          <AlertCircle size={20} aria-hidden="true" />
          <span>Nenhum bloco selecionado</span>
        </div>
      </section>
    );
  }

  return (
    <section className={INSPECTOR} aria-label="Propriedades do bloco">
      <header className={INSPECTOR_HEAD}>
        <span className={INSPECTOR_ICON}>
          <Settings size={18} aria-hidden="true" />
        </span>
        <div className={INSPECTOR_HEAD_TEXT}>
          <h2 className={INSPECTOR_TITLE}>
            {(selectedNode.props as Record<string, string>)?.label || selectedNode.type}
          </h2>
          <p className={INSPECTOR_SUB}>
            Bloco selecionado · ID {selectedNode.id.slice(0, 8)}
          </p>
        </div>
        <button
          type="button"
          className={INSPECTOR_ICON_BUTTON}
          aria-label={aiPanelOpen ? 'Fechar assistente de IA' : 'Abrir assistente de IA'}
          onClick={() => setAiPanelOpen((p) => !p)}
          disabled={controlsDisabled}
        >
          {aiPanelOpen ? <Minimize size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
        </button>
      </header>

      <div className={INSPECTOR_BODY}>
        <div className={INSPECTOR_PROPERTIES}>
          {schema.length ? (
            schema.map((field) => (
              <div key={field.key} className={INSPECTOR_FIELD}>
                <label className={INSPECTOR_FIELD_LABEL}>{field.label}</label>
                <div className={INSPECTOR_FIELD_CONTROL}>
                  {field.type === 'text' && (
                    <input
                      type="text"
                      className={INSPECTOR_INPUT}
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, e.target.value)}
                      placeholder={field.placeholder ?? ''}
                      disabled={controlsDisabled}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      className={INSPECTOR_TEXTAREA}
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, e.target.value)}
                      placeholder={field.placeholder ?? ''}
                      rows={3}
                      disabled={controlsDisabled}
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      className={INSPECTOR_INPUT}
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, Number(e.target.value) || 0)}
                      disabled={controlsDisabled}
                    />
                  )}
                  {field.type === 'color' && (
                    <div className={INSPECTOR_COLOR_WRAP}>
                      <input
                        type="color"
                        className={INSPECTOR_COLOR}
                        value={
                          String(
                            values[field.key] ??
                              selectedNode.props[field.key] ??
                              '#000000',
                          )
                        }
                        onChange={(e) => handlePropChange(field.key, e.target.value)}
                        disabled={controlsDisabled}
                      />
                    </div>
                  )}
                  {field.type === 'select' && (
                    <select
                      className={INSPECTOR_INPUT}
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, e.target.value)}
                      disabled={controlsDisabled}
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {field.type === 'boolean' && (
                    <label className={INSPECTOR_TOGGLE}>
                      <input
                        type="checkbox"
                        className={INSPECTOR_TOGGLE_INPUT}
                        checked={Boolean(values[field.key] ?? selectedNode.props[field.key])}
                        onChange={(e) => handlePropChange(field.key, e.target.checked)}
                        disabled={controlsDisabled}
                      />
                      <span className={INSPECTOR_TOGGLE_THUMB} aria-hidden="true" />
                    </label>
                  )}
                  {field.type === 'image' && (
                    <div className={INSPECTOR_COLOR_WRAP}>
                      <input
                        type="text"
                        className={INSPECTOR_INPUT}
                        value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                        onChange={(e) => handlePropChange(field.key, e.target.value)}
                        placeholder="URL da imagem"
                        disabled={controlsDisabled}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={INSPECTOR_EMPTY_STATE}>
              <span>Este bloco não tem propriedades editáveis.</span>
            </div>
          )}
        </div>

        {onStyleChange ? (
          <StyleInspector
            selectedNode={selectedNode}
            onStyleChange={onStyleChange}
            disabled={controlsDisabled}
          />
        ) : null}

        {aiPanelOpen && (
          <div className={INSPECTOR_AI_PANEL}>
            <header className={INSPECTOR_AI_HEAD}>
              <span className={INSPECTOR_AI_ICON}>
                <Sparkles size={16} aria-hidden="true" />
              </span>
              <span className={INSPECTOR_AI_TITLE}>Assistente de IA</span>
            </header>
            <form onSubmit={handleAiSubmit} className={INSPECTOR_AI_FORM}>
              <textarea
                id="vexora-ai-prompt"
                className={INSPECTOR_AI_INPUT}
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={handleAiKeyDown}
                placeholder="Ex.: torne o botão vermelho, aumente o espaçamento e centralize o texto"
                disabled={controlsDisabled || aiBusy}
              />
              <div className={INSPECTOR_AI_ACTIONS}>
                <small className={INSPECTOR_AI_HINT}>
                  Pressione Ctrl+Enter. A IA ajusta props/estilos como patch; revise e salve.
                </small>
                <button
                  type="submit"
                  className={INSPECTOR_PRIMARY_BUTTON}
                  disabled={controlsDisabled || aiBusy || !aiPrompt.trim() || !selectedNode}
                >
                  {aiBusy ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                      Aplicando…
                    </>
                  ) : (
                    <>
                      <Send size={15} aria-hidden="true" />
                      Aplicar
                    </>
                  )}
                </button>
              </div>
            </form>
            {aiFeedback ? (
              <div
                className={INSPECTOR_FEEDBACK_KIND[aiFeedback.error ? 'error' : 'ok']}
                role={aiFeedback.error ? 'alert' : 'status'}
                aria-live="polite"
              >
                {aiFeedback.text}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {readOnly ? (
        <div className={INSPECTOR_READONLY_BANNER} role="status">
          <AlertCircle size={14} aria-hidden="true" />
          <span>Somente leitura — inspecione blocos sem alterá-los.</span>
        </div>
      ) : null}
    </section>
  );
}
