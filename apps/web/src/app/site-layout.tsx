import type { CSSProperties, ReactNode } from "react";

const clampNum = (v: any, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const validLink = (v: any): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:|wa\.me\/)/i.test(s) ? s.slice(0, 500) : "#";
};
const validColor = (v: any): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, 300) : "";
  if (!s) return undefined;
  if (/url\s*\(|javascript|expression/i.test(s)) return undefined;
  if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
  if (/^(rgba?|hsla?)\s*\([0-9\s.,%]+\)$/i.test(s)) return s;
  if (/^linear-gradient\(/i.test(s)) return s;
  if (/^(white|black|transparent|currentColor)$/i.test(s)) return s;
  return undefined;
};
const validAlign = (v: any): "left" | "center" | "right" | "justify" | undefined =>
  (["left", "center", "right", "justify"] as const).find((a) => a === v);
const validJustify: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", between: "space-between" };
const validColAlign: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };

/** Converte **negrito**, *itálico* e ~~riscado~~ em elementos — sem HTML injetável (React escapa). */
function inlineMarkdown(text: string): ReactNode[] {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\n]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^~~[^~]+~~$/.test(part)) return <s key={i}>{part.slice(2, -2)}</s>;
    return <span key={i}>{part}</span>;
  });
}

function sanitizeStyle(s: any): CSSProperties {
  if (!s || typeof s !== "object") return {};
  const out: CSSProperties = {};
  if (s.padding !== undefined) out.padding = clampNum(s.padding, 0, 160, 0) + "px";
  if (s.margin !== undefined) out.margin = clampNum(s.margin, 0, 160, 0) + "px";
  const background = validColor(s.background); if (background) out.background = background;
  const color = validColor(s.color); if (color) out.color = color;
  if (s.fontSize !== undefined) out.fontSize = clampNum(s.fontSize, 10, 96, 16) + "px";
  return out;
}

function renderElement(el: any, key: number): ReactNode {
  if (!el || typeof el !== "object") return null;
  const style = sanitizeStyle(el.style);
  switch (el.type) {
    case "text": {
      const tag = (["p", "h1", "h2", "h3", "h4"] as const).find((t) => t === el.tag) ?? "p";
      return tag === "h1" ? <h1 key={key} style={{ ...style, textAlign: validAlign(el.align) }}>{inlineMarkdown(String(el.text ?? ""))}</h1>
        : tag === "h2" ? <h2 key={key} style={{ ...style, textAlign: validAlign(el.align) }}>{inlineMarkdown(String(el.text ?? ""))}</h2>
        : tag === "h3" ? <h3 key={key} style={{ ...style, textAlign: validAlign(el.align) }}>{inlineMarkdown(String(el.text ?? ""))}</h3>
        : tag === "h4" ? <h4 key={key} style={{ ...style, textAlign: validAlign(el.align) }}>{inlineMarkdown(String(el.text ?? ""))}</h4>
        : <p key={key} style={{ ...style, textAlign: validAlign(el.align) }}>{inlineMarkdown(String(el.text ?? ""))}</p>;
    }
    case "image": {
      const url = typeof el.url === "string" ? el.url : "";
      if (!/^(https:\/\/|\/api\/backend\/public\/site-assets\/)/.test(url)) return null;
      const width = clampNum(el.width, 10, 100, 100);
      const radius = clampNum(el.radius, 0, 64, 0);
      const imgStyle: CSSProperties = { width: width + "%", maxWidth: "100%", borderRadius: radius + "px", display: "block", height: "auto", objectFit: "cover" };
      if (el.align === "center") imgStyle.marginLeft = "auto", imgStyle.marginRight = "auto";
      else if (el.align === "right") imgStyle.marginLeft = "auto";
      const img = <img src={url} alt={typeof el.alt === "string" ? el.alt : ""} loading="lazy" style={imgStyle} />;
      const caption = el.caption ? <figcaption className="vx-caption">{String(el.caption)}</figcaption> : null;
      const linked = el.linkUrl ? (
        <a href={validLink(el.linkUrl)} target={el.linkTarget === "_blank" ? "_blank" : "_self"} rel={el.linkTarget === "_blank" ? "noopener noreferrer" : undefined} style={{ display: "block", textDecoration: "none" }}>{img}{caption}</a>
      ) : (<>{img}{caption}</>);
      return <figure key={key} style={{ ...style, margin: 0 }}>{linked}</figure>;
    }
    case "button": {
      const size = (["sm", "md", "lg"] as const).find((s) => s === el.size) ?? "md";
      const variant = (["solid", "outline", "ghost"] as const).find((v) => v === el.variant) ?? "solid";
      const background = validColor(el.background);
      const color = validColor(el.color);
      const className = `vx-button vx-button-${size} vx-button-${variant}${el.fullWidth === true ? " vx-button-full" : ""}`;
      return (
        <a key={key} className={className} href={validLink(el.href)} target={el.target === "_blank" ? "_blank" : "_self"} rel={el.target === "_blank" ? "noopener noreferrer" : undefined}
          style={{ ...style, ...(background ? { "--vx-btn-bg": background } as CSSProperties : {}), ...(color ? { "--vx-btn-fg": color } as CSSProperties : {}), borderRadius: clampNum(el.radius, 0, 64, 10) + "px", display: "inline-flex", width: el.fullWidth === true ? "100%" : undefined, textDecoration: "none" } as CSSProperties}>
          {String(el.label ?? "Botão")}
        </a>
      );
    }
    case "spacer":
      return <div key={key} aria-hidden="true" style={{ height: clampNum(el.height, 1, 240, 48) + "px" }} />;
    default:
      return null;
  }
}

/** Seção em colunas (layout) — usada em prévia, tema público e editor. */
export function LayoutBlock({ content }: { content: any }) {
  const columns = (Array.isArray(content?.columns) ? content.columns : []).slice(0, 4);
  if (!columns.length) return null;
  const colsValue = columns.map((c: any) => clampNum(c?.span, 1, 12, 6) + "fr").join(" ");
  const sectionStyle = {
    "--vx-cols": colsValue,
    display: "grid",
    gridTemplateColumns: "var(--vx-cols, 1fr)",
    gap: clampNum(content?.gap, 0, 96, 24) + "px",
    background: validColor(content?.background),
    padding: clampNum(content?.padding, 0, 200, 0) + "px",
    width: "100%",
  } as CSSProperties;
  return (
    <section className="vx-layout" style={sectionStyle}>
      {columns.map((col: any, i: number) => {
        const columnStyle: CSSProperties = {
          display: "flex",
          flexDirection: col?.direction === "row" ? "row" : "column",
          alignItems: validColAlign[col?.align] ?? "stretch",
          justifyContent: validJustify[col?.justify] ?? "flex-start",
          gap: clampNum(col?.gap, 0, 64, 12) + "px",
          flexWrap: "wrap",
          minWidth: 0,
        };
        return <div key={i} className="vx-layout-column" style={columnStyle}>{(Array.isArray(col?.elements) ? col.elements : []).map((el: any, j: number) => renderElement(el, j))}</div>;
      })}
    </section>
  );
}
