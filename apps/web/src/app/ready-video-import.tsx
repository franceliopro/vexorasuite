"use client";
import { useState, type FormEvent } from 'react';

export function ReadyVideoImport({onImported}:{onImported:()=>Promise<void>}){
 const [title,setTitle]=useState(''),[caption,setCaption]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!file||busy)return;const formElement=event.currentTarget;setBusy(true);setNotice('');
  try{
   if(file.size>20*1024*1024)throw Error('Use um MP4 com até 20 MB.');
   const form=new FormData();form.set('title',title);form.set('caption',caption);form.set('file',file);
   const response=await fetch('/api/backend/assistant/automations/import-video',{method:'POST',body:form});
   const data=await response.json();if(!response.ok)throw Error(typeof data.message==='string'?data.message:'Não foi possível importar o vídeo.');
   setFile(null);setTitle('');setCaption('');formElement.reset();setNotice('Vídeo salvo como rascunho. Abra a criação no histórico para revisar, publicar ou agendar.');await onImported();
  }catch(error){setNotice((error instanceof Error?error.message:'Falha ao enviar o vídeo.')+' Se houve interrupção, confira o histórico antes de enviar novamente.');}
  finally{setBusy(false);}
 }
 return <details className="content-card" style={{padding:20,marginTop:16}}><summary>Adicionar vídeo pronto</summary><form className="ai-admin-fields" onSubmit={event=>void submit(event)}><p>Envie seu MP4 para revisar e publicar pela Véxora. O arquivo sempre entra como rascunho.</p><label>Título do vídeo<input required maxLength={120} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></label><label>Legenda do vídeo<textarea required maxLength={2000} rows={3} value={caption} disabled={busy} onChange={e=>setCaption(e.target.value)}/></label><label>Arquivo MP4<input required type="file" accept="video/mp4,.mp4" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label><small>Até 20 MB. A importação prepara até os primeiros 60 segundos em formato vertical. Aguarde a confirmação antes de sair desta tela.</small><button type="submit" className="primary-button" disabled={busy||!file||!title.trim()||!caption.trim()}>{busy?'Preparando vídeo…':'Salvar vídeo como rascunho'}</button>{notice&&<p role="status">{notice}</p>}</form></details>;
}
