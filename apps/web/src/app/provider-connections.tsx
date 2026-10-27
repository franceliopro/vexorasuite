"use client";
import { useEffect, useState } from 'react';
type Connection = { provider: string; configured: boolean; source: 'tenant' | 'server' | null; needsRepair: boolean };
const labels: Record<string,string> = { openrouter: 'OpenRouter · modelos de IA', openai: 'OpenAI · modelos e voz', brave: 'Brave Search · pesquisa na internet' };

export function ProviderConnections() {
  const [connections,setConnections] = useState<Connection[] | null>(null);
  const [provider,setProvider] = useState('openrouter');
  const [key,setKey] = useState('');
  const [editing,setEditing]=useState(false),[usage,setUsage]=useState<any>(null);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [policy,setPolicy]=useState({freeFirst:false,allowPaidFallback:false,customerSearch:false});
  const [runtime,setRuntime]=useState<{research?:{localConfigured:boolean};local?:{llmConfigured:boolean;voiceConfigured:boolean}}>({});
  useEffect(()=>{
    let active=true;
    fetch('/api/backend/assistant/provider-connections',{cache:'no-store'}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.message||'Não foi possível verificar as conexões.');
      if(active){setConnections(data.connections);setRuntime(data);if(data.costPolicy)setPolicy(data.costPolicy);}
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'Falha ao verificar as conexões.');});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{let active=true;const load=()=>fetch('/api/backend/assistant/provider-connections/usage',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(active)setUsage(v)}).catch(()=>{});void load();const timer=setInterval(()=>void load(),60000);return()=>{active=false;clearInterval(timer)}},[]);
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
      <fieldset className="ai-admin-fields"><legend>Prioridade de custo</legend>
        <label className="ai-toggle"><input type="checkbox" checked={policy.freeFirst} disabled={busy} onChange={event=>setPolicy(value=>({...value,freeFirst:event.target.checked}))}/> Priorizar modelos locais e gratuitos · OpenRouter Free</label>
        <label className="ai-toggle"><input type="checkbox" checked={policy.allowPaidFallback} disabled={busy} onChange={event=>setPolicy(value=>({...value,allowPaidFallback:event.target.checked}))}/> Permitir modelos pagos configurados como contingência</label>
        <p className="ai-admin-note">Com a prioridade ativa, modelos Ollama configurados vêm primeiro, depois openrouter/free. Sem contingência paga, o limite gratuito interrompe a execução. A cota do OpenRouter depende da conta; consulte os valores informados pelo provedor abaixo.</p>
        <label><input type="checkbox" checked={policy.customerSearch===true} onChange={e=>setPolicy(p=>({...p,customerSearch:e.target.checked}))}/> Permitir pesquisa na internet para clientes nos agentes com a Skill de pesquisa · usa SearXNG próprio</label><button type="button" className="secondary-button" disabled={busy} onClick={()=>void savePolicy()}>Salvar prioridade de custo</button>
      </fieldset>
      <p><strong>Pesquisa:</strong> {runtime.research?.localConfigured?'SearXNG próprio configurado · sem cobrança de API':'SearXNG ainda não configurado no servidor; Brave é a conexão alternativa.'}</p>
      <p className="ai-admin-note">LLM local: {runtime.local?.llmConfigured?'endereço configurado':'ainda não configurado'}. Voz Whisper/Kokoro: {runtime.local?.voiceConfigured?'endereço configurado':'ainda não configurada'}. Modelos locais precisam estar instalados. Vídeos por templates usam FFmpeg.</p>
      <ul>{connections.map(connection=><li key={connection.provider}><strong>{labels[connection.provider]||connection.provider}:</strong> {connection.needsRepair?'Cadastre a chave novamente':connection.configured?`Chave cadastrada · ${connection.source==='tenant'?'desta empresa':'do servidor'}`:'Falta cadastrar a chave'}</li>)}</ul>
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
