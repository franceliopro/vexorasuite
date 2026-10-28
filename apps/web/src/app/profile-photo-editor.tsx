"use client";
import { useState } from 'react';
export function ProfilePhotoEditor({onUpdated}:{onUpdated:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function save(file?:File){setBusy(true);setNotice('');try{const body=file?new FormData():undefined;if(file)body!.set('file',file);const r=await fetch('/api/backend/profile/'+(file?'photo':'google-photo'),{method:'POST',body});const d=await r.json();if(!r.ok)throw Error(d.message||'Falha ao atualizar foto.');await onUpdated();setNotice('Foto atualizada.')}catch(e){setNotice(e instanceof Error?e.message:'Falha ao atualizar foto.')}finally{setBusy(false)}}
 return <details style={{padding:'6px 12px'}}><summary>Editar foto do perfil</summary><label>Enviar imagem · até 2 MB<input type="file" accept="image/*" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void save(file);e.target.value=''}}/></label><button type="button" className="text-button" disabled={busy} onClick={()=>void save()}>Usar foto da minha conta Google</button>{notice&&<small role="status">{notice}</small>}</details>;
}
