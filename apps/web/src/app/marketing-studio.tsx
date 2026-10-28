"use client";
import {useEffect,useState} from 'react';
async function api(path:string,body?:unknown){const r=await fetch('/api/backend/'+path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.message||'Não foi possível concluir.');return d;}
export function MarketingStudio({mode,onCreated}:{mode?:string;onCreated?:()=>void}){
 const [accounts,setAccounts]=useState<any[]>([]),[accountId,setAccountId]=useState(''),[folder,setFolder]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{void Promise.all([api('creative-references/accounts'),api('marketing/library')]).then(([a,l])=>{setAccounts(a);setAccountId(l.accountId||a[0]?.id||'');setFolder(l.folderId||'');}).catch(e=>setNotice(e.message));},[]);
 if(mode!=='settings')return null;
 return <form className="ai-admin-fields" onSubmit={e=>{e.preventDefault();setBusy(true);setNotice('');void api('marketing/library',{accountId,folderId:folder,autoPublish:false}).then(()=>{setNotice('Pasta salva.');onCreated?.();}).catch(e=>setNotice(e.message)).finally(()=>setBusy(false));}}>
 <label>Conta Google<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Selecione</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.email}</option>)}</select></label>
 <label>Pasta de referências<input value={folder} onChange={e=>setFolder(e.target.value)} placeholder="Link ou ID da pasta"/></label>
 <button className="secondary-button" disabled={busy||!accountId||!folder}>Salvar pasta</button>
 <button type="button" className="secondary-button" disabled={busy||!accountId||!folder} onClick={()=>{setBusy(true);void api('marketing/library/sync',{}).then(d=>{setNotice(d.answer);onCreated?.();}).catch(e=>setNotice(e.message)).finally(()=>setBusy(false));}}>Sincronizar referências</button>
 {notice&&<p role="status">{notice}</p>}</form>;
}
