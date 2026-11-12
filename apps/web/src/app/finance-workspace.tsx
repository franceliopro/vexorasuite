"use client";
import { useEffect, useRef, useState } from "react";
import { useModalDialog } from "../lib/use-modal-dialog";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  History,
  LayoutDashboard,
  Receipt,
  RefreshCcw,
  Repeat2,
  Sparkles,
  Wallet,
  Workflow,
  X,
  Zap,
} from "lucide-react";
const currency = (n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateBR = (value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split("-").reverse().join("/") : value;
const statusBR:Record<string,string>={PENDING:"Pendente",OVERDUE:"Vencido",RECEIVED:"Recebido",CONFIRMED:"Confirmado",RECEIVED_IN_CASH:"Recebido em dinheiro",REFUNDED:"Estornado",CANCELLED:"Cancelado",CHARGEBACK_REQUESTED:"Contestação solicitada",CHARGEBACK_DISPUTE:"Em contestação"};

type PortfolioItem = { id:string;customerId:string;customerName?:string|null;customerDocument?:string|null;description:string|null;value:number;dueDate:string;status:string;billingType:string|null;subscriptionId:string|null;invoiceUrl?:string|null };
type Portfolio = {source:string;environment:string;items:PortfolioItem[];hasMore:boolean;offset:number;totalCount:number|null};
function PortfolioView({initialStatus=""}:{initialStatus?:string}={}){
 const [status,setStatus]=useState(initialStatus);useEffect(()=>{setStatus(initialStatus);setOffset(0)},[initialStatus]);
 const [dueFrom,setDueFrom]=useState("");
 const [dueTo,setDueTo]=useState("");
 const [offset,setOffset]=useState(0);
 const [data,setData]=useState<Portfolio|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<PortfolioItem|null>(null);
 const [template,setTemplate]=useState("friendly");
 const drawerRef=useRef<HTMLElement|null>(null);
 useModalDialog(!!selected,drawerRef,()=>setSelected(null));
 const [copied,setCopied]=useState(false);
 const [groupBy,setGroupBy]=useState("none");
 useEffect(()=>{let active=true;setLoading(true);setError("");
  const q=new URLSearchParams({offset:String(offset),limit:"50"});
  if(status)q.set("status",status);if(dueFrom)q.set("dueFrom",dueFrom);if(dueTo)q.set("dueTo",dueTo);
  fetch("/api/backend/finance/portfolio?"+q.toString(),{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||"Falha ao consultar Asaas");return body as Portfolio}).then(v=>{if(active)setData(v)}).catch(e=>{if(active){setError(String(e.message||e));setData(null)}}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[status,dueFrom,dueTo,offset,refresh]);
 return <section className="content-card finance-portfolio">
  <header><h2>Carteira Asaas</h2><p>Cobranças consultadas diretamente no Asaas. Os resultados não são uma conciliação histórica.</p></header>
  <div className="finance-portfolio-filters"><label>Agrupar <select value={groupBy} onChange={e=>setGroupBy(e.target.value)}><option value="none">Sem agrupamento</option><option value="customer">Cliente</option><option value="service">Serviço</option><option value="date">Vencimento</option><option value="value">Valor</option></select></label>
   <label>Situação <select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}><option value="">Todas</option>{["PENDING","OVERDUE","RECEIVED","CONFIRMED","RECEIVED_IN_CASH","REFUNDED","CANCELLED","CHARGEBACK_REQUESTED","CHARGEBACK_DISPUTE"].map(s=><option key={s} value={s}>{({PENDING:"A vencer / pendente",OVERDUE:"Vencido",RECEIVED:"Recebido",CONFIRMED:"Confirmado",RECEIVED_IN_CASH:"Recebido em dinheiro",REFUNDED:"Estornado",CANCELLED:"Cancelado",CHARGEBACK_REQUESTED:"Contestação solicitada",CHARGEBACK_DISPUTE:"Em contestação"} as Record<string,string>)[s]}</option>)}</select></label>
   <label>Vencimento de <input type="date" value={dueFrom} onChange={e=>{setDueFrom(e.target.value);setOffset(0)}}/></label>
   <label>Até <input type="date" value={dueTo} min={dueFrom||undefined} onChange={e=>{setDueTo(e.target.value);setOffset(0)}}/></label>
   <button type="button" className="secondary-button" onClick={()=>setRefresh(n=>n+1)}>Atualizar</button>
  </div>
  {data?.items.length?<div className="finance-portfolio-actions"><button type="button" className="secondary-button" onClick={()=>{const headers=["Cliente","Documento","Serviço / referência","Vencimento","Situação","Valor"];const lines=data.items.map(p=>[p.customerName||"",p.customerDocument||"",p.description||"Sem referência",dateBR(p.dueDate),statusBR[p.status]||p.status,p.value.toFixed(2).replace(".",",")]);const csv="\uFEFF"+[headers,...lines].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="cobrancas-filtro-pagina.csv";link.click();URL.revokeObjectURL(url)}}>Exportar CSV (página atual)</button><button type="button" className="secondary-button" onClick={async()=>{const summary="Resumo de cobranças — página atual\n"+data.items.map(p=>(p.customerName||"Cliente não identificado")+" | "+dateBR(p.dueDate)+" | "+currency(p.value)+" | "+(statusBR[p.status]||p.status)).join("\n");try{await navigator.clipboard.writeText(summary);window.alert("Resumo copiado. Confira os dados e encaminhe ao responsável por um canal autorizado.")}catch{window.alert("Não foi possível copiar o resumo.")}}}>Copiar resumo para responsável</button></div>:null}
  {error?<p role="alert">{error}</p>:loading?<p role="status">Consultando cobranças…</p>:data&&<>
   <p className="finance-portfolio-meta">Fonte: Asaas · Ambiente: {data.environment} · Página {Math.floor(data.offset/50)+1}{data.totalCount!==null?" · Total informado: "+data.totalCount:""}</p>
   <div className="finance-portfolio-scroll"><table><thead><tr><th>Cliente</th><th>Serviço / referência</th><th>Vencimento</th><th>Situação</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{[...data.items].sort((a,b)=>groupBy==="customer"?(a.customerName||"").localeCompare(b.customerName||""):groupBy==="service"?(a.description||"").localeCompare(b.description||""):groupBy==="date"?a.dueDate.localeCompare(b.dueDate):groupBy==="value"?a.value-b.value:0).map(p=><tr key={p.id}><td><strong>{p.customerName||"Cliente não identificado"}</strong>{p.customerDocument?<small className="finance-customer-document">{p.customerDocument}</small>:null}</td><td>{p.description||"Sem referência"}</td><td>{dateBR(p.dueDate)}</td><td>{statusBR[p.status]||p.status}</td><td>{currency(p.value)}</td><td>{["PENDING","OVERDUE"].includes(p.status)?<button className="finance-collection-action" type="button" disabled={!p.customerName} title={!p.customerName?"Cliente não identificado no Asaas":undefined} onClick={()=>{setSelected(p);setCopied(false)}}>Enviar cobrança</button>:null}{p.invoiceUrl?<a className="finance-collection-action" href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">Fatura</a>:null}</td></tr>)}</tbody></table>{!data.items.length?<p>Nenhuma cobrança encontrada.</p>:null}</div>
   <div className="finance-portfolio-pagination"><button type="button" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Anterior</button><button type="button" disabled={!data.hasMore} onClick={()=>setOffset(n=>n+50)}>Próxima</button></div>
  </>}
 {selected&&<div className="finance-collection-overlay" role="presentation" onClick={()=>setSelected(null)}><aside ref={drawerRef} tabIndex={-1} className="finance-collection-drawer" role="dialog" aria-modal="true" aria-label="Preparar cobrança" onClick={e=>e.stopPropagation()}>
  <header><h2>Enviar cobrança existente</h2><button type="button" aria-label="Fechar" onClick={()=>setSelected(null)}><X size={16} aria-hidden="true" /></button></header>
  <p><strong>Cliente: {selected.customerName||"Não identificado"}</strong></p><p><strong>{currency(selected.value)}</strong> · Vencimento {dateBR(selected.dueDate)} · {statusBR[selected.status]||selected.status}</p>
  <label>Modelo de mensagem<select value={template} onChange={e=>{setTemplate(e.target.value);setCopied(false)}}><option value="friendly">Lembrete cordial</option><option value="due">Aviso de vencimento</option><option value="late">Cobrança após vencimento</option></select></label>
  <p>Mensagem preparada com os dados reais desta cobrança. Confira o destinatário antes de enviar.</p>
  <textarea readOnly rows={7} value={(template==="late"?"Olá! Identificamos uma cobrança pendente com vencimento em ":template==="due"?"Olá! Sua cobrança tem vencimento em ":"Olá! Segue um lembrete sobre sua cobrança com vencimento em ")+dateBR(selected.dueDate)+", no valor de "+currency(selected.value)+"."+(selected.invoiceUrl?" Acesse a fatura: "+selected.invoiceUrl:" Entre em contato com nosso financeiro para obter os dados de pagamento.")+" Se já realizou o pagamento, desconsidere esta mensagem."}/>
  <button type="button" onClick={async()=>{const message=(document.querySelector(".finance-collection-drawer textarea") as HTMLTextAreaElement|null)?.value||"";try{await navigator.clipboard.writeText(message);setCopied(true)}catch{setCopied(false)}}}>{copied?"Mensagem copiada":"Copiar mensagem"}</button>
  {selected.invoiceUrl?<a href={selected.invoiceUrl} target="_blank" rel="noopener noreferrer">Abrir fatura no Asaas</a>:null}
  <small>Não enviada automaticamente. O envio integrado e seu histórico dependem da conexão do canal e de auditoria.</small>
 </aside></div>}
 </section>;
}

type CatalogData={source:string;environment:string;products:{id:string;name:string;description:string;value:number;status:string;billingType:string|null}[];subscriptions:{id:string;customerId:string;description:string;value:number;cycle:string;status:string}[];hasMoreProducts:boolean;hasMoreSubscriptions:boolean;offset:number;limit:number};
function CatalogView({mode}:{mode:"catalog"|"subscriptions"}){
 const [data,setData]=useState<CatalogData|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError("");fetch("/api/backend/finance/catalog?offset="+offset+"&limit=50",{cache:"no-store"}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.message||"Não foi possível consultar o catálogo.");return body as CatalogData}).then(d=>{if(active)setData(d)}).catch(e=>{if(active){setData(null);setError(e.message)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[offset,refresh]);
 const isCatalog=mode==="catalog",items=isCatalog?data?.products:data?.subscriptions,hasMore=isCatalog?data?.hasMoreProducts:data?.hasMoreSubscriptions;
 return <section className="content-card finance-catalog"><header><div><h2>{isCatalog?"Produtos e serviços":"Assinaturas"}</h2><p>Dados consultados diretamente no Asaas · {data?.environment||"ambiente não confirmado"}</p></div><button className="secondary-button" type="button" onClick={()=>setRefresh(n=>n+1)}><RefreshCcw size={15}/> Sincronizar agora</button></header>

 {loading?<p role="status">Consultando Asaas…</p>:error?<p role="alert">{error}</p>:data?<><div className="finance-portfolio-scroll"><table><thead><tr>{isCatalog?<><th>Produto ou serviço</th><th>Valor</th><th>Tipo</th><th>Clientes vinculados*</th><th>Receita recorrente estimada*</th><th>Situação</th></>:<><th>Descrição</th><th>Valor</th><th>Periodicidade</th><th>Situação</th></>}</tr></thead><tbody>{isCatalog?data.products.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small className="finance-customer-document">{p.description}</small></td><td>{currency(p.value)}</td><td>{p.billingType||"Produto / serviço"}</td><td>{(()=>{const related=data.subscriptions.filter(s=>s.status==="ACTIVE"&&s.description?.trim().toLowerCase()===p.name.trim().toLowerCase());return related.length?new Set(related.map(s=>s.customerId)).size:"—"})()}</td><td>{(()=>{const related=data.subscriptions.filter(s=>s.status==="ACTIVE"&&s.description?.trim().toLowerCase()===p.name.trim().toLowerCase());return related.length?currency(related.reduce((sum,s)=>sum+s.value,0)):"—"})()}</td><td>{p.status}</td></tr>):data.subscriptions.map(s=><tr key={s.id}><td>{s.description||"Assinatura"}</td><td>{currency(s.value)}</td><td>{s.cycle}</td><td>{s.status}</td></tr>)}</tbody></table></div>{isCatalog?<p className="finance-catalog-note">* Vínculos estimados apenas por correspondência exata entre nome do produto e descrição das assinaturas ativas retornadas nesta página do Asaas. Não representa todos os clientes nem receita mensal consolidada; periodicidades podem variar. Sem correspondência, exibimos —, nunca zero fictício.</p>:null}{!items?.length?<p>Nenhum registro retornado pelo Asaas.</p>:null}<div className="finance-portfolio-pagination"><button disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Anterior</button><button disabled={!hasMore} onClick={()=>setOffset(v=>v+50)}>Próxima</button></div></>:null}
 </section>;
}

type FinanceListing={source:string;environment:string;kind:string;offset:number;limit:number;hasMore:boolean;totalCount:number|null;items:{id:string;customerId:string;customerName:string;description:string;value:number;cycle:string|null;status:string;billingType:string|null;dueDate:string|null;invoiceUrl:string|null}[]};
function FinanceAsaasListing({kind}:{kind:"subscriptions"|"detached"}){
 const [data,setData]=useState<FinanceListing|null>(null),[offset,setOffset]=useState(0),[refresh,setRefresh]=useState(0),[search,setSearch]=useState(""),[status,setStatus]=useState(""),[cycle,setCycle]=useState(""),[filters,setFilters]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{setOffset(0);setSearch("");setStatus("");setCycle("")},[kind]);
 useEffect(()=>{let active=true;setLoading(true);setError("");fetch("/api/backend/finance/listings?"+new URLSearchParams({kind,offset:String(offset),limit:"50"}),{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.message||"Falha na sincronização com o Asaas");return result as FinanceListing}).then(result=>{if(active)setData(result)}).catch(e=>{if(active){setError(e.message);setData(null)}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[kind,offset,refresh]);
 const shown=(data?.items||[]).filter(x=>(!search||[x.customerName,x.description,x.id].some(v=>v.toLowerCase().includes(search.toLowerCase())))&&(!status||x.status===status)&&(!cycle||x.cycle===cycle));
 const cycleName=(v:string|null)=>({MONTHLY:"Mensal",WEEKLY:"Semanal",BIWEEKLY:"Quinzenal",QUARTERLY:"Trimestral",SEMIANNUALLY:"Semestral",YEARLY:"Anual"} as Record<string,string>)[v||""]||v||"Avulsa";
 const paymentName=(v:string|null)=>({BOLETO:"Boleto bancário",PIX:"Pix",CREDIT_CARD:"Cartão de crédito",UNDEFINED:"A definir"} as Record<string,string>)[v||""]||v||"Não informado";
 const title=kind==="subscriptions"?"Assinaturas":"Cobranças avulsas";
 return <section className="content-card finance-asaas-listing"><div className="finance-asaas-listing-heading"><div><h2>{title}</h2><p>Sincronização direta · {data?.environment||"Asaas"}</p></div><button type="button" className="secondary-button" onClick={()=>setRefresh(v=>v+1)}><RefreshCcw size={15}/> Sincronizar</button></div>
 <div className="finance-asaas-listing-toolbar"><label className="finance-asaas-search"><span>Buscar</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome do cliente ou descrição"/></label><button type="button" className="secondary-button" aria-expanded={filters} onClick={()=>setFilters(v=>!v)}>Filtros {filters?"−":"+"}</button><small>Busca e filtros na página atual</small></div>
 {filters?<div className="finance-asaas-filters"><label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todas</option>{["ACTIVE","INACTIVE","EXPIRED","PENDING","OVERDUE","RECEIVED","CONFIRMED"].map(s=><option key={s} value={s}>{statusBR[s]||s}</option>)}</select></label>{kind==="subscriptions"?<label>Periodicidade<select value={cycle} onChange={e=>setCycle(e.target.value)}><option value="">Todas</option>{["MONTHLY","WEEKLY","BIWEEKLY","QUARTERLY","SEMIANNUALLY","YEARLY"].map(s=><option key={s} value={s}>{cycleName(s)}</option>)}</select></label>:null}<button type="button" className="secondary-button" onClick={()=>{setStatus("");setCycle("");setSearch("")}}>Limpar filtros</button></div>:null}
 {loading?<p role="status">Consultando dados reais do Asaas…</p>:error?<p role="alert">{error}</p>:<><div className="finance-asaas-table-wrap"><table><thead><tr><th>Cliente</th><th>Valor</th><th>Descrição</th><th>Forma de pagamento</th>{kind==="detached"?<th>Vencimento</th>:null}<th>Situação</th><th>Ações</th></tr></thead><tbody>{shown.map(x=><tr key={x.id}><td><strong>{x.customerName}</strong></td><td><strong>{currency(x.value)}</strong>{kind==="subscriptions"?<small>/ {cycleName(x.cycle)}</small>:null}</td><td>{x.description||<span className="finance-asaas-muted">Não informada</span>}</td><td>{paymentName(x.billingType)}</td>{kind==="detached"?<td>{x.dueDate?dateBR(x.dueDate):"—"}</td>:null}<td><span className={"finance-asaas-status "+(x.status==="ACTIVE"||x.status==="RECEIVED"?"positive":x.status==="OVERDUE"?"negative":"")}>{statusBR[x.status]||({ACTIVE:"Ativa",INACTIVE:"Inativa",EXPIRED:"Expirada"} as Record<string,string>)[x.status]||x.status}</span></td><td>{x.invoiceUrl?<a href={x.invoiceUrl} target="_blank" rel="noopener noreferrer" className="finance-asaas-link">Fatura</a>:<span className="finance-asaas-muted">—</span>}</td></tr>)}</tbody></table></div>{!shown.length?<p className="finance-asaas-empty">Nenhum registro encontrado nesta página.</p>:null}<div className="finance-asaas-listing-footer"><span>{shown.length} registros exibidos · página {Math.floor(offset/50)+1}{data?.totalCount!==null?" · "+data?.totalCount+" registros informados pelo Asaas":""}</span><div><button type="button" className="secondary-button" disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-50))}>Anterior</button><button type="button" className="secondary-button" disabled={!data?.hasMore} onClick={()=>setOffset(v=>v+50)}>Próxima</button></div></div>{kind==="detached"?<p className="finance-catalog-note">Somente cobranças sem assinatura vinculada. O resultado é paginado conforme o retorno do Asaas.</p>:null}</>}
 </section>;
}

const wafflePalette=["#2E7CF6","#7DD3FC","#FB7185","#FBBF24","#F472B6","#64748B"];
function WaffleChart({rows}:{rows:{status:string;count:number;amount:number}[]}){
  const total=rows.reduce((sum,item)=>sum+item.count,0);
  if(!total)return null;
  const exact=rows.map(row=>(row.count/total)*100);
  const cells=exact.map(value=>Math.floor(value));
  const remainder=100-cells.reduce((sum,value)=>sum+value,0);
  const order=rows.map((_,index)=>index).sort((a,b)=>((exact[b]??0)%1)-((exact[a]??0)%1));
  for(let step=0;step<remainder;step++){const target=order[step%order.length];if(target===undefined)break;cells[target]=(cells[target]??0)+1;}
  const slots=rows.flatMap((_,index)=>Array.from({length:cells[index]??0},()=>index)).slice(0,100);
  return <div className="finance-waffle" role="img" aria-label="Distribuição das cobranças por situação">{Array.from({length:100},(_,index)=>{const slot=slots[index];if(slot===undefined)return <span key={index} className="is-empty"/>;return <span key={index} style={{background:wafflePalette[slot%wafflePalette.length]}} title={statusBR[rows[slot]?.status??""]||rows[slot]?.status}/>;})}</div>;
}
type Executive={source:string;environment:string;partial:boolean;from:string;to:string;months:number;totals:{billed:number;paid:number;open:number;overdue:number;count:number;overdueCount:number;customers:number};collectionRate:number|null;series:{month:string;billed:number;paid:number;open:number;overdue:number}[];byStatus:{status:string;count:number;amount:number}[];byBillingType:{type:string;count:number;amount:number}[]};
function ExecutiveOverview({onOpenCharges}:{onOpenCharges:(status:string)=>void}){
 const [months,setMonths]=useState(6),[rangeMode,setRangeMode]=useState<"preset"|"all"|"custom">("preset"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[appliedRange,setAppliedRange]=useState<{from:string;to:string}|null>(null),[rangeError,setRangeError]=useState(""),[data,setData]=useState<Executive|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError("");fetch("/api/backend/finance/executive?"+new URLSearchParams(rangeMode==="all"?{months:String(months),all:"true"}:rangeMode==="custom"&&appliedRange?{months:String(months),from:appliedRange.from,to:appliedRange.to}:{months:String(months)}),{cache:"no-store"}).then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.message||"Falha na consulta ao Asaas.");return v as Executive}).then(v=>{if(live)setData(v)}).catch(e=>{if(live){setData(null);setError(e.message)}}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[months,rangeMode,appliedRange,refresh]);
 const max=Math.max(1,...(data?.series||[]).map(s=>s.billed));
 const totalBilling=(data?.byBillingType||[]).reduce((a,b)=>a+b.amount,0);
 const billed=data?.totals.billed||0;
 const paidShare=billed>0?Math.round((data?.totals.paid||0)/billed*100):0;
 const overdueShare=billed>0?Math.round((data?.totals.overdue||0)/billed*100):0;
 const openShare=Math.max(0,100-paidShare-overdueShare);
 const billingName=(v:string)=>(({BOLETO:"Boleto bancário",PIX:"Pix",CREDIT_CARD:"Cartão de crédito",UNDEFINED:"A definir"} as Record<string,string>)[v]||v);
 const billingPalette:[string,string][]=[["#2E7CF6","#164E8A"],["#7DD3FC","#1F5FD0"],["#FBBF24","#D97706"],["#F472B6","#BE185D"],["#38BDF8","#0369A1"],["#FB7185","#E11D48"]];
 const insight=data?(data.totals.overdue>0?"Atenção: "+currency(data.totals.overdue)+" em "+data.totals.overdueCount+" cobranças vencidas — priorize a régua de cobrança antes de oferecer novos prazos.":"Nenhuma cobrança vencida no período — carteira em dia."):"";
 return <div className="finance-executive">
  <section className="finance-hero" aria-label="Resumo executivo financeiro">
   <div className="finance-hero-copy">
    <span className="finance-hero-eyebrow"><Sparkles size={13} aria-hidden="true"/> Raio-X financeiro{data?" · "+data.environment:""}</span>
    <h2>O caixa decide o ritmo do negócio.</h2>
    <p>{data?"Vencimentos de "+dateBR(data.from)+" a "+dateBR(data.to)+". Cada valor abaixo veio do Asaas — nada é estimado sem base.":"Sincronizando indicadores em tempo real com o Asaas…"}</p>
    <div className="finance-hero-chips">
     <button type="button" className="finance-hero-chip" onClick={()=>onOpenCharges("OVERDUE")}><AlertTriangle size={13} aria-hidden="true"/>{data?data.totals.overdueCount+" cobranças vencidas":"Vencidas"}<ArrowRight size={13} aria-hidden="true"/></button>
     <button type="button" className="finance-hero-chip" onClick={()=>onOpenCharges("PENDING")}><Clock3 size={13} aria-hidden="true"/>{data?data.totals.count+" cobranças no período":"Em aberto"}<ArrowRight size={13} aria-hidden="true"/></button>
     <span className="finance-hero-chip is-static"><Banknote size={13} aria-hidden="true"/>{data&&data.collectionRate!==null?data.collectionRate+"% de recebimento":"Recebimento —"}</span>
    </div>
   </div>
   <div className="finance-hero-figure">
    <span>Total faturado</span>
    <strong>{data?currency(data.totals.billed):"—"}</strong>
    <div className="finance-hero-bar" role="img" aria-label="Composição do faturado: pago, em aberto e vencido"><i className="seg-paid" style={{width:paidShare+"%"}}/><i className="seg-open" style={{width:openShare+"%"}}/><i className="seg-overdue" style={{width:overdueShare+"%"}}/></div>
    <div className="finance-hero-legend"><span><i className="dot paid"/>Pago · {paidShare}%</span><span><i className="dot open"/>Em aberto · {openShare}%</span><span><i className="dot overdue"/>Vencido · {overdueShare}%</span></div>
   </div>
  </section>

  <div className="finance-period-bar">
   <div className="finance-period-chips" role="group" aria-label="Período do dashboard">{[1,3,6,12].map(n=><button type="button" key={n} className={rangeMode==="preset"&&months===n?"active":""} onClick={()=>{setMonths(n);setRangeMode("preset")}}>{n===1?"Mês atual":n+" meses"}</button>)}<button type="button" className={rangeMode==="all"?"active":""} onClick={()=>setRangeMode("all")}>Tudo</button><button type="button" className={rangeMode==="custom"?"active":""} onClick={()=>{if(!from){const d=new Date();setFrom(new Date(Date.UTC(d.getFullYear(),d.getMonth(),1)).toISOString().slice(0,10));setTo(d.toISOString().slice(0,10));}setRangeMode("custom");setAppliedRange(null);setRangeError("")}}>Personalizado</button></div>
   {rangeMode==="custom"?<div className="finance-period-custom"><label>De<input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setRangeError("")}}/></label><label>Até<input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setRangeError("")}}/></label><button type="button" className="primary-button" onClick={()=>{if(!from||!to||from>to){setRangeError("Informe um intervalo válido.");return;}setAppliedRange({from,to});setRangeError("");setRefresh(n=>n+1)}}>Aplicar período</button>{rangeError?<small role="alert">{rangeError}</small>:null}</div>:null}
   <button type="button" className="secondary-button" onClick={()=>{if(rangeMode==="custom"&&(!appliedRange||from!==appliedRange.from||to!==appliedRange.to)){if(!from||!to||from>to){setRangeError("Informe um intervalo válido.");return;}setAppliedRange({from,to})}setRefresh(n=>n+1)}}><RefreshCcw size={15} aria-hidden="true"/> Atualizar</button>
  </div>

  {loading?<p role="status">Sincronizando indicadores com o Asaas…</p>:error?<div className="content-card finance-health-note" role="alert"><AlertCircle size={18}/>{error}</div>:data?<>
   {data.partial?<p role="alert" className="finance-partial"><AlertTriangle size={15} aria-hidden="true"/> Consulta parcial: limite de 5.000 cobranças atingido. Indicadores não representam toda a carteira.</p>:null}
   <div className="finance-executive-metrics">{[{id:"billed",icon:Banknote,label:"Faturado",value:currency(data.totals.billed),hint:"Vencimentos do período",tone:"blue",href:null},{id:"paid",icon:CheckCircle2,label:"Pago",value:currency(data.totals.paid),hint:"Confirmado no Asaas",tone:"green",href:null},{id:"open",icon:Clock3,label:"Em aberto",value:currency(data.totals.open),hint:"Aguardando recebimento",tone:"amber",href:"PENDING"},{id:"overdue",icon:AlertTriangle,label:"Vencido",value:currency(data.totals.overdue),hint:data.totals.overdueCount+" cobranças · ver Cobranças",tone:"red",href:"OVERDUE"},{id:"inadimplencia",icon:Activity,label:"Inadimplência",value:data.totals.billed?(data.totals.overdue/data.totals.billed*100).toFixed(1)+"%":"—",hint:"Vencido sobre faturado",tone:"purple",href:null}].map(item=>{const Icon=item.icon;const inner=<><span className="fin-metric-icon"><Icon size={18} aria-hidden="true"/></span><span className="fin-metric-body"><small>{item.label}</small><strong>{item.value}</strong><em>{item.hint}</em></span>{item.href?<ArrowRight size={15} aria-hidden="true" className="fin-metric-arrow"/>:null}</>;return item.href?<button type="button" key={item.id} className={"finance-executive-metric "+item.tone+" is-interactive"} onClick={()=>onOpenCharges(item.href as string)}>{inner}</button>:<article className={"finance-executive-metric "+item.tone} key={item.id}>{inner}</article>})}</div>

   <div className="finance-executive-grid">
    <section className="content-card finance-executive-panel finance-executive-wide"><h2>Competências em perspectiva</h2><p>Por vencimento · faturado, recebido e vencido</p>{data.totals.count===0?<div className="finance-executive-empty">Nenhuma cobrança com vencimento no período selecionado. Experimente ampliar as datas ou selecionar Todo o período.</div>:<div className="finance-executive-columns">{data.series.map(s=><div className="finance-executive-column" key={s.month}><div className="finance-executive-column-bars"><i className="bar-billed" style={{height:s.billed>0?Math.max(3,s.billed/max*100):0+"%"}} title={"Faturado "+currency(s.billed)}/><i className="bar-paid" style={{height:s.paid>0?Math.max(3,s.paid/max*100):0+"%"}} title={"Pago "+currency(s.paid)}/><i className="bar-overdue" style={{height:s.overdue>0?Math.max(3,s.overdue/max*100):0+"%"}} title={"Vencido "+currency(s.overdue)}/></div><small>{s.month.length===4?s.month:s.month.slice(5)+"/"+s.month.slice(2,4)}</small></div>)}</div>}<div className="finance-executive-legend"><span><i className="dot paid"/>Faturado</span><span><i className="dot open"/>Pago</span><span><i className="dot overdue"/>Vencido</span></div></section>

    <section className="content-card finance-executive-panel finance-status-panel"><h2>Saldo por situação</h2><p>Cada anel mostra a participação sobre o faturado.</p>{data.totals.billed<=0?<div className="finance-executive-empty">Sem valores para comparar neste período.</div>:<div className="finance-status-donuts">{[{label:"Faturado",value:data.totals.billed,color:"#2E7CF6"},{label:"Pago",value:data.totals.paid,color:"#7DD3FC"},{label:"Vencido",value:data.totals.overdue,color:"#FB7185"}].map(item=>{const percentage=Math.min(100,Math.max(0,item.value/Math.max(1,data.totals.billed)*100));return <article className="finance-status-donut-card" key={item.label}><div className="finance-status-donut" style={{background:"conic-gradient("+item.color+" "+percentage+"%, color-mix(in srgb, "+item.color+" 10%, var(--s2)) 0)"}}><span>{percentage.toFixed(0)}<small>%</small></span></div><strong>{item.label}</strong><b>{currency(item.value)}</b></article>})}</div>}</section>

    <section className="content-card finance-executive-panel finance-billing-panel"><h2>Meios de pagamento</h2><p>Participação dos valores faturados por forma de pagamento</p>{data.byBillingType.length===0?<div className="finance-executive-empty">Nenhuma cobrança com meio de pagamento identificado neste período.</div>:<div className="finance-billing-bars">{[...data.byBillingType].sort((a,b)=>b.amount-a.amount).map((item,index)=>{const share=totalBilling>0?item.amount/totalBilling*100:0;const palette=billingPalette[index%billingPalette.length]??["#2E7CF6","#164E8A"];return <div className="finance-billing-row" key={item.type}><span className="finance-billing-label">{billingName(item.type)}</span><div className="finance-billing-track"><i style={{width:Math.max(3,share)+"%",background:"linear-gradient(90deg,"+palette[0]+","+palette[1]+")"}}/></div><span className="finance-billing-value"><strong>{share.toFixed(0)}%</strong><small>{item.count}x · {currency(item.amount)}</small></span></div>})}</div>}</section>

    <section className="content-card finance-executive-panel finance-waffle-panel"><h2>Distribuição da carteira</h2><p>Cada quadrado representa uma fatia das cobranças do período, por situação</p>{data.totals.count>0?<><WaffleChart rows={data.byStatus.slice(0,6)}/><div className="finance-waffle-legend">{data.byStatus.slice(0,6).map((s,i)=><span key={s.status}><i style={{background:wafflePalette[i%wafflePalette.length]}}/><b>{statusBR[s.status]||s.status}</b>{s.count} · {currency(s.amount)}</span>)}</div></>:<div className="finance-executive-empty">Nenhuma cobrança no período.</div>}</section>

    <section className="content-card finance-executive-panel finance-intelligence-panel"><h2>Inteligência financeira</h2><p>Alertas da carteira no período</p><dl><div><dt>Cobranças vencidas</dt><dd>{data.totals.overdueCount}</dd></div><div><dt>Clientes com cobranças</dt><dd>{data.totals.customers}</dd></div><div><dt>Taxa de recebimento</dt><dd>{data.collectionRate===null?"—":data.collectionRate+"%"}</dd></div></dl><p className="finance-insight"><Sparkles size={13} aria-hidden="true"/>{insight}</p><small>Indicadores calculados pelas cobranças do Asaas com vencimento no período selecionado.</small></section>
   </div>
  </>:null}
 </div>;
}

