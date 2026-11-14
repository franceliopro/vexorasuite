"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, ChevronUp, ChevronDown, Copy, Trash2, X } from "lucide-react";
import sanitizeHtml from "sanitize-html";

export type FreeSiteContent = { html: string; css: string };
type Selection = { index: number; tag: string; text: string; url: string; alt: string; style: Record<string, string> };

const selector = "section,header,footer,article,aside,div,h1,h2,h3,h4,p,a,img,li";
const controls = [
  ["color", "Texto"], ["background-color", "Fundo"], ["font-family", "Fonte"],
  ["font-size", "Tamanho"], ["font-weight", "Peso"], ["letter-spacing", "Entrelinhas"],
  ["line-height", "Altura de linha"], ["text-align", "Alinhamento"], ["text-transform", "Caixa alta"],
  ["opacity", "Opacidade"], ["padding", "Espaço interno"], ["margin", "Margem"],
  ["border-radius", "Cantos"], ["border", "Borda"], ["box-shadow", "Sombra"],
] as const;
const policy = "default-src 'none'; style-src 'unsafe-inline' https:; font-src 'self' https: data:; img-src https: data:; base-uri 'none'; form-action 'none'; object-src 'none'";

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
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "picture", "source", "details", "summary", "link"],
    allowedAttributes: { "*": ["id", "class", "role", "aria-*", "data-vx-element", "style"], a: ["href", "target", "rel"], img: ["src", "alt", "width", "height", "loading"], source: ["srcset", "media", "type"], link: ["rel", "href", "crossorigin", "media", "as", "type"] },
    allowedSchemes: ["https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: { a: (_tag, attrs) => {
      const href = attrs.href || "";
      const anchor = /^#[\w.-]+$/.test(href);
      const external = /^(https:\/\/|mailto:|tel:)/i.test(href);
      return { tagName: "a", attribs: { ...attrs, href: anchor || external ? href : "", target: external ? "_blank" : "_self", rel: "noopener noreferrer" } };
    } },
  });
  const rawCss = /<\/style/i.test(content.css) ? "" : content.css.replace(/(-?\d*\.?\d+)(?:[sld]?vh)\b/gi, "calc(var(--vx-viewport-unit, 8px) * $1)");
  // Nunca permitir que um CSS gerado "amamante" a página: remove travamento de scroll/altura do documento.
  const src = rawCss
    .replace(/overflow\s*:\s*hidden/gi, "overflow: auto")
    .replace(/height\s*:\s*(-?\d*\.?\d+)(vh|dvh|%)/gi, "min-height: $1dvh");
  const css = src + "html,body,:root{overflow:auto!important;height:auto!important;margin:0!important}";
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><style>body{margin:0}img{max-width:100%;height:auto}' + localFonts + '</style><style>' + css + '</style></head><body>' + html + '</body></html>';
}

