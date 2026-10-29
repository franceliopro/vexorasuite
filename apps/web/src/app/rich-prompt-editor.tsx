"use client";
import {useEffect,useRef,useState} from "react";
import {EditorContent,useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {Markdown} from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import {Bold,Italic,Heading2,List,ListOrdered,Quote,Code2,Undo2,Redo2,Maximize2,FileText,Link2} from "lucide-react";
import {VexoraDialog} from "./vexora-dialog";
export function RichPromptEditor({label,value,onChange,maxLength=6000,placeholder="Escreva as orientações da sua equipe…",rows=6,documentKey=""}:{label:string;value:string;onChange:(value:string)=>void;maxLength?:number;placeholder?:string;rows?:number;documentKey?:string}){
 const [expanded,setExpanded]=useState(false),[source,setSource]=useState(false),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState(""),[notice,setNotice]=useState("");
 const current=useRef({value,onChange,maxLength});current.current={value,onChange,maxLength};
 const [,render]=useState(0),lastEmitted=useRef(value);
 const editor=useEditor({
  immediatelyRender:false,
  extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:false}}),Markdown,Placeholder.configure({placeholder})],
  content:value,contentType:"markdown",
  editorProps:{attributes:{role:"textbox","aria-label":label,"aria-multiline":"true",class:"vx-rich-content"}},
  onUpdate:({editor})=>{const markdown=editor.getMarkdown();lastEmitted.current=markdown;if(markdown.length>current.current.maxLength){setNotice("O limite deste campo é "+current.current.maxLength.toLocaleString("pt-BR")+" caracteres.");editor.commands.setContent(current.current.value,{contentType:"markdown",emitUpdate:false});return;}setNotice("");current.current.onChange(markdown);},
  onSelectionUpdate:()=>render(v=>v+1),
 },[documentKey]);
 useEffect(()=>{if(editor&&value!==lastEmitted.current&&value!==editor.getMarkdown()){editor.commands.setContent(value,{contentType:"markdown",emitUpdate:false});lastEmitted.current=value;}},[editor,value]);
 const toolbar=<div className="vx-rich-toolbar" role="toolbar" aria-label={"Formatação de "+label}>
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
  <span className="vx-toolbar-spacer"/><button type="button" className={source?"active":""} onClick={()=>setSource(v=>!v)} aria-label="Alternar texto de origem" title="Texto de origem"><Code2 size={16}/></button>
  {!expanded&&<button type="button" aria-label={"Ampliar "+label} title="Ampliar editor" onClick={()=>setExpanded(true)}><Maximize2 size={16}/></button>}
 </div>;
 const content=<>{toolbar}{linkOpen&&<div className="vx-rich-link"><input aria-label="Endereço do link" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/><button type="button" onClick={()=>{try{const parsed=new URL(url);if(!["https:","http:"].includes(parsed.protocol))throw Error();editor?.chain().focus().setLink({href:parsed.href}).run();setLinkOpen(false);setUrl("");}catch{setNotice("Informe um endereço http ou https válido.");}}}>Inserir</button></div>}
 {source?<textarea className="vx-rich-source" aria-label={label+" · texto de origem"} value={value} maxLength={maxLength} rows={Math.max(rows,6)} onChange={e=>{onChange(e.target.value);lastEmitted.current=e.target.value;editor?.commands.setContent(e.target.value,{contentType:"markdown",emitUpdate:false});}}/>:<EditorContent editor={editor} style={{minHeight:Math.max(140,rows*24)}}/>}
 <footer className="vx-rich-footer"><span><FileText size={13}/> {documentKey?"Contexto do agente":"Documento da empresa"} · salve a configuração para aplicar</span><span>{value.length.toLocaleString("pt-BR")} / {maxLength.toLocaleString("pt-BR")}</span></footer>{notice&&<p className="vx-field-notice" role="status">{notice}</p>}</>;
 return <div className="vx-rich-field"><div className="vx-rich-label"><strong>{label}</strong><span>Rascunho</span></div>{!expanded&&<div className="vx-rich-editor">{content}</div>}<VexoraDialog open={expanded} title={label} subtitle="Organize as orientações com clareza. A formatação acompanha o texto salvo." icon={<FileText size={22}/>} onClose={()=>setExpanded(false)} wide><div className="vx-rich-editor expanded">{content}</div><button type="button" className="primary-button" onClick={()=>setExpanded(false)}>Concluir edição</button></VexoraDialog></div>;
}
