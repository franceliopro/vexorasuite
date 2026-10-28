"use client";
import {useCallback,useEffect,useState} from 'react';
type Item={id:string;title:string;status:string;createdAt:string;plannedFor?:string|null};
async function api(path:string,body?:unknown,method='POST'){const r=await fetch('/api/backend/'+path,body===undefined?{cache:'no-store'}:{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(typeof d.message==='string'?d.message:'Não foi possível concluir.');return d;}
export function ManualContentWorkspace(){
 const [items,setItems]=useState<Item[]>([]),[opened,setOpened]=useState<any>(null),[question,setQuestion]=useState(''),[format,setFormat]=useState('POST'),[brandOnly,setBrandOnly]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[caption,setCaption]=useState(''),[planned,setPlanned]=useState('');
 const load=useCallback(async()=>{setItems(await api('assistant/automations'));},[]);
 useEffect(()=>{void load().catch(e=>setNotice(e.message));},[load]);
 async function open(id:string){const d=await api('assistant/automations/'+id);setOpened(d);setCaption(d.details.carousel?.caption||'');setPlanned(d.details.manualReview?.plannedFor||'');}
 async function act(fn:()=>Promise<void>){setBusy(true);setNotice('');try{await fn()}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível concluir. Confira a biblioteca antes de repetir.');}finally{setBusy(false);}}
 return <section className="simple-workspace">
 <header className="creative-heading"><div><h1>Criações</h1><p>Prepare, revise e baixe seus conteúdos.</p></div><a className="secondary-button" href="/?module=Configurações">Marca da empresa</a></header>
 {notice&&<p role="status">{notice}</p>}
 <form className="workspace-surface ai-admin-fields" onSubmit={e=>{e.preventDefault();void act(async()=>{const d=await api('marketing/drafts',{question,format,useBrandOnly:brandOnly,publish:false});await load();if(d.automation?.id)await open(d.automation.id);setNotice('Rascunho criado. Revise antes de usar.');});}}>
 <label>Tema e orientação<textarea required rows={3} maxLength={2000} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Crie um conteúdo sobre os serviços da empresa."/></label>
 <label>Formato<select value={format} onChange={e=>setFormat(e.target.value)}><option value="POST">Arte e legenda</option><option value="CAROUSEL">Carrossel</option></select></label>
 <label><input type="checkbox" checked={brandOnly} onChange={e=>setBrandOnly(e.target.checked)}/> Usar somente a identidade visual, sem consultar o Drive</label>
 <button className="primary-button" disabled={busy||!question.trim()}>{busy?'Preparando…':'Criar rascunho'}</button>
 </form>
 {opened&&<section className="workspace-surface ai-admin-fields"><div className="workspace-section-heading"><h2>{opened.details.carousel?.title||'Conteúdo'}</h2><button className="text-button" onClick={()=>setOpened(null)}>Fechar</button></div>
 <p>{opened.details.manualReview?.approved?'Aprovado para uso manual':'Revisão pendente'}</p>
 <label>Legenda<textarea rows={5} maxLength={2000} value={caption} onChange={e=>setCaption(e.target.value)}/></label>
 <label>Data no calendário editorial<input type="date" value={planned} onChange={e=>setPlanned(e.target.value)}/><small>Organiza o planejamento; não publica nem envia mensagens.</small></label>
 <div className="workspace-actions">{[false,true].map(approved=><button key={String(approved)} type="button" className={approved?'primary-button':'secondary-button'} disabled={busy||!caption.trim()} onClick={()=>void act(async()=>{await api('marketing/drafts/'+opened.id+'/review',{caption,plannedFor:planned,approved},'PATCH');await open(opened.id);await load();setNotice(approved?'Conteúdo aprovado. Baixe e publique manualmente.':'Revisão salva.');})}>{approved?'Aprovar conteúdo':'Salvar revisão'}</button>)}
 <button className="secondary-button" type="button" onClick={()=>void navigator.clipboard.writeText(caption).then(()=>setNotice('Legenda copiada.')).catch(()=>setNotice('Selecione a legenda e copie.'))}>Copiar legenda</button></div>
 <div className="creative-slide-list">{opened.details.carousel?.slides?.map((slide:any,index:number)=><figure key={index}><img alt={slide.title} width={180} src={'/api/backend/assistant/automations/'+opened.id+'/slides/'+index}/><figcaption>{slide.title}</figcaption><a download={'arte-'+(index+1)+'.png'} href={'/api/backend/assistant/automations/'+opened.id+'/slides/'+index}>Baixar arte {index+1}</a></figure>)}</div>
 </section>}
 <section className="workspace-surface"><div className="workspace-section-heading"><h2>Biblioteca e planejamento</h2><button className="secondary-button" disabled={busy} onClick={()=>void act(load)}>Atualizar</button></div>
 {items.map(item=><article className="publication-row" key={item.id}><div><strong>{item.title}</strong><small>{item.plannedFor?'Planejado: '+item.plannedFor.split('-').reverse().join('/'):'Sem data editorial'}</small></div><span className="status-pill">{item.status==='MANUAL_READY'?'Aprovado':item.status==='DRAFT'?'Rascunho':'Histórico'}</span><button type="button" className="secondary-button" disabled={busy} onClick={()=>void act(()=>open(item.id))}>Revisar</button></article>)}
 {!items.length&&<p>Nenhum conteúdo criado.</p>}</section></section>;
}
