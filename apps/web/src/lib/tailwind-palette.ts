/**
 * Paleta oficial do Tailwind usada pelos seletores de cor da UI.
 *
 * O produto continua persistindo HEX (`sanitizeHex`, `/^#[0-9a-fA-F]{6}$/`);
 * este módulo apenas converte famílias/pesos em HEX para a interface. Nenhum
 * valor aqui é token de tema: são as cores canônicas do Tailwind.
 */

export const TAILWIND_WEIGHTS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type TailwindWeight = (typeof TAILWIND_WEIGHTS)[number];
export type TailwindFamily =
  | "slate"
  | "blue"
  | "violet"
  | "cyan"
  | "fuchsia"
  | "amber"
  | "emerald"
  | "rose"
  | "orange";

type TailwindShades = Record<TailwindWeight, string>;

export type TailwindSwatch = {
  family: TailwindFamily;
  label: string;
  shades: TailwindShades;
};

/** Tons reais do Tailwind CSS (v3/v4), em maiúsculas para casar com o backend. */
export const TAILWIND_PALETTE: readonly TailwindSwatch[] = [
  {
    family: "slate",
    label: "Slate",
    shades: {
      50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8",
      500: "#64748B", 600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A", 950: "#020617",
    },
  },
  {
    family: "blue",
    label: "Blue",
    shades: {
      50: "#EFF6FF", 100: "#DBEAFE", 200: "#BFDBFE", 300: "#93C5FD", 400: "#60A5FA",
      500: "#3B82F6", 600: "#2563EB", 700: "#1D4ED8", 800: "#1E40AF", 900: "#1E3A8A", 950: "#172554",
    },
  },
  {
    family: "violet",
    label: "Violet",
    shades: {
      50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 300: "#C4B5FD", 400: "#A78BFA",
      500: "#8B5CF6", 600: "#7C3AED", 700: "#6D28D9", 800: "#5B21B6", 900: "#4C1D95", 950: "#2E1065",
    },
  },
  {
    family: "cyan",
    label: "Cyan",
    shades: {
      50: "#ECFEFF", 100: "#CFFAFE", 200: "#A5F3FC", 300: "#67E8F9", 400: "#22D3EE",
      500: "#06B6D4", 600: "#0891B2", 700: "#0E7490", 800: "#155E75", 900: "#164E63", 950: "#083344",
    },
  },
  {
    family: "fuchsia",
    label: "Fuchsia",
    shades: {
      50: "#FDF4FF", 100: "#FAE8FF", 200: "#F5D0FE", 300: "#F0ABFC", 400: "#E879F9",
      500: "#D946EF", 600: "#C026D3", 700: "#A21CAF", 800: "#86198F", 900: "#701A75", 950: "#4A044E",
    },
  },
  {
    family: "amber",
    label: "Amber",
    shades: {
      50: "#FFFBEB", 100: "#FEF3C7", 200: "#FDE68A", 300: "#FCD34D", 400: "#FBBF24",
      500: "#F59E0B", 600: "#D97706", 700: "#B45309", 800: "#92400E", 900: "#78350F", 950: "#451A03",
    },
  },
  {
    family: "emerald",
    label: "Emerald",
    shades: {
      50: "#ECFDF5", 100: "#D1FAE5", 200: "#A7F3D0", 300: "#6EE7B7", 400: "#34D399",
      500: "#10B981", 600: "#059669", 700: "#047857", 800: "#065F46", 900: "#064E3B", 950: "#022C22",
    },
  },
  {
    family: "rose",
    label: "Rose",
    shades: {
      50: "#FFF1F2", 100: "#FFE4E6", 200: "#FECDD3", 300: "#FDA4AF", 400: "#FB7185",
      500: "#F43F5E", 600: "#E11D48", 700: "#BE123C", 800: "#9F1239", 900: "#881337", 950: "#4C0519",
    },
  },
  {
    family: "orange",
    label: "Orange",
    shades: {
      50: "#FFF7ED", 100: "#FFEDD5", 200: "#FED7AA", 300: "#FDBA74", 400: "#FB923C",
      500: "#F97316", 600: "#EA580C", 700: "#C2410C", 800: "#9A3412", 900: "#7C2D12", 950: "#431407",
    },
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Cor comum recomendada para a marca: blue-700 (azul escuro do Tailwind). */
export const DEFAULT_TAILWIND_SELECTION = { family: "blue" as TailwindFamily, weight: 700 as TailwindWeight };

export type TailwindSelection = { family: TailwindFamily; weight: TailwindWeight; hex: string };

export function tailwindHex(family: TailwindFamily, weight: TailwindWeight): string {
  const swatch = TAILWIND_PALETTE.find((item) => item.family === family);
  return (swatch?.shades[weight] ?? TAILWIND_PALETTE[0]!.shades[50]).toUpperCase();
}

/** Converte a seleção da UI no HEX que o backend espera. */
export function tailwindSelectionToHex(family: TailwindFamily, weight: TailwindWeight): string {
  return tailwindHex(family, weight);
}

/** Reconhece um HEX salvo e devolve família/peso para posicionar os controles. */
export function hexToTailwindSelection(
  value: string | null | undefined,
  fallback: Pick<TailwindSelection, "family" | "weight"> = DEFAULT_TAILWIND_SELECTION,
): TailwindSelection {
  const clean = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (HEX.test(clean)) {
    for (const swatch of TAILWIND_PALETTE) {
      for (const weight of TAILWIND_WEIGHTS) {
        if (swatch.shades[weight] === clean) return { family: swatch.family, weight, hex: clean };
      }
    }
  }
  return { ...fallback, hex: tailwindHex(fallback.family, fallback.weight) };
}
