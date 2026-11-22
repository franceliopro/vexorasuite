"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Node, mergeAttributes } from "@tiptap/core";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Undo2, Redo2, Link2, ImagePlus, Youtube, Images, Code2, FileText, X, ChevronUp, ChevronDown } from "lucide-react";

const primaryTw = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-slate-50 shadow-lg transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const textButtonTw = "inline-flex min-h-8 items-center justify-center gap-2 rounded-lg px-1.5 text-sm font-bold text-blue-600 transition-colors hover:bg-slate-700 hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

/* Utilities completas para a fatia do editor de corpo de post. */
const postBodyTw = "grid min-w-0 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900";
const postToolbarTw = "flex flex-wrap items-center gap-0.5 border-b border-slate-700 bg-slate-800 px-2.5 py-2";
const postToolbarButtonTw = "inline-grid h-8 min-w-8 place-items-center rounded-lg bg-transparent font-extrabold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60";
const postToolbarActiveTw = "inline-grid h-8 min-w-8 place-items-center rounded-lg bg-blue-600 font-extrabold text-slate-50 transition-colors hover:bg-blue-700";
const postToolbarSepTw = "mx-1.5 h-5 w-px bg-slate-700";
const postToolbarSpacerTw = "flex-1";
const postPopoverTw = "flex gap-2 border-b border-slate-700 bg-slate-800 p-2.5";
const postPopoverInputTw = "min-h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-50";
const postContentTw = "min-h-64 outline-none px-4 py-4 text-base leading-relaxed text-slate-50";
const postSourceTw = "min-h-72 w-full resize-y border-0 px-4 py-4 font-mono text-xs leading-relaxed outline-none";
const postNoticeTw = "m-0 bg-red-100 px-3 py-2 text-xs font-semibold text-red-600";
const postHintTw = "m-0 border-t border-slate-700 px-3 py-2.5 text-xs text-slate-200";
const fieldHintTw = "m-0 text-xs text-slate-200";
const galleryNodeTw = "my-2.5 grid gap-2.5 rounded-xl border border-dashed border-slate-700 bg-slate-800 p-2.5";
const galleryNodeSelectedTw = "my-2.5 grid gap-2.5 rounded-xl border border-solid border-blue-600 bg-slate-800 p-2.5";
const galleryNodeClass = (selected: boolean) => selected ? galleryNodeSelectedTw : galleryNodeTw;
const galleryHeadTw = "flex items-center gap-2.5 text-xs text-slate-200";
const galleryGridTw = "grid grid-cols-2 gap-2 sm:grid-cols-3";
const galleryThumbTw = "relative m-0 overflow-hidden rounded-xl border border-slate-700";
const galleryThumbImgTw = "block aspect-square w-full object-cover";
const galleryActionsTw = "absolute right-1 top-1 flex gap-1";
const galleryActionButtonTw = "grid h-5 w-5 place-items-center rounded-md border border-slate-700 bg-slate-900/80 text-slate-50 transition-colors hover:bg-slate-900";
const youtubeNodeTw = "my-2.5 grid gap-2.5 rounded-xl border border-dashed border-slate-700 bg-slate-800 p-2.5";
const youtubeNodeSelectedTw = "my-2.5 grid gap-2.5 rounded-xl border border-solid border-blue-600 bg-slate-800 p-2.5";
const youtubeNodeClass = (selected: boolean) => selected ? youtubeNodeSelectedTw : youtubeNodeTw;
const youtubeIframeTw = "block w-full rounded-xl";
const galleryRenderTw = "my-4 grid grid-cols-2 gap-2 sm:grid-cols-3";
const galleryRenderLinkTw = "block overflow-hidden rounded-xl";
const galleryRenderImgTw = "block h-36 w-full object-cover";

/**
 * Regras descendentes do conteúdo rico (HTML produzido pelo Tiptap). O seletor
 * é um atributo funcional do editor, não uma classe decorativa; as cores vêm
 * dos tokens do tema e o par de cores do bloco de código é mantido em rgb para
 * não introduzir hex em classes nem color-mix em patches visuais.
 */
