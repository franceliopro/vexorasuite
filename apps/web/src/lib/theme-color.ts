export type ThemeMode = "hybrid" | "light" | "dark";

/** Mobile browser/status bar colors; each matches the page surface (--bg) of its theme. */
export const THEME_BAR_COLORS: Record<ThemeMode, string> = {
  light: "#F6F7F4",
  hybrid: "#F6F7F4",
  dark: "#0A0F0C",
};

/** Keeps <meta name="theme-color"> in sync with the active theme. */
export function applyThemeColor(theme: ThemeMode, doc: Document = document): void {
  const color = THEME_BAR_COLORS[theme];
  const metas = doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = doc.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    doc.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => { meta.content = color; });
}
