"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {useModalDialog} from "../lib/use-modal-dialog";
export function VexoraDialog({open,title,subtitle,icon,children,footer,onClose,wide=false}:{open:boolean;title:string;subtitle?:string;icon?:ReactNode;children:ReactNode;footer?:ReactNode;onClose:()=>void;wide?:boolean}){
 const [mounted,setMounted]=useState(false);const ref=useRef<HTMLElement|null>(null);
 useEffect(()=>setMounted(true),[]);useModalDialog(open&&mounted,ref,onClose);
 if(!open||!mounted)return null;
 return createPortal(<div className="vx-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} tabIndex={-1} className={"vx-dialog "+(wide?"vx-dialog-wide":"")} role="dialog" aria-modal="true" aria-label={title}><header className="vx-dialog-heading"><span className="vx-dialog-icon">{icon}</span><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="vx-dialog-close" aria-label="Fechar janela" onClick={onClose}><X size={19}/></button></header><div className="vx-dialog-body">{children}</div>{footer&&<footer className="vx-dialog-footer">{footer}</footer>}</section></div>,document.body);
}
