"use client";

import {
  DEFAULT_TAILWIND_SELECTION,
  TAILWIND_PALETTE,
  TAILWIND_WEIGHTS,
  hexToTailwindSelection,
  tailwindHex,
  tailwindSelectionToHex,
  type TailwindFamily,
  type TailwindWeight,
} from "../lib/tailwind-palette";

/** Blocos de família + slider de peso. O valor enviado ao chamador é sempre HEX. */
const pickerTw = "grid gap-2.5 rounded-token-sm border border-gray-200 bg-zinc-100 p-2.5";
const swatchListTw = "flex flex-wrap gap-1";
const swatchTw = "h-7 w-7 flex-none rounded-token-sm border border-line transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus";
const swatchSelectedTw = "ring-2 ring-blue-700";
const sliderTw = "w-full accent-blue-700";
const metaTw = "grid gap-1 text-2xs text-ink-secondary";
const metaHeadTw = "flex items-center justify-between gap-2";
const hexTw = "font-bold text-ink";
const previewTw = "grid gap-2 rounded-token-sm border border-gray-200 bg-zinc-100 p-2.5";
const previewRowTw = "flex flex-wrap items-center gap-1.5";
const previewChipTw = "rounded-token-sm px-2 py-1 text-2xs font-bold";
const previewThemeTw = "flex flex-wrap items-center gap-2 rounded-token-sm px-2.5 py-2 text-2xs";
const previewDotTw = "h-3 w-3 flex-none rounded-full border border-line";

export function TailwindColorPicker({
  value,
  onChange,
  label,
  ariaLabel,
  swatchAriaLabel,
  fallback = DEFAULT_TAILWIND_SELECTION,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  ariaLabel: string;
  swatchAriaLabel?: string;
  fallback?: Pick<{ family: TailwindFamily; weight: TailwindWeight }, "family" | "weight">;
}) {
  const selected = hexToTailwindSelection(value, fallback);

  const chooseFamily = (family: TailwindFamily) => {
    onChange(tailwindSelectionToHex(family, selected.weight));
  };

  const chooseWeight = (weight: TailwindWeight) => {
    onChange(tailwindSelectionToHex(selected.family, weight));
  };

  return (
    <div role="group" aria-label={ariaLabel} className={pickerTw}>
      <div className={swatchListTw} aria-label={`Famílias de cor para ${label}`}>
        {TAILWIND_PALETTE.map((swatch) => {
          const active = swatch.family === selected.family;
          return (
            <button
              key={swatch.family}
              type="button"
              aria-label={`${swatchAriaLabel ?? "Escolher " + label.toLowerCase()} · ${swatch.label}`}
              aria-pressed={active}
              title={`${swatch.label} · ${selected.weight}`}
              onClick={() => chooseFamily(swatch.family)}
              className={`${swatchTw} ${active ? swatchSelectedTw : ""}`}
              style={{ backgroundColor: tailwindHex(swatch.family, selected.weight) }}
            />
          );
        })}
      </div>
      <label className={metaTw}>
        <span className={metaHeadTw}>
          <span>Peso Tailwind · {selected.weight}</span>
          <span className={hexTw}>{selected.hex}</span>
        </span>
        <input
          type="range"
          min={TAILWIND_WEIGHTS[0]}
          max={TAILWIND_WEIGHTS[TAILWIND_WEIGHTS.length - 1]}
          step={50}
          value={selected.weight}
          aria-label={`Peso da cor ${label}`}
          onChange={(event) => chooseWeight(Number(event.target.value) as TailwindWeight)}
          className={sliderTw}
        />
      </label>
    </div>
  );
}

export type TailwindPalettePreviewColors = {
  primary?: string;
  sidebarBackground?: string;
  sidebarForeground?: string;
  sidebarHover?: string;
};

/** Prévia em tempo real da sidebar e do tema geral, sempre em cores da paleta. */
export function TailwindPalettePreview({ colors }: { colors: TailwindPalettePreviewColors }) {
  const background = colors.sidebarBackground || tailwindHex("slate", 950);
  const foreground = colors.sidebarForeground || tailwindHex("slate", 50);
  const hover = colors.sidebarHover || tailwindHex("slate", 900);
  const primary = colors.primary || tailwindHex("blue", 700);
  const themeBackground = tailwindHex("slate", 900);
  const themeForeground = tailwindHex("slate", 50);

  return (
    <div role="group" aria-label="Prévia em tempo real das cores" className={previewTw}>
      <div className={previewRowTw}>
        <span className={previewChipTw} style={{ backgroundColor: background, color: foreground }}>
          Sidebar · fundo e texto
        </span>
        <span className={previewChipTw} style={{ backgroundColor: hover, color: foreground }}>
          Hover
        </span>
        <span className={previewChipTw} style={{ backgroundColor: primary, color: themeForeground }}>
          Item ativo
        </span>
      </div>
      <div className={previewThemeTw} style={{ backgroundColor: themeBackground, color: themeForeground }}>
        <span className={previewDotTw} style={{ backgroundColor: primary }} aria-hidden="true" />
        Tema geral · cor predominante aplicada
      </div>
    </div>
  );
}
