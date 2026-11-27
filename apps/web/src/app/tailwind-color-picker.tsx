"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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

/** Famílias + tom exato da paleta. O valor enviado ao chamador continua sendo HEX. */
const pickerTw = "grid gap-2.5 rounded-token-sm border border-gray-200 bg-zinc-100 p-2.5";
const swatchListTw = "flex flex-wrap gap-1";
const swatchTw = "h-7 w-7 flex-none rounded-token-sm border border-line transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus";
const swatchSelectedTw = "ring-2 ring-blue-700";
const sliderTw = "w-full accent-blue-700";
const metaTw = "grid gap-1 text-2xs text-ink-secondary";
const metaHeadTw = "flex items-center justify-between gap-2";
const hexTw = "font-bold text-ink";
const hintTw = "m-0 text-2xs leading-normal text-slate-600";
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
  /** O range trabalha com ÍNDICE; o valor exposto é sempre um peso canônico. */
  const selectedIndex = Math.max(0, TAILWIND_WEIGHTS.indexOf(selected.weight));
  const rootRef = useRef<HTMLDivElement>(null);

  const chooseFamily = useCallback(
    (family: TailwindFamily) => onChange(tailwindSelectionToHex(family, selected.weight)),
    [onChange, selected.weight],
  );

  const chooseWeight = useCallback(
    (weight: TailwindWeight) => onChange(tailwindSelectionToHex(selected.family, weight)),
    [onChange, selected.family],
  );

  const stepBy = useCallback(
    (delta: number) => {
      const next = Math.min(TAILWIND_WEIGHTS.length - 1, Math.max(0, selectedIndex + delta));
      const weight = TAILWIND_WEIGHTS[next];
      if (weight !== undefined && weight !== selected.weight) chooseWeight(weight);
    },
    [chooseWeight, selected.weight, selectedIndex],
  );

  /** Rodinha: listener nativo não-passivo para poder cancelar o scroll da página. */
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaX === 0 && event.deltaY === 0) return;
      if (!node.matches(":hover") && !node.contains(document.activeElement)) return;
      event.preventDefault();
      stepBy(event.deltaY < 0 || event.deltaX < 0 ? 1 : -1);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [stepBy]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      stepBy(1);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      stepBy(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      chooseWeight(TAILWIND_WEIGHTS[0]!);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      chooseWeight(TAILWIND_WEIGHTS[TAILWIND_WEIGHTS.length - 1]!);
    }
  };

  return (
    <div ref={rootRef} role="group" aria-label={ariaLabel} className={pickerTw}>
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
          <span>Tom {selected.weight}</span>
          <span className={hexTw}>{selected.hex}</span>
        </span>
        <input
          type="range"
          min={0}
          max={TAILWIND_WEIGHTS.length - 1}
          step={1}
          value={selectedIndex}
          aria-label={`Tom da cor ${label}`}
          aria-valuetext={`Tom ${selected.weight} · ${selected.hex}`}
          onChange={(event) =>
            chooseWeight(TAILWIND_WEIGHTS[Number(event.target.value)] ?? selected.weight)
          }
          onKeyDown={onKeyDown}
          className={sliderTw}
        />
        <span className={hintTw}>Use ← → ou a rodinha para ajustar o tom.</span>
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

/** Prévia em tempo real, com linguagem de produto (não de implementação). */
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
          Menu
        </span>
        <span className={previewChipTw} style={{ backgroundColor: hover, color: foreground }}>
          Destaque
        </span>
        <span className={previewChipTw} style={{ backgroundColor: primary, color: themeForeground }}>
          Selecionado
        </span>
      </div>
      <div className={previewThemeTw} style={{ backgroundColor: themeBackground, color: themeForeground }}>
        <span className={previewDotTw} style={{ backgroundColor: primary }} aria-hidden="true" />
        Botões e realces seguem esta cor
      </div>
    </div>
  );
}
