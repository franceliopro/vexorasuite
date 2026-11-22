"use client";
import { useEffect, useState } from 'react';
type Connection = { provider: string; configured: boolean; source: 'tenant' | 'server' | null; needsRepair: boolean };
type Probe = { provider: string; status: 'connected' | 'rejected' | 'offline' | 'not_configured'; httpStatus?: number; message: string; checkedAt: string };
const labels: Record<string,string> = { openrouter: 'OpenRouter · modelos de IA', openai: 'OpenAI · modelos e voz', gemini: 'Google Gemini', anthropic: 'Claude · Anthropic', deepseek: 'DeepSeek', qwen: 'Qwen · Alibaba Cloud (Singapura)', groq: 'Groq · modelos abertos rápidos', 'vercel-gateway': 'Vercel AI Gateway', nvidia: 'NVIDIA NIM', brave: 'Brave Search · pesquisa na internet' };
const cardTw = "mb-4 grid gap-3 self-start rounded-token border border-gray-200 bg-zinc-200 p-provider-pad";
const noteTw = "text-provider-note text-slate-600";
const overviewTw = "grid gap-provider-gap rounded-provider-overview border border-gray-200 bg-zinc-200 p-provider-pad";
const overviewHeadTw = "flex flex-wrap items-center justify-between gap-3";
const overviewTitleTw = "m-0 text-provider-heading font-extrabold text-slate-950";
const statusListTw = "m-0 grid list-none gap-2 p-0";
const statusItemTw = "grid grid-cols-1 items-center gap-x-4 gap-y-2 rounded-provider-item border border-gray-200 bg-zinc-100 px-provider-pad py-3 md:grid-cols-provider-status";
const statusMainTw = "flex min-w-0 items-center gap-2.5";
const statusNameTw = "overflow-hidden text-ellipsis whitespace-nowrap text-body text-slate-950";
const statusPillTw = "inline-flex items-center rounded-provider-pill px-provider-pill-x py-provider-pill-y font-display text-provider-pill font-extrabold tracking-provider-pill whitespace-nowrap";
const statusDetailTw = "m-0 text-provider-detail text-slate-950";
const statusOriginTw = "col-span-full m-0 text-provider-origin text-slate-600";
const fieldsTw = "grid gap-3";
const fieldTw = "grid gap-1.5 text-small font-semibold text-slate-600";
const togglerTw = "inline-flex cursor-pointer items-center gap-2 text-small";
const checkTw = "h-4 w-4 flex-none accent-blue-600";
const inputTw = "min-h-control w-full min-w-0 rounded-lg border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-small text-slate-950 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25";
const warningTw = "mx-3 mt-2 flex flex-wrap items-start gap-2.5 rounded-provider-alert border border-provider-alert-line border-dashed bg-red-100 px-provider-alert-x py-provider-alert-y text-provider-alert text-slate-600";
const warningTitleTw = "basis-full text-provider-alert-strong font-extrabold tracking-provider-alert text-provider-alert-ink";
const warningLinkTw = "text-provider-alert-ink font-bold underline underline-offset-2";
const primaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const textButton = "inline-flex min-h-8 items-center justify-center px-1.5 font-bold text-blue-600 transition-colors hover:bg-blue-50";
const pillTone: Record<string,string> = {
  "is-connected": "bg-provider-connected-bg text-provider-connected-ink",
  "is-rejected": "bg-provider-rejected-bg text-provider-rejected-ink",
  "is-offline": "bg-provider-offline-bg text-provider-offline-ink",
  "is-off": "bg-zinc-200 text-slate-600",
  "is-configured": "bg-provider-configured-bg text-provider-configured-ink",
};

