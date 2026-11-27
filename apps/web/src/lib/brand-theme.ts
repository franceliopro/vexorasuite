import { brandTextColor } from "./tenant-cache";

export type BrandAssets = {
  primaryColor: string;
  logoLight?: string;
  logoDark?: string;
  favicon?: string;
  logoShape?: "square" | "round" | "rectangular";
  logoMaxWidth?: number;
  logoMaxHeight?: number;
  showCompanyName?: boolean;
  fontScalePercent?: number;
  displayName?: string;
  sidebarBackground?: string;
  sidebarForeground?: string;
  sidebarHover?: string;
};

/** WCAG contrast ratio between two #RRGGBB colors. */
export function wcagRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const a = lum(hexA), b = lum(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Applies the tenant brand color to the document. Single source of truth for --primary* tokens. */
export function applyBrandTheme(color: string, root: HTMLElement = document.documentElement): void {
  const contrast = brandTextColor(color);
  root.style.setProperty("--primary", color);
  root.style.setProperty("--primary-contrast", contrast);
  root.style.setProperty("--primary-soft", `color-mix(in srgb, ${color} 13%, var(--card))`);
  // Sidebar, highlights and focus rings follow the brand color automatically.
  root.style.setProperty("--sb-active", color);
  root.style.setProperty("--sb-active-tx", contrast);
  root.style.setProperty("--ring", `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)`);
}

/** Normalizes a picked color: returns the uppercase hex when valid, otherwise "". */
export function sanitizeHex(value: unknown): string {
  const clean = typeof value === "string" ? value.trim().toUpperCase() : "";
  return HEX.test(clean) ? clean : "";
}

/** A cor da marca sempre recebe texto automático com contraste AA. */
export function brandIsReadable(hex: string): boolean {
  const clean = sanitizeHex(hex);
  if (!clean) return false;
  return wcagRatio(clean, brandTextColor(clean)) >= 4.5;
}

/** Hybrid sidebar defaults (kept in sync with the `:root[data-theme=hybrid]` stylesheet). */
export const HYBRID_SIDEBAR_DEFAULTS = {
  background: "#1D4ED8",
  foreground: "#F8FAFC",
  hover: "#1E40AF",
} as const;

const SIDEBAR_PROPS = ["--sb-bg", "--sb-tx", "--sb-on", "--sb-ln", "--sb-mut", "--sb-thumb", "--sb-active-tx", "--sb-active"] as const;

/**
 * Super power of the hybrid theme: lets the company paint the sidebar itself.
 * Applies only while the hybrid theme is active; clears the inline overrides otherwise.
 * When a picker is empty, the stylesheet default (or the derived value) is used instead.
 */
export function applyHybridSidebar(
  custom: { sidebarBackground?: string; sidebarForeground?: string; sidebarHover?: string } | null | undefined,
  theme: string | undefined,
  root: HTMLElement = document.documentElement,
): void {
  const bg = sanitizeHex(custom?.sidebarBackground || "");
  const fg = sanitizeHex(custom?.sidebarForeground || "");
  const hover = sanitizeHex(custom?.sidebarHover || "");
  const clear = () => { for (const prop of SIDEBAR_PROPS) root.style.removeProperty(prop); };
  if (theme !== "hybrid") { clear(); return; }
  if (!bg && !fg && !hover) { clear(); return; }
  const background = bg || HYBRID_SIDEBAR_DEFAULTS.background;
  const foreground = fg || HYBRID_SIDEBAR_DEFAULTS.foreground;
  const hoverColor = hover || `color-mix(in srgb, ${foreground} 12%, ${background})`;
  root.style.setProperty("--sb-bg", background);
  root.style.setProperty("--sb-tx", foreground);
  root.style.setProperty("--sb-on", hoverColor);
  root.style.setProperty("--sb-ln", `color-mix(in srgb, ${foreground} 20%, ${background})`);
  root.style.setProperty("--sb-mut", `color-mix(in srgb, ${foreground} 84%, ${background})`);
  root.style.setProperty("--sb-thumb", `color-mix(in srgb, ${foreground} 52%, ${background})`);
}

/** Applies brand tokens that depend on the active theme (primary always; hybrid sidebar only). */
export function applyBrandAll(
  assets: BrandAssets | null | undefined,
  theme: string | undefined,
  root: HTMLElement = document.documentElement,
): void {
  if (!assets) return;
  const primary = sanitizeHex(assets.primaryColor);
  if (primary) applyBrandTheme(primary, root);
  applyHybridSidebar(assets, theme, root);
}
