"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Node, mergeAttributes } from "@tiptap/core";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Undo2, Redo2, Link2, ImagePlus, Youtube, Images, Code2, FileText, X, ChevronUp, ChevronDown } from "lucide-react";
import { FileImagePicker } from "./file-image-picker";

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
    return ["figure", mergeAttributes({ "data-vx-gallery": "", class: "vx-post-gallery" }), ...items.map((item) => ["a", mergeAttributes({ href: item.url, target: "_blank", rel: "noopener noreferrer" }), ["img", { src: item.url, alt: item.alt || "Foto" }]] as any)];
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
    <NodeViewWrapper className={"vx-gallery-node" + (selected ? " is-selected" : "")} data-vx-gallery="true">
      <div className="vx-gallery-node-head"><Images size={15} aria-hidden="true" /><span>{items.length} imagem(ns) na galeria</span>
        <button type="button" className="text-button" onClick={() => setPickerOpen(true)}>+ Adicionar imagens</button>
        <FileImagePicker open={pickerOpen} onClose={() => setPickerOpen(false)} multiple title="File manager · Galeria" onSelect={(urls) => { const added = urls.map(u => ({ url: u, alt: decodeURIComponent(u.split("/").pop() || "Imagem").replace(/\.[a-z0-9]+$/i, ""), caption: "" })); updateAttributes({ items: [...items, ...added] }); }} />
      </div>
      {items.length ? (
        <div className="vx-gallery-grid">{items.map((item, index) => (
          <figure key={index} className="vx-gallery-thumb">
            <img src={item.url} alt={item.alt || "Foto"} loading="lazy" />
            <div className="vx-gallery-thumb-actions">
              <button type="button" aria-label="Mover para a esquerda" title="Mover para a esquerda" onClick={() => move(index, -1)}><ChevronUp size={12} aria-hidden="true" /></button>
              <button type="button" aria-label="Mover para a direita" title="Mover para a direita" onClick={() => move(index, 1)}><ChevronDown size={12} aria-hidden="true" /></button>
              <button type="button" aria-label="Excluir da galeria" title="Excluir da galeria" onClick={() => removeAt(index)}><X size={12} aria-hidden="true" /></button>
            </div>
          </figure>
        ))}</div>
      ) : (
        <p className="vx-field-hint">Nenhuma imagem ainda — clique em “Adicionar imagens”.</p>
      )}
    </NodeViewWrapper>
  );
}

