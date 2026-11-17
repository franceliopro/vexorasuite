"use client";
import { useEffect, useRef, useState } from 'react';
export function ContactPhoto({id,name,className,version}:{id:string;name:string;className?:string;version?:unknown}){
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const timer=useRef<number|null>(null);
  useEffect(()=>{setFailed(false);setAttempt(0)},[id,version]);
  useEffect(()=>()=>{if(timer.current)window.clearTimeout(timer.current)},[]);
  return <span className={className}>{failed?(name.trim().slice(0,1).toUpperCase()||'?'):<img key={attempt} src={'/api/backend/contacts/'+id+'/avatar?v='+(version?encodeURIComponent(String(version))+'-':'')+attempt} alt={'Foto de '+name} loading="lazy" referrerPolicy="no-referrer" onError={()=>{if(timer.current)window.clearTimeout(timer.current);if(attempt<2){timer.current=window.setTimeout(()=>setAttempt(a=>a+1),1500)}else{setFailed(true)}}} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>}</span>;
}
