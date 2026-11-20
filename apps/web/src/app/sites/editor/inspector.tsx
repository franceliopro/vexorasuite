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
import './editor.css';

interface InspectorProps {
  selectedNode: SiteNode | null;
  schema: BlockPropSchema[];
  onPropChange: (key: string, value: string | number | boolean) => void;
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
      <section className="vx-inspector vx-inspector-empty" aria-label="Propriedades do bloco">
        <header className="vx-inspector-head">
          <span className="vx-inspector-icon">
            <Settings size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="vx-inspector-title">Propriedades do bloco</h2>
            <p className="vx-inspector-sub">
              Selecione um elemento no canvas para editar suas propriedades.
            </p>
          </div>
        </header>
        <div className="vx-inspector-empty-state">
          <AlertCircle size={20} aria-hidden="true" />
          <span>Nenhum bloco selecionado</span>
        </div>
      </section>
    );
  }

  return (
    <section className="vx-inspector" aria-label="Propriedades do bloco">
      <header className="vx-inspector-head">
        <span className="vx-inspector-icon">
          <Settings size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="vx-inspector-title">
            {(selectedNode.props as Record<string, string>)?.label || selectedNode.type}
          </h2>
          <p className="vx-inspector-sub">
            Bloco selecionado · ID {selectedNode.id.slice(0, 8)}
          </p>
        </div>
        <button
          type="button"
          className="vx-inspector-btn-icon"
          aria-label={aiPanelOpen ? 'Fechar assistente de IA' : 'Abrir assistente de IA'}
          onClick={() => setAiPanelOpen((p) => !p)}
          disabled={controlsDisabled}
        >
          {aiPanelOpen ? <Minimize size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
        </button>
      </header>

      <div className="vx-inspector-body">
        <div className="vx-inspector-properties">
          {schema.length ? (
            schema.map((field) => (
              <div key={field.key} className="vx-inspector-field">
                <label className="vx-inspector-field-label">{field.label}</label>
                <div className="vx-inspector-field-control">
                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="vx-inspector-input"
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, e.target.value)}
                      placeholder={field.placeholder ?? ''}
                      disabled={controlsDisabled}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      className="vx-inspector-textarea"
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
                      className="vx-inspector-input"
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, Number(e.target.value) || 0)}
                      disabled={controlsDisabled}
                    />
                  )}
                  {field.type === 'color' && (
                    <div className="vx-inspector-color-wrap">
                      <input
                        type="color"
                        className="vx-inspector-color"
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
                      className="vx-inspector-select"
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
                    <label className="vx-inspector-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(values[field.key] ?? selectedNode.props[field.key])}
                        onChange={(e) => handlePropChange(field.key, e.target.checked)}
                        disabled={controlsDisabled}
                      />
                      <span className="vx-inspector-toggle-thumb" aria-hidden="true" />
                    </label>
                  )}
                  {field.type === 'image' && (
                    <div className="vx-inspector-image-wrap">
                      <input
                        type="text"
                        className="vx-inspector-input"
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
            <div className="vx-inspector-empty-state">
              <span>Este bloco não tem propriedades editáveis.</span>
            </div>
          )}
        </div>

        {aiPanelOpen && (
          <div className="vx-inspector-ai-panel">
            <header className="vx-inspector-ai-head">
              <span className="vx-inspector-ai-icon">
                <Sparkles size={16} aria-hidden="true" />
              </span>
              <span className="vx-inspector-ai-title">Assistente de IA</span>
            </header>
            <form onSubmit={handleAiSubmit} className="vx-inspector-ai-form">
              <textarea
                id="vexora-ai-prompt"
                className="vx-inspector-ai-input"
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={handleAiKeyDown}
                placeholder="Ex.: torne o botão vermelho, aumente o espaçamento e centralize o texto"
                disabled={controlsDisabled || aiBusy}
              />
              <div className="vx-inspector-ai-actions">
                <small className="vx-inspector-ai-hint">
                  Pressione Ctrl+Enter. A IA ajusta props/estilos como patch; revise e salve.
                </small>
                <button
                  type="submit"
                  className="vx-inspector-btn-primary"
                  disabled={controlsDisabled || aiBusy || !aiPrompt.trim() || !selectedNode}
                >
                  {aiBusy ? (
                    <>
                      <Loader2 size={15} className="vx-spin" aria-hidden="true" />
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
                className={`vx-inspector-ai-feedback ${aiFeedback.error ? 'is-error' : 'is-ok'}`}
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
        <div className="vx-inspector-readonly-banner" role="status">
          <AlertCircle size={14} aria-hidden="true" />
          <span>Somente leitura — inspecione blocos sem alterá-los.</span>
        </div>
      ) : null}
    </section>
  );
}
