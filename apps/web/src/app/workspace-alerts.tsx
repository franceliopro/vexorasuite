"use client";
import { useEffect,useState } from 'react';
export function WorkspaceAlerts({admin}:{admin:boolean}){
 const [usage,setUsage]=useState<any>(null),[channels,setChannels]=useState<any[]>([]);
 useEffect(()=>{let live=true;const read=(path:string)=>fetch('/api/backend/'+path,{cache:'no-store'}).then(r=>r.ok?r.json():null);const load=()=>{
  void read('channels').then(v=>{if(live&&Array.isArray(v))setChannels(v)}).catch(()=>{});
  if(admin)void read('assistant/provider-connections/usage').then(v=>{if(live)setUsage(v)}).catch(()=>{});
 };load();const timer=setInterval(load,30000);return()=>{live=false;clearInterval(timer)}},[admin]);
 const problem=channels.filter(c=>c.provider==='WAHA'&&(c.status!=='CONNECTED'||!c.healthCheckedAt||Date.now()-Date.parse(c.healthCheckedAt)>90000));
 if(!problem.length&&!usage?.low&&!usage?.incident)return null;
 return <aside aria-label="Avisos da operação" className="operation-notices"><details><summary>{problem.length?'WhatsApp requer atenção':'Limite de IA requer atenção'}<span>{problem.length+(usage?.low||usage?.incident?1:0)} aviso(s) · ver detalhes</span></summary>{problem.length>0&&<p role="alert"><strong>WhatsApp: {problem.map(c=>c.name).join(', ')} requer verificação.</strong> <a href="/?module=Atendimento">Ver estado e reconectar</a></p>}{(usage?.low||usage?.incident)&&<p><strong>Cota de IA baixa ou limite recente atingido.</strong> <a href="/?module=Agentes%20de%20IA">Revisar limites e modelos</a></p>}</details></aside>;
}

