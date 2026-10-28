"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, Check, CheckCircle2, ChevronRight, Plus, RefreshCw, ShieldCheck, Unplug, Info, Copy } from "lucide-react";

type SocialAccount = { accountId: string; platform: string; username?: string; name?: string; status?: string; profileName?: string };
type Diagnostic = { configured: boolean; publicUrlConfigured: boolean; authenticated: boolean; accountCount: number; accounts: SocialAccount[]; checkedAt: string; message?: string; diagnosticStage?: string; providerStatus?: number };
type Channel = { id: string; name: string; provider: string; status: string; platform?: string; accountId?: string; username?: string; profileName?: string; lastError?: string | null; webhookVerifiedAt?: string; createdAt?: string };
type Setup = { id: string; name: string; platform: string; accountId: string; webhookUrl: string | null; webhookSecret: string; webhookSetup: string };
const platformNames: Record<string,string> = { instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", whatsapp:"WhatsApp", tiktok:"TikTok", linkedin:"LinkedIn", youtube:"YouTube", threads:"Threads", pinterest:"Pinterest", x:"X", twitter:"X", reddit:"Reddit", bluesky:"Bluesky", telegram:"Telegram", discord:"Discord", snapchat:"Snapchat", googlebusiness:"Google Business" };
const platformColors: Record<string,string> = { instagram:"#D9468D", facebook:"#1877F2", messenger:"#168AFF", whatsapp:"#159B75", tiktok:"#20242B", linkedin:"#0A66C2", youtube:"#E53935", threads:"#303030", pinterest:"#BD081C", x:"#111827", twitter:"#111827", reddit:"#FF4500", bluesky:"#1685FE", telegram:"#229ED9", discord:"#5865F2", snapchat:"#E5C900", googlebusiness:"#4285F4" };
async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); const body=await response.json().catch(()=>({})); if(!response.ok) { if(response.status===401) throw new Error("Sua sessão da Véxora expirou ou não foi encontrada. Entre novamente na Véxora para verificar a integração Zernio."); throw new Error(Array.isArray(body.message)?body.message.join(" "):body.message||body.error||"Não foi possível concluir a operação."); } return body as T; }
function platformName(platform:string){return platformNames[platform.toLowerCase()]||platform;}
function platformColor(platform:string){return platformColors[platform.toLowerCase()]||"#6258DF";}
function statusText(status?:string){const s=(status||"").toUpperCase();if(["CONNECTED","ACTIVE","HEALTHY"].includes(s))return "Conectada";if(["ERROR","FAILED","DISCONNECTED","REVOKED"].includes(s))return "Precisa de atenção";if(["CONNECTING","PENDING"].includes(s))return "Em validação";return status||"Registrada";}
export function ChannelsIntegrations(){
 const [diagnostic,setDiagnostic]=useState<Diagnostic|null>(null);
 const [channels,setChannels]=useState<Channel[]>([]);
 const [loading,setLoading]=useState(true);
 const [googleConfig,setGoogleConfig]=useState<{configured:boolean;encryptionConfigured?:boolean;status:string;callbackUrl:string|null}|null>(null);
 const [googleConnections,setGoogleConnections]=useState<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>([]);
 const [googleBusy,setGoogleBusy]=useState(false);

 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");

 const [selectedAccount,setSelectedAccount]=useState("");
 
 
 const [busy,setBusy]=useState(false);
 const [setup,setSetup]=useState<Setup|null>(null);
 const [secretVisible,setSecretVisible]=useState(false);
 const [copied,setCopied]=useState(false);
 const refresh=useCallback(async(showFeedback=false)=>{
   setLoading(true); if(showFeedback)setError("");
   try{
     const [diag,existing]=await Promise.all([
       api<Diagnostic>("/api/backend/channels/zernio/diagnostics"),
       api<Channel[]>("/api/backend/channels")
     ]);
     setDiagnostic(diag);setChannels(existing);
     if(showFeedback)setNotice(diag.message || (diag.authenticated?"Chave Zernio validada. A entrega de mensagens depende da configuração do webhook de cada conta.":"A configuração da Zernio precisa de atenção."));
   }catch(e){setDiagnostic(null);setChannels([]);setError(e instanceof Error?e.message:"Não foi possível verificar a integração.");}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const result=params.get("google");if(result==="connected")setNotice("Conta Google autorizada com sucesso. A conexão está disponível nesta empresa.");else if(result)setError("A autorização Google não foi concluída ("+result+"). Tente conectar novamente.");if(result){const url=new URL(window.location.href);url.searchParams.delete("google");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);}},[]);
 useEffect(()=>{void refresh();void api<{configured:boolean;encryptionConfigured:boolean;status:string;callbackUrl:string|null}>("/api/backend/integrations/google/config").then(setGoogleConfig).catch(()=>setGoogleConfig(null));void api<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>("/api/backend/integrations/google/connections").then(setGoogleConnections).catch(()=>{});},[refresh]);
 async function connectGoogle(service:"calendar"|"drive"){setGoogleBusy(true);setError("");try{const result=await api<{authorizationUrl:string}>("/api/backend/integrations/google/start/"+service,{method:"POST"});window.location.assign(result.authorizationUrl);}catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização Google.");setGoogleBusy(false);}}
 async function disconnectGoogleService(id:string,service:"calendar"|"drive"){if(!window.confirm("Desconectar somente o Google "+(service==="calendar"?"Agenda":"Drive")+"? O outro serviço permanecerá conectado."))return;setGoogleBusy(true);try{await api("/api/backend/integrations/google/connections/"+encodeURIComponent(id)+"/services/"+service,{method:"DELETE"});setGoogleConnections(rows=>rows.map(row=>row.id===id?{...row,disabledServices:[...new Set([...(row.disabledServices||[]),service])]}:row));setNotice("Serviço desconectado. A outra integração foi preservada.");}catch(e){setError(e instanceof Error?e.message:"Falha ao desconectar serviço.");}finally{setGoogleBusy(false);}}
 async function forgetGoogle(id:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.filter(a=>a.id!==id));setNotice('Conta desconectada removida da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}
 async function forgetGoogleService(id:string,service:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/services/'+service+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.map(a=>a.id===id?{...a,disabledServices:[...a.disabledServices,'hidden:'+service]}:a));setNotice('Serviço desconectado removido da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}
 const socialAccounts=useMemo(()=>diagnostic?.accounts||[],[diagnostic]);
 const chosen=socialAccounts.find(a=>a.accountId===selectedAccount);
 useEffect(()=>{if(chosen){}},[selectedAccount]);
 async function connectAccount(event:React.FormEvent){event.preventDefault();const accountId=(chosen?.accountId||"").trim();const accountName=chosen?.name||chosen?.username||(chosen?platformName(chosen.platform):"");if(!accountId||!accountName){setError("Selecione uma conta disponível na Zernio.");return;}setBusy(true);setError("");setNotice("");setSetup(null);setSecretVisible(false);
   try{const result=await api<Setup>("/api/backend/channels/zernio",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:accountName,username:chosen?.username,profileName:chosen?.profileName,platform:chosen?.platform==="twitter"?"x":chosen?.platform,accountId})});setSetup(result);setSecretVisible(true);setChannels(await api<Channel[]>("/api/backend/channels"));setNotice("Conta vinculada. Configure o webhook desta conta usando os dados abaixo.");setSelectedAccount("");}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível vincular a conta.");}finally{setBusy(false);}
 }
 const linkedIds=new Set(channels.filter(c=>c.provider==="ZERNIO").map(c=>c.accountId).filter(Boolean));
 const linkedCount=channels.filter(c=>c.provider==="ZERNIO").length;
 async function copyWebhook(){if(!setup)return;try{await navigator.clipboard.writeText("URL: "+(setup.webhookUrl||"")+"\nSegredo de assinatura: "+setup.webhookSecret);setCopied(true);}catch{setError("O navegador bloqueou a cópia. Selecione e copie os dados manualmente.");}}
 return <section className="channels-page">
   <header className="channels-page-heading"><div><h1>Canais e integrações</h1></div></header>
   {error?<div className="channels-alert error" role="alert"><AlertCircle size={17}/><span>{error}</span><button type="button" onClick={()=>setError("")} aria-label="Fechar aviso">×</button></div>:null}
   {notice?<div className="channels-alert success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Fechar aviso">×</button></div>:null}
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark" style={{background:"#4285F4",color:"#fff"}}>G</span><div><h2>Google Workspace</h2><p>Agenda e Drive autorizados individualmente por empresa</p></div><span className="channels-once-badge">{googleConnections.some(a=>(a.scopes.includes("calendar.events")&&!(a.disabledServices||[]).includes("calendar"))||(a.scopes.includes("drive.file")&&!(a.disabledServices||[]).includes("drive")))?"Conectado":googleConfig?.configured?"Pronto para conectar":"Não configurado"}</span></div>
     {googleConnections.length?<div className="channels-connected-list">{googleConnections.map(account=><div className="channels-google-account" key={account.id}><strong>{account.email}</strong>{["calendar","drive"].filter(service=>account.scopes.includes(service==="drive"?"/drive":"/calendar")).every(service=>(account.disabledServices||[]).includes(service))&&<button type="button" className="text-button" disabled={googleBusy} onClick={()=>void forgetGoogle(account.id)}>Excluir da lista</button>}{(["calendar","drive"] as const).filter(service=>!(account.disabledServices||[]).includes("hidden:"+service)).map(service=>{const enabled=account.scopes.includes(service==="calendar"?"/calendar":"/drive")&&!(account.disabledServices||[]).includes(service);return <div className="channels-google-service" key={service}><div><strong>{service==="calendar"?"Google Agenda":"Google Drive"}</strong><small>{enabled?"Conectado":"Desconectado"}</small></div><div className="channels-google-service-actions"><button type="button" className="secondary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle(service)}>{enabled?"↻ Reconectar":"Conectar"}</button>{enabled?<button type="button" className="secondary-button" disabled={googleBusy} onClick={()=>void disconnectGoogleService(account.id,service)}>Desconectar</button>:<button type="button" className="text-button" disabled={googleBusy} onClick={()=>void forgetGoogleService(account.id,service)}>Excluir da lista</button>}</div></div>;})}</div>)}</div>:<p className="channels-form-note">Nenhuma conta Google autorizada nesta empresa.</p>}
     <p><a href="/?module=Google%20Drive" className="secondary-button">Abrir arquivos do Drive</a></p><details><summary>Conectar outra conta Google</summary><div className="channels-google-actions"><button type="button" className="primary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle("calendar")}>{googleConnections.some(a=>a.scopes.includes("calendar.events"))?"Autorizar outra Agenda":"Conectar Google Agenda"}</button><button type="button" className="secondary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle("drive")}>{googleConnections.some(a=>a.scopes.includes("drive.file"))?"Autorizar outro Drive":"Conectar Google Drive"}</button></div></details>
     {!googleConnections.length?<details className="channels-google-setup"><summary>Configuração técnica do Google</summary><p>As credenciais da aplicação são configuradas na API. {googleConfig?.configured?"Credenciais detectadas.":"Credenciais não detectadas."}</p><p>Retorno OAuth: <code>{googleConfig?.callbackUrl||"Não configurado"}</code></p>{!googleConfig?.encryptionConfigured?<p>Configure GOOGLE_TOKEN_ENCRYPTION_KEY no servidor.</p>:null}</details>:null}
   </section>
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark">Z</span><div><h2>Zernio</h2><p>{loading?"Verificando conexão…":diagnostic?.authenticated?"API autenticada":diagnostic?.message||"Conexão não validada"}</p></div><button type="button" className="secondary-button" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={15}/> Verificar</button></div>
     {!loading&&!diagnostic?.authenticated?<p className="channels-form-note"><AlertCircle size={16}/> {diagnostic?.message||"Confira a configuração da API no servidor."}</p>:null}
   {diagnostic?.authenticated&&socialAccounts.some(a=>!linkedIds.has(a.accountId))?<section className="content-card channels-account-form-card">
     <div className="channels-section-heading"><span className="channels-heading-icon"><Plus size={18}/></span><div><h2>Adicionar conta</h2><p>Escolha uma conta já autorizada na Zernio.</p></div></div>
     <form className="channels-form" onSubmit={connectAccount}>
       <label><span>Conta social</span><select value={selectedAccount} onChange={e=>setSelectedAccount(e.target.value)} required><option value="">Selecione uma conta…</option>{socialAccounts.filter(a=>!linkedIds.has(a.accountId)&&["instagram","facebook","messenger","whatsapp","tiktok","linkedin","youtube","threads","pinterest","x","twitter"].includes(a.platform.toLowerCase())).map(a=><option key={a.accountId} value={a.accountId}>{platformName(a.platform)} · {a.username||a.name||a.accountId}</option>)}</select></label>
       <button type="submit" className="primary-button channels-submit" disabled={busy||!chosen}>{busy?"Vinculando…":"Vincular conta"}</button>
     </form>
   </section>:null}
   {setup?<section className="content-card channels-webhook-card"><div className="channels-section-heading"><span className="channels-heading-icon"><ShieldCheck size={18}/></span><div><h2>Configurar webhook desta conta</h2><p>O segredo abaixo é o segredo de assinatura do webhook, não a chave geral da API.</p></div><span className="channels-once-badge">Exibido uma vez</span></div>
      <div className="channels-webhook-fields"><div><label>URL de webhook</label><code>{setup.webhookUrl||"Defina API_PUBLIC_URL no servidor e atualize a integração."}</code></div><div><label>Segredo de assinatura</label><div className="channels-secret-line"><code>{secretVisible?setup.webhookSecret:"••••••••••••••••••••••••••••••••"}</code><button type="button" className="secondary-button" onClick={()=>setSecretVisible(v=>!v)}>{secretVisible?"Ocultar":"Mostrar"}</button></div></div></div>
      <p className="channels-webhook-warning"><AlertCircle size={15}/> Guarde esse segredo no painel de webhooks da Zernio. Ele não poderá ser recuperado nesta tela depois que você sair.</p>
      <button type="button" className="secondary-button" onClick={()=>void copyWebhook()}>{copied?<Check size={15}/>:<Plus size={15}/>} {copied?"Dados copiados":"Copiar URL e segredo"}</button>
      <p className="channels-webhook-instructions">{setup.webhookSetup}</p>
   </section>:null}
   <section className="content-card channels-connected-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Activity size={18}/></span><div><h3>Contas vinculadas</h3><p>Estado atual das conexões registradas nesta empresa.</p></div><span className="channels-count">{linkedCount}</span></div>
     {channels.filter(c=>c.provider==="ZERNIO").length?<div className="channels-connected-list">{channels.filter(c=>c.provider==="ZERNIO").map(stored=>{const live=socialAccounts.find(a=>a.accountId===stored.accountId);const c={...stored,username:live?.username||stored.username};return <article className="channels-connected-row" key={c.id}><span className="channels-platform-icon" style={{background:platformColor(c.platform||"social")}}>{(c.platform||"").toLowerCase()==="instagram"?<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="white" strokeWidth="2" aria-label="Instagram"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6.5" r="1" fill="white" stroke="none"/></svg>:(platformName(c.platform||"Rede social").slice(0,1)).toUpperCase()}</span><div className="channels-connected-main"><strong>{c.username?"@"+c.username.replace(/^@/,""):"Login não informado pela Zernio"}</strong><p>Conta: {c.name} · {c.accountId||"ID protegido"} · {c.webhookVerifiedAt?"Webhook verificado · ":""}{statusText(c.status)}</p></div><span className={"channels-connection-pill "+(c.status==="CONNECTED"?"good":"attention")}><span/> {statusText(c.status)}</span><ChevronRight size={16} className="channels-row-chevron"/></article>})}</div>:<div className="channels-empty-state"><span><Unplug size={22}/></span><strong>Nenhuma conta vinculada ainda</strong><p>Depois de validar a configuração, as contas aparecerão aqui com seu estado de conexão.</p><button type="button" className="secondary-button" onClick={()=>document.querySelector(".channels-account-form-card")?.scrollIntoView({behavior:"smooth",block:"center"})}>Vincular primeira conta <ChevronRight size={15}/></button></div>}
   </section>
   </section>

 </section>;
}
