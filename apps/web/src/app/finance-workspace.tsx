"use client";
import { useEffect, useState } from "react";
import { Activity, AlertCircle, RefreshCcw, Wallet } from "lucide-react";
type Dashboard = { source:string;partial:boolean;caveat:string;environment:string[];months:number;totals:{billed:number;paid:number;open:number;count:number};series:{month:string;billed:number;paid:number;open:number}[];outstandingContacts:number;collectionRate:number|null };
const currency = (n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

type PortfolioItem = { id:string;customerId:string;description:string|null;value:number;dueDate:string;status:string;billingType:string|null;subscriptionId:string|null;invoiceUrl?:string|null };
type Portfolio = {source:string;environment:string;items:PortfolioItem[];hasMore:boolean;offset:number;totalCount:number|null};
function PortfolioView(){
 const [status,setStatus]=useState("");
 const [dueFrom,setDueFrom]=useState("");
 const [dueTo,setDueTo]=useState("");
 const [offset,setOffset]=useState(0);
 const [data,setData]=useState<Portfolio|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<PortfolioItem|null>(null);
 const [template,setTemplate]=useState("friendly");
 const [copied,setCopied]=useState(false);
 useEffect(()=>{let active=true;setLoading(true);setError("");
  const q=new URLSearchParams({offset:String(offset),limit:"50"});
  if(status)q.set("status",status);if(dueFrom)q.set("dueFrom",dueFrom);if(dueTo)q.set("dueTo",dueTo);
  fetch("/api/backend/finance/portfolio?"+q.toString(),{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||"Falha ao consultar Asaas");return body as Portfolio}).then(v=>{if(active)setData(v)}).catch(e=>{if(active){setError(String(e.message||e));setData(null)}}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[status,dueFrom,dueTo,offset,refresh]);
 return <section className="content-card finance-portfolio">
  <header><h2>Carteira Asaas</h2><p>Cobranças consultadas diretamente no Asaas. Os resultados não são uma conciliação histórica.</p></header>
  <div className="finance-portfolio-filters">
   <label>Situação <select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><option value="">Todas</option>{["PENDING","OVERDUE","RECEIVED","CONFIRMED","RECEIVED_IN_CASH","REFUNDED","CANCELLED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE"].map(s=><option key={s} value={s}>{({PENDING:"A vencer / pendente",OVERDUE:"Vencido",RECEIVED:"Recebido",CONFIRMED:"Confirmado",RECEIVED_IN_CASH:"Recebido em dinheiro",REFUNDED:"Estornado",CANCELLED:"Cancelado",CHARGEBACK_REQUESTED:"Contestação solicitada",CHARGEBACK_DISPUTE:"Em contestação"} as Record<string,string>)[s]}</option>)}</select></label>
   <label>Vencimento de <input type="date" value={dueFrom} onChange={e=>{setDueFrom(e.target.value);setOffset(0)}}/></label>
   <label>Até <input type="date" value={dueTo} min={dueFrom||undefined} onChange={e=>{setDueTo(e.target.value);setOffset(0)}}/></label>
   <button type="button" className="secondary-button" onClick={()=>setRefresh(n=>n+1)}>Atualizar</button>
  </div>
  {error?<p role="alert">{error}</p>:loading?<p role="status">Consultando cobranças…</p>:data&&<>
   <p className="finance-portfolio-meta">Fonte: Asaas · Ambiente: {data.environment} · Página {Math.floor(data.offset/50)+1}{data.totalCount!==null?" · Total informado: "+data.totalCount:""}</p>
   <div className="finance-portfolio-scroll"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{data.items.map(p=><tr key={p.id}><td>{p.dueDate}</td><td>{p.description||"Cobrança sem descrição"}</td><td>{currency(p.value)}</td><td>{p.status}</td><td>{["PENDING","OVERDUE"].includes(p.status)?<button type="button" onClick={()=>{setSelected(p);setCopied(false)}}>Cobrar</button>:p.invoiceUrl?<a href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">Fatura</a>:"—"}</td></tr>)}</tbody></table>{!data.items.length?<p>Nenhuma cobrança encontrada.</p>:null}</div>
   <div className="finance-portfolio-pagination"><button type="button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Anterior</button><button type="button" disabled={!data.hasMore} onClick={()=>setOffset(n=>n+50)}>Próxima</button></div>
  </>}
 {selected&&<div className="finance-collection-overlay" role="presentation" onClick={()=>setSelected(null)}><aside className="finance-collection-drawer" role="dialog" aria-modal="true" aria-label="Preparar cobrança" onClick={e=>e.stopPropagation()}>
  <header><h2>Preparar cobrança</h2><button type="button" aria-label="Fechar" onClick={()=>setSelected(null)}>×</button></header>
  <p><strong>{currency(selected.value)}</strong> · Vencimento {selected.dueDate} · {selected.status}</p>
  <label>Modelo de mensagem<select value={template} onChange={e=>{setTemplate(e.target.value);setCopied(false)}}><option value="friendly">Lembrete cordial</option><option value="due">Aviso de vencimento</option><option value="late">Cobrança após vencimento</option></select></label>
  <p>Mensagem preparada com os dados reais desta cobrança. Confira o destinatário antes de enviar.</p>
  <textarea readOnly rows={7} value={(template==="late"?"Olá! Identificamos uma cobrança pendente com vencimento em ":template==="due"?"Olá! Sua cobrança tem vencimento em ":"Olá! Segue um lembrete sobre sua cobrança com vencimento em ")+selected.dueDate+", no valor de "+currency(selected.value)+"."+(selected.invoiceUrl?" Acesse a fatura: "+selected.invoiceUrl:" Entre em contato com nosso financeiro para obter os dados de pagamento.")+" Se já realizou o pagamento, desconsidere esta mensagem."}/>
  <button type="button" onClick={async()=>{const message=(document.querySelector(".finance-collection-drawer textarea") as HTMLTextAreaElement|null)?.value||"";try{await navigator.clipboard.writeText(message);setCopied(true)}catch{setCopied(false)}}}>{copied?"Mensagem copiada":"Copiar mensagem"}</button>
  {selected.invoiceUrl?<a href={selected.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir fatura no Asaas</a>:null}
  <small>Não enviada automaticamente. O envio integrado e seu histórico dependem da conexão do canal e de auditoria.</small>
 </aside></div>}
 </section>;
}

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
   <div className="finance-health-toolbar"><div className="module-tabs" role="group" aria-label="Comparar períodos">{[1,2,3,6,12].map(m=><button type="button" key={m} className={!custom&&months===m?"active":""} onClick={()=>{setCustom(false);setMonths(m)}}>{m===1?"Mês atual":m===12?"1 ano":m+" meses"}</button>)}<button type="button" className={custom?"active":""} onClick={()=>{if(!from){const d=new Date();setFrom(new Date(Date.UTC(d.getFullYear(),d.getMonth(),1)).toISOString().slice(0,10));setTo(d.toISOString().slice(0,10));}setCustom(true)}}>Personalizado</button></div>{false&&custom&&<div className="finance-health-date-range"><label>De <input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>Até <input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label></div>}<button className="secondary-button" type="button" onClick={()=>setRefresh(n=>n+1)}><RefreshCcw size={15}/> Atualizar</button></div>
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
   <PortfolioView/>
 </section>;
}
