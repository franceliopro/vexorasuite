"use client";
import { useEffect,useState } from 'react';
export function WorkspaceAlerts({admin}:{admin:boolean}){
 const [usage,setUsage]=useState<any>(null),[folders,setFolders]=useState<any[]>([]),[channels,setChannels]=useState<any[]>([]);
 useEffect(()=>{let live=true;const read=(path:string)=>fetch('/api/backend/'+path,{cache:'no-store'}).then(r=>r.ok?r.json():null);const load=()=>{
  void read('channels').then(v=>{if(live&&Array.isArray(v))setChannels(v)}).catch(()=>{});
  if(admin){void read('assistant/provider-connections/usage').then(v=>{if(live)setUsage(v)}).catch(()=>{});void read('marketing/prepared').then(v=>{if(live&&v)setFolders(v.folders||[])}).catch(()=>{});}
 };load();const timer=setInterval(load,30000);return()=>{live=false;clearInterval(timer)}},[admin]);
 const problem=channels.filter(c=>c.provider==='WAHA'&&(c.status!=='CONNECTED'||!c.healthCheckedAt||Date.now()-Date.parse(c.healthCheckedAt)>90000));
 const low=folders.filter(f=>f.enabled&&f.lastScanAt&&f.remaining<=2);
 if(!problem.length&&!low.length&&!usage?.low&&!usage?.incident)return null;
 return <aside aria-label="Avisos da operação" style={{display:'grid',gap:6,marginBottom:12}}>{problem.length>0&&<div role="alert" className="channel-health-warning"><strong>WhatsApp: {problem.map(c=>c.name).join(', ')} requer verificação.</strong><a href="/?module=Atendimento">Ver estado e reconectar</a></div>}{(usage?.low||usage?.incident)&&<div role="alert" className="channel-health-warning"><strong>Cota de IA baixa ou limite recente atingido.</strong><span>Confira o limite gratuito e escolha se autoriza um modelo pago de menor custo.</span><a href="/?module=Agentes%20de%20IA">Revisar Agentes de IA</a></div>}{low.map(f=><div role="alert" className="channel-health-warning" key={f.id}><strong>Pasta {f.mode==='NEWS'?'novidades':'prontas'}: {f.remaining} mídias disponíveis.</strong><a href="/?module=Postagens">Repor e revisar rotina</a></div>)}</aside>;
}
