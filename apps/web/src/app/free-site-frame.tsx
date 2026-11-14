"use client";

import { useEffect, useRef, useState } from "react";
import sanitizeHtml from "sanitize-html";

export type FreeSiteContent = { html: string; css: string };
type Selection = { index: number; tag: string; text: string; url: string; alt: string; style: Record<string, string> };

const selector = "section,header,footer,article,aside,div,h1,h2,h3,h4,p,a,img,li";
const controls = [
  ["color", "Cor do texto"], ["background-color", "Cor de fundo"], ["font-family", "Fonte"],
  ["font-size", "Tamanho da letra"], ["padding", "Espaçamento interno"], ["margin", "Margem"],
] as const;
const policy = "default-src 'none'; style-src 'unsafe-inline'; font-src 'self' data:; img-src https: data:; base-uri 'none'; form-action 'none'; object-src 'none'";

const localFonts = [
  ["DM Sans", "dm-sans-latin", "100 1000"],
  ["Manrope", "manrope-latin", "200 800"],
  ["Inter", "inter-var", "100 900"],
  ["Playfair Display", "playfair-display-var", "400 900"],
  ["Fraunces", "fraunces-var", "100 900"],
  ["DM Serif Display", "dm-serif-display-latin", "400"],
].map(([family, asset, weights]) => "@font-face{font-family:'" + family + "';src:url('/fonts/" + asset + ".woff2') format('woff2');font-weight:" + weights + ";font-display:swap}").join("");

function safeDocument(content: FreeSiteContent) {
  const html = sanitizeHtml(content.html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "picture", "source", "details", "summary"],
    allowedAttributes: { "*": ["id", "class", "role", "aria-*", "data-vx-element"], a: ["href", "target", "rel"], img: ["src", "alt", "width", "height", "loading"], source: ["srcset", "media", "type"] },
    allowedSchemes: ["https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: { a: (_tag, attrs) => {
      const href = attrs.href || "";
      const anchor = /^#[\w.-]+$/.test(href);
      const external = /^(https:\/\/|mailto:|tel:)/i.test(href);
      return { tagName: "a", attribs: { ...attrs, href: anchor || external ? href : "", target: external ? "_blank" : "_self", rel: "noopener noreferrer" } };
    } },
  });
  const css = /<\/style/i.test(content.css) ? "" : content.css.replace(/(-?\d*\.?\d+)(?:[sld]?vh)\b/gi, "calc(var(--vx-viewport-unit, 8px) * $1)");
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><style>body{margin:0}img{max-width:100%;height:auto}' + localFonts + '</style><style>' + css + '</style></head><body>' + html + '</body></html>';
}

export function FreeSiteFrame({ content, onSelect, onMove }: {
  content: FreeSiteContent; onSelect?: (selection: Selection) => void; onMove?: (source: number, target: number) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(520);
  useEffect(() => () => observer.current?.disconnect(), []);
  return <iframe ref={frame} title="Layout da página" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"
    srcDoc={safeDocument({ html: String(content?.html || ""), css: String(content?.css || "") })}
    style={{ display: "block", border: 0, width: "100%", height }}
    onLoad={() => {
      const doc = frame.current?.contentDocument;
      if (!doc || doc.URL !== "about:srcdoc") return;
      observer.current?.disconnect();
      const viewportUnit = () => doc.documentElement.style.setProperty("--vx-viewport-unit", window.innerHeight / 100 + "px");
      const resize = () => setHeight(Math.max(220, Math.ceil(doc.body.getBoundingClientRect().height)));
      viewportUnit();
      resize();
      observer.current = new ResizeObserver(resize);
      observer.current.observe(doc.body);
      if (!onSelect) return;
      const elements = Array.from(doc.body.querySelectorAll<HTMLElement>(selector));
      if (onMove) {
        let dragging: HTMLElement | null = null;
        for (const element of elements) element.draggable = true;
        doc.addEventListener("dragstart", event => {
          dragging = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector) ?? null;
          if (dragging) event.dataTransfer?.setData("text/plain", String(elements.indexOf(dragging)));
        });
        doc.addEventListener("dragover", event => {
          const target = (event.target as HTMLElement | null)?.closest(selector);
          if (dragging && target && dragging !== target && dragging.parentElement === target.parentElement) event.preventDefault();
        });
        doc.addEventListener("drop", event => {
          const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector);
          if (!dragging || !target || dragging === target || dragging.parentElement !== target.parentElement) return;
          event.preventDefault();
          onMove(elements.indexOf(dragging), elements.indexOf(target));
          dragging = null;
        });
      }
      doc.addEventListener("click", event => {
        const element = (event.target as Element | null)?.closest(selector);
        if (!element || !doc.body.contains(element)) return;
        event.preventDefault();
        const index = elements.indexOf(element as HTMLElement);
        for (const item of elements) item.style.removeProperty("outline");
        (element as HTMLElement).style.setProperty("outline", "2px solid #38bdf8", "important");
        const computed = doc.defaultView?.getComputedStyle(element);
        onSelect({ index, tag: element.tagName.toLowerCase(), text: element.childElementCount ? "" : element.textContent || "",
          url: element.getAttribute(element.tagName === "IMG" ? "src" : "href") || "", alt: element.getAttribute("alt") || "",
          style: Object.fromEntries(controls.map(([key]) => [key, computed?.getPropertyValue(key) || ""])) });
      });
    }} />;
}

