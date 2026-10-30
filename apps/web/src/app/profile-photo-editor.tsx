"use client";
import { useState } from 'react';
import { Camera } from 'lucide-react';
export function ProfilePhotoEditor({onUpdated,compact=false}:{onUpdated:()=>Promise<void>;compact?:boolean}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function save(file?:File){setBusy(true);setNotice('');try{const body=file?new FormData():undefined;if(file)body!.set('file',file);const r=await fetch('/api/backend/profile/'+(file?'photo':'google-photo'),{method:'POST',body});const d=await r.json();if(!r.ok)throw Error(d.message||'Falha ao atualizar foto.');await onUpdated();setNotice('Foto atualizada.')}catch(e){setNotice(e instanceof Error?e.message:'Falha ao atualizar foto.')}finally{setBusy(false)}}
 if(compact)return <label className="profile-photo-trigger" title="Trocar foto" onClick={e=>e.stopPropagation()}><Camera size={14}/><input type="file" accept="image/*" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void save(file);e.target.value=''}}/>{notice&&<small role="status">{notice}</small>}</label>;
 return <div className="profile-photo-help"><label className="secondary-button">Trocar foto<input type="file" accept="image/*" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void save(file);e.target.value=''}}/></label>{notice&&<small role="status">{notice}</small>}</div>;
}
