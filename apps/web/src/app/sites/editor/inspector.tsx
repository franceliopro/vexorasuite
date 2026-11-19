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

import { useCallback, useState } from 'react';
import type { SiteNode, BlockPropSchema } from '../../../../../../packages/shared-types/src/site-document';
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
  disabled?: boolean;
}

export function Inspector({
  selectedNode,
  schema,
  onPropChange,
  onAIChange,
  aiBusy = false,
  disabled = false,
}: InspectorProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});

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
          disabled={disabled}
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
                      disabled={disabled}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      className="vx-inspector-textarea"
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, e.target.value)}
                      placeholder={field.placeholder ?? ''}
                      rows={3}
                      disabled={disabled}
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="number"
                      className="vx-inspector-input"
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, Number(e.target.value) || 0)}
                      disabled={disabled}
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
                        disabled={disabled}
                      />
                    </div>
                  )}
                  {field.type === 'select' && (
                    <select
                      className="vx-inspector-select"
                      value={String(values[field.key] ?? selectedNode.props[field.key] ?? '')}
                      onChange={(e) => handlePropChange(field.key, e.target.value)}
                      disabled={disabled}
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
                        disabled={disabled}
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
                        disabled={disabled}
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
                disabled={disabled || aiBusy}
              />
              <div className="vx-inspector-ai-actions">
                <small className="vx-inspector-ai-hint">
                  Pressione Ctrl+Enter para aplicar. A IA altera props/estilos do bloco selecionado.
                </small>
                <button
                  type="submit"
                  className="vx-inspector-btn-primary"
                  disabled={disabled || aiBusy || !aiPrompt.trim() || !selectedNode}
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
          </div>
        )}
      </div>

      {disabled && (
        <div className="vx-inspector-disabled-banner">
          <AlertCircle size={14} aria-hidden="true" />
          <span>Edição bloqueada — sem permissão para alterar este bloco.</span>
        </div>
      )}
    </section>
  );
}