const FINANCE_MESSAGE_PRESETS=[
 {name:"Lembrete de vencimento",category:"Cobrança",body:"Olá, {{nome}}! Sua cobrança de {{valor}} vence em {{vencimento}}. Consulte sua fatura: {{fatura}}."},
 {name:"Vencimento hoje",category:"Cobrança",body:"Olá, {{nome}}! Sua cobrança de {{valor}} vence hoje. Segue a fatura: {{fatura}}."},
 {name:"Primeiro aviso de atraso",category:"Cobrança",body:"Olá, {{nome}}! Identificamos uma cobrança vencida em {{vencimento}}. Podemos ajudar? {{fatura}}"},
 {name:"Segundo aviso de atraso",category:"Cobrança",body:"Olá, {{nome}}! Sua cobrança de {{valor}} continua em aberto. Para regularizar, acesse: {{fatura}}."},
 {name:"Último lembrete amigável",category:"Cobrança",body:"Olá, {{nome}}! Estamos à disposição para ajudar com sua cobrança pendente. Confira: {{fatura}}."},
 {name:"Pagamento confirmado",category:"Cobrança",body:"Olá, {{nome}}! Recebemos seu pagamento. Agradecemos pela confiança!"},
 {name:"Aniversário",category:"Relacionamento",body:"Feliz aniversário, {{nome}}! Desejamos saúde, alegria e muitas conquistas. Equipe {{empresa}}."},
 {name:"Aniversário de parceria",category:"Relacionamento",body:"{{nome}}, hoje celebramos mais um ano da nossa parceria. Obrigado por confiar na {{empresa}}!"},
 {name:"Boas-vindas",category:"Relacionamento",body:"Olá, {{nome}}! Seja bem-vindo(a) à {{empresa}}. Estamos felizes em ter você conosco."},
 {name:"Agradecimento",category:"Relacionamento",body:"Olá, {{nome}}! Obrigado pela confiança em nossa equipe. Conte sempre com a {{empresa}}."}
];
function FinanceAutomationWorkspace(){
 const [selected,setSelected]=useState(0),[draft,setDraft]=useState(FINANCE_MESSAGE_PRESETS[0]!.body),[dueDays,setDueDays]=useState("-5,-3,0,3"),[days,setDays]=useState("1,5,15"),[time,setTime]=useState("09:00"),[zone,setZone]=useState("America/Sao_Paulo"),[enabled,setEnabled]=useState(false),[channel,setChannel]=useState(""),[drive,setDrive]=useState(false);
 return <section className="finance-automation-page"><header className="finance-automation-heading"><div><h2>Automação financeira</h2><p>Configure mensagens, periodicidade e canal. A ativação de envios exige um executor validado.</p></div><span className="finance-automation-pill">Configuração preliminar · não envia mensagens</span></header><div className="finance-automation-grid"><section className="content-card finance-automation-card"><h3>Rotina e horários</h3><label className="finance-auto-check"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Preparar avisos automáticos</label><label>Fuso horário<select value={zone} onChange={e=>setZone(e.target.value)}><option value="America/Sao_Paulo">Brasília / São Paulo</option><option value="America/Cuiaba">Cuiabá</option><option value="America/Manaus">Manaus</option></select></label><label>Horário de execução<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><label>Dias para conciliação mensal<input value={days} onChange={e=>setDays(e.target.value)} placeholder="1, 5, 15"/></label><label>Avisos em relação ao vencimento<input value={dueDays} onChange={e=>setDueDays(e.target.value)} placeholder="-5, -3, 0, 3"/></label><p className="finance-auto-note">Valores negativos representam dias antes do vencimento. Configuração visual ainda não ativa no servidor.</p></section><section className="content-card finance-automation-card"><h3>Canal e estratégia</h3><label>Canal para envios<select value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Selecione um canal após vinculação</option><option value="whatsapp" disabled>WhatsApp · depende de canal e permissões</option></select></label><label>Modelo de comunicação<select value={drive?"drive":"text"} onChange={e=>setDrive(e.target.value==="drive")}><option value="text">Mensagem de texto</option><option value="drive">Modelo no Google Drive · integração pendente</option></select></label><div className="finance-auto-strategy"><strong>Regras de segurança</strong><p>Antes de enviar: verificar pagamento atualizado no Asaas, consentimento, canal autorizado, janela do WhatsApp e evitar duplicidades.</p></div><div className="finance-auto-strategy"><strong>Integração entre módulos</strong><p>As mensagens deverão utilizar contatos do CRM, cobranças do Asaas, canais do Atendimento e registros auditáveis no Histórico.</p></div></section><section className="content-card finance-automation-card finance-auto-wide"><div className="finance-auto-templates-heading"><div><h3>Biblioteca de mensagens</h3><p>10 sugestões editáveis, prontas para personalizar</p></div><span>10 modelos</span></div><div className="finance-auto-template-grid"><div className="finance-auto-template-list">{FINANCE_MESSAGE_PRESETS.map((item,i)=><button type="button" key={item.name} className={selected===i?"active":""} onClick={()=>{setSelected(i);setDraft(item.body)}}><strong>{item.name}</strong><small>{item.category}</small></button>)}</div><div className="finance-auto-template-editor"><label>Mensagem — {FINANCE_MESSAGE_PRESETS[selected]!.name}<textarea rows={5} value={draft} onChange={e=>setDraft(e.target.value)}/></label><p className="finance-auto-note">Variáveis: {"{{nome}}"}, {"{{valor}}"}, {"{{vencimento}}"}, {"{{fatura}}"}, {"{{empresa}}"}.</p><div className="finance-auto-preview"><strong>Prévia do texto</strong><p>{draft||"Digite sua mensagem para visualizar."}</p></div><p className="finance-auto-note">Os modelos são exemplos locais. Ainda não são salvos no banco, no Google Drive ou enviados automaticamente.</p></div></div></section></div></section>;
}
function FinanceHistoryWorkspace(){
 return <section className="content-card finance-automation-card finance-history-page"><header className="finance-automation-heading"><div><h2>Histórico de avisos</h2><p>Acompanhamento de tentativas, entregas, falhas e alterações das automações financeiras.</p></div><span className="finance-automation-pill">Aguardando integração com eventos reais</span></header><div className="finance-history-stats">{["Enviados","Entregues","Falhas","Pendentes"].map(label=><div key={label}><small>{label}</small><strong>—</strong></div>)}</div><div className="finance-history-table"><div className="finance-history-row finance-history-head"><span>Data e hora</span><span>Cliente</span><span>Evento</span><span>Status</span><span>Detalhes</span></div><div className="finance-history-empty">Ainda não há um registro de execução auditável conectado a esta tela. Nenhuma entrega ou falha será simulada.</div></div><p className="finance-auto-note">A integração deverá registrar eventos de cobrança, confirmação do provedor, recebimento e leitura quando disponíveis, erros, tentativas e reprocessamentos seguros.</p></section>;
}

