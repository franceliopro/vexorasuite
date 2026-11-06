import { brandTextColor } from "./tenant-cache";

/** Applies the tenant brand color to the document. Single source of truth for --primary* tokens. */
export function applyBrandTheme(color: string, root: HTMLElement = document.documentElement): void {
  root.style.setProperty("--primary", color);
  root.style.setProperty("--primary-contrast", brandTextColor(color));
  root.style.setProperty("--primary-soft", `color-mix(in srgb, ${color} 13%, var(--card))`);
}
