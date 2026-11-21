"use client";
import {useEffect,useState} from 'react';

const cardTw="grid min-w-0 gap-3 rounded-token-lg border border-line bg-surface p-4 shadow-token-sm";
const toggleTw="inline-flex items-center gap-2 text-xs text-ink-secondary";
const toggleInputTw="size-4 accent-blue-600";
const primaryTw="inline-flex min-h-control items-center justify-center rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

export function NotificationSettings(){
 const [settings,setSettings]=useState({users:true,departments:true}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{void fetch('/api/backend/notification-settings',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Não foi possível consultar as notificações.');return r.json()}).then(d=>{setSettings({users:d.users,departments:d.departments});setReady(true)}).catch(e=>setNotice(e.message));},[]);
 return <details className={cardTw}><summary>Notificações de atendimento</summary><p>Bot e IA trabalham em silêncio. Os avisos começam quando o atendimento é atribuído a uma pessoa ou equipe. A atribuição individual avisa somente o responsável.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setNotice('');try{const r=await fetch('/api/backend/notification-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});if(!r.ok)throw Error('Não foi possível salvar.');setNotice('Notificações atualizadas.')}catch(e){setNotice(e instanceof Error?e.message:'Falha de conexão.')}finally{setBusy(false)}}}><label className={toggleTw}><input className={toggleInputTw} type="checkbox" disabled={!ready||busy} checked={settings.users} onChange={e=>setSettings(v=>({...v,users:e.target.checked}))}/>Atendimentos atribuídos ao usuário</label><label className={toggleTw}><input className={toggleInputTw} type="checkbox" disabled={!ready||busy} checked={settings.departments} onChange={e=>setSettings(v=>({...v,departments:e.target.checked}))}/>Atendimentos atribuídos ao departamento</label><button className={primaryTw} disabled={!ready||busy}>{busy?'Salvando…':'Salvar notificações'}</button></form>{notice&&<p role="status">{notice}</p>}</details>;
}
