"use client";
import { useEffect, useState } from 'react';
type Connection = { provider: string; configured: boolean; source: 'tenant' | 'server' | null; needsRepair: boolean };
const labels: Record<string,string> = { openrouter: 'OpenRouter · modelos de IA', openai: 'OpenAI · modelos e voz', brave: 'Brave Search · pesquisa na internet' };

export function ProviderConnections() {
  const [connections,setConnections] = useState<Connection[] | null>(null);
  const [provider,setProvider] = useState('openrouter');
  const [key,setKey] = useState('');
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  useEffect(()=>{
    let active=true;
    fetch('/api/backend/assistant/provider-connections',{cache:'no-store'}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw Error(data.message||'Não foi possível verificar as conexões.');
      if(active)setConnections(data.connections);
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'Falha ao verificar as conexões.');});
    return ()=>{active=false;};
  },[]);
  async function save(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/backend/assistant/provider-connections',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({provider,key:key.trim()})});
      const data=await response.json();
      if(!response.ok)throw Error(data.message||'Não foi possível salvar a chave.');
      setKey('');setConnections(data.connections);setNotice('Chave protegida salva para esta empresa. A validade é confirmada pelo provedor durante o uso.');
    } catch(error) {setError(error instanceof Error?error.message:'Falha ao salvar a chave.');}
    finally {setBusy(false);}
  }
  return <section className="content-card ai-admin-card" style={{marginBottom:16}} aria-label="Conexões de IA e pesquisa">
    <h2>Conexões de IA e pesquisa</h2>
    <p className="ai-admin-note">A chave da empresa tem prioridade sobre a configuração do servidor. As chaves são criptografadas e não são exibidas novamente.</p>
    {connections ? <>
      <ul>{connections.map(connection=><li key={connection.provider}><strong>{labels[connection.provider]||connection.provider}:</strong> {connection.needsRepair?'Cadastre a chave novamente':connection.configured?`Chave cadastrada · ${connection.source==='tenant'?'desta empresa':'do servidor'}`:'Falta cadastrar a chave'}</li>)}</ul>
      <details><summary>Conectar ou trocar chave</summary><form className="ai-admin-fields" onSubmit={save} style={{paddingTop:12}}>
        <label>Provedor da conexão<select value={provider} disabled={busy} onChange={event=>{setProvider(event.target.value);setKey('');setNotice('');}}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Chave de API<input type="password" name="ai-provider-key" autoComplete="new-password" value={key} minLength={12} maxLength={512} required disabled={busy} onChange={event=>setKey(event.target.value)} placeholder="Insira a chave neste campo protegido"/></label>
        <p className="ai-admin-note">Somente administradores podem salvar esta conexão. Use uma chave já criada na sua conta do provedor.</p>
        <button className="primary-button" type="submit" disabled={busy||key.trim().length<12}>{busy?'Salvando…':'Salvar chave'}</button>
      </form></details>
    </> : !error && <p role="status">Verificando conexões…</p>}
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