export function FreeSiteFrame({ content, onSelect, onMove, mouseParallax, scrollReveal }: {
  content: FreeSiteContent; onSelect?: (selection: Selection) => void; onMove?: (source: number, target: number) => void;
  /** Efeito sutil de profundidade com o mouse (moldura do site; respeita prefers-reduced-motion). */
  mouseParallax?: boolean;
  /** Revela elementos do site ao rolar a página (IntersectionObserver dentro da moldura). */
  scrollReveal?: boolean;
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
      const reducedMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (mouseParallax && !reducedMotion) {
        try {
          const layers: { el: HTMLElement; depth: number; suffix: string }[] = [];
          const collect = (selectorText: string, depth: number, suffix = "") => {
            const el = doc.querySelector<HTMLElement>(selectorText);
            if (el) layers.push({ el, depth, suffix });
          };
          collect(".vx-art", 16);
          collect(".vx-window", 9, " rotate(-0.6deg)");
          collect(".vx-hero-txt", -5);
          if (layers.length) {
            let targetX = 0, targetY = 0, currentX = 0, currentY = 0, raf = 0;
            const tick = () => {
              currentX += (targetX - currentX) * 0.12;
              currentY += (targetY - currentY) * 0.12;
              for (const { el, depth, suffix } of layers) {
                el.style.transform = "translate3d(" + (currentX * depth).toFixed(2) + "px," + (currentY * depth * 0.62).toFixed(2) + "px,0)" + suffix;
              }
              if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) raf = requestAnimationFrame(tick);
              else raf = 0;
            };
            const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
            doc.addEventListener("pointermove", (event) => {
              const rect = doc.documentElement.getBoundingClientRect();
              if (!rect.width || !rect.height) return;
              targetX = Math.max(-1.2, Math.min(1.2, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
              targetY = Math.max(-1.2, Math.min(1.2, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
              kick();
            });
            doc.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; kick(); });
          }
        } catch { /* o efeito é decorativo; o site funciona sem ele */ }
      }
      if (scrollReveal && !reducedMotion) {
        try {
          const targets = Array.from(doc.querySelectorAll<HTMLElement>(".vx-head-row,.vx-mod,.vx-persona,.vx-plan,.vx-quote,.vx-faq-item,.vx-cta h2"));
          if (targets.length) {
            for (const t of targets) t.classList.add("vx-reveal");
            const frameWindow = doc.defaultView as (Window & typeof globalThis) | null;
            const Observer = (frameWindow as any)?.IntersectionObserver;
            if (Observer) {
              const io = new Observer((entries: any[]) => {
                for (const entry of entries) {
                  if (entry.isIntersecting) {
                    entry.target.classList.add("vx-in");
                    io.unobserve(entry.target);
                  }
                }
              }, { threshold: 0.12, rootMargin: "0px 0px -48px 0px" });
              for (const t of targets) io.observe(t);
            } else {
              for (const t of targets) t.classList.add("vx-in");
            }
          }
        } catch { /* o efeito é decorativo; o site funciona sem ele */ }
      }
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
  const [tab, setTab] = useState<"gerais" | "estilos" | "animacoes" | "codigo">("gerais");
  const [linkParam, setLinkParam] = useState("");
  const ANIM_KEYFRAMES = "@keyframes vx-anim-fade-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes vx-anim-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@keyframes vx-anim-pulse{0%,100%{box-shadow:0 0 0 0 rgba(46,124,246,.4)}50%{box-shadow:0 0 0 12px rgba(46,124,246,0)}}";
  const toHex = (v: string) => {
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(v || "");
    if (m) return "#" + [m[1] ?? "0", m[2] ?? "0", m[3] ?? "0"].map(n => ("0" + Number(n).toString(16)).slice(-2)).join("");
    return /^#[0-9a-f]{6}$/i.test(v || "") ? v! : "#000000";
  };
  const setAnimation = (name: "none" | "fade-up" | "float" | "pulse") => {
    if (!selection) return;
    const value = name === "none" ? "none" : name === "float" ? "vx-anim-float 2.6s ease-in-out infinite" : name === "pulse" ? "vx-anim-pulse 2.2s ease-in-out infinite" : "vx-anim-fade-up .7s cubic-bezier(.2,.7,.3,1) both";
    const withAnims = name !== "none" && !draft.css.includes("vx-anim-fade-up") ? draft.css + "\n" + ANIM_KEYFRAMES : draft.css;
    const parsed = new DOMParser().parseFromString(safeDocument({ html: draft.html, css: withAnims }), "text/html");
    const element = parsed.body.querySelectorAll(selector)[selection.index] as HTMLElement | undefined;
    if (!element) return;
    const id = "studio-" + selection.index;
    element.setAttribute("data-vx-element", id);
    const css = withAnims + "\n[data-vx-element='" + id + "']{animation:" + value + " !important}";
    setDraft({ html: parsed.body.innerHTML, css });
  };
  const duplicateElement = () => {
    if (!selection) return;
    const parsed = new DOMParser().parseFromString(safeDocument(draft), "text/html");
    const elements = parsed.body.querySelectorAll(selector);
    const element = elements[selection.index] as HTMLElement | undefined;
    if (!element || !element.parentElement) return;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.removeAttribute("data-vx-element");
    element.after(clone);
    setDraft({ ...draft, html: parsed.body.innerHTML });
    setSelection(null);
  };
  const deleteElement = () => {
    if (!selection) return;
    const parsed = new DOMParser().parseFromString(safeDocument(draft), "text/html");
    const element = parsed.body.querySelectorAll(selector)[selection.index] as HTMLElement | undefined;
    if (!element) return;
    element.remove();
    setDraft({ ...draft, html: parsed.body.innerHTML });
    setSelection(null);
  };
  const applyLinkAction = (action: "keep" | "newTab" | "sameTab" | "whatsapp" | "tel" | "mailto" | "anchor") => {
    if (!selection || selection.tag !== "a") return;
    const parsed = new DOMParser().parseFromString(safeDocument(draft), "text/html");
    const element = parsed.body.querySelectorAll(selector)[selection.index] as HTMLAnchorElement | undefined;
    if (!element) return;
    const param = linkParam.trim();
    const digits = param.replace(/\D/g, "");
    const href = element.getAttribute("href") || "#";
    const set = (h: string, target?: string) => { element.setAttribute("href", h); if (target) { element.setAttribute("target", target); } if (target === "_blank") { element.setAttribute("rel", "noopener noreferrer"); } };
    if (action === "keep") { /* nada muda */ }
    else if (action === "newTab") set(href, "_blank");
    else if (action === "sameTab") set(href, "_self");
    else if (action === "whatsapp" && digits) set("https://wa.me/" + digits, "_blank");
    else if (action === "tel" && digits) set("tel:" + digits, "_self");
    else if (action === "mailto" && param.includes("@")) set("mailto:" + param, "_self");
    else if (action === "anchor" && param.startsWith("#")) set(param, "_self");
    setDraft({ ...draft, html: parsed.body.innerHTML });
  };
  const FONT_STACKS: [string, string][] = [
    ["Padrão do site", ""],
    ["Manrope (Véxora)", "'Manrope',sans-serif"],
    ["DM Sans", "'DM Sans',sans-serif"],
    ["Inter", "'Inter',sans-serif"],
    ["Playfair Display", "'Playfair Display',serif"],
    ["Fraunces", "'Fraunces',serif"],
    ["DM Serif Display", "'DM Serif Display',serif"],
  ];
  const fontStackMatch = (v: string) => {
    const low = (v || "").toLowerCase();
    const hit = FONT_STACKS.find(([, stack]) => stack && low.includes(stack.split(",")[0]!.replace(/['"]/g, "").toLowerCase()));
    return hit?.[1] ?? "";
  };
  const textEditable = !!selection && ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "li", "blockquote", "span", "strong", "em", "small"].includes(selection.tag) && !selection.text.includes("\n");
  const fontFamily = selection ? fontStackMatch(selection.style["font-family"] || "") : "";
  return <div className="sites-studio-editor">
    <div className="sites-studio-canvas-bar">
      <div className="sites-studio-device-toggle" role="group" aria-label="Visualizar em">
        <button type="button" aria-pressed={width === "100%"} className={width === "100%" ? "active" : ""} onClick={() => setWidth("100%")}><Monitor size={13} aria-hidden="true" /> PC</button>
        <button type="button" aria-pressed={width === "390px"} className={width === "390px" ? "active" : ""} onClick={() => setWidth("390px")}><Smartphone size={13} aria-hidden="true" /> Celular</button>
      </div>
      <button type="button" className="primary-button" onClick={() => onSave(draft)}>Aplicar alterações</button>
    </div>
    <div className="sites-studio-editor-body">
      <div className="sites-studio-canvas-wrap" style={{ width: width === "390px" ? 400 : "100%", maxWidth: "100%", marginInline: "auto" }}><FreeSiteFrame content={draft} onSelect={setSelection} onMove={moveTo} /></div>
      {selection ? <aside className="sites-inspector" aria-label="Propriedades do elemento">
        <header className="sites-inspector-head">
          <div><span className="sites-inspector-kicker">Elemento selecionado</span><strong>{selection.tag}</strong></div>
          <div className="sites-inspector-head-actions">
            <button type="button" className="icon-button" onClick={() => moveElement(-1)} title="Mover para cima" aria-label="Mover elemento para cima"><ChevronUp size={14} aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={() => moveElement(1)} title="Mover para baixo" aria-label="Mover elemento para baixo"><ChevronDown size={14} aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={duplicateElement} title="Duplicar elemento" aria-label="Duplicar elemento"><Copy size={14} aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={deleteElement} title="Excluir elemento" aria-label="Excluir elemento"><Trash2 size={14} aria-hidden="true" /></button>
            <button type="button" className="icon-button" onClick={() => setSelection(null)} title="Fechar" aria-label="Fechar painel do elemento"><X size={14} aria-hidden="true" /></button>
          </div>
        </header>
        <div className="sites-inspector-tabs" role="tablist" aria-label="Seções do inspetor">
          <button type="button" role="tab" aria-selected={tab === "gerais"} className={"sites-inspector-tab" + (tab === "gerais" ? " is-active" : "")} onClick={() => setTab("gerais")}>Gerais</button>
          <button type="button" role="tab" aria-selected={tab === "estilos"} className={"sites-inspector-tab" + (tab === "estilos" ? " is-active" : "")} onClick={() => setTab("estilos")}>Estilos</button>
          <button type="button" role="tab" aria-selected={tab === "animacoes"} className={"sites-inspector-tab" + (tab === "animacoes" ? " is-active" : "")} onClick={() => setTab("animacoes")}>Animações</button>
          <button type="button" role="tab" aria-selected={tab === "codigo"} className={"sites-inspector-tab" + (tab === "codigo" ? " is-active" : "")} onClick={() => setTab("codigo")}>Código</button>
        </div>
        <div className="sites-inspector-body">
          {tab === "gerais" && <>
            {textEditable && <label className="sites-inspector-field"><span>Texto</span><textarea rows={2} key={"t" + selection.index + selection.text} defaultValue={selection.text} onBlur={event => editElement("text", event.target.value)} /></label>}
            {["a", "img"].includes(selection.tag) && <label className="sites-inspector-field"><span>{selection.tag === "img" ? "URL da imagem" : "Link"}</span><input key={"u" + selection.index + selection.url} defaultValue={selection.url} onBlur={event => editElement("url", event.target.value)} /></label>}
            {selection.tag === "img" && <label className="sites-inspector-field"><span>Texto alternativo</span><input key={"a" + selection.index + selection.alt} defaultValue={selection.alt} onBlur={event => editElement("alt", event.target.value)} /></label>}
            {selection.tag === "a" && <fieldset className="sites-inspector-field"><legend>Ação do botão</legend>
              <input className="sites-inspector-input" placeholder="Número, e-mail ou #âncora — ex.: 5562999990000" value={linkParam} onChange={event => setLinkParam(event.target.value)} aria-label="Parâmetro da ação (número, e-mail ou âncora)" />
              <div className="sites-inspector-action-grid">
                <button type="button" onClick={() => applyLinkAction("keep")}>Manter link</button>
                <button type="button" onClick={() => applyLinkAction("sameTab")}>Mesma aba</button>
                <button type="button" onClick={() => applyLinkAction("newTab")}>Nova aba</button>
                <button type="button" onClick={() => applyLinkAction("whatsapp")}>WhatsApp</button>
                <button type="button" onClick={() => applyLinkAction("tel")}>Ligar</button>
                <button type="button" onClick={() => applyLinkAction("mailto")}>E-mail</button>
                <button type="button" onClick={() => applyLinkAction("anchor")}>Âncora</button>
              </div>
              <small className="sites-field-hint">Ex.: WhatsApp abre o wa.me com o número digitado.</small>
            </fieldset>}
            <p className="sites-field-hint">Selecione outro elemento no canvas para ajustar. Use a aba Estilos para cores e espaçamento.</p>
          </>}
          {tab === "estilos" && <>
            <div className="sites-inspector-group"><span className="sites-inspector-group-label">Texto</span>
              <label className="sites-inspector-field"><span>Cor do texto</span><input type="color" value={toHex(selection.style["color"] || "")} onChange={event => editElement("color", event.target.value)} /></label>
              <label className="sites-inspector-field"><span>Fundo</span><input type="color" value={toHex(selection.style["background-color"] || "")} onChange={event => editElement("background-color", event.target.value)} /></label>
              <label className="sites-inspector-field"><span>Fonte</span><select key={"f" + selection.index} defaultValue={fontFamily} onChange={event => { if (event.target.value) editElement("font-family", event.target.value); }}>{FONT_STACKS.map(([label, stack]) => <option key={label} value={stack}>{label}</option>)}</select></label>
              <label className="sites-inspector-field"><span>Tamanho da letra</span><input key={"fs" + selection.index} defaultValue={selection.style["font-size"] || ""} placeholder="ex.: 16px" onBlur={event => editElement("font-size", event.target.value)} /></label>
              <label className="sites-inspector-field"><span>Peso da fonte</span><select key={"fw" + selection.index} defaultValue={(selection.style["font-weight"] || "").replace(/[^0-9]/g, "")} onChange={event => editElement("font-weight", event.target.value)}><option value="">Original</option><option value="400">Normal (400)</option><option value="500">Médio (500)</option><option value="600">Semibold (600)</option><option value="700">Negrito (700)</option><option value="800">Extra-negrito (800)</option></select></label>
              <label className="sites-inspector-field"><span>Espaçamento entre letras</span><select key={"ls" + selection.index} defaultValue={selection.style["letter-spacing"] || ""} onChange={event => editElement("letter-spacing", event.target.value)}><option value="">Original</option><option value="normal">Normal</option><option value=".02em">Suave (0,02em)</option><option value=".06em">Médio (0,06em)</option><option value=".14em">Amplo (0,14em)</option></select></label>
              <label className="sites-inspector-field"><span>Caixa alta</span><select key={"tt" + selection.index} defaultValue={selection.style["text-transform"] || ""} onChange={event => editElement("text-transform", event.target.value)}><option value="">Original</option><option value="none">Nenhuma</option><option value="uppercase">MAIÚSCULAS</option><option value="capitalize">Primeiras Maiúsculas</option></select></label>
              <label className="sites-inspector-field"><span>Alinhamento</span><select key={"ta" + selection.index} defaultValue={selection.style["text-align"] || ""} onChange={event => editElement("text-align", event.target.value)}><option value="">Original</option><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
              <label className="sites-inspector-field"><span>Opacidade</span><select key={"op" + selection.index} defaultValue={selection.style["opacity"] || ""} onChange={event => editElement("opacity", event.target.value)}><option value="">Original</option><option value="1">100%</option><option value=".85">85%</option><option value=".6">60%</option><option value=".3">30%</option></select></label>
            </div>
            <div className="sites-inspector-group"><span className="sites-inspector-group-label">Caixa</span>
              <label className="sites-inspector-field"><span>Espaço interno</span><input key={"p" + selection.index} defaultValue={selection.style["padding"] || ""} placeholder="ex.: 24px" onBlur={event => editElement("padding", event.target.value)} /></label>
              <label className="sites-inspector-field"><span>Margem</span><input key={"m" + selection.index} defaultValue={selection.style["margin"] || ""} placeholder="ex.: 0 auto" onBlur={event => editElement("margin", event.target.value)} /></label>
              <label className="sites-inspector-field"><span>Cantos arredondados</span><input key={"br" + selection.index} defaultValue={selection.style["border-radius"] || ""} placeholder="ex.: 14px" onBlur={event => editElement("border-radius", event.target.value)} /></label>
              <label className="sites-inspector-field"><span>Borda</span><select key={"bd" + selection.index} defaultValue="" onChange={event => editElement("border", event.target.value)}><option value="">Original</option><option value="none">Nenhuma</option><option value="1px solid #E2E8F8">1px clara</option><option value="1px solid #0A1730">1px escura</option><option value="2px solid #2E7CF6">2px azul Véxora</option></select></label>
              <label className="sites-inspector-field"><span>Sombra</span><select key={"sh" + selection.index} defaultValue="" onChange={event => editElement("box-shadow", event.target.value)}><option value="">Original</option><option value="none">Nenhuma</option><option value="0 8px 24px -8px rgba(6,11,31,.35)">Suave</option><option value="0 24px 48px -16px rgba(6,11,31,.45)">Profunda</option></select></label>
            </div>
          </>}
          {tab === "animacoes" && <>
            <p className="sites-field-hint">Animação aplicada a este elemento.</p>
            <div className="sites-inspector-action-grid">
              <button type="button" onClick={() => setAnimation("none")}>Nenhuma</button>
              <button type="button" onClick={() => setAnimation("fade-up")}>Subir ao entrar</button>
              <button type="button" onClick={() => setAnimation("float")}>Flutuar</button>
              <button type="button" onClick={() => setAnimation("pulse")}>Pulsar</button>
            </div>
            <p className="sites-field-hint">Animações rodam em CSS — sem JavaScript. Feitas para chamar atenção sem pesar a página.</p>
          </>}
          {tab === "codigo" && <>
            <label className="sites-inspector-field"><span>HTML</span><textarea rows={9} value={draft.html} onChange={event => { setSelection(null); setDraft({ ...draft, html: event.target.value }); }} /></label>
            <label className="sites-inspector-field"><span>CSS</span><textarea rows={9} value={draft.css} onChange={event => { setSelection(null); setDraft({ ...draft, css: event.target.value }); }} /></label>
          </>}
          {onPrompt && <div className="sites-inspector-ai"><label className="sites-inspector-field"><span>Alterar com Design Gráfico &amp; Web</span><textarea rows={2} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ex.: mais respiro entre título e imagem" /></label>
            <button type="button" className="secondary-button" disabled={busy || prompt.trim().length < 3} onClick={async () => {
              setBusy(true);
              try { await onPrompt(prompt); setPrompt(""); } finally { setBusy(false); }
            }}>{busy ? "Gerando…" : "Aplicar pedido"}</button></div>}
        </div>
      </aside> : null}
    </div>
  </div>;
}

/** Site importado de um HTML externo — roda isolado: sem acesso ao app, cookies ou login. */
export function ExternalHtmlFrame({ html, title, heightVh }: { html: string; title?: string; heightVh?: number }) {
  const doc = typeof html === "string" && html.trim() ? html : "";
  if (!doc) return <p className="sites-field-hint">Conteúdo do site importado indisponível.</p>;
  return <iframe title={title || "Site importado"} sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={doc} style={{ display: "block", border: 0, width: "100%", height: (heightVh ?? 78) + "vh", minHeight: 480, background: "#fff" }} />;
}
