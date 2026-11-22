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

/* Utilities literais sobre os tokens do preset. Cores, medidas e sombras vêm de
   `node.styles` (dados do documento), nunca de classes utilitárias. */
const styleInspectorTw = 'flex flex-col gap-2 border-t border-line pt-2';
const styleHintTw = 'm-0 mb-1 text-xs leading-normal text-ink-secondary';
const styleGroupTw = 'group overflow-hidden rounded-token-sm border border-line bg-surface';
const styleGroupSummaryTw = 'flex cursor-pointer list-none select-none items-center gap-2 bg-surface-2 px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-ink-secondary';
const styleGroupBodyTw = 'flex flex-col gap-2.5 p-2.5';
const styleGroupExpandIconTw = 'ml-auto text-sm leading-none text-ink-secondary group-open:hidden';
const styleGroupCollapseIconTw = 'ml-auto hidden text-sm leading-none text-ink-secondary group-open:inline';
const styleGrid2Tw = 'grid grid-cols-2 gap-2';
const styleGrid4Tw = 'grid grid-cols-4 gap-1.5';
const styleAlignTw = 'flex gap-1';
const styleAlignButtonTw = 'flex-1 rounded-token-sm border border-line bg-surface px-0 py-1.5 text-xs text-ink-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50';
const styleAlignButtonActiveTw = 'border-brand bg-brand text-surface';
const styleRangeTw = 'flex items-center gap-2';
const styleRangeInputTw = 'min-w-0 flex-1';
const styleRangeValueTw = 'min-w-8 text-right text-xs text-ink-secondary';
const fieldTw = 'flex flex-col gap-1.5';
const fieldLabelTw = 'text-body font-bold text-ink-secondary';
const fieldControlTw = 'flex flex-col gap-1';
const inputTw = 'w-full rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50';
const compactInputTw = 'p-1.5 text-center text-xs';
const selectTw = 'w-full rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-50';
const styleColorTw = 'flex items-center gap-2';
const styleColorInputTw = 'size-7 shrink-0 cursor-pointer rounded-md border border-line bg-surface disabled:cursor-not-allowed disabled:opacity-50';
const styleColorTextTw = 'min-w-0 flex-1';
const stylePresetsTw = 'flex flex-wrap gap-1.5';
const stylePresetTw = 'size-4 shrink-0 cursor-pointer rounded-full border border-line p-0 hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-brand disabled:cursor-not-allowed disabled:opacity-50';
const styleSpacingTw = 'flex flex-col gap-2';

export function StyleInspector({ selectedNode, onStyleChange, disabled = false }: StyleInspectorProps) {
  const style = (key: string): string => selectedNode.styles?.[key] ?? '';
  const set = (key: string, value: string): void => {
    if (!disabled) onStyleChange(key, value);
  };

  return (
    <div className={styleInspectorTw}>
      <p className={styleHintTw}>
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
        <div className={styleGrid4Tw}>
          <Field label="Largura"><TextInput compact value={style('width')} placeholder="100%" onChange={(v) => set('width', v)} disabled={disabled} /></Field>
          <Field label="Altura"><TextInput compact value={style('height')} placeholder="auto" onChange={(v) => set('height', v)} disabled={disabled} /></Field>
          <Field label="Largura mín."><TextInput compact value={style('minWidth')} placeholder="12rem" onChange={(v) => set('minWidth', v)} disabled={disabled} /></Field>
          <Field label="Largura máx."><TextInput compact value={style('maxWidth')} placeholder="42rem" onChange={(v) => set('maxWidth', v)} disabled={disabled} /></Field>
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
        <div className={styleGrid2Tw}>
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
          <div className={styleAlignTw}>
            {TEXT_ALIGNS.map((align) => (
              <button
                key={align}
                type="button"
                className={`${styleAlignButtonTw} ${style('textAlign') === align ? styleAlignButtonActiveTw : ''}`}
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
        <div className={styleGrid2Tw}>
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
        <div className={styleGrid4Tw}>
          <Field label="Topo"><TextInput compact value={style('top')} placeholder="0" onChange={(v) => set('top', v)} disabled={disabled} /></Field>
          <Field label="Direita"><TextInput compact value={style('right')} placeholder="0" onChange={(v) => set('right', v)} disabled={disabled} /></Field>
          <Field label="Baixo"><TextInput compact value={style('bottom')} placeholder="0" onChange={(v) => set('bottom', v)} disabled={disabled} /></Field>
          <Field label="Esquerda"><TextInput compact value={style('left')} placeholder="0" onChange={(v) => set('left', v)} disabled={disabled} /></Field>
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
          <div className={styleRangeTw}>
            <input
              type="range"
              className={styleRangeInputTw}
              min="0"
              max="1"
              step="0.05"
              value={parseNumber(style('opacity'), 1)}
              onChange={(e) => set('opacity', e.target.value)}
              disabled={disabled}
              aria-label="Opacidade"
            />
            <span className={styleRangeValueTw}>{style('opacity') || '1'}</span>
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
    <details className={styleGroupTw} open={defaultOpen}>
      <summary className={styleGroupSummaryTw}>
        {icon}
        <span>{title}</span>
        <span aria-hidden="true" className={styleGroupExpandIconTw}>+</span>
        <span aria-hidden="true" className={styleGroupCollapseIconTw}>−</span>
      </summary>
      <div className={styleGroupBodyTw}>{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={fieldTw}>
      <label className={fieldLabelTw}>{label}</label>
      <div className={fieldControlTw}>{children}</div>
    </div>
  );
}

function TextInput({
  value,
  placeholder,
  onChange,
  disabled,
  compact = false,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <input
      type="text"
      className={compact ? `${inputTw} ${compactInputTw}` : inputTw}
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
      className={selectTw}
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
      <div className={styleColorTw}>
        <input
          type="color"
          className={styleColorInputTw}
          value={hexOf(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={`Cor de ${label.toLowerCase()}`}
        />
        <input
          type="text"
          className={`${inputTw} ${styleColorTextTw}`}
          value={value}
          placeholder="#ffffff ou var(--primary)"
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className={stylePresetsTw}>
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={stylePresetTw}
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
    <div className={styleSpacingTw}>
      <Field label={label}>
        <TextInput value={shorthand} placeholder="1rem 2rem" onChange={(v) => set(prefix, v)} disabled={disabled} />
      </Field>
      <div className={styleGrid4Tw}>
        {sides.map((side) => (
          <Field key={side} label={side}>
            <TextInput
              compact
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
