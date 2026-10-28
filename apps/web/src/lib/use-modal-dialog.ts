"use client";
import {useEffect,useRef,type RefObject} from 'react';
import {acquireBodyScrollLock} from "./body-scroll-lock.ts";
export function useModalDialog(open:boolean,ref:RefObject<HTMLElement|null>,close:()=>void){
 const closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{if(!open)return;const dialog=ref.current;if(!dialog)return;const previous=document.activeElement as HTMLElement|null;
  const releaseScroll=acquireBodyScrollLock();
  const focusable=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  (focusable()[0]||dialog).focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeRef.current();return;}if(event.key!=='Tab')return;const elements=focusable(),first=elements[0],last=elements.at(-1);if(!first||!last){event.preventDefault();dialog.focus();return;}if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}};
  document.addEventListener('keydown',onKey,true);
  return()=>{document.removeEventListener('keydown',onKey,true);releaseScroll();if(previous?.isConnected)previous.focus();};
 },[open,ref]);
}


