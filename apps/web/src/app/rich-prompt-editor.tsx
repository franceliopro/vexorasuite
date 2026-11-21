"use client";
import {useEffect,useRef,useState} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {Markdown} from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import {Bold,Italic,Heading2,List,ListOrdered,Quote,Code2,Undo2,Redo2,Maximize2,FileText,Link2,ImagePlus} from "lucide-react";
import {VexoraDialog} from "./vexora-dialog";
const primaryTw='inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60';
/* TW utility-first. Os seletor abaixo são apenas estruturais (o Tiptap cria os
   filhos); todas as cores, tamanhos e raios vêm do preset. */
const fieldTw="grid min-w-0 gap-2";
const labelTw="flex min-w-0 items-center justify-between gap-2.5";
const labelTitleTw="font-heading text-h6 tracking-flow-tight text-ink";
const labelBadgeTw="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-ib-wide text-ink-secondary";
const editorTw="grid min-w-0 overflow-hidden rounded-ai-phone border border-line-strong bg-surface shadow-token-sm transition-colors hover:border-line-hover focus-within:border-blue-600 focus-within:shadow-ring";
const expandedEditorTw="grid min-w-0 bg-transparent";
const toolbarTw="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-2 px-2.25 py-1.75";
const toolbarButtonTw="grid min-h-8 min-w-8 place-items-center rounded-token-sm border-0 bg-transparent px-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink aria-pressed:bg-blue-50 aria-pressed:text-blue-800 disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600";
const toolbarButtonClass=(active:boolean)=>active?toolbarButtonTw+" bg-blue-50 text-blue-800":toolbarButtonTw;
const imageButtonTw="grid min-h-8 min-w-8 cursor-pointer place-items-center rounded-token-sm px-1.5 text-ink-secondary transition-colors hover:bg-hover hover:text-ink";
const toolbarSpacerTw="min-w-2 flex-1";
const richContentTw="min-h-30 break-words px-4 py-3.5 text-body leading-relaxed text-ink outline-none [&_p]:mb-2.5 [&_p:last-child]:mb-0 [&_h2]:mb-2 [&_h2]:mt-3.5 [&_h2]:text-h2 [&_h2]:leading-snug [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-h3 [&_h3]:leading-snug [&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5.5 [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-5.5 [&_li]:my-0.75 [&_blockquote]:mb-2.5 [&_blockquote]:border-l-4 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-secondary [&_blockquote]:italic [&_code]:rounded-sm bg-surface-3 px-1.25 py-px text-h6 font-mono [&_pre]:mb-2.5 [&_pre]:overflow-auto [&_pre]:rounded-token-sm [&_pre]:bg-surface-page [&_pre]:px-3.5 [&_pre]:py-3 [&_pre]:text-h6 [&_pre]:leading-relaxed [&_pre]:text-ink [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:whitespace-pre-line [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:text-ink-secondary [&_p.is-editor-empty:first-child]:before:opacity-85 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";
const sourceTw="min-h-32.5 w-full resize-y rounded-token-sm border border-line bg-surface-2 p-3 font-mono text-h6 leading-relaxed text-ink focus:border-blue-600 focus:outline-none";
const linkBarTw="flex items-center gap-2 border-b border-line bg-surface-2 px-2.5 py-2";
const linkInputTw="min-h-8.5 min-w-0 flex-1 border border-line bg-surface text-body text-ink";
const linkButtonTw="min-h-8.5 rounded-token-sm bg-blue-600 px-3.5 text-body font-bold text-blue-50 transition-colors hover:bg-blue-700";
const footerTw="flex items-center justify-between gap-2.5 border-t border-line bg-surface-2 px-3 py-1.75 text-2xs text-ink-secondary tabular-nums";
const footerItemTw="inline-flex min-w-0 items-center gap-1.5";
const noticeTw="m-0 text-2xs text-warning";
export function RichPromptEditor({label,value,onChange,maxLength=6000,placeholder="Escreva as orientações da sua equipe…",rows=6,documentKey=""}:{label:string;value:string;onChange:(value:string)=>void;maxLength?:number;placeholder?:string;rows?:number;documentKey?:string}){
 const [expanded,setExpanded]=useState(false),[source,setSource]=useState(false),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState(""),[notice,setNotice]=useState("");
 const current=useRef({value,onChange,maxLength});current.current={value,onChange,maxLength};
 const [,render]=useState(0),lastEmitted=useRef(value);
 const editor=useEditor({
  immediatelyRender:false,
  extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:false}}),Image.configure({inline:true,allowBase64:true}),Markdown,Placeholder.configure({placeholder})],
  content:value,contentType:"markdown",
  editorProps:{attributes:{role:"textbox","aria-label":label,"aria-multiline":"true",class:richContentTw}},
  onUpdate:({editor})=>{const markdown=editor.getMarkdown();lastEmitted.current=markdown;if(markdown.length>current.current.maxLength){setNotice("O limite deste campo é "+current.current.maxLength.toLocaleString("pt-BR")+" caracteres.");editor.commands.setContent(current.current.value,{contentType:"markdown",emitUpdate:false});return;}setNotice("");current.current.onChange(markdown);},
  onSelectionUpdate:()=>render(v=>v+1),
 },[documentKey]);
 useEffect(()=>{if(editor&&value!==lastEmitted.current&&value!==editor.getMarkdown()){editor.commands.setContent(value,{contentType:"markdown",emitUpdate:false});lastEmitted.current=value;}},[editor,value]);
 const makeToolbar=(isExpanded:boolean)=><div className={isExpanded?toolbarTw+" rounded-none":toolbarTw+" rounded-t-ai-phone"} role="toolbar" aria-label={"Formatação de "+label}>
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
  ].map(item=><button type="button" key={item.name} title={item.name} aria-label={item.name} aria-pressed={!!item.active} disabled={!editor||source} onMouseDown={e=>e.preventDefault()} onClick={item.run}>{item.icon}</button>)}
  <button type="button" aria-label="Inserir link" title="Inserir link" disabled={source} onMouseDown={e=>e.preventDefault()} onClick={()=>setLinkOpen(v=>!v)}><Link2 size={16}/></button>
  <label className={imageButtonTw} title="Inserir imagem do PC ou celular" aria-label="Inserir imagem do PC ou celular" onMouseDown={e=>e.preventDefault()}><ImagePlus size={16}/><input type="file" accept="image/*" style={{display:"none"}} onChange={(event)=>{const file=event.target.files?.[0];if(!file)return;if(file.size>4*1024*1024){setNotice("A imagem excede 4 MB. Escolha uma menor.");event.target.value="";return;}const reader=new FileReader();reader.onload=()=>{editor?.chain().focus().setImage({src:String(reader.result),alt:file.name}).run();};reader.readAsDataURL(file);event.target.value="";}}/></label>
  <span className={toolbarSpacerTw}/><button type="button" className={toolbarButtonClass(source)} onClick={()=>setSource(v=>!v)} aria-label="Alternar texto de origem" title="Texto de origem"><Code2 size={16}/></button>
  {!expanded&&<button type="button" aria-label={"Ampliar "+label} title="Ampliar editor" onClick={()=>setExpanded(true)}><Maximize2 size={16}/></button>}
 </div>;
 const makeContent=(isExpanded:boolean)=><>{makeToolbar(isExpanded)}{linkOpen&&<div className={linkBarTw}><input aria-label="Endereço do link" className={linkInputTw} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/><button type="button" className={linkButtonTw} onClick={()=>{try{const parsed=new URL(url);if(!["https:","http:"].includes(parsed.protocol))throw Error();editor?.chain().focus().setLink({href:parsed.href}).run();setLinkOpen(false);setUrl("");}catch{setNotice("Informe um endereço http ou https válido.");}}}>Inserir</button></div>}
 {source?<textarea className={sourceTw} aria-label={label+" · texto de origem"} value={value} maxLength={maxLength} rows={Math.max(rows,6)} onChange={e=>{onChange(e.target.value);lastEmitted.current=e.target.value;editor?.commands.setContent(e.target.value,{contentType:"markdown",emitUpdate:false});}}/>:<EditorContent editor={editor} style={{minHeight:Math.max(140,rows*24)}}/>}
 <footer className={isExpanded?footerTw+" rounded-none":footerTw+" rounded-b-ai-phone"}><span className={footerItemTw}><FileText size={13}/> {documentKey?"Contexto do agente":"Documento da empresa"} · salve a configuração para aplicar</span><span className={footerItemTw}>{value.length.toLocaleString("pt-BR")} / {maxLength.toLocaleString("pt-BR")}</span></footer>{notice&&<p className={noticeTw} role="status">{notice}</p>}</>;
 return <div className={fieldTw}><div className={labelTw}><strong className={labelTitleTw}>{label}</strong><span className={labelBadgeTw}>Rascunho</span></div>{!expanded&&<div className={editorTw}>{makeContent(false)}</div>}<VexoraDialog open={expanded} title={label} subtitle="Organize as orientações com clareza. A formatação acompanha o texto salvo." icon={<FileText size={22}/>} onClose={()=>setExpanded(false)} wide><div className={expandedEditorTw}>{makeContent(true)}</div><button type="button" className={primaryTw} onClick={()=>setExpanded(false)}>Concluir edição</button></VexoraDialog></div>;
}
