"use client";
import {InboxesManagement} from "./inboxes-management";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, Check, CheckCircle2, ChevronRight, Plus, RefreshCw, Unplug } from "lucide-react";

type Diagnostic = { configured: boolean; publicUrlConfigured: boolean; webhookSecretConfigured?:boolean; teamWebhookUrl?:string|null; authenticated: boolean; profileConfigured?:boolean; accountCount: number; accounts: {accountId:string;platform:string;username?:string;name?:string;status?:string;profileName?:string}[]; checkedAt: string; message?: string; diagnosticStage?: string; providerStatus?: number };
type Channel = { id: string; name: string; provider: string; status: string; platform?: string; accountId?: string; username?: string; profileName?: string; lastError?: string | null; webhookVerifiedAt?: string; createdAt?: string };

const platformNames: Record<string,string> = { instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", whatsapp:"WhatsApp", tiktok:"TikTok", linkedin:"LinkedIn", youtube:"YouTube", threads:"Threads", pinterest:"Pinterest", x:"X", twitter:"X", reddit:"Reddit", bluesky:"Bluesky", telegram:"Telegram", discord:"Discord", snapchat:"Snapchat", googlebusiness:"Google Business" };
const platformColors: Record<string,string> = { instagram:"#D9468D", facebook:"#1877F2", messenger:"#168AFF", whatsapp:"#159B75", tiktok:"#20242B", linkedin:"#0A66C2", youtube:"#E53935", threads:"#303030", pinterest:"#BD081C", x:"#111827", twitter:"#111827", reddit:"#FF4500", bluesky:"#1685FE", telegram:"#229ED9", discord:"#5865F2", snapchat:"#E5C900", googlebusiness:"#4285F4" };
async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); const body=await response.json().catch(()=>({})); if(!response.ok) { if(response.status===401) throw new Error("Sua sessão da Véxora expirou ou não foi encontrada. Entre novamente na Véxora para verificar a integração Zernio."); throw new Error(Array.isArray(body.message)?body.message.join(" "):body.message||body.error||"Não foi possível concluir a operação."); } return body as T; }
function platformName(platform:string){return platformNames[platform.toLowerCase()]||platform;}
function platformColor(platform:string){return platformColors[platform.toLowerCase()]||"#6258DF";}
function statusText(status?:string){const s=(status||"").toUpperCase();if(["CONNECTED","ACTIVE","HEALTHY"].includes(s))return "Conectada";if(["ERROR","FAILED","DISCONNECTED","REVOKED"].includes(s))return "Precisa de atenção";if(["CONNECTING","PENDING"].includes(s))return "Em validação";if(s==="UNKNOWN")return "Conexão não confirmada";return status||"Registrada";}
export function ChannelsIntegrations(){
 const [diagnostic,setDiagnostic]=useState<Diagnostic|null>(null);
 const [channels,setChannels]=useState<Channel[]>([]);
 const [loading,setLoading]=useState(true);
 const [inboxRevision,setInboxRevision]=useState(0);
 const refreshing=useRef(false);
 const [googleConfig,setGoogleConfig]=useState<{configured:boolean;encryptionConfigured?:boolean;status:string;callbackUrl:string|null}|null>(null);
 const [googleConnections,setGoogleConnections]=useState<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>([]);
 const [googleBusy,setGoogleBusy]=useState(false);

 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");


 
 
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async(showFeedback=false)=>{
   if(refreshing.current)return;refreshing.current=true;
   setLoading(true);setError("");
   try{
     const diag=await api<Diagnostic>("/api/backend/channels/zernio/sync",{method:"POST"});
     const existing=await api<Channel[]>("/api/backend/channels");
     setInboxRevision(v=>v+1);
     setDiagnostic(diag);setChannels(existing);
     if(showFeedback)setNotice(diag.message || (diag.authenticated?"Conexões desta empresa atualizadas.":"A configuração da Zernio precisa de atenção."));
   }catch(e){setDiagnostic(null);setChannels([]);setError(e instanceof Error?e.message:"Não foi possível verificar a integração.");}
   finally{setLoading(false);refreshing.current=false;}
 },[]);
 useEffect(()=>{const update=()=>{if(document.visibilityState==="visible")void refresh();};window.addEventListener("focus",update);const timer=window.setInterval(update,60000);return()=>{window.removeEventListener("focus",update);window.clearInterval(timer);};},[refresh]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const result=params.get("google");if(result==="connected")setNotice("Conta Google autorizada com sucesso. A conexão está disponível nesta empresa.");else if(result)setError("A autorização Google não foi concluída ("+result+"). Tente conectar novamente.");const social=params.get("zernio");if(social==="connected")setNotice("Conta social autorizada e vinculada a esta empresa.");else if(social)setError("Não foi possível concluir o OAuth da Zernio ("+social+"). Tente novamente.");if(result||social){const url=new URL(window.location.href);url.searchParams.delete("google");url.searchParams.delete("zernio");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);void refresh(true);}},[refresh]);
 useEffect(()=>{void refresh();void api<{configured:boolean;encryptionConfigured:boolean;status:string;callbackUrl:string|null}>("/api/backend/integrations/google/config").then(setGoogleConfig).catch(()=>setGoogleConfig(null));void api<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>("/api/backend/integrations/google/connections").then(setGoogleConnections).catch(()=>{});},[refresh]);
 async function connectGoogle(service:"calendar"|"drive"){setGoogleBusy(true);setError("");try{const result=await api<{authorizationUrl:string}>("/api/backend/integrations/google/start/"+service,{method:"POST"});window.location.assign(result.authorizationUrl);}catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização Google.");setGoogleBusy(false);}}
 async function disconnectGoogleService(id:string,service:"calendar"|"drive"){if(!window.confirm("Desconectar somente o Google "+(service==="calendar"?"Agenda":"Drive")+"? O outro serviço permanecerá conectado."))return;setGoogleBusy(true);try{await api("/api/backend/integrations/google/connections/"+encodeURIComponent(id)+"/services/"+service,{method:"DELETE"});setGoogleConnections(rows=>rows.map(row=>row.id===id?{...row,disabledServices:[...new Set([...(row.disabledServices||[]),service])]}:row));setNotice("Serviço desconectado. A outra integração foi preservada.");}catch(e){setError(e instanceof Error?e.message:"Falha ao desconectar serviço.");}finally{setGoogleBusy(false);}}
 async function forgetGoogle(id:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.filter(a=>a.id!==id));setNotice('Conta desconectada removida da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}
 async function forgetGoogleService(id:string,service:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/services/'+service+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.map(a=>a.id===id?{...a,disabledServices:[...a.disabledServices,'hidden:'+service]}:a));setNotice('Serviço desconectado removido da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}


 async function connectSocial(platform:"instagram"|"facebook"|"whatsapp"){
   setBusy(true);setError("");setNotice("");
   try{const result=await api<{authorizationUrl:string}>("/api/backend/channels/zernio/oauth/start/"+platform,{method:"POST"});window.location.assign(result.authorizationUrl);}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização OAuth.");setBusy(false);}
 }
 const linkedCount=channels.filter(c=>c.provider==="ZERNIO").length;
 return <section className="channels-page">
   <header className="channels-page-heading"><div><h1>Canais e integrações</h1></div></header>
   <InboxesManagement refreshKey={inboxRevision}/>
   {error?<div className="channels-alert error" role="alert"><AlertCircle size={17}/><span>{error}</span><button type="button" onClick={()=>setError("")} aria-label="Fechar aviso">×</button></div>:null}
   {notice?<div className="channels-alert success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Fechar aviso">×</button></div>:null}
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark" style={{background:"#4285F4",color:"#fff"}}>G</span><div><h2>Google Workspace</h2><p>Agenda e Drive autorizados individualmente por empresa</p></div><span className="channels-once-badge">{googleConnections.some(a=>(a.scopes.includes("calendar.events")&&!(a.disabledServices||[]).includes("calendar"))||(a.scopes.includes("drive.file")&&!(a.disabledServices||[]).includes("drive")))?"Conectado":googleConfig?.configured?"Pronto para conectar":"Não configurado"}</span></div>
     {googleConnections.length?<div className="channels-connected-list">{googleConnections.map(account=><div className="channels-google-account" key={account.id}><strong>{account.email}</strong>{["calendar","drive"].filter(service=>account.scopes.includes(service==="drive"?"/drive":"/calendar")).every(service=>(account.disabledServices||[]).includes(service))&&<button type="button" className="text-button" disabled={googleBusy} onClick={()=>void forgetGoogle(account.id)}>Excluir da lista</button>}{(["calendar","drive"] as const).filter(service=>!(account.disabledServices||[]).includes("hidden:"+service)).map(service=>{const enabled=account.scopes.includes(service==="calendar"?"/calendar":"/drive")&&!(account.disabledServices||[]).includes(service);return <div className="channels-google-service" key={service}><div><strong>{service==="calendar"?"Google Agenda":"Google Drive"}</strong><small>{enabled?"Conectado":"Desconectado"}</small></div><div className="channels-google-service-actions"><button type="button" className="secondary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle(service)}>{enabled?"↻ Reconectar":"Conectar"}</button>{enabled?<button type="button" className="secondary-button" disabled={googleBusy} onClick={()=>void disconnectGoogleService(account.id,service)}>Desconectar</button>:<button type="button" className="text-button" disabled={googleBusy} onClick={()=>void forgetGoogleService(account.id,service)}>Excluir da lista</button>}</div></div>;})}</div>)}</div>:<p className="channels-form-note">Nenhuma conta Google autorizada nesta empresa.</p>}
     <p><a href="/?module=Google%20Drive" className="secondary-button">Abrir arquivos do Drive</a></p><details><summary>Conectar outra conta Google</summary><div className="channels-google-actions"><button type="button" className="primary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle("calendar")}>{googleConnections.some(a=>a.scopes.includes("calendar.events"))?"Autorizar outra Agenda":"Conectar Google Agenda"}</button><button type="button" className="secondary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle("drive")}>{googleConnections.some(a=>a.scopes.includes("drive.file"))?"Autorizar outro Drive":"Conectar Google Drive"}</button></div></details>
     {!googleConnections.length?<details className="channels-google-setup"><summary>Configuração técnica do Google</summary><p>As credenciais da aplicação são configuradas na API. {googleConfig?.configured?"Credenciais detectadas.":"Credenciais não detectadas."}</p><p>Retorno OAuth: <code>{googleConfig?.callbackUrl||"Não configurado"}</code></p>{!googleConfig?.encryptionConfigured?<p>Configure GOOGLE_TOKEN_ENCRYPTION_KEY no servidor.</p>:null}</details>:null}
   </section>
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark">Z</span><div><h2>Zernio</h2><p>{loading?"Atualizando perfil desta empresa…":diagnostic?.authenticated?"Perfil desta empresa · "+(diagnostic.profileConfigured?"conectado":"pronto para OAuth"):diagnostic?.message||"A integração central precisa de atenção"}</p></div><button type="button" className="secondary-button" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={15}/> Atualizar contas</button></div>
     {!loading&&!diagnostic?.authenticated?<p className="channels-form-note"><AlertCircle size={16}/>{diagnostic?.message||"Confira a configuração central da Zernio."}</p>:null}
     {diagnostic?.authenticated?<details className="channels-google-setup"><summary>Configuração do webhook único da Véxora</summary><p>Configure uma única vez na Zernio o endereço central. Os eventos serão separados pelo perfil e pela conta de cada empresa.</p><p>Endereço: <code>{diagnostic.teamWebhookUrl||"Configure API_PUBLIC_URL no servidor."}</code></p><p>{diagnostic.webhookSecretConfigured?"Segredo do webhook configurado no servidor.":"Configure ZERNIO_WEBHOOK_SECRET no servidor e use o mesmo segredo na Zernio."}</p><p>Ative os eventos account.connected, account.disconnected e message.received.</p></details>:null}
     {diagnostic?.authenticated?<div className="content-card channels-account-form-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Plus size={18}/></span><div><h2>Conectar uma rede desta empresa</h2><p>O cliente autoriza a conta por OAuth. A conexão fica no perfil Zernio exclusivo desta empresa.</p></div></div><div className="channels-google-actions">{(["instagram","facebook","whatsapp"] as const).map(platform=><button key={platform} type="button" className="secondary-button" disabled={busy} onClick={()=>void connectSocial(platform)}>{busy?"Abrindo autorização…":"Conectar "+platformName(platform)}</button>)}</div></div>:null}
   </section>
     <section className="content-card channels-connected-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Activity size={18}/></span><div><h3>Contas vinculadas a esta empresa</h3><p>As contas aqui pertencem somente ao perfil desta empresa na Zernio.</p></div><span className="channels-count">{linkedCount}</span></div>
       {linkedCount?<div className="channels-connected-list">{channels.filter(c=>c.provider==="ZERNIO").map(c=><article className="channels-connected-row" key={c.id}><span className="channels-platform-icon" style={{background:platformColor(c.platform||"social")}}>{platformName(c.platform||"Rede social").slice(0,1).toUpperCase()}</span><div className="channels-connected-main"><strong>{c.username?"@"+c.username.replace(/^@/,""):c.name}</strong><p>{platformName(c.platform||"Rede social")} · {statusText(c.status)} · Histórico e inbox desta empresa</p></div><span className={"channels-connection-pill "+(c.status==="CONNECTED"?"good":"attention")}><span/> {statusText(c.status)}</span><ChevronRight size={16} className="channels-row-chevron"/></article>)}</div>:<div className="channels-empty-state"><span><Unplug size={22}/></span><strong>Nenhuma conta conectada nesta empresa</strong><p>Use as opções de OAuth acima para conectar Instagram, Facebook ou WhatsApp. Cada empresa mantém suas próprias contas.</p></div>}
     </section>
   </section>;
}