const POST_CONTENT_CSS = `
[data-vx-post-content] h2{font-family:var(--font-display);font-size:22px;font-weight:800;line-height:1.25;margin:20px 0 10px}
[data-vx-post-content] h3{font-family:var(--font-display);font-size:17px;font-weight:800;line-height:1.3;margin:16px 0 8px}
[data-vx-post-content] p{margin:0 0 12px}
[data-vx-post-content] :is(ul,ol){margin:0 0 12px 22px}
[data-vx-post-content] blockquote{border-left:3px solid var(--primary);margin:0 0 12px;padding:6px 14px;color:var(--tx2);font-style:italic}
[data-vx-post-content] img{display:block;max-width:100%;margin:10px 0;border-radius:10px}
[data-vx-post-content] pre{overflow-x:auto;margin:0;padding:12px 14px;border-radius:10px;background:rgb(15 23 42);color:rgb(226 232 240);font-size:12px}
`;
const codeSurfaceStyle = { backgroundColor: "rgb(15 23 42)", color: "rgb(226 232 240)" } as const;
const popoverInputStyle = { backgroundColor: "var(--s1)", borderColor: "var(--ln2)", minHeight: 36, padding: "0 12px" } as const;

/* ===== Nodes customizados ===== */
const parseYoutubeId = (input: string): string | null => {
  try {
    const u = new URL(String(input || "").trim());
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(u.hostname.toLowerCase())) return null;
    const raw = u.hostname.includes("youtu.be") ? u.pathname.replace(/^\//, "").split("/")[0] : u.searchParams.get("v") || (u.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{6,20})/)?.[1]) || "";
    return raw && /^[a-zA-Z0-9_-]{6,20}$/.test(raw) ? raw : null;
  } catch { return null; }
};
const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`;

const YoutubeEmbed = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() { return { src: { default: "" }, title: { default: "Vídeo" } }; },
  parseHTML() { return [{ tag: "iframe[data-vx-youtube]" }]; },
  renderHTML({ node }) { const src = youtubeEmbedUrl(String(node.attrs.src || "")); return ["iframe", mergeAttributes({ "data-vx-youtube": "", src, title: node.attrs.title || "Vídeo", width: "100%", height: "360", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowfullscreen: "true", frameborder: "0" })]; },
  addNodeView() { return ReactNodeViewRenderer(YoutubeNodeView); },
});

type GalleryItem = { url: string; alt?: string; caption?: string };

const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() { return { items: { default: [] } }; },
  parseHTML() { return [{ tag: "figure[data-vx-gallery]" }]; },
  renderHTML({ node }) {
    const items: GalleryItem[] = Array.isArray(node.attrs.items) ? node.attrs.items : [];
    return ["figure", mergeAttributes({ "data-vx-gallery": "", class: galleryRenderTw }), ...items.map((item) => ["a", mergeAttributes({ href: item.url, target: "_blank", rel: "noopener noreferrer", class: galleryRenderLinkTw }), ["img", { src: item.url, alt: item.alt || "Foto", class: galleryRenderImgTw }]] as any)];
  },
  addNodeView() { return ReactNodeViewRenderer(GalleryNodeView); },
});

function GalleryNodeView(props: any) {
  const { node, updateAttributes, selected } = props;
  const items: GalleryItem[] = Array.isArray(node.attrs.items) ? node.attrs.items : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const removeAt = (index: number) => updateAttributes({ items: items.filter((_, i) => i !== index) });
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    updateAttributes({ items: next });
  };
  return (
    <NodeViewWrapper className={galleryNodeClass(selected)} data-vx-gallery="true">
      <div className={galleryHeadTw}><Images size={15} aria-hidden="true" /><span>{items.length} imagem(ns) na galeria</span>
        <button type="button" className={textButtonTw} onClick={() => setPickerOpen(true)}>+ Adicionar imagens</button>
        
      </div>
      {items.length ? (
        <div className={galleryGridTw}>{items.map((item, index) => (
          <figure key={index} className={galleryThumbTw}>
            <img className={galleryThumbImgTw} src={item.url} alt={item.alt || "Foto"} loading="lazy" />
            <div className={galleryActionsTw}>
              <button type="button" className={galleryActionButtonTw} aria-label="Mover para a esquerda" title="Mover para a esquerda" onClick={() => move(index, -1)}><ChevronUp size={12} aria-hidden="true" /></button>
              <button type="button" className={galleryActionButtonTw} aria-label="Mover para a direita" title="Mover para a direita" onClick={() => move(index, 1)}><ChevronDown size={12} aria-hidden="true" /></button>
              <button type="button" className={galleryActionButtonTw} aria-label="Excluir da galeria" title="Excluir da galeria" onClick={() => removeAt(index)}><X size={12} aria-hidden="true" /></button>
            </div>
          </figure>
        ))}</div>
      ) : (
        <p className={fieldHintTw}>Nenhuma imagem ainda — clique em “Adicionar imagens”.</p>
      )}
    </NodeViewWrapper>
  );
}

function YoutubeNodeView(props: any) {
  const { node, selected } = props;
  const id = String(node.attrs.src || "");
  return (
    <NodeViewWrapper className={youtubeNodeClass(selected)} data-vx-youtube="true">
      {id ? <iframe className={youtubeIframeTw} src={youtubeEmbedUrl(id)} title={String(node.attrs.title || "Vídeo")} width="100%" height="360" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <p className={fieldHintTw}>Vídeo sem URL — selecione e exclua o bloco.</p>}
    </NodeViewWrapper>
  );
}

/* ===== Editor principal (estilo WordPress: Visual / Código) ===== */
type Props = { value: string; onChange: (html: string) => void; placeholder?: string; maxLength?: number; "aria-label"?: string };

export function PostBodyEditor({ value, onChange, placeholder, maxLength = 60000, ...rest }: Props) {
  const [source, setSource] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const current = useRef({ value, onChange }); current.current = { value, onChange };
  const lastEmitted = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: false } }), Image, YoutubeEmbed, Gallery],
    content: typeof value === "string" ? value : "",
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": rest["aria-label"] || "Corpo do texto", "data-vx-post-content": "", class: postContentTw } },
    onUpdate: ({ editor }) => { const html = editor.getHTML(); if (html.length > maxLength) { setNotice("O corpo do texto excedeu o limite de caracteres."); return; } lastEmitted.current = html; setNotice(""); current.current.onChange(html); },
  }, []);

  useEffect(() => { if (editor && value !== lastEmitted.current && value !== editor.getHTML()) { editor.commands.setContent(typeof value === "string" ? value : "", { emitUpdate: false }); lastEmitted.current = editor.getHTML(); } }, [editor, value]);

  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const insertYoutube = () => {
    const id = parseYoutubeId(url);
    if (!id) { setNotice("Cole um link válido de vídeo do YouTube (ex.: https://www.youtube.com/watch?v=…)."); return; }
    editor?.chain().focus().insertContent({ type: "youtube", attrs: { src: id, title: "Vídeo" } }).run();
    setYoutubeOpen(false); setUrl(""); setNotice("");
  };
  const insertGallery = () => { editor?.chain().focus().insertContent({ type: "gallery", attrs: { items: [] } }).run(); };
  const toolbar = (
    <div className={postToolbarTw} role="toolbar" aria-label="Formatação do texto">
      <button type="button" className={postToolbarButtonTw} title="Desfazer" aria-label="Desfazer" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Refazer" aria-label="Refazer" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={15} aria-hidden="true" /></button>
      <span className={postToolbarSepTw} />
      <button type="button" className={postToolbarButtonTw} title="Negrito" aria-label="Negrito" aria-pressed={!!editor?.isActive("bold")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Itálico" aria-label="Itálico" aria-pressed={!!editor?.isActive("italic")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Sublinhado" aria-label="Sublinhado" aria-pressed={!!editor?.isActive("underline")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Riscado" aria-label="Riscado" aria-pressed={!!editor?.isActive("strike")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Título 2" aria-label="Título 2" aria-pressed={!!editor?.isActive("heading", { level: 2 })} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><b>H2</b></button>
      <button type="button" className={postToolbarButtonTw} title="Título 3" aria-label="Título 3" aria-pressed={!!editor?.isActive("heading", { level: 3 })} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><b>H3</b></button>
      <span className={postToolbarSepTw} />
      <button type="button" className={postToolbarButtonTw} title="Lista" aria-label="Lista" aria-pressed={!!editor?.isActive("bulletList")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Lista numerada" aria-label="Lista numerada" aria-pressed={!!editor?.isActive("orderedList")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Citação" aria-label="Citação" aria-pressed={!!editor?.isActive("blockquote")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Bloco de código" aria-label="Bloco de código" aria-pressed={!!editor?.isActive("codeBlock")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 size={15} aria-hidden="true" /></button>
      <span className={postToolbarSepTw} />
      <button type="button" className={postToolbarButtonTw} title="Inserir link" aria-label="Inserir link" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => setLinkOpen(v => !v)}><Link2 size={15} aria-hidden="true" /></button>
            <button type="button" className={postToolbarButtonTw} title="Inserir vídeo do YouTube" aria-label="Inserir vídeo do YouTube" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => setYoutubeOpen(v => !v)}><Youtube size={15} aria-hidden="true" /></button>
      <button type="button" className={postToolbarButtonTw} title="Inserir galeria de imagens" aria-label="Inserir galeria" disabled={source} onMouseDown={e => e.preventDefault()} onClick={insertGallery}><Images size={15} aria-hidden="true" /></button>
      <span className={postToolbarSpacerTw} />
      <button type="button" className={source ? postToolbarActiveTw : postToolbarButtonTw} title={source ? "Alternar para modo Visual" : "Alternar para modo Código (HTML)"} aria-label={source ? "Modo Visual" : "Modo Código"} aria-pressed={source} onClick={() => setSource(v => { const next = !v; if (!next && editor) editor.commands.setContent(value || editor.getHTML(), { emitUpdate: false }); return next; })}>{source ? <FileText size={15} aria-hidden="true" /> : <Code2 size={15} aria-hidden="true" />}<small>{source ? "Código" : "Visual"}</small></button>
    </div>
  );
  return (
    <div className={postBodyTw}>
      <style>{POST_CONTENT_CSS}</style>
      {toolbar}
      {linkOpen && <div className={postPopoverTw}><input className={postPopoverInputTw} aria-label="Endereço do link" autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={popoverInputStyle} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const parsed = url.trim(); if (/^(https?:\/\/|mailto:|tel:)/i.test(parsed)) { editor?.chain().focus().setLink({ href: parsed }).run(); setLinkOpen(false); setUrl(""); setNotice(""); } else setNotice("Informe um endereço http(s), mailto: ou tel:."); } }} /><button type="button" className={primaryTw} onClick={() => { const parsed = url.trim(); if (/^(https?:\/\/|mailto:|tel:)/i.test(parsed)) { editor?.chain().focus().setLink({ href: parsed }).run(); setLinkOpen(false); setUrl(""); } else setNotice("Informe um endereço http(s)."); }}>Inserir</button></div>}
      {youtubeOpen && <div className={postPopoverTw}><input className={postPopoverInputTw} aria-label="Link do YouTube" autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" style={popoverInputStyle} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertYoutube(); } }} /><button type="button" className={primaryTw} onClick={insertYoutube}>Inserir vídeo</button></div>}
      {source
        ? <textarea className={postSourceTw} style={codeSurfaceStyle} aria-label="Corpo do texto (HTML)" value={value} onChange={e => { onChange(e.target.value); lastEmitted.current = e.target.value; editor?.commands.setContent(e.target.value, { emitUpdate: false }); }} placeholder={placeholder} />
        : <EditorContent editor={editor} />}
      {notice && <p className={postNoticeTw} role="alert">{notice}</p>}
      <p className={postHintTw}>Dica: use o File manager para enviar do PC/celular e depois inserir aqui — a galeria aceita várias imagens de uma vez.</p>
      
    </div>
  );
}
