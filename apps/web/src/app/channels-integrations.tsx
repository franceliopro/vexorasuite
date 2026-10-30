"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, RefreshCw } from "lucide-react";

type Diagnostic = { configured: boolean; publicUrlConfigured: boolean; webhookSecretConfigured?:boolean; teamWebhookUrl?:string|null; authenticated: boolean; profileConfigured?:boolean; accountCount: number; accounts: {accountId:string;platform:string;username?:string;name?:string;status?:string;profileName?:string}[]; checkedAt: string; message?: string; diagnosticStage?: string; providerStatus?: number; tenantKind?: "PLATFORM"|"COMPANY" };

const platformNames: Record<string,string> = { instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", whatsapp:"WhatsApp", tiktok:"TikTok", linkedin:"LinkedIn", youtube:"YouTube", threads:"Threads", pinterest:"Pinterest", x:"X", twitter:"X", reddit:"Reddit", bluesky:"Bluesky", telegram:"Telegram", discord:"Discord", snapchat:"Snapchat", googlebusiness:"Google Business" };
const platformColors: Record<string,string> = { instagram:"#D9468D", facebook:"#1877F2", messenger:"#168AFF", whatsapp:"#159B75", tiktok:"#20242B", linkedin:"#0A66C2", youtube:"#E53935", threads:"#303030", pinterest:"#BD081C", x:"#111827", twitter:"#111827", reddit:"#FF4500", bluesky:"#1685FE", telegram:"#229ED9", discord:"#5865F2", snapchat:"#E5C900", googlebusiness:"#4285F4" };
async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); const body=await response.json().catch(()=>({})); if(!response.ok) { if(response.status===401) throw new Error("Sua sessão da Véxora expirou ou não foi encontrada. Entre novamente na Véxora para verificar a integração Zernio."); throw new Error(Array.isArray(body.message)?body.message.join(" "):body.message||body.error||"Não foi possível concluir a operação."); } return body as T; }
function platformName(platform:string){return platformNames[platform.toLowerCase()]||platform;}
function platformColor(platform:string){return platformColors[platform.toLowerCase()]||"#6258DF";}
function statusText(status?:string){const s=(status||"").toUpperCase();if(["CONNECTED","ACTIVE","HEALTHY"].includes(s))return "Conectada";if(["ERROR","FAILED","DISCONNECTED","REVOKED"].includes(s))return "Precisa de atenção";if(["CONNECTING","PENDING"].includes(s))return "Em validação";if(s==="UNKNOWN")return "Conexão não confirmada";return status||"Registrada";}
export function ChannelsIntegrations(){
 const [diagnostic,setDiagnostic]=useState<Diagnostic|null>(null);
 const [loading,setLoading]=useState(true);
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
     setDiagnostic(diag);
     if(showFeedback)setNotice(diag.authenticated?"Conexões desta empresa atualizadas.":"A integração Zernio ainda não está pronta para novas conexões.");
   }catch(e){setDiagnostic(null);setError(e instanceof Error?e.message:"Não foi possível verificar a integração.");}
   finally{setLoading(false);refreshing.current=false;}
 },[]);
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
 const linkedAccounts=diagnostic?.authenticated?diagnostic.accounts:[];
 return <section className="channels-page">
   {error?<div className="channels-alert error" role="alert"><AlertCircle size={17}/><span>Não foi possível atualizar as conexões agora.</span><button type="button" onClick={()=>setError("")} aria-label="Fechar aviso">×</button></div>:null}
   {notice?<div className="channels-alert success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Fechar aviso">×</button></div>:null}
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark">Z</span><div><h2>Canais sociais</h2><p>{loading?"Atualizando conexões…":diagnostic?.authenticated?"Contas desta empresa": "Não foi possível confirmar as contas agora"}</p></div><button type="button" className="secondary-button" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={15}/> Atualizar</button></div>
     {diagnostic?.authenticated?<>
       {linkedAccounts.length?<div className="channels-connected-list">{linkedAccounts.map(account=><div className="channels-connected-row" key={account.accountId}><span className="channels-platform-icon" style={{background:platformColor(account.platform)}}>{platformName(account.platform).slice(0,1).toUpperCase()}</span><div className="channels-connected-main"><strong>{account.username?"@"+account.username.replace(/^@/,""):account.name||platformName(account.platform)}</strong><p>{platformName(account.platform)} · {statusText(account.status)}</p></div></div>)}</div>:<div className="channels-empty-state"><strong>Nenhuma conta social conectada</strong><p>Conecte uma conta para ela aparecer aqui.</p></div>}
       <div className="channels-account-form-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Plus size={18}/></span><div><h3>Conectar uma rede desta empresa</h3><p>Escolha a rede e autorize a conta.</p></div></div><div className="channels-google-actions">{(["instagram","facebook","whatsapp"] as const).map(platform=><button key={platform} type="button" className="secondary-button" disabled={busy} onClick={()=>void connectSocial(platform)}>Conectar {platformName(platform)}</button>)}</div></div>
     </>:<p className="channels-form-note">Não foi possível confirmar a integração desta empresa. Tente atualizar novamente.</p>}
   </section>
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark" style={{background:"#4285F4",color:"#fff"}}>G</span><div><h2>Google Workspace</h2><p>Contas autorizadas nesta empresa</p></div><span className="channels-once-badge">{googleConnections.length?"Conectado":"Não conectado"}</span></div>
     {googleConnections.length?<div className="channels-connected-list">{googleConnections.map(account=><div className="channels-google-account" key={account.id}><strong>{account.email}</strong><div className="channels-google-service-actions"><button type="button" className="secondary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle(account.scopes.includes("drive")&&!account.scopes.includes("calendar")?"drive":"calendar")}>Reconectar</button><button type="button" className="secondary-button" disabled={googleBusy} onClick={()=>void forgetGoogle(account.id)}>Desconectar</button></div></div>)}</div>:<p className="channels-form-note">Nenhuma conta Google conectada nesta empresa.</p>}
     <div className="channels-google-actions"><button type="button" className="primary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle("calendar")}>{googleConnections.length?"Conectar outra conta":"Conectar Google"}</button></div>
   </section>
 </section>;
}
