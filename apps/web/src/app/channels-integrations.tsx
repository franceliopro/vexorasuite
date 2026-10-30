"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, RefreshCw, Instagram, Facebook, MessageCircle, CalendarDays, HardDrive } from "lucide-react";

type Diagnostic = { configured: boolean; publicUrlConfigured: boolean; webhookSecretConfigured?:boolean; teamWebhookUrl?:string|null; authenticated: boolean; profileConfigured?:boolean; providerStatus?:number; providerCode?:string; providerReason?:string; dashboardUrl?:string; accountCount: number; accounts: {accountId:string;platform:string;username?:string;name?:string;status?:string;profileName?:string}[]; checkedAt: string; message?: string; diagnosticStage?: string; tenantKind?: "PLATFORM"|"COMPANY" };

const platformNames: Record<string,string> = { instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", whatsapp:"WhatsApp", tiktok:"TikTok", linkedin:"LinkedIn", youtube:"YouTube", threads:"Threads", pinterest:"Pinterest", x:"X", twitter:"X", reddit:"Reddit", bluesky:"Bluesky", telegram:"Telegram", discord:"Discord", snapchat:"Snapchat", googlebusiness:"Google Business" };
const platformColors: Record<string,string> = { instagram:"#D9468D", facebook:"#1877F2", messenger:"#168AFF", whatsapp:"#159B75", tiktok:"#20242B", linkedin:"#0A66C2", youtube:"#E53935", threads:"#303030", pinterest:"#BD081C", x:"#111827", twitter:"#111827", reddit:"#FF4500", bluesky:"#1685FE", telegram:"#229ED9", discord:"#5865F2", snapchat:"#E5C900", googlebusiness:"#4285F4" };
async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); const body=await response.json().catch(()=>({})); if(!response.ok) { if(response.status===401) throw new Error("Sua sessão da Véxora expirou ou não foi encontrada. Entre novamente na Véxora para verificar a integração Zernio."); const detail=body?.message&&typeof body.message==="object"?body.message:null; const message=Array.isArray(body.message)?body.message.join(" "):typeof body.message==="string"?body.message:detail?.message||body.error||"Não foi possível concluir a operação."; const suffix=detail?.dashboardUrl?` Abra a página de cobrança da Zernio: ${detail.dashboardUrl}`:""; throw new Error(message+suffix); } return body as T; }
function platformName(platform:string){return platformNames[platform.toLowerCase()]||platform;}
function platformColor(platform:string){return platformColors[platform.toLowerCase()]||"#6258DF";}
function PlatformIcon({platform,size=18}:{platform:string;size?:number}){
 const value=platform.toLowerCase();
 if(value==="instagram")return <Instagram size={size} strokeWidth={2.2}/>;
 if(value==="facebook"||value==="messenger")return <Facebook size={size} strokeWidth={2.2}/>;
 return <MessageCircle size={size} strokeWidth={2.2}/>;
}
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
 type InboxRow = { id:string; name:string; provider:string; platform:string; status:string; identity?:string|null; departmentName?:string|null; routing:{mode:string;departmentId?:string|null;targetType?:string;targetId?:string|null;revision?:string|null}; };
 const [inboxes,setInboxes]=useState<InboxRow[]>([]);
 const [inboxDepartments,setInboxDepartments]=useState<{id:string;name:string}[]>([]);
 const [inboxAgents,setInboxAgents]=useState<{id:string;name:string;email?:string}[]>([]);
 const [inboxAiAgents,setInboxAiAgents]=useState<{id:string;name:string}[]>([]);
 const [inboxBusy,setInboxBusy]=useState(false);
 const [editingInbox,setEditingInbox]=useState<string|null>(null);
 const [renameValues,setRenameValues]=useState<Record<string,string>>({});
 const loadInboxes=useCallback(async()=>{
   try{const result=await api<{inboxes:InboxRow[];departments:{id:string;name:string}[]}>("/api/backend/channels/inboxes");setInboxes(result.inboxes);setInboxDepartments(result.departments);const [agents,ai]=await Promise.all([api<{id:string;name:string;email?:string}[]>("/api/backend/conversations/assignees").catch(()=>[]),api<{agents?:{id:string;name:string}[]}>("/api/backend/assistant/config").catch(()=>({agents:[]}))]);setInboxAgents(agents);setInboxAiAgents(Array.isArray(ai.agents)?ai.agents:[]);}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar as inboxes.");}
 },[]);

 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async(showFeedback=false)=>{
   if(refreshing.current)return;refreshing.current=true;
   setLoading(true);setError("");
   try{
     const diag=await api<Diagnostic>("/api/backend/channels/zernio/sync",{method:"POST"});
     setDiagnostic(diag);
     if(showFeedback)setNotice(diag.authenticated?"Conexões desta empresa atualizadas.":diag.providerStatus===402?`A Zernio bloqueou novas conexões por cobrança (${diag.providerReason||diag.providerCode||"PAYMENT_REQUIRED"}). Verifique a forma de pagamento na Zernio.`:"A integração Zernio ainda não está pronta para novas conexões.");
   }catch(e){setDiagnostic(null);setError(e instanceof Error?e.message:"Não foi possível verificar a integração.");}
   finally{setLoading(false);refreshing.current=false;}
 },[]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const result=params.get("google");if(result==="connected")setNotice("Conta Google autorizada com sucesso. A conexão está disponível nesta empresa.");else if(result)setError("A autorização Google não foi concluída ("+result+"). Tente conectar novamente.");const social=params.get("zernio");if(social==="connected")setNotice("Conta social autorizada e vinculada a esta empresa.");else if(social)setError("Não foi possível concluir o OAuth da Zernio ("+social+"). Tente novamente.");if(result||social){const url=new URL(window.location.href);url.searchParams.delete("google");url.searchParams.delete("zernio");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);void refresh(true);}},[refresh]);
 useEffect(()=>{void refresh();void loadInboxes();void api<{configured:boolean;encryptionConfigured:boolean;status:string;callbackUrl:string|null}>("/api/backend/integrations/google/config").then(setGoogleConfig).catch(()=>setGoogleConfig(null));void api<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>("/api/backend/integrations/google/connections").then(setGoogleConnections).catch(()=>{});},[refresh]);
 async function connectGoogle(service:"calendar"|"drive"){setGoogleBusy(true);setError("");try{const result=await api<{authorizationUrl:string}>("/api/backend/integrations/google/start/"+service,{method:"POST"});window.location.assign(result.authorizationUrl);}catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização Google.");setGoogleBusy(false);}}
 async function disconnectGoogleService(id:string,service:"calendar"|"drive"){if(!window.confirm("Desconectar somente o Google "+(service==="calendar"?"Agenda":"Drive")+"? O outro serviço permanecerá conectado."))return;setGoogleBusy(true);try{await api("/api/backend/integrations/google/connections/"+encodeURIComponent(id)+"/services/"+service,{method:"DELETE"});setGoogleConnections(rows=>rows.map(row=>row.id===id?{...row,disabledServices:[...new Set([...(row.disabledServices||[]),service])]}:row));setNotice("Serviço desconectado. A outra integração foi preservada.");}catch(e){setError(e instanceof Error?e.message:"Falha ao desconectar serviço.");}finally{setGoogleBusy(false);}}
 async function forgetGoogle(id:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.filter(a=>a.id!==id));setNotice('Conta desconectada removida da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}
 async function forgetGoogleService(id:string,service:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/services/'+service+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.map(a=>a.id===id?{...a,disabledServices:[...a.disabledServices,'hidden:'+service]}:a));setNotice('Serviço desconectado removido da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}


 async function reconnectInbox(inbox:InboxRow){
   setInboxBusy(true);setError("");
   try{
     if(inbox.provider==="ZERNIO"){const result=await api<{authorizationUrl:string}>("/api/backend/channels/zernio/oauth/start/"+encodeURIComponent(inbox.platform),{method:"POST"});window.location.assign(result.authorizationUrl);return;}
     await api("/api/backend/channels/"+encodeURIComponent(inbox.id)+"/connect",{method:"POST"});await loadInboxes();setNotice("Reconexão iniciada.");
   }catch(e){setError(e instanceof Error?e.message:"Não foi possível reconectar a inbox.");}finally{setInboxBusy(false);}
 }
 async function disconnectInbox(inbox:InboxRow){
   if(!window.confirm("Desconectar a inbox "+inbox.name+"? O histórico das conversas será preservado."))return;
   setInboxBusy(true);setError("");try{await api("/api/backend/channels/"+encodeURIComponent(inbox.id)+"/disconnect",{method:"POST"});await loadInboxes();setNotice("Inbox desconectada. O histórico foi preservado.");}catch(e){setError(e instanceof Error?e.message:"Não foi possível desconectar a inbox.");}finally{setInboxBusy(false);}
 }
 async function deleteInbox(inbox:InboxRow){
   if(!window.confirm("Remover a inbox "+inbox.name+"? O histórico das conversas será preservado, mas a inbox deixará de aparecer."))return;
   setInboxBusy(true);setError("");try{await api("/api/backend/channels/"+encodeURIComponent(inbox.id),{method:"DELETE"});setInboxes(rows=>rows.filter(row=>row.id!==inbox.id));setNotice("Inbox removida. O histórico foi preservado.");}catch(e){setError(e instanceof Error?e.message:"Não foi possível remover a inbox.");}finally{setInboxBusy(false);}
 }
 async function renameInbox(id:string){
   const name=(renameValues[id]||"").trim();if(!name)return;
   setInboxBusy(true);setError("");
   try{const updated=await api<{id:string;name:string}>("/api/backend/channels/"+encodeURIComponent(id),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({name})});setInboxes(rows=>rows.map(row=>row.id===id?{...row,name:updated.name}:row));setNotice("Nome da inbox atualizado.");}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível renomear a inbox.");}
   finally{setInboxBusy(false);}
 }
 async function saveInbox(id:string,mode:string,departmentId:string|null,targetType:string,targetId:string|null,revision?:string|null){
   setInboxBusy(true);setError("");
   try{const updated=await api<InboxRow>("/api/backend/channels/"+encodeURIComponent(id)+"/inbox",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mode,departmentId:departmentId||null,targetType,targetId:targetId||null,expectedRevision:revision??null})});setInboxes(rows=>rows.map(row=>row.id===id?updated:row));setEditingInbox(null);setNotice("Inbox atualizada.");}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar a inbox.");}
   finally{setInboxBusy(false);}
 }
 async function connectSocial(platform:"instagram"|"facebook"|"whatsapp"){
   setBusy(true);setError("");setNotice("");
   try{const result=await api<{authorizationUrl:string}>("/api/backend/channels/zernio/oauth/start/"+platform,{method:"POST"});window.location.assign(result.authorizationUrl);}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização OAuth.");setBusy(false);}
 }
 const linkedAccounts=diagnostic?.authenticated?diagnostic.accounts:[];
 return <section className="channels-page">
   {error?<div className="channels-alert error" role="alert"><AlertCircle size={17}/><span>{error}</span><button type="button" onClick={()=>setError("")} aria-label="Fechar aviso">×</button></div>:null}
   {notice?<div className="channels-alert success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Fechar aviso">×</button></div>:null}
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark">Z</span><div><h2>Canais sociais</h2><p>{loading?"Atualizando conexões…":diagnostic?.authenticated?"Contas desta empresa": "Não foi possível confirmar as contas agora"}</p></div><button type="button" className="secondary-button" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={15}/> Atualizar</button></div>
     {diagnostic?.authenticated?<>
       {linkedAccounts.length?<div className="channels-connected-list">{linkedAccounts.map(account=><div className="channels-connected-row" key={account.accountId}><span className="channels-platform-icon channels-platform-icon-large" style={{background:platformColor(account.platform)}}><PlatformIcon platform={account.platform} size={20}/></span><div className="channels-connected-main"><strong>{account.username?"@"+account.username.replace(/^@/,""):account.name||platformName(account.platform)}</strong><p>{platformName(account.platform)} · {statusText(account.status)}</p></div></div>)}</div>:<div className="channels-empty-state"><strong>Nenhuma conta social conectada</strong><p>Conecte uma conta para ela aparecer aqui.</p></div>}
       <div className="channels-account-form-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Plus size={18}/></span><div><h3>Conectar uma rede desta empresa</h3><p>Escolha a rede e autorize a conta.</p></div></div><div className="channels-google-actions">{(["instagram","facebook","whatsapp"] as const).map(platform=><button key={platform} type="button" className="secondary-button" disabled={busy} onClick={()=>void connectSocial(platform)}>Conectar {platformName(platform)}</button>)}</div></div>
     </>:<p className="channels-form-note">Não foi possível confirmar a integração desta empresa. Tente atualizar novamente.</p>}
   </section>
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark">I</span><div><h2>Inboxes da empresa</h2><p>Cada número ou conta fica separado para receber conversas, IA e automações.</p></div><button type="button" className="secondary-button" onClick={()=>void loadInboxes()} disabled={inboxBusy}><RefreshCw size={15}/> Atualizar</button></div>
     {inboxes.length?<div className="channels-inbox-grid">{inboxes.map(inbox=><article className="channels-inbox-card" key={inbox.id}><div className="channels-inbox-title"><div><input className="channels-inbox-name" aria-label={"Nome da inbox "+inbox.name} value={renameValues[inbox.id]??inbox.name} onChange={e=>setRenameValues(values=>({...values,[inbox.id]:e.target.value}))} onBlur={()=>{if((renameValues[inbox.id]??inbox.name).trim()!==inbox.name)void renameInbox(inbox.id);}}/><p><span className="channels-platform-icon channels-platform-icon-large" style={{background:platformColor(inbox.platform)}}><PlatformIcon platform={inbox.platform} size={20}/></span>{platformName(inbox.platform)} · {inbox.identity||"Identidade não confirmada"} · {statusText(inbox.status)}</p></div><button type="button" className="secondary-button" onClick={()=>setEditingInbox(editingInbox===inbox.id?null:inbox.id)}>Configurar</button></div><small className="channels-inbox-route">{inbox.routing.mode==="HUMAN"?"Atendimento humano":inbox.routing.mode==="AUTOMATION"?"Automação":"Configuração da empresa"}{inbox.departmentName?" · "+inbox.departmentName:""}</small><div className="channels-inbox-actions"><button type="button" className="text-button" disabled={inboxBusy} onClick={()=>void reconnectInbox(inbox)}>Reconectar</button><button type="button" className="text-button" disabled={inboxBusy} onClick={()=>void disconnectInbox(inbox)}>Desconectar</button><button type="button" className="text-button danger-text" disabled={inboxBusy} onClick={()=>void deleteInbox(inbox)}>Remover</button></div>
       {editingInbox===inbox.id?<div className="channels-inbox-editor"><label>Atendimento<select defaultValue={inbox.routing.mode} id={"mode-"+inbox.id}><option value="INHERIT">Configuração da empresa</option><option value="AUTOMATION">Automação</option><option value="HUMAN">Atendimento humano</option></select></label><label>Destino<select defaultValue={inbox.routing.targetType||"DEPARTMENT"} id={"target-type-"+inbox.id}><option value="DEPARTMENT">Departamento</option><option value="USER">Atendente</option><option value="AI">Agente de IA</option><option value="AUTOMATION">Fluxo de automação</option></select></label><label>Escolha<select defaultValue={inbox.routing.targetId||""} id={"target-id-"+inbox.id}><option value="">Selecione um destino</option>{inbox.routing.targetType==="USER"?inboxAgents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>):inbox.routing.targetType==="AI"?inboxAiAgents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>):inboxDepartments.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label><button type="button" className="primary-button" disabled={inboxBusy} onClick={()=>{const mode=(document.getElementById("mode-"+inbox.id) as HTMLSelectElement).value;const departmentId=(document.getElementById("department-"+inbox.id) as HTMLSelectElement|null)?.value||null;const targetType=(document.getElementById("target-type-"+inbox.id) as HTMLSelectElement).value;const targetId=(document.getElementById("target-id-"+inbox.id) as HTMLSelectElement).value||null;void saveInbox(inbox.id,mode,departmentId,targetType,targetId,inbox.routing.revision);}}>Salvar</button></div>:null}</article>)}</div>:<p className="channels-form-note">Nenhuma inbox conectada nesta empresa. Conecte uma rede ou crie um WhatsApp WAHA.</p>}
   </section>
   <section className="channels-google-grid">
     {(["calendar","drive"] as const).map(service=>{
       const rows=googleConnections.filter(account=>account.scopes.toLowerCase().includes(service));
       const isCalendar=service==="calendar";
       return <article className="content-card channels-google-card channels-inbox-card" key={service}>
         <div className="channels-section-heading"><span className="channels-platform-icon channels-platform-icon-large" style={{background:isCalendar?"#4285F4":"#0F9D58"}}>{isCalendar?<CalendarDays size={20}/>:<HardDrive size={20}/>}</span><div><h2>{isCalendar?"Google Agenda":"Google Drive"}</h2><p>{rows.length?"Conta conectada":"Nenhuma conta conectada"}</p></div><span className="channels-once-badge">{rows.length?"Conectado":"Não conectado"}</span></div>
         {rows.length?<div className="channels-connected-list">{rows.map(account=><div className="channels-google-account" key={account.id}><strong>{account.email}</strong><div className="channels-google-service-actions"><button type="button" className="secondary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle(service)}>Reconectar</button><button type="button" className="secondary-button" disabled={googleBusy} onClick={()=>void forgetGoogleService(account.id,service)}>Desconectar</button></div></div>)}</div>:<p className="channels-form-note">Conecte uma conta para usar o {isCalendar?"Agenda":"Drive"} nesta empresa.</p>}
         <div className="channels-google-actions"><button type="button" className="primary-button" disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle(service)}>{rows.length?"Conectar outra conta":"Conectar "+(isCalendar?"Agenda":"Drive")}</button></div>
       </article>;
     })}
   </section>
 </section>;
}
