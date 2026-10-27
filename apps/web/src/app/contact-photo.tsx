"use client";
import { useEffect, useState } from 'react';
export function ContactPhoto({id,name,className,version}:{id:string;name:string;className?:string;version?:unknown}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[id,version]);
 return <span className={className}>{failed?(name.trim().slice(0,1).toUpperCase()||'?'):<img src={'/api/backend/contacts/'+id+'/avatar'+(version?'?v='+encodeURIComponent(String(version)):'')} alt={'Foto de '+name} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>}</span>;
}
