"use client";
import {useEffect,useRef,useState} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {Markdown} from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import {Bold,Italic,Heading2,List,ListOrdered,Quote,Code2,Undo2,Redo2,Maximize2,FileText,Link2,ImagePlus} from "lucide-react";
import {VexoraDialog} from "./vexora-dialog";
const primaryTw='inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-blue-50 shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
/* TW utility-first. Os seletor abaixo são apenas estruturais (o Tiptap cria os
   filhos); todas as cores, tamanhos e raios vêm do preset. */
const fieldTw="grid min-w-0 gap-2";
const labelTw="flex min-w-0 items-center justify-between gap-2.5";
const labelTitleTw="font-sans text-base font-semibold tracking-tight text-slate-50";
const labelBadgeTw="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-slate-200";
const editorTw="grid min-w-0 overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-sm transition-colors hover:border-slate-500 focus-within:border-blue-600 focus-within:shadow-md";
const expandedEditorTw="grid min-w-0 bg-transparent";
const toolbarClass: Record<'inline' | 'expanded', string> = {
  inline: "flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-700 bg-slate-800 px-2.5 py-2",
  expanded: "flex flex-wrap items-center gap-0.5 rounded-none border-b border-slate-700 bg-slate-800 px-2.5 py-2",
};
const toolbarButtonTw="grid min-h-8 min-w-8 place-items-center rounded-md border-0 bg-transparent px-1.5 text-slate-200 transition-colors hover:bg-slate-700 hover:text-slate-50 disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600";
const toolbarButtonActiveTw="grid min-h-8 min-w-8 place-items-center rounded-md border-0 bg-slate-700 px-1.5 text-slate-50 transition-colors hover:bg-slate-700 hover:text-slate-50 disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600";
const toolbarButtonClass=(active:boolean)=>active?toolbarButtonActiveTw:toolbarButtonTw;
const imageButtonTw="grid min-h-8 min-w-8 cursor-pointer place-items-center rounded-md px-1.5 text-slate-200 transition-colors hover:bg-slate-700 hover:text-slate-50";
const toolbarSpacerTw="min-w-2 flex-1";
const richContentTw="min-h-32 break-words px-4 py-3.5 text-sm leading-relaxed text-slate-50 outline-none";
const sourceTw="min-h-40 w-full resize-y rounded-md border border-slate-700 bg-slate-800 p-3 font-mono text-xs leading-relaxed text-slate-50 focus:border-blue-600 focus:outline-none";
const linkBarTw="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-2.5 py-2";
const linkInputTw="min-h-9 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-50";
const linkButtonTw="min-h-9 rounded-md bg-blue-600 px-3.5 text-sm font-bold text-blue-50 transition-colors hover:bg-blue-700";
const footerClass: Record<'inline' | 'expanded', string> = {
  inline: "flex items-center justify-between gap-2.5 rounded-b-lg border-t border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 tabular-nums",
  expanded: "flex items-center justify-between gap-2.5 rounded-none border-t border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 tabular-nums",
};
const footerItemTw="inline-flex min-w-0 items-center gap-1.5";
const noticeTw="m-0 text-xs text-amber-300";
const RICH_CONTENT_CSS=`
[data-rich-content] p{margin-bottom:0.625rem}
[data-rich-content] p:last-child{margin-bottom:0}
[data-rich-content] h2{margin:0.875rem 0 0.5rem;font-size:1.5rem;line-height:1.25}
[data-rich-content] h3{margin:0.75rem 0 0.375rem;font-size:1.25rem;line-height:1.25}
[data-rich-content] ul,[data-rich-content] ol{margin-bottom:0.625rem;padding-left:1.375rem}
[data-rich-content] ul{list-style:disc}
[data-rich-content] ol{list-style:decimal}
[data-rich-content] li{margin:0.1875rem 0}
[data-rich-content] blockquote{margin-bottom:0.625rem;border-left:4px solid rgb(71 85 105);padding-left:0.75rem;color:rgb(203 213 225);font-style:italic}
[data-rich-content] code{border-radius:0.125rem;background:rgb(30 41 59);padding:1px 0.3125rem;font-family:ui-monospace,monospace;font-size:0.875rem}
[data-rich-content] pre{margin-bottom:0.625rem;overflow:auto;border-radius:0.375rem;background:rgb(15 23 42);padding:0.875rem;color:rgb(226 232 240);line-height:1.5}
[data-rich-content] pre code{background:transparent;padding:0;color:inherit}
[data-rich-content] img{max-width:100%;border-radius:0.5rem}
[data-rich-content] a{color:rgb(37 99 235);text-decoration:underline;text-underline-offset:2px}
[data-rich-content] p.is-editor-empty:first-child::before{content:attr(data-placeholder);float:left;height:0;color:rgb(148 163 184);opacity:0.85;pointer-events:none;white-space:pre-line}
`;
export function RichPromptEditor({label,value,onChange,maxLength=6000,placeholder="Escreva as orientações da sua equipe…",rows=6,documentKey=""}:{label:string;value:string;onChange:(value:string)=>void;maxLength?:number;placeholder?:string;rows?:number;documentKey?:string}){
 const [expanded,setExpanded]=useState(false),[source,setSource]=useState(false),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState(""),[notice,setNotice]=useState("");
 const current=useRef({value,onChange,maxLength});current.current={value,onChange,maxLength};
 const [,render]=useState(0),lastEmitted=useRef(value);
 const editor=useEditor({
  immediatelyRender:false,
  extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:false}}),Image.configure({inline:true,allowBase64:true}),Markdown,Placeholder.configure({placeholder})],
  content:value,contentType:"markdown",
  editorProps:{attributes:{role:"textbox","aria-label":label,"aria-multiline":"true","data-rich-content":"",class:richContentTw}},
  onUpdate:({editor})=>{const markdown=editor.getMarkdown();lastEmitted.current=markdown;if(markdown.length>current.current.maxLength){setNotice("O limite deste campo é "+current.current.maxLength.toLocaleString("pt-BR")+" caracteres.");editor.commands.setContent(current.current.value,{contentType:"markdown",emitUpdate:false});return;}setNotice("");current.current.onChange(markdown);},
  onSelectionUpdate:()=>render(v=>v+1),
 },[documentKey]);
 useEffect(()=>{if(editor&&value!==lastEmitted.current&&value!==editor.getMarkdown()){editor.commands.setContent(value,{contentType:"markdown",emitUpdate:false});lastEmitted.current=value;}},[editor,value]);
 const makeToolbar=(isExpanded:boolean)=><div className={toolbarClass[isExpanded?"expanded":"inline"]} role="toolbar" aria-label={"Formatação de "+label}>
  {[
   {name:"Negrito",icon:<Bold size={16}/>,active:editor?.isActive("bold"),run:()=>editor?.chain().focus().toggleBold().run()},
   {name:"Itálico",icon:<Italic size={16}/>,active:editor?.isActive("italic"),run:()=>editor?.chain().focus().toggleItalic().run()},
   {name:"Título",icon:<Heading2 size={16}/>,active:editor?.isActive("heading"),run:()=>editor?.chain().focus().toggleHeading({level:2}).run()},
   {name:"Lista",icon:<List size={16}/>,active:editor?.isActive("bulletList"),run:()=>editor?.chain().focus().toggleBulletList().run()},
   {name:"Lista numerada",icon:<ListOrdered size={16}/>,active:editor?.isActive("orderedList"),run:()=>editor?.chain().focus().toggleOrderedList().run()},
   {name:"Citação",icon:<Quote size={16}/>,active:editor?.isActive("blockquote"),run:()=>editor?.chain().focus().toggleBlockquote().run()},
   {name:"Código",icon:<Code2 size={16}/>,active:editor?.isActive("codeBlock"),run:()=>editor?.chain().focus().toggleCodeBlock().run()},
   {name:"Desfazer",icon:<Undo2 size={16}/>,run:()=>editor?.chain().focus().undo().run()},
   {name:"Refazer",icon:<Redo2 size={16}/>,run:()=>editor?.chain().focus().redo().run()},
  ].map(item=><button type="button" key={item.name} className={toolbarButtonClass(!!item.active)} title={item.name} aria-label={item.name} aria-pressed={!!item.active} disabled={!editor||source} onMouseDown={e=>e.preventDefault()} onClick={item.run}>{item.icon}</button>)}
  <button type="button" className={toolbarButtonTw} aria-label="Inserir link" title="Inserir link" disabled={source} onMouseDown={e=>e.preventDefault()} onClick={()=>setLinkOpen(v=>!v)}><Link2 size={16}/></button>
  <label className={imageButtonTw} title="Inserir imagem do PC ou celular" aria-label="Inserir imagem do PC ou celular" onMouseDown={e=>e.preventDefault()}><ImagePlus size={16}/><input type="file" accept="image/*" style={{display:"none"}} onChange={(event)=>{const file=event.target.files?.[0];if(!file)return;if(file.size>4*1024*1024){setNotice("A imagem excede 4 MB. Escolha uma menor.");event.target.value="";return;}const reader=new FileReader();reader.onload=()=>{editor?.chain().focus().setImage({src:String(reader.result),alt:file.name}).run();};reader.readAsDataURL(file);event.target.value="";}}/></label>
  <span className={toolbarSpacerTw}/><button type="button" className={toolbarButtonClass(source)} onClick={()=>setSource(v=>!v)} aria-label="Alternar texto de origem" title="Texto de origem"><Code2 size={16}/></button>
  {!expanded&&<button type="button" className={toolbarButtonTw} aria-label={"Ampliar "+label} title="Ampliar editor" onClick={()=>setExpanded(true)}><Maximize2 size={16}/></button>}
 </div>;
 const makeContent=(isExpanded:boolean)=><>{makeToolbar(isExpanded)}{linkOpen&&<div className={linkBarTw}><input aria-label="Endereço do link" className={linkInputTw} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/><button type="button" className={linkButtonTw} onClick={()=>{try{const parsed=new URL(url);if(!["https:","http:"].includes(parsed.protocol))throw Error();editor?.chain().focus().setLink({href:parsed.href}).run();setLinkOpen(false);setUrl("");}catch{setNotice("Informe um endereço http ou https válido.");}}}>Inserir</button></div>}
 {source?<textarea className={sourceTw} aria-label={label+" · texto de origem"} value={value} maxLength={maxLength} rows={Math.max(rows,6)} onChange={e=>{onChange(e.target.value);lastEmitted.current=e.target.value;editor?.commands.setContent(e.target.value,{contentType:"markdown",emitUpdate:false});}}/>:<EditorContent editor={editor} style={{minHeight:Math.max(140,rows*24)}}/>}
 <footer className={footerClass[isExpanded?"expanded":"inline"]}><span className={footerItemTw}><FileText size={13}/> {documentKey?"Contexto do agente":"Documento da empresa"} · salve a configuração para aplicar</span><span className={footerItemTw}>{value.length.toLocaleString("pt-BR")} / {maxLength.toLocaleString("pt-BR")}</span></footer>{notice&&<p className={noticeTw} role="status">{notice}</p>}</>;
 return <div className={fieldTw}><style>{RICH_CONTENT_CSS}</style><div className={labelTw}><strong className={labelTitleTw}>{label}</strong><span className={labelBadgeTw}>Rascunho</span></div>{!expanded&&<div className={editorTw}>{makeContent(false)}</div>}<VexoraDialog open={expanded} title={label} subtitle="Organize as orientações com clareza. A formatação acompanha o texto salvo." icon={<FileText size={22}/>} onClose={()=>setExpanded(false)} wide><div className={expandedEditorTw}>{makeContent(true)}</div><button type="button" className={primaryTw} onClick={()=>setExpanded(false)}>Concluir edição</button></VexoraDialog></div>;
}
