"use client";
import { useEffect,useState } from 'react';
type Skill={id:string;name:string;description:string;instructions:string;status?:string};
export function ProductSkillsEditor(){
 const [skills,setSkills]=useState<Skill[]>([]),[canEdit,setCanEdit]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch('/api/backend/assistant/custom-skills',{cache:'no-store'});if(!r.ok)throw Error('Não foi possível carregar as Skills.');const d=await r.json();setSkills(d.skills||[]);setCanEdit(d.canEdit===true);}
 useEffect(()=>{void load().catch(e=>setNotice(e.message))},[]);
 async function save(){setBusy(true);try{const r=await fetch('/api/backend/assistant/custom-skills',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({skills})});const d=await r.json();if(!r.ok)throw Error(d.message||'Falha ao salvar.');await load();setNotice('Instruções salvas para esta empresa.');}catch(e){setNotice(e instanceof Error?e.message:'Falha ao salvar')}finally{setBusy(false)}}
 return <section><h4>Instruções das Skills da empresa</h4><p>Você pode ler as regras e editar as orientações de negócio. As permissões de acesso e as proteções contra publicação repetida continuam obrigatórias.</p>{skills.map((skill,index)=><details key={skill.id}><summary>{skill.name} · {skill.status==='implemented'?'Implementada':'Rascunho'}</summary><p>{skill.description}</p><label>Instruções<textarea rows={7} maxLength={12000} disabled={!canEdit||busy} value={skill.instructions} onChange={e=>setSkills(rows=>rows.map((s,i)=>i===index?{...s,instructions:e.target.value}:s))}/></label></details>)}{canEdit&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void save()}>Salvar instruções das Skills</button>}{notice&&<p role="status">{notice}</p>}</section>;
}
