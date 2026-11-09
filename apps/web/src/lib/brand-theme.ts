import { brandTextColor } from "./tenant-cache";

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