const FINANCE_TABS=[{id:"overview",label:"Visão geral",icon:LayoutDashboard},{id:"charges",label:"Cobranças",icon:Receipt},{id:"subscriptions",label:"Assinaturas",icon:Repeat2},{id:"detached",label:"Avulsas",icon:Zap},{id:"automation",label:"Automação",icon:Workflow},{id:"history",label:"Histórico de avisos",icon:History}] as const;
export function FinanceWorkspace(){
 const [tab,setTab]=useState<"overview"|"charges"|"subscriptions"|"detached"|"automation"|"history">("overview");
 const [portfolioStatus,setPortfolioStatus]=useState("");
 return <section className="module-workspace finance-health">
  <header className="page-heading"><div><h1>Financeiro</h1><p className="page-subtitle">Indicadores e cobranças reais integrados ao Asaas. Nada é estimado sem base.</p></div></header>
  <nav className="finance-module-tabs" aria-label="Áreas do Financeiro">{FINANCE_TABS.map(item=>{const Icon=item.icon;return <button type="button" key={item.id} className={tab===item.id?"active":""} aria-current={tab===item.id?"page":undefined} onClick={()=>setTab(item.id)}><Icon size={15} aria-hidden="true"/>{item.label}</button>})}</nav>
  {tab==="overview"?<ExecutiveOverview onOpenCharges={(status)=>{setPortfolioStatus(status);setTab("charges")}}/>:null}
  {tab==="charges"?<PortfolioView initialStatus={portfolioStatus}/>:null}
  {tab==="subscriptions"||tab==="detached"?<FinanceAsaasListing kind={tab}/>:null}
  {tab==="automation"?<FinanceAutomationWorkspace/>:null}
  {tab==="history"?<FinanceHistoryWorkspace/>:null}
 </section>;
}
