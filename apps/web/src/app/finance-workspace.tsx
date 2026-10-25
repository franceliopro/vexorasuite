"use client";
import { useEffect, useState } from "react";
import { Activity, AlertCircle, RefreshCcw, Wallet } from "lucide-react";
type Dashboard = { source:string;partial:boolean;caveat:string;environment:string[];months:number;totals:{billed:number;paid:number;open:number;count:number};series:{month:string;billed:number;paid:number;open:number}[];outstandingContacts:number;collectionRate:number|null };
const currency = (n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function FinanceWorkspace(){
 const [months,setMonths]=useState(1);
 const [custom,setCustom]=useState(false);
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [data,setData]=useState<Dashboard|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");fetch("/api/backend/finance/dashboard?"+(custom?"from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to):"months="+months),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||"Falha ao consultar o Financeiro");return d as Dashboard;}).then(d=>{if(live)setData(d)}).catch(e=>{if(live){setData(null);setError(e.message)}}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[months,custom,from,to,refresh]);
 const max=Math.max(1,...(data?.series||[]).map(v=>v.billed));
 return <section className="module-workspace finance-health">
   <header className="page-heading"><div><h1>Financeiro</h1><p className="page-subtitle">Visão dos recebimentos registrados nos atendimentos.</p></div></header>
   <div className="finance-health-toolbar"><div className="module-tabs" role="group" aria-label="Comparar períodos">{[1,2,3,6,12].map(m=><button type="button" key={m} className={!custom&&months===m?"active":""} onClick={()=>{setCustom(false);setMonths(m)}}>{m===1?"Mês atual":m===12?"1 ano":m+" meses"}</button>)}<button type="button" className={custom?"active":""} onClick={()=>{if(!from){const d=new Date();setFrom(new Date(Date.UTC(d.getFullYear(),d.getMonth(),1)).toISOString().slice(0,10));setTo(d.toISOString().slice(0,10));}setCustom(true)}}>Personalizado</button></div>{custom&&<div className="finance-health-date-range"><label>De <input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>Até <input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label></div>}<button className="secondary-button" type="button" onClick={()=>setRefresh(n=>n+1)}><RefreshCcw size={15}/> Atualizar</button></div>
   {loading?<p role="status">Consultando dados financeiros…</p>:error?<div className="content-card finance-health-note" role="alert"><AlertCircle size={18}/>{error}</div>:data&&<>
   <div className="finance-health-note content-card"><AlertCircle size={17}/><span><strong>Visão parcial dos atendimentos.</strong> {data.caveat}{data.partial?" Limite de 10 mil registros atingido.":""}</span></div>
   <div className="finance-health-metrics">
     {[{label:"Valor registrado",value:currency(data.totals.billed),icon:<Wallet size={18}/>},{label:"Pagamentos confirmados",value:currency(data.totals.paid),icon:<Activity size={18}/>},{label:"Ainda em aberto",value:currency(data.totals.open),icon:<Wallet size={18}/>},{label:"Taxa de recebimento",value:data.collectionRate===null?"—":data.collectionRate+"%",icon:<Activity size={18}/>}].map(v=><article className="content-card finance-health-metric" key={v.label}><span>{v.icon}{v.label}</span><strong>{v.value}</strong></article>)}
   </div>
   <div className="finance-health-panels">
     <section className="content-card finance-health-chart"><h2>Recebimentos por mês</h2><p>Competência pelo registro na Véxora; valores em reais.</p><div className="finance-health-bars">{data.series.map(item=><div className="finance-health-bar-group" key={item.month}><div className="finance-health-bar-pair" title={item.month+": "+currency(item.paid)+" recebidos, "+currency(item.open)+" em aberto"}><div className="finance-health-bar finance-health-bar-paid" style={{height:Math.max(1,item.paid/max*100)+"%"}}/><div className="finance-health-bar finance-health-bar-open" style={{height:Math.max(1,item.open/max*100)+"%"}}/></div><small>{item.month.slice(5)}/{item.month.slice(2,4)}</small></div>)}</div><div className="finance-health-legend"><span>● Recebido</span><span>● Em aberto</span></div></section>
     <section className="content-card finance-health-summary"><h2>Raio-X inicial</h2><p>Resumo dos registros disponíveis neste período.</p><dl><div><dt>Pagamentos registrados</dt><dd>{data.totals.count}</dd></div><div><dt>Contatos com valores em aberto</dt><dd>{data.outstandingContacts}</dd></div><div><dt>Ambientes registrados</dt><dd>{data.environment.join(", ")||"Sem registros"}</dd></div></dl><p>Para calcular inadimplência real, dias em atraso e régua de cobrança, o próximo passo é importar e conciliar a carteira de cobranças do Asaas com datas de vencimento.</p></section>
   </div>
   </>}
 </section>;
}
