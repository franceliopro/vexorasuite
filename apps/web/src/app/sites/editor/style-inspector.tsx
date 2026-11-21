'use client';

/**
 * Véxora Sites — Inspector de estilo (controle total do layout).
 *
 * Edita `node.styles` (CSS real) do bloco selecionado: cores, espaçamento,
 * dimensões, tipografia, layout flexível, posicionamento, borda, sombra e
 * efeitos. Tudo é determinístico: cada controle escreve uma declaração CSS
 * direta no documento, sem dependência de IA e sem autosave.
 */

import type { SiteNode } from '@/shared-types/site-document';
import { Palette, Ruler, Maximize, Type, LayoutGrid, Move, Square, Sparkles } from 'lucide-react';
import './editor.css';

interface StyleInspectorProps {
  selectedNode: SiteNode;
  onStyleChange: (key: string, value: string) => void;
  disabled?: boolean;
}

const COLOR_PRESETS = [
  '#ffffff', '#f6f7f4', '#e5e8ef', '#101d33', '#0E7A5C', '#2563eb',
  '#6258DF', '#059669', '#d97706', '#dc2626',
];

const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;

export function StyleInspector({ selectedNode, onStyleChange, disabled = false }: StyleInspectorProps) {
  const style = (key: string): string => selectedNode.styles?.[key] ?? '';
  const set = (key: string, value: string): void => {
    if (!disabled) onStyleChange(key, value);
  };

  return (
    <div className="vx-style-inspector">
      <p className="vx-style-hint">
        Ajustes visuais imediatos no canvas. Revise e salve para publicar.
      </p>

      <StyleGroup title="Cores" icon={<Palette size={14} aria-hidden="true" />} defaultOpen>
        <ColorField label="Fundo" value={style('background')} onChange={(v) => set('background', v)} disabled={disabled} />
        <ColorField label="Texto" value={style('color')} onChange={(v) => set('color', v)} disabled={disabled} />
      </StyleGroup>

      <StyleGroup title="Espaçamento" icon={<Ruler size={14} aria-hidden="true" />} defaultOpen>
        <SpacingField label="Padding (interno)" prefix="padding" node={selectedNode} set={set} disabled={disabled} />
        <SpacingField label="Margem (externa)" prefix="margin" node={selectedNode} set={set} disabled={disabled} />
        <Field label="Distância entre itens (gap)">
          <TextInput value={style('gap')} placeholder="1rem" onChange={(v) => set('gap', v)} disabled={disabled} />
        </Field>
      </StyleGroup>

      <StyleGroup title="Dimensões" icon={<Maximize size={14} aria-hidden="true" />}>
        <div className="vx-style-grid-2">
          <Field label="Largura"><TextInput value={style('width')} placeholder="100%" onChange={(v) => set('width', v)} disabled={disabled} /></Field>
          <Field label="Altura"><TextInput value={style('height')} placeholder="auto" onChange={(v) => set('height', v)} disabled={disabled} /></Field>
          <Field label="Largura mín."><TextInput value={style('minWidth')} placeholder="12rem" onChange={(v) => set('minWidth', v)} disabled={disabled} /></Field>
          <Field label="Largura máx."><TextInput value={style('maxWidth')} placeholder="42rem" onChange={(v) => set('maxWidth', v)} disabled={disabled} /></Field>
        </div>
      </StyleGroup>

      <StyleGroup title="Tipografia" icon={<Type size={14} aria-hidden="true" />}>
        <Field label="Família da fonte">
          <SelectInput
            value={style('fontFamily')}
            placeholder="Padrão do tema"
            options={[
              ['Inter', 'Inter'],
              ['system-ui', 'Sistema'],
              ['Georgia', 'Georgia'],
              ['\"Courier New\", monospace', 'Monoespaçado'],
            ]}
            onChange={(v) => set('fontFamily', v)}
            disabled={disabled}
          />
        </Field>
        <div className="vx-style-grid-2">
          <Field label="Tamanho"><TextInput value={style('fontSize')} placeholder="1rem" onChange={(v) => set('fontSize', v)} disabled={disabled} /></Field>
          <Field label="Altura da linha"><TextInput value={style('lineHeight')} placeholder="1.6" onChange={(v) => set('lineHeight', v)} disabled={disabled} /></Field>
        </div>
        <Field label="Peso">
          <SelectInput
            value={style('fontWeight')}
            placeholder="Padrão"
            options={[
              ['300', 'Leve (300)'], ['400', 'Normal (400)'], ['500', 'Médio (500)'],
              ['600', 'Seminegrito (600)'], ['700', 'Negrito (700)'], ['800', 'Forte (800)'],
            ]}
            onChange={(v) => set('fontWeight', v)}
            disabled={disabled}
          />
        </Field>
        <Field label="Alinhamento">
          <div className="vx-style-align">
            {TEXT_ALIGNS.map((align) => (
              <button
                key={align}
                type="button"
                className={`vx-style-align-btn ${style('textAlign') === align ? 'is-active' : ''}`}
                onClick={() => set('textAlign', align)}
                disabled={disabled}
                title={align}
                aria-label={`Alinhar à ${align}`}
              >
                {align === 'left' ? '◀' : align === 'center' ? '◆' : align === 'right' ? '▶' : '↔'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Transformação">
          <SelectInput
            value={style('textTransform')}
            placeholder="Normal"
            options={[
              ['uppercase', 'MAIÚSCULAS'], ['lowercase', 'minúsculas'], ['capitalize', 'Primeira letra'],
            ]}
            onChange={(v) => set('textTransform', v)}
            disabled={disabled}
          />
        </Field>
        <Field label="Espaçamento entre letras"><TextInput value={style('letterSpacing')} placeholder="0" onChange={(v) => set('letterSpacing', v)} disabled={disabled} /></Field>
      </StyleGroup>

      <StyleGroup title="Layout e posição dos filhos" icon={<LayoutGrid size={14} aria-hidden="true" />}>
        <Field label="Exibição">
          <SelectInput
            value={style('display')}
            placeholder="Padrão"
            options={[
              ['block', 'Bloco'], ['flex', 'Flex'], ['grid', 'Grid'],
              ['inline-block', 'Em linha'], ['none', 'Oculto'],
            ]}
            onChange={(v) => set('display', v)}
            disabled={disabled}
          />
        </Field>
        <div className="vx-style-grid-2">
          <Field label="Direção">
            <SelectInput
              value={style('flexDirection')}
              placeholder="Linha"
              options={[
                ['row', 'Linha'], ['row-reverse', 'Linha invertida'],
                ['column', 'Coluna'], ['column-reverse', 'Coluna invertida'],
              ]}
              onChange={(v) => set('flexDirection', v)}
              disabled={disabled}
            />
          </Field>
          <Field label="Quebra">
            <SelectInput
              value={style('flexWrap')}
              placeholder="Sem quebra"
              options={[['wrap', 'Quebrar'], ['nowrap', 'Sem quebra']]}
              onChange={(v) => set('flexWrap', v)}
              disabled={disabled}
            />
          </Field>
        </div>
        <Field label="Distribuir (justify)">
          <SelectInput
            value={style('justifyContent')}
            placeholder="Início"
            options={[
              ['flex-start', 'Início'], ['center', 'Centro'], ['flex-end', 'Fim'],
              ['space-between', 'Entre'], ['space-around', 'Ao redor'], ['space-evenly', 'Igual'],
            ]}
            onChange={(v) => set('justifyContent', v)}
            disabled={disabled}
          />
        </Field>
        <Field label="Alinhar (items)">
          <SelectInput
            value={style('alignItems')}
            placeholder="Esticar"
            options={[
              ['stretch', 'Esticar'], ['flex-start', 'Início'], ['center', 'Centro'],
              ['flex-end', 'Fim'], ['baseline', 'Linha de base'],
            ]}
            onChange={(v) => set('alignItems', v)}
            disabled={disabled}
          />
        </Field>
        <Field label="Colunas do grid"><TextInput value={style('gridTemplateColumns')} placeholder="repeat(3, 1fr)" onChange={(v) => set('gridTemplateColumns', v)} disabled={disabled} /></Field>
      </StyleGroup>

      <StyleGroup title="Posicionamento" icon={<Move size={14} aria-hidden="true" />}>
        <Field label="Posição">
          <SelectInput
            value={style('position')}
            placeholder="Estática"
            options={[
              ['relative', 'Relativa'], ['absolute', 'Absoluta'],
              ['fixed', 'Fixa'], ['sticky', 'Grudada'],
            ]}
            onChange={(v) => set('position', v)}
            disabled={disabled}
          />
        </Field>
        <div className="vx-style-grid-4">
          <Field label="Topo"><TextInput value={style('top')} placeholder="0" onChange={(v) => set('top', v)} disabled={disabled} /></Field>
          <Field label="Direita"><TextInput value={style('right')} placeholder="0" onChange={(v) => set('right', v)} disabled={disabled} /></Field>
          <Field label="Baixo"><TextInput value={style('bottom')} placeholder="0" onChange={(v) => set('bottom', v)} disabled={disabled} /></Field>
          <Field label="Esquerda"><TextInput value={style('left')} placeholder="0" onChange={(v) => set('left', v)} disabled={disabled} /></Field>
        </div>
        <Field label="Camada (z-index)"><TextInput value={style('zIndex')} placeholder="1" onChange={(v) => set('zIndex', v)} disabled={disabled} /></Field>
      </StyleGroup>

      <StyleGroup title="Borda e sombra" icon={<Square size={14} aria-hidden="true" />}>
        <Field label="Borda"><TextInput value={style('border')} placeholder="1px solid #e5e8ef" onChange={(v) => set('border', v)} disabled={disabled} /></Field>
        <Field label="Arredondamento"><TextInput value={style('borderRadius')} placeholder="0.75rem" onChange={(v) => set('borderRadius', v)} disabled={disabled} /></Field>
        <Field label="Sombra">
          <SelectInput
            value={style('boxShadow')}
            placeholder="Nenhuma"
            options={[
              ['0 1px 3px rgb(0 0 0 / 0.1)', 'Suave'],
              ['0 8px 24px rgb(0 0 0 / 0.12)', 'Média'],
              ['0 20px 45px rgb(0 0 0 / 0.18)', 'Forte'],
            ]}
            onChange={(v) => set('boxShadow', v)}
            disabled={disabled}
          />
        </Field>
      </StyleGroup>

      <StyleGroup title="Efeitos" icon={<Sparkles size={14} aria-hidden="true" />}>
        <Field label="Opacidade">
          <div className="vx-style-range">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={parseNumber(style('opacity'), 1)}
              onChange={(e) => set('opacity', e.target.value)}
              disabled={disabled}
              aria-label="Opacidade"
            />
            <span>{style('opacity') || '1'}</span>
          </div>
        </Field>
        <Field label="Transformação"><TextInput value={style('transform')} placeholder="translateY(-4px)" onChange={(v) => set('transform', v)} disabled={disabled} /></Field>
        <Field label="Transição"><TextInput value={style('transition')} placeholder="all 0.2s ease" onChange={(v) => set('transition', v)} disabled={disabled} /></Field>
        <Field label="Visibilidade">
          <SelectInput
            value={style('visibility')}
            placeholder="Visível"
            options={[['visible', 'Visível'], ['hidden', 'Oculta']]}
            onChange={(v) => set('visibility', v)}
            disabled={disabled}
          />
        </Field>
      </StyleGroup>
    </div>
  );
}

/* ---------- Subcomponentes ---------- */

function StyleGroup({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="vx-style-group" open={defaultOpen}>
      <summary className="vx-style-group-summary">
        {icon}
        <span>{title}</span>
      </summary>
      <div className="vx-style-group-body">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="vx-inspector-field">
      <label className="vx-inspector-field-label">{label}</label>
      <div className="vx-inspector-field-control">{children}</div>
    </div>
  );
}

function TextInput({
  value,
  placeholder,
  onChange,
  disabled,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      type="text"
      className="vx-inspector-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

function SelectInput({
  value,
  placeholder,
  options,
  onChange,
  disabled,
}: {
  value: string;
  placeholder: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <select
      className="vx-inspector-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>{label}</option>
      ))}
    </select>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Field label={label}>
      <div className="vx-style-color">
        <input
          type="color"
          className="vx-inspector-color"
          value={hexOf(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={`Cor de ${label.toLowerCase()}`}
        />
        <input
          type="text"
          className="vx-inspector-input"
          value={value}
          placeholder="#ffffff ou var(--primary)"
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="vx-style-presets">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="vx-style-preset"
            style={{ backgroundColor: preset }}
            title={preset}
            aria-label={`Usar cor ${preset}`}
            onClick={() => onChange(preset)}
            disabled={disabled}
          />
        ))}
      </div>
    </Field>
  );
}

function SpacingField({
  label,
  prefix,
  node,
  set,
  disabled,
}: {
  label: string;
  prefix: 'padding' | 'margin';
  node: SiteNode;
  set: (key: string, value: string) => void;
  disabled: boolean;
}) {
  const shorthand = node.styles?.[prefix] ?? '';
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  return (
    <div className="vx-style-spacing">
      <Field label={label}>
        <TextInput value={shorthand} placeholder="1rem 2rem" onChange={(v) => set(prefix, v)} disabled={disabled} />
      </Field>
      <div className="vx-style-grid-4">
        {sides.map((side) => (
          <Field key={side} label={side}>
            <TextInput
              value={node.styles?.[`${prefix}-${side}`] ?? ''}
              placeholder="0"
              onChange={(v) => set(`${prefix}-${side}`, v)}
              disabled={disabled}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Extrai um hex de valores simples; variáveis CSS recebem um fallback neutro. */
function hexOf(value: string): string {
  const match = /#[0-9a-fA-F]{6}/.exec(value);
  return match ? match[0] : '#ffffff';
}
