"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {useModalDialog} from "../lib/use-modal-dialog";

/** Literais completas por largura: o preset não conhece mais tokens de diálogo. */
const dialogTw: Record<"standard" | "wide", string> = {
  standard: "relative flex max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
  wide: "relative flex max-h-dvh w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
};
export function VexoraDialog({open,title,subtitle,icon,children,footer,onClose,wide=false}:{open:boolean;title:string;subtitle?:string;icon?:ReactNode;children:ReactNode;footer?:ReactNode;onClose:()=>void;wide?:boolean}){
  const [mounted,setMounted]=useState(false);const ref=useRef<HTMLElement|null>(null);
  useEffect(()=>setMounted(true),[]);useModalDialog(open&&mounted,ref,onClose);
  if(!open||!mounted)return null;
  return createPortal(<div data-testid="vexora-dialog-backdrop" className="fixed inset-0 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm" style={{ zIndex: 1000 }} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} tabIndex={-1} data-testid="vexora-dialog" data-wide={wide?"true":"false"} className={dialogTw[wide?"wide":"standard"]} style={{ zIndex: 1 }} role="dialog" aria-modal="true" aria-label={title}><header data-testid="vexora-dialog-heading" className="mb-3.5 flex flex-none items-center gap-3 pr-10"><span data-testid="vexora-dialog-icon" className="grid flex-none place-items-center size-10 rounded-lg border border-blue-200 bg-slate-100 text-blue-700 dark:border-blue-500/30 dark:bg-slate-800 dark:text-blue-300">{icon}</span><div className="min-w-0"><h2 className="truncate">{title}</h2>{subtitle&&<p className="text-xs text-slate-600 dark:text-slate-300">{subtitle}</p>}</div><button type="button" data-testid="vexora-dialog-close" className="absolute right-3 top-3 z-10 grid place-items-center size-8 rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-50" aria-label="Fechar janela" onClick={onClose}><X size={19}/></button></header><div data-testid="vexora-dialog-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>{footer&&<footer data-testid="vexora-dialog-footer" className="mt-0 flex flex-none justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">{footer}</footer>}</section></div>,document.body);
}