function YoutubeNodeView(props: any) {
  const { node, selected } = props;
  const id = String(node.attrs.src || "");
  return (
    <NodeViewWrapper className={"vx-youtube-node" + (selected ? " is-selected" : "")} data-vx-youtube="true">
      {id ? <iframe src={youtubeEmbedUrl(id)} title={String(node.attrs.title || "Vídeo")} width="100%" height="360" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <p className="vx-field-hint">Vídeo sem URL — selecione e exclua o bloco.</p>}
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
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": rest["aria-label"] || "Corpo do texto", class: "vx-post-body-content" } },
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
    <div className="vx-post-toolbar" role="toolbar" aria-label="Formatação do texto">
      <button type="button" title="Desfazer" aria-label="Desfazer" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 size={15} aria-hidden="true" /></button>
      <button type="button" title="Refazer" aria-label="Refazer" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 size={15} aria-hidden="true" /></button>
      <span className="vx-post-toolbar-sep" />
      <button type="button" title="Negrito" aria-label="Negrito" aria-pressed={!!editor?.isActive("bold")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} aria-hidden="true" /></button>
      <button type="button" title="Itálico" aria-label="Itálico" aria-pressed={!!editor?.isActive("italic")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} aria-hidden="true" /></button>
      <button type="button" title="Sublinhado" aria-label="Sublinhado" aria-pressed={!!editor?.isActive("underline")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}><Underline size={15} aria-hidden="true" /></button>
      <button type="button" title="Riscado" aria-label="Riscado" aria-pressed={!!editor?.isActive("strike")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={15} aria-hidden="true" /></button>
      <button type="button" title="Título 2" aria-label="Título 2" aria-pressed={!!editor?.isActive("heading", { level: 2 })} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><b>H2</b></button>
      <button type="button" title="Título 3" aria-label="Título 3" aria-pressed={!!editor?.isActive("heading", { level: 3 })} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><b>H3</b></button>
      <span className="vx-post-toolbar-sep" />
      <button type="button" title="Lista" aria-label="Lista" aria-pressed={!!editor?.isActive("bulletList")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} aria-hidden="true" /></button>
      <button type="button" title="Lista numerada" aria-label="Lista numerada" aria-pressed={!!editor?.isActive("orderedList")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} aria-hidden="true" /></button>
      <button type="button" title="Citação" aria-label="Citação" aria-pressed={!!editor?.isActive("blockquote")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={15} aria-hidden="true" /></button>
      <button type="button" title="Bloco de código" aria-label="Bloco de código" aria-pressed={!!editor?.isActive("codeBlock")} disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code2 size={15} aria-hidden="true" /></button>
      <span className="vx-post-toolbar-sep" />
      <button type="button" title="Inserir link" aria-label="Inserir link" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => setLinkOpen(v => !v)}><Link2 size={15} aria-hidden="true" /></button>
      <button type="button" className="vx-post-tool" title="Inserir imagem do File manager" aria-label="Inserir imagem do File manager" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => setImagePickerOpen(true)}><ImagePlus size={15} aria-hidden="true" /></button>
      <button type="button" title="Inserir vídeo do YouTube" aria-label="Inserir vídeo do YouTube" disabled={source} onMouseDown={e => e.preventDefault()} onClick={() => setYoutubeOpen(v => !v)}><Youtube size={15} aria-hidden="true" /></button>
      <button type="button" title="Inserir galeria de imagens" aria-label="Inserir galeria" disabled={source} onMouseDown={e => e.preventDefault()} onClick={insertGallery}><Images size={15} aria-hidden="true" /></button>
      <span className="vx-post-toolbar-spacer" />
      <button type="button" className={source ? "active" : ""} title={source ? "Alternar para modo Visual" : "Alternar para modo Código (HTML)"} aria-label={source ? "Modo Visual" : "Modo Código"} aria-pressed={source} onClick={() => setSource(v => { const next = !v; if (!next && editor) editor.commands.setContent(value || editor.getHTML(), { emitUpdate: false }); return next; })}>{source ? <FileText size={15} aria-hidden="true" /> : <Code2 size={15} aria-hidden="true" />}<small>{source ? "Código" : "Visual"}</small></button>
    </div>
  );
  return (
    <div className="vx-post-body">
      {toolbar}
      {linkOpen && <div className="vx-post-popover"><input aria-label="Endereço do link" autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const parsed = url.trim(); if (/^(https?:\/\/|mailto:|tel:)/i.test(parsed)) { editor?.chain().focus().setLink({ href: parsed }).run(); setLinkOpen(false); setUrl(""); setNotice(""); } else setNotice("Informe um endereço http(s), mailto: ou tel:."); } }} /><button type="button" className="primary-button" onClick={() => { const parsed = url.trim(); if (/^(https?:\/\/|mailto:|tel:)/i.test(parsed)) { editor?.chain().focus().setLink({ href: parsed }).run(); setLinkOpen(false); setUrl(""); } else setNotice("Informe um endereço http(s)."); }}>Inserir</button></div>}
      {youtubeOpen && <div className="vx-post-popover"><input aria-label="Link do YouTube" autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); insertYoutube(); } }} /><button type="button" className="primary-button" onClick={insertYoutube}>Inserir vídeo</button></div>}
      {source
        ? <textarea className="vx-post-source" aria-label="Corpo do texto (HTML)" value={value} onChange={e => { onChange(e.target.value); lastEmitted.current = e.target.value; editor?.commands.setContent(e.target.value, { emitUpdate: false }); }} placeholder={placeholder} />
        : <EditorContent editor={editor} />}
      {notice && <p className="vx-post-notice" role="alert">{notice}</p>}
      <p className="vx-post-hint">Dica: use o File manager para enviar do PC/celular e depois inserir aqui — a galeria aceita várias imagens de uma vez.</p>
      <FileImagePicker open={imagePickerOpen} onClose={() => setImagePickerOpen(false)} title="Inserir imagem do File manager" onSelect={(urls) => { const url = urls[0]; if (url) editor?.chain().focus().setImage({ src: url, alt: decodeURIComponent(url.split("/").pop() || "Imagem").replace(/\.[a-z0-9]+$/i, "") }).run(); }} />
    </div>
  );
}
