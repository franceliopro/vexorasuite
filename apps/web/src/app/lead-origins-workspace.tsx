"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Compass, Search } from "lucide-react";

type OriginGroup={name:string;total:number;won:number;lost:number;open:number;withCampaign:number};
type Lead={id:string;name:string;source:string;campaign:string|null;stage:string;createdAt:string};
type Origins={period:{from:string;to:string};total:number;identified:number;unidentified:number;byOrigin:OriginGroup[];stages:{name:string;count:number}[];recent:Lead[];basis:string};
const day=86400000;
function dateValue(value:Date){return value.getFullYear()+"-"+String(value.getMonth()+1).padStart(2,"0")+"-"+String(value.getDate()).padStart(2,"0")}
async function request<T>(url:string):Promise<T>{const response=await fetch(url,{cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"Não foi possível carregar as origens.");return data as T}
export function LeadOriginsWorkspace(){
 const today=dateValue(new Date()),initialFrom=dateValue(new Date(Date.now()-29*day));
 const [from,setFrom]=useState(initialFrom),[to,setTo]=useState(today),[applied,setApplied]=useState({from:initialFrom,to:today}),[data,setData]=useState<Origins|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[query,setQuery]=useState("");
 useEffect(()=>{let live=true;setLoading(true);setError("");void request<Origins>("/api/backend/reports/lead-origins?"+new URLSearchParams({...applied,tzOffset:String(new Date().getTimezoneOffset())})).then(v=>{if(live)setData(v)}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Falha ao carregar as origens.")}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[applied]);
 const max=Math.max(1,...(data?.byOrigin||[]).map(item=>item.total));
 const visible=(data?.recent||[]).filter(item=>!query.trim()||[item.name,item.source,item.campaign||""].some(v=>v.toLowerCase().includes(query.trim().toLowerCase())));
 function apply(){if(from&&to&&from<=to)setApplied({from,to});else setError("Confira as datas do período.")}
 return <section className="settings-workspace lead-origins-workspace">
  <header className="settings-heading report-heading"><div><p className="eyebrow">INTELIGÊNCIA COMERCIAL</p><h1>Origem dos Leads</h1><p>Entenda de onde vêm as oportunidades e onde a informação de aquisição ainda falta.</p></div><span className="report-heading-icon"><Compass size={24}/></span></header>
  <section className="content-card report-filters"><label>De<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label><button className="primary-button" onClick={apply} disabled={loading}>Aplicar período</button></section>
  {error?<div className="settings-feedback error" role="alert">{error}</div>:null}
  {data?<><div className="report-kpi-grid origin-kpi-grid">{[["Leads no período",data.total],["Origem identificada",data.identified],["Origem não informada",data.unidentified]].map(([label,value])=><article className="content-card report-kpi" key={String(label)}><span>{label}</span><strong>{value}</strong><small>{data.total?Math.round(Number(value)/data.total*100)+"% do total":"Sem contatos neste período"}</small></article>)}</div>
   <div className="report-tables-grid origin-main-grid"><section className="content-card origin-breakdown"><header><div><h2>De onde vêm os contatos</h2><p>Origens explícitas, sem deduzir aquisição pelo canal de atendimento.</p></div></header>{data.byOrigin.length?data.byOrigin.map(item=><div className="origin-bar-row" key={item.name}><div className="origin-bar-label"><span>{item.name}</span><strong>{item.total}</strong></div><div className="origin-bar-track"><span style={{width:(item.total/max*100)+"%"}}/></div><div className="origin-bar-meta"><span>{item.won} ganhos</span><span>{item.lost} perdas</span><span>{item.open} em andamento</span>{item.withCampaign?<span>{item.withCampaign} com campanha</span>:null}</div></div>):<p className="report-empty">Ainda não há contatos neste período.</p>}</section>
   <section className="content-card origin-stage-card"><header><h2>Etapas comerciais</h2></header>{data.stages.length?data.stages.map(stage=><div className="origin-stage-row" key={stage.name}><span>{stage.name}</span><strong>{stage.count}</strong></div>):<p className="report-empty">Sem etapas registradas.</p>}<div className="origin-tip"><strong>Como melhorar a atribuição</strong><p>Registre a origem quando cadastrar um lead e conecte formulários/campanhas para capturar a primeira origem sem depender da memória do atendente.</p></div></section></div>
   <section className="content-card origin-recent"><header><div><h2>Contatos recentes</h2><p>Até 50 registros criados no período selecionado.</p></div><label className="origin-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar contato ou origem"/></label></header>{visible.length?<div className="report-table-scroll"><table><thead><tr><th>Contato</th><th>Origem</th><th>Campanha</th><th>Etapa</th><th>Cadastro</th><th></th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><strong>{item.name}</strong></td><td><span className={item.source==="Não identificada"?"origin-unknown":""}>{item.source}</span></td><td>{item.campaign||"—"}</td><td>{item.stage}</td><td>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td><td><button className="origin-open-link" onClick={()=>{window.location.search="?module=CRM";}} aria-label={"Abrir CRM para "+item.name}><ArrowUpRight size={15}/></button></td></tr>)}</tbody></table></div>:<p className="report-empty">Nenhum contato corresponde à busca.</p>}</section>
   <p className="report-methodology">{data.basis} {loading?"Atualizando os dados…":""}</p>
  </>:null}
 </section>
}
