"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, Check, CheckCircle2, ChevronRight, ExternalLink, Instagram, LoaderCircle, MessageCircle, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react";

type SocialAccount = { accountId: string; platform: string; username?: string; name?: string; status?: string; profileName?: string };
type Diagnostic = { configured: boolean; publicUrlConfigured: boolean; authenticated: boolean; accountCount: number; accounts: SocialAccount[]; checkedAt: string };
type Channel = { id: string; name: string; provider: string; status: string; platform?: string; accountId?: string; lastError?: string | null; createdAt?: string };
type Setup = { id: string; name: string; platform: string; accountId: string; webhookUrl: string | null; webhookSecret: string; webhookSetup: string };
const platformNames: Record<string,string> = { instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", whatsapp:"WhatsApp", tiktok:"TikTok", linkedin:"LinkedIn", youtube:"YouTube", threads:"Threads", pinterest:"Pinterest", x:"X", twitter:"X", reddit:"Reddit", bluesky:"Bluesky", telegram:"Telegram", discord:"Discord", snapchat:"Snapchat", googlebusiness:"Google Business" };
const platformColors: Record<string,string> = { instagram:"#D9468D", facebook:"#1877F2", messenger:"#168AFF", whatsapp:"#159B75", tiktok:"#20242B", linkedin:"#0A66C2", youtube:"#E53935", threads:"#303030", pinterest:"#BD081C", x:"#111827", twitter:"#111827", reddit:"#FF4500", bluesky:"#1685FE", telegram:"#229ED9", discord:"#5865F2", snapchat:"#E5C900", googlebusiness:"#4285F4" };
async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); const body=await response.json().catch(()=>({})); if(!response.ok) throw new Error(Array.isArray(body.message)?body.message.join(" "):body.message||body.error||"Não foi possível concluir a operação."); return body as T; }
function platformName(platform:string){return platformNames[platform.toLowerCase()]||platform;}
function platformColor(platform:string){return platformColors[platform.toLowerCase()]||"#6258DF";}
function statusText(status?:string){const s=(status||"").toUpperCase();if(["CONNECTED","ACTIVE","HEALTHY","CONNECTED"].includes(s))return "Conectada";if(["ERROR","FAILED","DISCONNECTED","REVOKED"].includes(s))return "Precisa de atenção";if(["CONNECTING","PENDING"].includes(s))return "Em validação";return status||"Registrada";}
export function ChannelsIntegrations(){
 const [diagnostic,setDiagnostic]=useState<Diagnostic|null>(null);
 const [channels,setChannels]=useState<Channel[]>([]);
 const [loading,setLoading]=useState(true);
 const [checking,setChecking]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [name,setName]=useState("");
 const [selectedAccount,setSelectedAccount]=useState("");
 const [manualAccountId,setManualAccountId]=useState("");
 const [platform,setPlatform]=useState("instagram");
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
     if(showFeedback)setNotice(diag.authenticated?"Conexão com a Zernio validada com sucesso.":"A configuração da Zernio precisa de atenção.");
   }catch(e){setError(e instanceof Error?e.message:"Não foi possível verificar a integração.");}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const socialAccounts=useMemo(()=>diagnostic?.accounts||[],[diagnostic]);
 const chosen=socialAccounts.find(a=>a.accountId===selectedAccount);
 useEffect(()=>{if(chosen){setPlatform(chosen.platform.toLowerCase());setName(chosen.name||chosen.username||platformName(chosen.platform));setManualAccountId(chosen.accountId);}},[selectedAccount]);
 async function validate(){setChecking(true);setError("");setNotice("");try{const diag=await api<Diagnostic>("/api/backend/channels/zernio/diagnostics");setDiagnostic(diag);setNotice(diag.authenticated?"Integração validada: a Véxora autenticou na Zernio e consultou as contas.":"A Zernio não confirmou a autenticação. Confira os secrets do servidor.");}catch(e){setError(e instanceof Error?e.message:"Falha na validação da Zernio.");}finally{setChecking(false);}}
 async function connectAccount(event:React.FormEvent){event.preventDefault();const accountId=(chosen?.accountId||manualAccountId).trim();const accountName=name.trim()||chosen?.username||chosen?.name||platformName(platform);if(!accountId||!accountName){setError("Selecione uma conta disponível ou informe o ID da conta Zernio.");return;}setBusy(true);setError("");setNotice("");setSetup(null);setSecretVisible(false);
   try{const result=await api<Setup>("/api/backend/channels/zernio",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:accountName,platform:(chosen?.platform||platform)==="twitter"?"x":(chosen?.platform||platform),accountId})});setSetup(result);setSecretVisible(true);setChannels(await api<Channel[]>("/api/backend/channels"));setNotice("Conta vinculada à Véxora. Falta configurar e testar o webhook para validar o recebimento.");setSelectedAccount("");setName("");setManualAccountId("");}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível vincular a conta.");}finally{setBusy(false);}
 }
 const linkedIds=new Set(channels.filter(c=>c.provider==="ZERNIO").map(c=>c.accountId).filter(Boolean));
 const linkedCount=channels.filter(c=>c.provider==="ZERNIO").length;
 async function copyWebhook(){if(!setup)return;try{await navigator.clipboard.writeText("URL: "+(setup.webhookUrl||"")+"\nSegredo de assinatura: "+setup.webhookSecret);setCopied(true);}catch{setError("O navegador bloqueou a cópia. Selecione e copie os dados manualmente.");}}
 return <section className="channels-page">
   <header className="channels-page-heading"><div><p className="eyebrow">OPERAÇÃO · CANAIS</p><h1>Canais e integrações</h1><p className="page-subtitle">Conecte suas redes sociais, acompanhe cada vínculo e prepare as mensagens para a caixa de atendimento.</p></div><button type="button" className="secondary-button channels-refresh" onClick={()=>void refresh(true)} disabled={loading}><RefreshCw size={15} className={loading?"channels-spin":""}/> Atualizar status</button></header>
   {error?<div className="channels-alert error" role="alert"><AlertCircle size={17}/><span>{error}</span><button type="button" onClick={()=>setError("")} aria-label="Fechar aviso">×</button></div>:null}
   {notice?<div className="channels-alert success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Fechar aviso">×</button></div>:null}
   <div className="channels-summary-grid">
     <article className="channels-summary-card"><span className="channels-summary-icon"><ShieldCheck size={19}/></span><div><small>Integração Zernio</small><strong>{loading?"Verificando…":diagnostic?.authenticated?"Validada":"Aguardando validação"}</strong><p>{diagnostic?.authenticated?"Autenticação confirmada pelo servidor":"A chave permanece protegida no servidor"}</p></div><span className={"channels-status-dot "+(diagnostic?.authenticated?"online":"pending")}/></article>
     <article className="channels-summary-card"><span className="channels-summary-icon"><Activity size={19}/></span><div><small>Contas na Zernio</small><strong>{diagnostic?diagnostic.accountCount:"—"}</strong><p>Contas retornadas pela integração</p></div></article>
     <article className="channels-summary-card"><span className="channels-summary-icon"><MessageCircle size={19}/></span><div><small>Vínculos na Véxora</small><strong>{linkedCount}</strong><p>Preparados para receber eventos</p></div></article>
   </div>
   <section className="content-card channels-provider-card">
     <div className="channels-section-heading"><span className="channels-provider-mark">Z</span><div><h2>Conexão com a Zernio</h2><p>Validação segura da configuração do servidor e das contas disponíveis.</p></div><a href="https://zernio.com/dashboard" target="_blank" rel="noreferrer" className="channels-external-link">Abrir Zernio <ExternalLink size={14}/></a></div>
     <div className="channels-checklist">
       <div className="channels-check-row"><span className={diagnostic?.configured?"check-ok":"check-pending"}>{diagnostic?.configured?<Check size={14}/>:<AlertCircle size={14}/>}</span><div><strong>Chave da API no servidor</strong><p>{diagnostic?.configured?"Configurada sem expor seu conteúdo.":"Não detectada ou ainda não verificada."}</p></div></div>
       <div className="channels-check-row"><span className={diagnostic?.publicUrlConfigured?"check-ok":"check-pending"}>{diagnostic?.publicUrlConfigured?<Check size={14}/>:<AlertCircle size={14}/>}</span><div><strong>URL pública para webhooks</strong><p>{diagnostic?.publicUrlConfigured?"Endereço público configurado.":"Configure API_PUBLIC_URL no serviço da API para gerar o webhook."}</p></div></div>
       <div className="channels-check-row"><span className={diagnostic?.authenticated?"check-ok":"check-pending"}>{diagnostic?.authenticated?<Check size={14}/>:<AlertCircle size={14}/>}</span><div><strong>Autenticação com a Zernio</strong><p>{diagnostic?.authenticated?"A API respondeu à consulta de validação.":"Execute a validação para confirmar as credenciais."}</p></div></div>
     </div>
     <div className="channels-validation-footer"><p><ShieldCheck size={15}/> A chave secreta nunca é enviada ao navegador nem exibida nesta tela.</p><button type="button" className="primary-button" onClick={()=>void validate()} disabled={checking||loading}>{checking?<><LoaderCircle size={15} className="channels-spin"/> Validando…</>:<><RefreshCw size={15}/> Validar integração</>}</button></div>
   </section>
   <section className="channels-work-grid">
     <section className="content-card channels-account-form-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Plus size={18}/></span><div><h2>Adicionar conta à Véxora</h2><p>Selecione uma conta que já esteja conectada à Zernio.</p></div></div>
       <div className="channels-form-note"><AlertCircle size={16}/><p>Primeiro conecte a rede social no painel da Zernio. Depois, selecione a conta aqui para vinculá-la ao tenant da Véxora.</p></div>
       <form className="channels-form" onSubmit={connectAccount}>
         <label><span>Conta disponível na Zernio</span><select value={selectedAccount} onChange={e=>{setSelectedAccount(e.target.value);const account=socialAccounts.find(a=>a.accountId===e.target.value);if(account){setPlatform(account.platform.toLowerCase());setName(account.name||account.username||platformName(account.platform));setManualAccountId(account.accountId);}}}><option value="">Selecione uma conta…</option>{socialAccounts.filter(a=>["instagram","facebook","messenger","whatsapp","tiktok","linkedin","youtube","threads","pinterest","x","twitter"].includes(a.platform.toLowerCase())).map(a=><option key={a.accountId} value={a.accountId} disabled={linkedIds.has(a.accountId)}>{platformName(a.platform)} · {a.username||a.name||a.accountId}{linkedIds.has(a.accountId)?" (já vinculada)":""}</option>)}</select></label>
         <div className="channels-form-two"><label><span>Nome de exibição</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Instagram Rastreabem" maxLength={100}/></label><label><span>Rede social</span><select value={platform} onChange={e=>setPlatform(e.target.value)}>{["instagram","facebook","messenger","whatsapp","tiktok","linkedin","youtube","threads","pinterest","x"].map(key=><option key={key} value={key}>{platformName(key)}</option>)}</select></label></div>
         {!selectedAccount?<label><span>ID da conta Zernio <small>(alternativa manual)</small></span><input value={manualAccountId} onChange={e=>setManualAccountId(e.target.value)} placeholder="ID da conta fornecido pela Zernio" maxLength={200}/></label>:null}
         <button type="submit" className="primary-button channels-submit" disabled={busy||(!selectedAccount&&!manualAccountId.trim())||!name.trim()}>{busy?<><LoaderCircle size={15} className="channels-spin"/> Vinculando…</>:<><Plus size={16}/> Vincular conta</>}</button>
       </form>
     </section>
     <section className="content-card channels-flow-card"><div className="channels-section-heading"><span className="channels-heading-icon"><MessageCircle size={18}/></span><div><h2>Chegada de mensagens</h2><p>O caminho entre a rede social e o atendimento.</p></div></div>
       <ol className="channels-flow-list"><li className="complete"><span>1</span><div><strong>Conta social conectada na Zernio</strong><p>Autorização e permissões da rede social.</p></div></li><li className={linkedCount?"complete":""}><span>2</span><div><strong>Conta vinculada à Véxora</strong><p>Associa a conta à empresa correta.</p></div></li><li className={setup?"pending-step":"pending-step"}><span>3</span><div><strong>Webhook configurado e assinado</strong><p>Entrega eventos com verificação de assinatura.</p></div></li><li><span>4</span><div><strong>Mensagem recebida na caixa</strong><p>Validação real com uma mensagem de teste.</p></div></li></ol>
       <div className="channels-flow-note"><Activity size={15}/><span>Vínculo criado não significa que o webhook já foi testado. O status só será considerado concluído após validar o evento real.</span></div>
     </section>
   </section>
   {setup?<section className="content-card channels-webhook-card"><div className="channels-section-heading"><span className="channels-heading-icon"><ShieldCheck size={18}/></span><div><h2>Configurar webhook desta conta</h2><p>O segredo abaixo é o segredo de assinatura do webhook, não a chave geral da API.</p></div><span className="channels-once-badge">Exibido uma vez</span></div>
      <div className="channels-webhook-fields"><div><label>URL de webhook</label><code>{setup.webhookUrl||"Defina API_PUBLIC_URL no servidor e atualize a integração."}</code></div><div><label>Segredo de assinatura</label><div className="channels-secret-line"><code>{secretVisible?setup.webhookSecret:"••••••••••••••••••••••••••••••••"}</code><button type="button" className="secondary-button" onClick={()=>setSecretVisible(v=>!v)}>{secretVisible?"Ocultar":"Mostrar"}</button></div></div></div>
      <p className="channels-webhook-warning"><AlertCircle size={15}/> Guarde esse segredo no painel de webhooks da Zernio. Ele não poderá ser recuperado nesta tela depois que você sair.</p>
      <button type="button" className="secondary-button" onClick={()=>void copyWebhook()}>{copied?<Check size={15}/>:<Plus size={15}/>} {copied?"Dados copiados":"Copiar URL e segredo"}</button>
      <p className="channels-webhook-instructions">{setup.webhookSetup}</p>
   </section>:null}
   <section className="content-card channels-connected-card"><div className="channels-section-heading"><span className="channels-heading-icon"><Activity size={18}/></span><div><h2>Contas vinculadas</h2><p>Estado atual das conexões registradas nesta empresa.</p></div><span className="channels-count">{linkedCount}</span></div>
     {channels.filter(c=>c.provider==="ZERNIO").length?<div className="channels-connected-list">{channels.filter(c=>c.provider==="ZERNIO").map(c=><article className="channels-connected-row" key={c.id}><span className="channels-platform-icon" style={{background:platformColor(c.platform||"social")}}>{(platformName(c.platform||"Rede social").slice(0,1)).toUpperCase()}</span><div className="channels-connected-main"><strong>{c.name}</strong><p>{platformName(c.platform||"Rede social")} · {c.accountId||"ID protegido"} · {statusText(c.status)}</p></div><span className={"channels-connection-pill "+(c.status==="CONNECTED"?"good":"attention")}><span/> {statusText(c.status)}</span><ChevronRight size={16} className="channels-row-chevron"/></article>)}</div>:<div className="channels-empty-state"><span><Unplug size={22}/></span><strong>Nenhuma conta vinculada ainda</strong><p>Depois de validar a configuração, as contas aparecerão aqui com seu estado de conexão.</p><button type="button" className="secondary-button" onClick={()=>document.querySelector(".channels-account-form-card")?.scrollIntoView({behavior:"smooth",block:"center"})}>Vincular primeira conta <ChevronRight size={15}/></button></div>}
   </section>
   <p className="channels-updated-at">Última verificação: {diagnostic?.checkedAt?new Date(diagnostic.checkedAt).toLocaleString("pt-BR"):"ainda não verificada"} · Nenhuma conta foi conectada automaticamente.</p>
 </section>;
}