export function FreeSiteEditor({ content, onSave, onPrompt }: {
  content: FreeSiteContent; onSave: (value: FreeSiteContent) => void; onPrompt?: (prompt: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(content);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState("100%");
  const moveTo = (source: number, target: number) => {
    const parsed = new DOMParser().parseFromString(safeDocument(draft), "text/html");
    const elements = parsed.body.querySelectorAll(selector);
    const element = elements[source];
    const destination = elements[target];
    if (!element || !destination || element.parentElement !== destination.parentElement || source === target) return;
    if (source < target) destination.after(element);
    else destination.before(element);
    setDraft({ ...draft, html: parsed.body.innerHTML });
    setSelection(null);
  };
  const moveElement = (direction: -1 | 1) => {
    if (!selection) return;
    const parsed = new DOMParser().parseFromString(safeDocument(draft), "text/html");
    const element = parsed.body.querySelectorAll(selector)[selection.index];
    const sibling = direction === -1 ? element?.previousElementSibling : element?.nextElementSibling;
    if (!element || !sibling || !sibling.matches(selector)) return;
    if (direction === -1) sibling.before(element);
    else sibling.after(element);
    setDraft({ ...draft, html: parsed.body.innerHTML });
    setSelection(null);
  };
  const editElement = (key: string, value: string) => {
    if (!selection) return;
    const parsed = new DOMParser().parseFromString(safeDocument(draft), "text/html");
    const element = parsed.body.querySelectorAll(selector)[selection.index];
    if (!element) return;
    if (key === "text") {
      if (element.childElementCount) return;
      element.textContent = value;
      setSelection({ ...selection, text: value });
      setDraft({ ...draft, html: parsed.body.innerHTML });
      return;
    }
    if (key === "url" || key === "alt") {
      const attr = key === "alt" ? "alt" : selection.tag === "img" ? "src" : "href";
      if (key === "url" && value && !(selection.tag === "img" ? /^https:\/\//i.test(value) : /^(https:\/\/|mailto:|tel:|#[\w.-]+$)/i.test(value))) return;
      element.setAttribute(attr, value);
      setSelection({ ...selection, [key]: value });
      setDraft({ ...draft, html: parsed.body.innerHTML });
      return;
    }
    const style = parsed.createElement("span").style;
    style.setProperty(key, value);
    const cssValue = style.getPropertyValue(key);
    if (!cssValue || /[{}<>;]/.test(cssValue)) return;
    const id = "studio-" + selection.index;
    element.setAttribute("data-vx-element", id);
    const css = draft.css + "\n[data-vx-element='" + id + "']{" + key + ":" + cssValue + " !important}";
    setSelection({ ...selection, style: { ...selection.style, [key]: cssValue } });
    setDraft({ html: parsed.body.innerHTML, css });
  };
  return <div className="sites-studio-fields">
    <div className="sites-block-actions">
      <button type="button" className="secondary-button" aria-pressed={width === "100%"} onClick={() => setWidth("100%")}>Desktop</button>
      <button type="button" className="secondary-button" aria-pressed={width === "390px"} onClick={() => setWidth("390px")}>Celular</button>
      <button type="button" className="primary-button" onClick={() => onSave(draft)}>Aplicar alterações</button>
    </div>
    <div style={{ width, maxWidth: "100%", marginInline: "auto" }}><FreeSiteFrame content={draft} onSelect={setSelection} onMove={moveTo} /></div>
    {selection ? <div className="sites-block-form">
      <strong>Elemento {selection.tag}</strong>
      <div className="sites-block-actions">
        <button type="button" className="secondary-button" onClick={() => moveElement(-1)}>Mover acima</button>
        <button type="button" className="secondary-button" onClick={() => moveElement(1)}>Mover abaixo</button>
      </div>
      {["h1", "h2", "h3", "h4", "p", "a", "li"].includes(selection.tag) && selection.text && <label>Texto<input key={selection.index + "-text"} defaultValue={selection.text} onBlur={event => editElement("text", event.target.value)} /></label>}
      {["a", "img"].includes(selection.tag) && <label>{selection.tag === "img" ? "URL da imagem" : "Link"}<input key={selection.index + "-url"} defaultValue={selection.url} onBlur={event => editElement("url", event.target.value)} /></label>}
      {selection.tag === "img" && <label>Texto alternativo<input key={selection.index + "-alt"} defaultValue={selection.alt} onBlur={event => editElement("alt", event.target.value)} /></label>}
      {controls.map(([key, label]) => <label key={selection.index + key}>{label}<input defaultValue={selection.style[key]} onBlur={event => { if (event.target.value !== selection.style[key]) editElement(key, event.target.value); }} /></label>)}
    </div> : <p className="sites-field-hint">Selecione um elemento para editar ou arraste para reorganizar elementos da mesma seção.</p>}
    {onPrompt && <div className="sites-block-form"><label>Alterar com Design Gráfico &amp; Web<textarea value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
      <button type="button" className="secondary-button" disabled={busy || prompt.trim().length < 3} onClick={async () => {
        setBusy(true);
        try { await onPrompt(prompt); setPrompt(""); } finally { setBusy(false); }
      }}>{busy ? "Gerando…" : "Aplicar pedido"}</button></div>}
    <details><summary>HTML e CSS</summary>
      <div className="sites-block-form">
        <label>HTML<textarea rows={7} value={draft.html} onChange={event => { setSelection(null); setDraft({ ...draft, html: event.target.value }); }} /></label>
        <label>CSS<textarea rows={7} value={draft.css} onChange={event => { setSelection(null); setDraft({ ...draft, css: event.target.value }); }} /></label>
      </div>
    </details>
  </div>;
}