export function ProviderConnections() {
  const [connections,setConnections] = useState<Connection[] | null>(null);
  const [probes,setProbes] = useState<Record<string,Probe>>({});
  const [provider,setProvider] = useState('openrouter');
  const [key,setKey] = useState('');
  const [editingProvider,setEditingProvider]=useState<string|null>(null),[usage,setUsage]=useState<any>(null),[usageLoading,setUsageLoading]=useState(true),[usageError,setUsageError]=useState(''),[usageAttempt,setUsageAttempt]=useState(0);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [policy,setPolicy]=useState({freeFirst:false,allowPaidFallback:false,customerSearch:false});
  const [runtime,setRuntime]=useState<{research?:{localConfigured:boolean};local?:{llmConfigured:boolean;voiceConfigured:boolean}}>({});
  const [connectionsAttempt,setConnectionsAttempt] = useState(0);
  useEffect(()=>{
    let active=true;
    fetch('/api/backend/assistant/provider-connections',{cache:'no-store'}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.message||'Não foi possível verificar as conexões.');
      if(active){setConnections(data.connections);setRuntime(data);if(data.costPolicy)setPolicy(data.costPolicy);if(data.probes)setProbes(data.probes);}
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'Falha ao verificar as conexões.');});
    return ()=>{active=false;};
  },[connectionsAttempt]);
  useEffect(()=>{let active=true;const load=async()=>{setUsageLoading(true);setUsageError('');try{const response=await fetch('/api/backend/assistant/provider-connections/usage',{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.message||'Não foi possível consultar as cotas do OpenRouter.');if(active)setUsage(data);}catch(error){if(active)setUsageError(error instanceof Error?error.message:'Não foi possível consultar as cotas do OpenRouter.');}finally{if(active)setUsageLoading(false)}};void load();const timer=setInterval(()=>void load(),60000);return()=>{active=false;clearInterval(timer)}},[usageAttempt]);
  async function save(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/backend/assistant/provider-connections',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({provider,key:key.trim()})});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||'Não foi possível salvar a chave.');
      setKey('');setEditingProvider(null);setConnections(data.connections);setRuntime(data);setNotice('Chave protegida salva para esta empresa. A validade é confirmada pelo provedor durante o uso.');
    } catch(error) {setError(error instanceof Error?error.message:'Falha ao salvar a chave.');}
    finally {setBusy(false);}
  }
  async function savePolicy(){
    setBusy(true);setError('');setNotice('');
    try{const response=await fetch('/api/backend/assistant/provider-connections/policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(policy)});const data=await response.json();if(!response.ok)throw Error(data.message||'Falha ao salvar a prioridade.');setPolicy(data.costPolicy);setNotice('Prioridade de custo salva para esta empresa.');}catch(error){setError(error instanceof Error?error.message:'Falha ao salvar.');}finally{setBusy(false);}
  }
  return <section className={cardTw} aria-label="Conexões de IA e pesquisa">
    <h2 className="flex items-center gap-provider-title-gap text-provider-heading font-extrabold text-slate-950">Conexões de IA e pesquisa</h2>
    <p className={noteTw}>A chave da empresa tem prioridade sobre a configuração do servidor. As chaves são criptografadas e não são exibidas novamente.</p>
    {connections ? <>
      <section aria-label="Status das conexões de IA e pesquisa" className={overviewTw}>
        <div className={overviewHeadTw}><h3 className={overviewTitleTw}>Status das conexões — quem está de pé AGORA</h3><button type="button" className={`${secondaryButton} min-h-8 px-3 text-small`} onClick={()=>setConnectionsAttempt(v=>v+1)}>Reverificar</button></div>
        <ul className={statusListTw}>{connections.map(connection => {
          const probe = probes[connection.provider];
          const configured = connection.configured;
          const editing = editingProvider === connection.provider;
          const state: string = !configured ? "is-off" : probe?.status === "connected" ? "is-connected" : probe?.status === "rejected" ? "is-rejected" : probe?.status === "offline" ? "is-offline" : "is-configured";
          const label = !configured ? "SEM CHAVE" : probe?.status === "connected" ? "CONECTADA" : probe?.status === "rejected" ? "REJEITADA/EXPIRADA" : probe?.status === "offline" ? "OFFLINE" : "CONFIGURADA";
          const origin = connection.source === 'tenant' ? "desta empresa" : connection.source === 'server' ? "do servidor" : "";
          return <li key={connection.provider} className={statusItemTw} data-provider-status={state}>
            <div className={statusMainTw}>
              <strong className={statusNameTw}>{labels[connection.provider]||connection.provider}</strong>
              <span className={`${statusPillTw} ${pillTone[state]}`}>{label}</span>
            </div>
            <p className={statusDetailTw}>{configured ? (probe ? probe.message + (probe.checkedAt ? " · verificado agora" : "") : "Verificação pendente…") : "Nenhuma chave cadastrada"}</p>
            <p className={statusOriginTw}>{configured && origin ? "Chave: " + origin : "Sem chave"}{connection.needsRepair ? " · Cadastre novamente" : ""}</p>
            <button type="button" className={`${textButton} justify-self-start md:justify-self-end`} aria-expanded={editing} onClick={()=>{ setProvider(connection.provider); setKey(""); setNotice(""); setError(""); setEditingProvider(editing ? null : connection.provider); }}>{connection.configured ? "Trocar chave" : "Adicionar chave"}</button>
            {editing?<form className="col-span-full grid gap-3 rounded-token-sm border border-gray-200 bg-zinc-100 p-provider-pad" onSubmit={save}>
              <label className={fieldTw}>Chave de API para {labels[connection.provider]||connection.provider}<input type="password" name="ai-provider-key" autoComplete="new-password" value={key} minLength={12} maxLength={512} required disabled={busy} onChange={event=>setKey(event.target.value)} placeholder="Insira a chave neste campo protegido"/></label>
              <p className={noteTw}>A chave fica nesta empresa e não é exibida novamente. A validade é confirmada pelo provedor durante o uso.</p>
              <div className="flex flex-wrap gap-2"><button className={primaryButton} type="submit" disabled={busy||key.trim().length<12}>{busy?'Salvando…':'Salvar chave'}</button><button type="button" className={secondaryButton} onClick={()=>{setEditingProvider(null);setKey('')}}>Cancelar</button></div>
            </form>:null}
          </li>;
        })}</ul>
      </section>
      <fieldset className="mt-5 grid gap-2.5 rounded-token-sm border border-gray-200 p-provider-pad"><legend>Prioridade de custo</legend>
        <label className={togglerTw}><input type="checkbox" className={checkTw} checked={policy.freeFirst} disabled={busy} onChange={event=>setPolicy(value=>({...value,freeFirst:event.target.checked}))}/> Priorizar modelos locais e gratuitos · OpenRouter Free</label>
        <label className={togglerTw}><input type="checkbox" className={checkTw} checked={policy.allowPaidFallback} disabled={busy} onChange={event=>setPolicy(value=>({...value,allowPaidFallback:event.target.checked}))}/> Permitir modelos pagos configurados como contingência</label>
        <p className={noteTw}>Com a prioridade ativa, modelos Ollama configurados vêm primeiro, depois openrouter/free. Sem contingência paga, o limite gratuito interrompe a execução. A cota do OpenRouter depende da conta; consulte os valores informados pelo provedor abaixo.</p>
        <label className={togglerTw}><input type="checkbox" className={checkTw} checked={policy.customerSearch===true} onChange={e=>setPolicy(p=>({...p,customerSearch:e.target.checked}))}/> Permitir pesquisa na internet para clientes nos agentes com a Skill de pesquisa · usa SearXNG próprio</label><button type="button" className={secondaryButton} disabled={busy} onClick={()=>void savePolicy()}>Salvar prioridade de custo</button>
      </fieldset>
      <p className="text-body text-slate-950"><strong>Pesquisa:</strong> {runtime.research?.localConfigured?'SearXNG próprio configurado · sem cobrança de API':'SearXNG ainda não configurado no servidor; Brave é a conexão alternativa.'}</p>
      <p className={noteTw}>LLM local: {runtime.local?.llmConfigured?'endereço configurado':'ainda não configurado'}. Voz Whisper/Kokoro: {runtime.local?.voiceConfigured?'endereço configurado':'ainda não configurada'}. Modelos locais precisam estar instalados. Vídeos por templates usam FFmpeg.</p>
      {usageLoading?<p role="status">Consultando cotas do OpenRouter…</p>:null}{usageError?<div role="alert"><p>{usageError}</p><button type="button" className={secondaryButton} onClick={()=>setUsageAttempt(value=>value+1)}>Tentar novamente</button></div>:null}
      {usage?.configured&&<div role={usage.low||usage.incident?'alert':'status'} className={usage.low||usage.incident?warningTw:"grid gap-1.5"}><strong className={usage.low||usage.incident?warningTitleTw:"text-body font-bold text-slate-950"}>OpenRouter · cotas e créditos</strong>{usage.available?<><p>Cota gratuita: {usage.free?usage.free.remaining+' de '+usage.free.limit+' solicitações restantes hoje (UTC)':'não informada pelo provedor'}. Limite de crédito da chave: {usage.keyCreditsRemaining===null?'sem limite informado':'US$ '+usage.keyCreditsRemaining.toFixed(2)+' restantes'}. {usage.budget&&'Orçamento: US$ '+usage.budget.remaining.toFixed(2)+' restantes.'}</p><small>O limite da chave não representa necessariamente o saldo da conta.</small></>:<p>{usage.message}</p>}{(usage.low||usage.incident)&&<p>A cota está baixa ou houve bloqueio recente. Mantenha local → grátis; habilite contingência paga apenas se desejar, escolhendo seus modelos de menor custo.</p>}<a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer" className={usage.low||usage.incident?warningLinkTw:"text-blue-600 font-bold underline underline-offset-2"}>Consultar saldo na OpenRouter</a></div>}
    </> : !error && <p role="status">Verificando conexões…</p>}
    {notice&&<p role="status" className="text-body text-emerald-600">{notice}</p>}{error&&<p role="alert" className="text-body text-red-600">{error}</p>}
  </section>;
}
