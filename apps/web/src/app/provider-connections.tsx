"use client";
import { useEffect, useState } from 'react';
type Connection = { provider: string; configured: boolean; source: 'tenant' | 'server' | null; needsRepair: boolean };
type Probe = { provider: string; status: 'connected' | 'rejected' | 'offline' | 'not_configured'; httpStatus?: number; message: string; checkedAt: string };
const labels: Record<string,string> = { openrouter: 'OpenRouter · modelos de IA', openai: 'OpenAI · modelos e voz', gemini: 'Google Gemini', anthropic: 'Claude · Anthropic', deepseek: 'DeepSeek', qwen: 'Qwen · Alibaba Cloud (Singapura)', groq: 'Groq · modelos abertos rápidos', 'vercel-gateway': 'Vercel AI Gateway', nvidia: 'NVIDIA NIM', brave: 'Brave Search · pesquisa na internet' };

export function ProviderConnections() {
  const [connections,setConnections] = useState<Connection[] | null>(null);
  const [probes,setProbes] = useState<Record<string,Probe>>({});
  const [provider,setProvider] = useState('openrouter');
  const [key,setKey] = useState('');
  const [editing,setEditing]=useState(false),[usage,setUsage]=useState<any>(null),[usageLoading,setUsageLoading]=useState(true),[usageError,setUsageError]=useState(''),[usageAttempt,setUsageAttempt]=useState(0);
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
      setKey('');setEditing(false);setConnections(data.connections);setRuntime(data);setNotice('Chave protegida salva para esta empresa. A validade é confirmada pelo provedor durante o uso.');
    } catch(error) {setError(error instanceof Error?error.message:'Falha ao salvar a chave.');}
    finally {setBusy(false);}
  }
  async function savePolicy(){
    setBusy(true);setError('');setNotice('');
    try{const response=await fetch('/api/backend/assistant/provider-connections/policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(policy)});const data=await response.json();if(!response.ok)throw Error(data.message||'Falha ao salvar a prioridade.');setPolicy(data.costPolicy);setNotice('Prioridade de custo salva para esta empresa.');}catch(error){setError(error instanceof Error?error.message:'Falha ao salvar.');}finally{setBusy(false);}
  }
  return <section className="content-card ai-admin-card" style={{marginBottom:16}} aria-label="Conexões de IA e pesquisa">
    <h2>Conexões de IA e pesquisa</h2>
    <p className="ai-admin-note">A chave da empresa tem prioridade sobre a configuração do servidor. As chaves são criptografadas e não são exibidas novamente.</p>
    {connections ? <>
      <section aria-label="Status das conexões de IA e pesquisa" className="provider-status-overview">
        <div className="provider-status-head"><h3>Status das conexões — quem está de pé AGORA</h3><button type="button" className="secondary-button provider-status-retry" onClick={()=>setConnectionsAttempt(v=>v+1)}>Reverificar</button></div>
        <ul className="provider-status-list">{connections.map(connection => {
          const probe = probes[connection.provider];
          const configured = connection.configured;
          const state: string = !configured ? "is-off" : probe?.status === "connected" ? "is-connected" : probe?.status === "rejected" ? "is-rejected" : probe?.status === "offline" ? "is-offline" : "is-configured";
          const label = !configured ? "SEM CHAVE" : probe?.status === "connected" ? "CONECTADA" : probe?.status === "rejected" ? "REJEITADA/EXPIRADA" : probe?.status === "offline" ? "OFFLINE" : "CONFIGURADA";
          const origin = connection.source === 'tenant' ? "desta empresa" : connection.source === 'server' ? "do servidor" : "";
          return <li key={connection.provider} className={"provider-status-item " + state}>
            <div className="provider-status-main">
              <strong>{labels[connection.provider]||connection.provider}</strong>
              <span className="provider-status-pill">{label}</span>
            </div>
            <p className="provider-status-detail">{configured ? (probe ? probe.message + (probe.checkedAt ? " · verificado agora" : "") : "Verificação pendente…") : "Nenhuma chave cadastrada"}</p>
            <p className="provider-status-origin">{configured && origin ? "Chave: " + origin : "Sem chave"}{connection.needsRepair ? " · Cadastre novamente" : ""}</p>
            <button type="button" className="text-button provider-status-action" onClick={()=>{ setProvider(connection.provider); setKey(""); setNotice(""); setEditing(true); }}>{connection.configured ? "Trocar chave" : "Adicionar chave"}</button>
          </li>;
        })}</ul>
      </section>
      <fieldset className="ai-admin-fields"><legend>Prioridade de custo</legend>
        <label className="ai-toggle"><input type="checkbox" checked={policy.freeFirst} disabled={busy} onChange={event=>setPolicy(value=>({...value,freeFirst:event.target.checked}))}/> Priorizar modelos locais e gratuitos · OpenRouter Free</label>
        <label className="ai-toggle"><input type="checkbox" checked={policy.allowPaidFallback} disabled={busy} onChange={event=>setPolicy(value=>({...value,allowPaidFallback:event.target.checked}))}/> Permitir modelos pagos configurados como contingência</label>
        <p className="ai-admin-note">Com a prioridade ativa, modelos Ollama configurados vêm primeiro, depois openrouter/free. Sem contingência paga, o limite gratuito interrompe a execução. A cota do OpenRouter depende da conta; consulte os valores informados pelo provedor abaixo.</p>
        <label><input type="checkbox" checked={policy.customerSearch===true} onChange={e=>setPolicy(p=>({...p,customerSearch:e.target.checked}))}/> Permitir pesquisa na internet para clientes nos agentes com a Skill de pesquisa · usa SearXNG próprio</label><button type="button" className="secondary-button" disabled={busy} onClick={()=>void savePolicy()}>Salvar prioridade de custo</button>
      </fieldset>
      <p><strong>Pesquisa:</strong> {runtime.research?.localConfigured?'SearXNG próprio configurado · sem cobrança de API':'SearXNG ainda não configurado no servidor; Brave é a conexão alternativa.'}</p>
      <p className="ai-admin-note">LLM local: {runtime.local?.llmConfigured?'endereço configurado':'ainda não configurado'}. Voz Whisper/Kokoro: {runtime.local?.voiceConfigured?'endereço configurado':'ainda não configurada'}. Modelos locais precisam estar instalados. Vídeos por templates usam FFmpeg.</p>
      {usageLoading?<p role="status">Consultando cotas do OpenRouter…</p>:null}{usageError?<div role="alert"><p>{usageError}</p><button type="button" className="secondary-button" onClick={()=>setUsageAttempt(value=>value+1)}>Tentar novamente</button></div>:null}
      {usage?.configured&&<div role={usage.low||usage.incident?'alert':'status'} className={usage.low||usage.incident?'channel-health-warning':''}><strong>OpenRouter · cotas e créditos</strong>{usage.available?<><p>Cota gratuita: {usage.free?usage.free.remaining+' de '+usage.free.limit+' solicitações restantes hoje (UTC)':'não informada pelo provedor'}. Limite de crédito da chave: {usage.keyCreditsRemaining===null?'sem limite informado':'US$ '+usage.keyCreditsRemaining.toFixed(2)+' restantes'}. {usage.budget&&'Orçamento: US$ '+usage.budget.remaining.toFixed(2)+' restantes.'}</p><small>O limite da chave não representa necessariamente o saldo da conta.</small></>:<p>{usage.message}</p>}{(usage.low||usage.incident)&&<p>A cota está baixa ou houve bloqueio recente. Mantenha local → grátis; habilite contingência paga apenas se desejar, escolhendo seus modelos de menor custo.</p>}<a href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer">Consultar saldo na OpenRouter</a></div>}
      <button type="button" className="secondary-button" aria-expanded={editing} onClick={()=>{setEditing(v=>!v);setKey('')}}>{editing?'Cancelar edição':'Editar conexão / permissões'}</button>{editing&&<form className="ai-admin-fields" onSubmit={save} style={{paddingTop:12}}>
        <label>Provedor da conexão<select value={provider} disabled={busy} onChange={event=>{setProvider(event.target.value);setKey('');setNotice('');}}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Chave de API<input type="password" name="ai-provider-key" autoComplete="new-password" value={key} minLength={12} maxLength={512} required disabled={busy} onChange={event=>setKey(event.target.value)} placeholder="Insira a chave neste campo protegido"/></label>
        <p className="ai-admin-note">Somente administradores podem salvar esta conexão. Use uma chave já criada na sua conta do provedor.</p>
        <button className="primary-button" type="submit" disabled={busy||key.trim().length<12}>{busy?'Salvando…':'Salvar chave'}</button>
      </form>}
    </> : !error && <p role="status">Verificando conexões…</p>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}

