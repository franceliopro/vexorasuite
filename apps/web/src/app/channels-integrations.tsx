"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AsaasSettings } from "./asaas-settings";
import { PaymentProvidersSettings } from "./payment-providers-settings";
import { VexoraDialog } from "./vexora-dialog";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  RefreshCw,
  CalendarDays,
  HardDrive,
  Mail as MailIcon,
  X,
  Check,
  Plug,
} from "lucide-react";
import { GoogleGlyph } from "./brand-glyph";
import { PlatformIcon, platformLabel, platformColor } from "./platform-icon";

const primaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-900 shadow-token-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton="inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-gray-200 bg-zinc-200 px-4 text-body font-bold text-slate-950 shadow-token-sm transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60";
const textButton="inline-flex min-h-8 items-center justify-center px-1.5 text-body font-bold text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const dangerTextButton="inline-flex min-h-8 items-center justify-center px-1.5 text-body font-bold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const pageTw="flex flex-col gap-pad";
const connectionsLayoutTw="grid grid-cols-1 items-start gap-token xl:grid-cols-2";
const connectionsColumnTw="grid min-w-0 content-start gap-token";
const headingTw="flex flex-wrap items-center justify-between gap-token pt-0.5";
const eyebrowTw="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-800";
const sectionTw="grid content-start gap-3 rounded-token border border-gray-200 bg-zinc-100 p-pad shadow-token";
const sectionHeadingTw="flex items-center justify-start gap-3 border-b border-gray-200 pb-3";
const sectionHeadingTitleTw="m-0 text-h4 font-extrabold tracking-tight text-slate-950";
const providerMarkTw="grid h-8 w-8 flex-none place-items-center text-slate-600";
const metricTw="ml-auto inline-grid h-channels-metric min-w-channels-metric place-items-center rounded-fm-pill bg-blue-50 px-2 text-2xs font-extrabold tabular-nums text-blue-800";
const formTw="grid gap-3";
const formLabelTw="grid gap-1.5 text-2xs font-extrabold uppercase tracking-wider text-slate-600";
const formInputTw="min-h-control w-full min-w-0 rounded-token-sm border border-gray-200 bg-zinc-100 px-2.5 py-1.5 text-channels-field text-slate-950 placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25";
const formNoteTw="text-small text-slate-600";
const shortcutsTw="flex flex-wrap items-center gap-2";
const alertErrorTw="flex items-center gap-2.5 rounded-channels-alert border border-red-600 bg-red-100 px-3.5 py-3 text-channels-field text-red-600";
const alertSuccessTw="flex items-center gap-2.5 rounded-channels-alert border border-emerald-600 bg-emerald-100 px-3.5 py-3 text-channels-field text-emerald-600";
const alertCloseTw="ml-auto grid place-items-center text-current";
const inboxGridTw="grid grid-cols-channels-inbox gap-3";
const inboxCardTw="grid gap-2.5 rounded-channels-card border border-gray-200 bg-zinc-100 p-3.5 shadow-token transition-transform hover:-translate-y-0.5 hover:shadow-token-lg";
const inboxTitleTw="flex items-center justify-between gap-3";
const inboxNameTw="truncate text-channels-name font-extrabold tracking-tight text-slate-950";
const inboxNameInputTw="min-h-8 w-full min-w-0 truncate rounded-lg border border-transparent bg-transparent px-2 text-channels-name font-extrabold tracking-tight text-slate-950 hover:border-gray-200 hover:bg-zinc-200 focus:border-blue-600 focus:bg-zinc-100 focus:shadow-token focus:outline-hidden";
const inboxMetaTw="flex min-w-0 items-center gap-2.5 text-channels-meta text-slate-600";
const inboxPlatformTw="grid h-channels-icon-lg w-channels-icon-lg flex-none place-items-center";
const inboxRouteTw="text-xs text-slate-600";
const inboxActionsTw="flex flex-wrap gap-1.5 border-t border-gray-200 pt-1";
const statusPillTw="inline-flex min-h-6 items-center gap-1 rounded-fm-pill bg-blue-50 px-2.5 text-small font-bold text-blue-800";
const settingsToggleTw="flex cursor-pointer items-start gap-2.5 border-b border-gray-200 py-2 last:border-b-0";
const googleGridTw="grid grid-cols-channels-google gap-3";
const googleCardTw="grid content-start gap-2.5 rounded-channels-card border border-gray-200 bg-zinc-100 p-3.5 shadow-token transition-transform hover:-translate-y-0.5 hover:shadow-token-lg";
const connectedListTw="grid gap-2";
const googleAccountTw="flex items-center justify-between gap-2.5 rounded-channels-account border border-gray-200 bg-zinc-100 px-3 py-2.5 text-small";
const renewableWarningTw="mt-0.5 block text-2xs font-semibold leading-relaxed text-amber-600";
const googleAccountActionsTw="flex flex-wrap justify-end gap-2";
const editorTw="grid gap-3";
const helpTw="overflow-hidden rounded-channels-help border border-blue-600 bg-blue-50";
const helpSummaryTw="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-channels-meta font-bold text-blue-800";
const helpBodyTw="grid gap-3 p-3.5 text-small leading-relaxed text-slate-600";
const attachFieldsetTw="ml-0 mr-0 mt-5 mb-1 grid gap-2 rounded-channels-help border border-gray-200 px-3 pb-3 pt-2.5";
const attachLegendTw="px-1 text-2xs font-bold uppercase tracking-wider text-slate-600";
const attachGridTw="grid grid-cols-channels-attach gap-2";
const attachToggleTw="flex min-h-control cursor-pointer select-none items-center gap-2 rounded-channels-attach border border-gray-200 bg-zinc-100 px-2.5 text-channels-field font-semibold text-slate-950";
const attachWarningTw="mt-0.5 rounded-channels-attach border border-amber-600 bg-amber-100 px-2.5 py-2 text-channels-meta leading-relaxed text-amber-600";
const qrTw="grid place-items-center rounded-token-sm bg-channels-qr p-4";

type Diagnostic = { configured: boolean; publicUrlConfigured: boolean; webhookSecretConfigured?:boolean; teamWebhookUrl?:string|null; authenticated: boolean; profileConfigured?:boolean; providerStatus?:number; providerCode?:string; providerReason?:string; dashboardUrl?:string; accountCount: number; accounts: {accountId:string;platform:string;username?:string;name?:string;status?:string;profileName?:string}[]; checkedAt: string; message?: string; diagnosticStage?: string; tenantKind?: "PLATFORM"|"COMPANY" };

const ATTACHMENT_SERVICES = ["INBOX", "IA", "CHATBOT", "SITE"] as const;
function savedAttachments(value?: Record<string, boolean> | null): Record<string, boolean> {
  return Object.fromEntries(ATTACHMENT_SERVICES.map(service => [service, value?.[service] === true]));
}

async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); let body:Record<string,any>={}; try{body=await response.json();}catch{if(response.ok)throw new Error("A Véxora recebeu uma resposta inválida do servidor.");} if(!response.ok) { if(response.status===401) throw new Error("Sua sessão da Véxora expirou ou não foi encontrada. Entre novamente na Véxora para verificar a integração Zernio."); const detail=body?.message&&typeof body.message==="object"?body.message:null; const message=Array.isArray(body.message)?body.message.join(" "):typeof body.message==="string"?body.message:detail?.message||body.error||"Não foi possível concluir a operação."; const suffix=detail?.dashboardUrl?` Abra a página de cobrança da Zernio: ${detail.dashboardUrl}`:""; throw new Error(message+suffix); } return body as T; }
function mailBrandColor(host:string){const value=(host||"").toLowerCase();if(value.includes("gmail")||value.includes("google"))return "#EA4335";if(value.includes("outlook")||value.includes("office365")||value.includes("office.com"))return "#0067B8";if(value.includes("yahoo"))return "#5F01D1";return "#475569";}
function statusText(status?:string){const s=(status||"").toUpperCase();if(["CONNECTED","ACTIVE","HEALTHY"].includes(s))return "Conectada";if(["ERROR","FAILED","DISCONNECTED","REVOKED"].includes(s))return "Precisa de atenção";if(["CONNECTING","PENDING"].includes(s))return "Em validação";if(s==="UNKNOWN")return "Conexão não confirmada";return status||"Registrada";}
function EmailMailboxSettings(){
 const [rows,setRows]=useState<Array<{id:string;address:string;imapHost:string;imapPort:number;imapSecure:boolean;imapUser:string;imapMailbox:string;smtpHost:string|null;smtpPort:number|null;smtpSecure:boolean|null;smtpUser:string|null;smtpFrom:string|null;smtpFromName:string|null;status:string;lastError:string|null;lastSyncAt:string|null}>>([]);
 const [loading,setLoading]=useState(true);
 const [open,setOpen]=useState(false),[editingId,setEditingId]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const blankForm={name:"",address:"",imapHost:"imap.gmail.com",imapPort:"993",imapSecure:true,imapUser:"",imapPassword:"",imapMailbox:"INBOX",smtpHost:"smtp.gmail.com",smtpPort:"587",smtpSecure:false,smtpUser:"",smtpPassword:"",smtpFrom:"",smtpFromName:""};
 const [form,setForm]=useState(blankForm);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const data=await api<{mailboxes:typeof rows}>("/api/backend/mailboxes");setRows(data.mailboxes||[]);}catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar as caixas de e-mail agora. Verifique as credenciais do servidor de e-mail e tente novamente; se o problema continuar, avise a administração.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load()},[load]);
 const startEdit=(row:typeof rows[number])=>{setEditingId(row.id);setForm({name:row.address,address:row.address,imapHost:row.imapHost,imapPort:String(row.imapPort),imapSecure:row.imapSecure,imapUser:"",imapPassword:"",imapMailbox:row.imapMailbox,smtpHost:row.smtpHost||"",smtpPort:String(row.smtpPort||587),smtpSecure:row.smtpSecure??false,smtpUser:row.smtpUser||"",smtpPassword:"",smtpFrom:row.smtpFrom||row.address,smtpFromName:row.smtpFromName||""});setOpen(true);};
 const update=(key:string,value:string|boolean)=>setForm(current=>({...current,[key]:value}));
 async function saveMailbox(){setBusy(true);setError("");try{const endpoint=editingId?"/api/backend/mailboxes/"+editingId:"/api/backend/mailboxes";await api(endpoint,{method:editingId?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,imapPort:Number(form.imapPort),smtpPort:Number(form.smtpPort),smtpFrom:form.smtpFrom||form.address})});setNotice(editingId?"Configuração da caixa atualizada. Valide novamente o IMAP antes de sincronizar.":"Caixa cadastrada. Valide a conexão IMAP antes de sincronizar.");setOpen(false);setEditingId(null);setForm(blankForm);await load();}catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar a caixa agora. Verifique os dados de acesso (IMAP/SMTP) e tente novamente; a caixa não foi alterada.");}finally{setBusy(false)}}
 async function action(id:string,kind:"verify"|"sync"){setBusy(true);setError("");try{const result=await api<{ok?:boolean;imported?:number;detail?:string}>("/api/backend/mailboxes/"+id+"/"+kind,{method:"POST"});if(result.ok===false)throw new Error(result.detail||"A conexão IMAP falhou.");setNotice(kind==="verify"?"Conexão IMAP validada.":"Sincronização concluída: "+(result.imported||0)+" mensagem(ns) nova(s).");await load();}catch(e){setError(e instanceof Error?e.message:"Não foi possível concluir a operação.");}finally{setBusy(false)}}
 return <section className={sectionTw}><div className={sectionHeadingTw}><span className={providerMarkTw} style={{color:"#EA4335"}}><MailIcon size={17} aria-hidden="true" /></span><div><h2 className={sectionHeadingTitleTw}>Caixas de e-mail</h2><p>IMAP recebe conversas no Atendimento; SMTP envia as respostas pela mesma caixa.</p></div><button type="button" className={secondaryButton} onClick={()=>{setEditingId(null);setForm(blankForm);setOpen(value=>!value)}}>{open?"Fechar":"Adicionar caixa"}</button>{rows.length?<span className={metricTw}>{rows.length}</span>:null}</div>
 {error?<p className={formNoteTw} role="alert">{error}</p>:null}{notice?<p className={formNoteTw} role="status">{notice}</p>:null}
 {open?<div className={formTw}><h3 className={sectionHeadingTitleTw}>{editingId?"Editar caixa de e-mail":"Adicionar caixa de e-mail"}</h3><label className={formLabelTw}>Nome<input className={formInputTw} value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Ex.: Atendimento comercial"/></label><label className={formLabelTw}>Endereço da caixa<input className={formInputTw} type="email" value={form.address} onChange={e=>update("address",e.target.value)} placeholder="atendimento@empresa.com"/></label><label className={formLabelTw}>Servidor IMAP<input className={formInputTw} value={form.imapHost} onChange={e=>update("imapHost",e.target.value)} placeholder="imap.gmail.com"/></label><label className={formLabelTw}>Porta IMAP<input className={formInputTw} type="number" min="1" max="65535" value={form.imapPort} onChange={e=>update("imapPort",e.target.value)}/></label><label className={settingsToggleTw}><input className="h-4 w-4 flex-none accent-blue-600" type="checkbox" checked={form.imapSecure} onChange={e=>update("imapSecure",e.target.checked)}/><span>IMAP seguro (TLS)</span></label><label className={formLabelTw}>Pasta IMAP<input className={formInputTw} value={form.imapMailbox} onChange={e=>update("imapMailbox",e.target.value)} placeholder="INBOX"/></label><label className={formLabelTw}>Usuário IMAP<input className={formInputTw} value={form.imapUser} onChange={e=>update("imapUser",e.target.value)} placeholder="igual ao endereço"/></label><label className={formLabelTw}>Senha/app password IMAP{editingId?<small> Deixe em branco para manter a senha atual.</small>:null}<input className={formInputTw} type="password" value={form.imapPassword} onChange={e=>update("imapPassword",e.target.value)} autoComplete="new-password"/></label><label className={formLabelTw}>Servidor SMTP<input className={formInputTw} value={form.smtpHost} onChange={e=>update("smtpHost",e.target.value)} placeholder="smtp.gmail.com"/></label><label className={formLabelTw}>Porta SMTP<input className={formInputTw} type="number" min="1" max="65535" value={form.smtpPort} onChange={e=>update("smtpPort",e.target.value)}/></label><label className={settingsToggleTw}><input className="h-4 w-4 flex-none accent-blue-600" type="checkbox" checked={form.smtpSecure} onChange={e=>update("smtpSecure",e.target.checked)}/><span>SMTP seguro (TLS direto)</span></label><label className={formLabelTw}>Usuário SMTP<input className={formInputTw} value={form.smtpUser} onChange={e=>update("smtpUser",e.target.value)} placeholder="igual ao endereço"/></label><label className={formLabelTw}>Senha/app password SMTP{editingId?<small> Deixe em branco para manter a senha atual.</small>:null}<input className={formInputTw} type="password" value={form.smtpPassword} onChange={e=>update("smtpPassword",e.target.value)} autoComplete="new-password"/></label><label className={formLabelTw}>Remetente SMTP<input className={formInputTw} type="email" value={form.smtpFrom} onChange={e=>update("smtpFrom",e.target.value)} placeholder="igual ao endereço"/></label><label className={formLabelTw}>Nome do remetente<input className={formInputTw} value={form.smtpFromName} onChange={e=>update("smtpFromName",e.target.value)} placeholder="Atendimento da empresa"/></label><div className={inboxActionsTw}><button type="button" className={textButton} onClick={()=>{setOpen(false);setEditingId(null)}}>Cancelar</button><button type="button" className={primaryButton} disabled={busy||!form.address||!form.imapHost||(!editingId&&!form.imapPassword)} onClick={()=>void saveMailbox()}>{busy?"Salvando…":editingId?"Salvar alterações":"Salvar caixa"}</button></div></div>:null}
 {loading?<p className={formNoteTw} role="status">Carregando caixas de e-mail…</p>:rows.length?<div className={inboxGridTw}>{rows.map(row=><article className={inboxCardTw} key={row.id}><div className={inboxTitleTw}><div><strong className={inboxNameTw}>{row.address}</strong><p className={inboxMetaTw}><span className={inboxPlatformTw} style={{color:mailBrandColor(row.imapHost)}}><MailIcon size={22}/></span> E-mail · {row.imapHost}:{row.imapPort} · {statusText(row.status)}</p></div><span className={statusPillTw}>{statusText(row.status)}</span></div><small className={inboxRouteTw}>{row.lastError||"Nenhuma falha registrada."}</small><div className={inboxActionsTw}><button type="button" className={secondaryButton} disabled={busy} onClick={()=>startEdit(row)}>Editar</button><button type="button" className={secondaryButton} disabled={busy} onClick={()=>void action(row.id,"verify")}>Validar IMAP/SMTP</button><button type="button" className={textButton} disabled={busy||row.status!=="CONNECTED"} onClick={()=>void action(row.id,"sync")}>Sincronizar agora</button></div></article>)}</div>:<p className={formNoteTw}>Nenhuma caixa de e-mail cadastrada.</p>}
 </section>
}

function GmailOAuthMailboxSettings(){
 const [mailboxes,setMailboxes]=useState<{id:string;address:string;authMode:string;googleConnectionId:string|null;status:string}[]>([]);
 const [accounts,setAccounts]=useState<{id:string;email:string;scopes:string}[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async()=>{try{const [boxes,connections]=await Promise.all([api<{mailboxes:{id:string;address:string;authMode:string;googleConnectionId:string|null;status:string}[]}>('/api/backend/mailboxes'),api<{id:string;email:string;scopes:string}[]>('/api/backend/integrations/google/connections')]);setMailboxes(boxes.mailboxes||[]);setAccounts((connections||[]).filter(a=>a.scopes.includes('https://mail.google.com/')));}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o Gmail agora. Verifique a conexão Google em Conexões; se continuar falhando, a administração precisa renovar a autorização.');}},[]);
 useEffect(()=>{void load()},[load]);
 async function connect(){setBusy(true);setError('');try{const result=await api<{authorizationUrl:string}>('/api/backend/integrations/google/start/gmail',{method:'POST'});window.location.assign(result.authorizationUrl);}catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a autorização Gmail.');setBusy(false);}}
  async function linkGmailOAuth(mailbox:{id:string;address:string},account:{id:string;email:string}){setBusy(true);setError('');try{await api('/api/backend/mailboxes/'+mailbox.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({address:mailbox.address,authMode:'GOOGLE_OAUTH',googleConnectionId:account.id,imapPassword:'',smtpPassword:'',imapUser:mailbox.address,smtpUser:mailbox.address})});setNotice('OAuth Gmail vinculado à caixa '+mailbox.address+'.');await load();}catch(e){setError(e instanceof Error?e.message:'Não foi possível vincular o Gmail.');}finally{setBusy(false);}}
 const compatible=mailboxes.flatMap(mailbox=>accounts.filter(account=>account.email.toLowerCase()===mailbox.address.toLowerCase()).map(account=>({mailbox,account})));
  return <article className={googleCardTw}><div className={sectionHeadingTw}><span className={inboxPlatformTw} style={{color:"#EA4335"}}><GoogleGlyph size={19}/></span><div><h3 className={sectionHeadingTitleTw}>Gmail</h3><p>{compatible.length?"OAuth Gmail disponível para estas caixas":"Autorize o Gmail da caixa sem senha de app"}</p></div></div>{error?<p className={formNoteTw} role="alert">{error}</p>:null}{notice?<p className={formNoteTw} role="status">{notice}</p>:null}{compatible.length?<div className={connectedListTw}>{compatible.map(({mailbox,account})=><div className={googleAccountTw} key={mailbox.id}><div className="grid min-w-0 gap-0.5"><strong>{mailbox.address}</strong><small>Conta Google: {account.email}</small></div>{mailbox.authMode!=='GOOGLE_OAUTH'?<button type="button" className={secondaryButton} disabled={busy} onClick={()=>void linkGmailOAuth(mailbox,account)}>Usar OAuth</button>:<span className={statusPillTw}>OAuth ativo</span>}</div>)}</div>:<p className={formNoteTw}>Autorize um Gmail com o mesmo endereço da caixa para habilitar OAuth. Outlook, Hostinger e HostGator continuam usando IMAP/SMTP próprio.</p>}<button type="button" className={primaryButton} disabled={busy} onClick={()=>void connect()}>Autorizar Gmail</button></article>;
}

function ZernioByoCard({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<{ source: "tenant" | "server" | null; tenantConfigured: boolean; updatedAt: string | null; webhookUrl: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [byoSecret, setByoSecret] = useState<{ secret: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const s = await api<{ source: "tenant" | "server" | null; tenantConfigured: boolean; updatedAt: string | null; webhookUrl: string | null }>("/api/backend/channels/zernio/setup");
      setStatus(s);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler a configuração do Zernio desta empresa."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const enable = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await api<{ ok: boolean; webhookSecret: string; webhookUrl: string | null; message: string }>("/api/backend/channels/zernio/setup", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: apiKey.trim() }) });
      setByoSecret({ secret: res.webhookSecret, url: res.webhookUrl || "" });
      setNotice("Pronto! Agora cole o segredo no painel do seu Zernio (Webhooks).");
      setApiKey("");
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a conta Zernio."); }
    finally { setBusy(false); }
  };
  const disable = async () => {
    if (!window.confirm("Desativar a conta Zernio própria e voltar para a conta compartilhada da Véxora (se existir)?")) return;
    setBusy(true); setError("");
    try {
      await api("/api/backend/channels/zernio/setup", { method: "DELETE" });
      setNotice("Conta própria desativada — voltando para a conta compartilhada (se houver).");
      setByoSecret(null);
      await load();
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível desativar."); }
    finally { setBusy(false); }
  };
  return <section className={sectionTw}><div className={sectionHeadingTw}><span className={providerMarkTw} style={{ color: "var(--primary)" }}><Plug size={16} aria-hidden="true" /></span><div><h2 className={sectionHeadingTitleTw}>Minha conta Zernio</h2><p>A Zernio dá 2 conexões grátis por conta — use a conta do seu cliente, sem pagar por ele, e ofereça 2 redes + WhatsApp no seu plano.</p></div></div>
    {error ? <p className={formNoteTw} role="alert">{error}</p> : null}
    {notice ? <p className={formNoteTw} role="status">{notice}</p> : null}
    {byoSecret ? <div className={formTw}><h3 className={sectionHeadingTitleTw}>Segredo do webhook (copie agora)</h3><label className={formLabelTw}><span>URL do webhook — cole no painel do seu Zernio</span><input className={formInputTw} readOnly value={byoSecret.url} onFocus={e => e.currentTarget.select()} /></label><label className={formLabelTw}><span>Segredo — cole no painel do seu Zernio</span><input className={formInputTw} readOnly value={byoSecret.secret} onFocus={e => e.currentTarget.select()} /></label><div className={inboxActionsTw}><button type="button" className={secondaryButton} onClick={() => navigator.clipboard?.writeText(byoSecret.secret).catch(() => undefined)}>Copiar segredo</button><button type="button" className={textButton} onClick={() => setByoSecret(null)}>Fechar</button></div><p className={formNoteTw}>O segredo só aparece agora. Se perder, clique em “Voltar para a conta compartilhada” e ative de novo para gerar outro — e substitua no seu Zernio.</p></div> : null}
    {status?.tenantConfigured ? <div className={inboxActionsTw}><p className={formNoteTw}>A conta Zernio desta empresa está ativa (própria).{status.updatedAt ? " Atualizada em " + new Date(status.updatedAt).toLocaleDateString("pt-BR") + "." : ""}</p><button type="button" className={secondaryButton} disabled={busy} onClick={() => void disable()}>{busy ? "Desativando…" : "Voltar para a conta compartilhada"}</button></div>
      : <div className={formTw}><h3 className={sectionHeadingTitleTw}>Ativar a conta Zernio de vocês</h3><p className={formNoteTw}>Sem chave própria, as conexões sociais usam a conta compartilhada da Véxora (se houver). Com a sua chave: 2 redes grátis por conta Zernio, sem custo para a Véxora por cliente.</p><label className={formLabelTw}><span>Chave da API do seu Zernio</span><input className={formInputTw} type="password" autoComplete="new-password" placeholder="cole a chave do seu painel Zernio" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label><div className={inboxActionsTw}><button type="button" className={primaryButton} disabled={busy || apiKey.trim().length < 12 || loading} onClick={() => void enable()}>{busy ? "Ativando…" : "Ativar minha conta Zernio"}</button></div></div>}
  </section>;
}

function MetaOficialCard({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<{ id: string; name: string; webhookUrl: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const connect = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await api<{ id: string; name: string; provider: string; status: string; webhookUrl: string }>("/api/backend/channels/meta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "WhatsApp Oficial", phoneNumberId: phoneNumberId.trim(), wabaId: wabaId.trim(), accessToken: accessToken.trim(), appSecret: appSecret.trim() }),
      });
      setConnected({ id: created.id, name: created.name, webhookUrl: created.webhookUrl });
      setNotice("Canal conectado. Copie o endereço do webhook abaixo e configure no painel do Meta (veja instruções).");
      setName(""); setPhoneNumberId(""); setWabaId(""); setAccessToken(""); setAppSecret("");
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível conectar o WhatsApp Oficial."); }
    finally { setBusy(false); }
  };
  return <section className={sectionTw}><div className={sectionHeadingTw}><span className={providerMarkTw} style={{ color: "#25D366" }}><Plug size={16} aria-hidden="true" /></span><div><h2 className={sectionHeadingTitleTw}>WhatsApp Oficial (Meta Cloud API)</h2><p>Conecte o número oficial da sua empresa pelo app dela no Meta — sem depender de QR code e com status de entrega (enviado/entregue/lido).</p></div></div>
    {error ? <p className={formNoteTw} role="alert">{error}</p> : null}
    {notice ? <p className={formNoteTw} role="status">{notice}</p> : null}
    {connected ? <div className={formTw}><h3 className={sectionHeadingTitleTw}>Pronto! Agora configure o webhook no Meta</h3><label className={formLabelTw}><span>URL do webhook — cole no painel do app Meta (WhatsApp → Configuration → Webhook)</span><input className={formInputTw} readOnly value={connected.webhookUrl} onFocus={e => e.currentTarget.select()} /></label><div className={inboxActionsTw}><button type="button" className={secondaryButton} onClick={() => navigator.clipboard?.writeText(connected.webhookUrl).catch(() => undefined)}>Copiar URL</button><button type="button" className={textButton} onClick={() => setConnected(null)}>Fechar</button></div><p className={formNoteTw}>No app do Meta: WhatsApp → Configuration → Webhook → atualize com a URL acima e o verify token que você define no botão abaixo. Em seguida, assine os eventos <strong>messages</strong>.</p></div> : null}
    <div className={formTw}>
      <h3 className={sectionHeadingTitleTw}>Conectar número oficial</h3>
      <label className={formLabelTw}><span>Nome da conexão</span><input className={formInputTw} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: WhatsApp Comercial — Oficial" maxLength={100} /></label>
      <label className={formLabelTw}><span>Phone Number ID (Meta → WhatsApp → API Setup)</span><input className={formInputTw} inputMode="numeric" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 123456789012345" maxLength={25} /></label>
      <label className={formLabelTw}><span>WhatsApp Business Account ID</span><input className={formInputTw} inputMode="numeric" value={wabaId} onChange={e => setWabaId(e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 123456789012345" maxLength={25} /></label>
      <label className={formLabelTw}><span>Token de acesso permanente (System User)</span><input className={formInputTw} type="password" autoComplete="new-password" placeholder="EAA..." value={accessToken} onChange={e => setAccessToken(e.target.value)} /></label>
      <label className={formLabelTw}><span>App Secret (do app Meta — WhatsApp → Configuration)</span><input className={formInputTw} type="password" autoComplete="new-password" placeholder="segredo do app Meta" value={appSecret} onChange={e => setAppSecret(e.target.value)} /></label>
      <p className={formNoteTw}>Precisa de: app próprio no Meta (developers.facebook.com), número oficial no Business Manager (com verificação empresarial) e um System User com permissão whatsapp_business_messaging + whatsapp_business_management. O token ao lado é gerado no System Users do Meta Business.</p>
      <div className={inboxActionsTw}><button type="button" className={primaryButton} disabled={busy || phoneNumberId.length < 5 || wabaId.length < 5 || accessToken.trim().length < 40 || appSecret.trim().length < 10} onClick={() => void connect()}>{busy ? "Validando no Meta…" : "Conectar WhatsApp Oficial"}</button></div>
    </div>
  </section>;
}

export function ChannelsIntegrations(){
 const [diagnostic,setDiagnostic]=useState<Diagnostic|null>(null);
 const [loading,setLoading]=useState(true);
 const refreshing=useRef(false);
 const [googleConfig,setGoogleConfig]=useState<{configured:boolean;encryptionConfigured?:boolean;status:string;callbackUrl:string|null}|null>(null);
 const [googleConnections,setGoogleConnections]=useState<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>([]);
 const [googleBusy,setGoogleBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 type InboxRow = { id:string; name:string; provider:string; platform:string; status:string; identity?:string|null; departmentName?:string|null; attachments?:Record<string,boolean>; routing:{mode:string;departmentId?:string|null;targetType?:string;targetId?:string|null;revision?:string|null}; };
 type WhatsAppTemplate = { name:string; language:string; category:string|null };
 const [templateCatalog,setTemplateCatalog]=useState<{ channelName:string; templates:WhatsAppTemplate[] }|null>(null);
 const [inboxes,setInboxes]=useState<InboxRow[]>([]);
 const [inboxDepartments,setInboxDepartments]=useState<{id:string;name:string}[]>([]);
 const [inboxAgents,setInboxAgents]=useState<{id:string;name:string;email?:string}[]>([]);
 const [inboxAiAgents,setInboxAiAgents]=useState<{id:string;name:string}[]>([]);
 const [inboxBusy,setInboxBusy]=useState(false);
 const [wahaName,setWahaName]=useState("");
 const [wahaSetup,setWahaSetup]=useState<{id:string;name:string;status:string;qrDataUrl?:string;error?:string}|null>(null);
 const [connectionPlatform,setConnectionPlatform]=useState<"waha"|"instagram"|"facebook"|"whatsapp">("waha");
 const [editingInbox,setEditingInbox]=useState<string|null>(null);
 const [targetTypes,setTargetTypes]=useState<Record<string,string>>({});
 const [renameValues,setRenameValues]=useState<Record<string,string>>({});
  const loadInboxes=useCallback(async()=>{
   try{
    const [result,channels]=await Promise.all([
     api<{inboxes:InboxRow[];departments:{id:string;name:string}[]}>("/api/backend/channels/inboxes"),
     api<{id:string;attachments?:Record<string,boolean>}[]>("/api/backend/channels").catch(()=>[]),
    ]);
    const saved=new Map(channels.map(channel=>[channel.id,channel.attachments]));
    setInboxes(result.inboxes.map(row=>({...row,attachments:savedAttachments(saved.has(row.id)?saved.get(row.id):row.attachments)})));
    setInboxDepartments(result.departments);
    const [agents,ai]=await Promise.all([api<{id:string;name:string;email?:string}[]>("/api/backend/conversations/assignees"),api<{agents?:{id:string;name:string}[]}>("/api/backend/assistant/config")]);
    setInboxAgents(agents);setInboxAiAgents(Array.isArray(ai.agents)?ai.agents:[]);
   }
   catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar os canais agora. Verifique a conexão e recarregue; se continuar falhando, a administração precisa conferir as credenciais do WhatsApp.");}
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
 useEffect(()=>{void refresh();void loadInboxes();void Promise.all([api<{configured:boolean;encryptionConfigured:boolean;status:string;callbackUrl:string|null}>("/api/backend/integrations/google/config"),api<{id:string;email:string;scopes:string;disabledServices:string[];renewable:boolean}[]>("/api/backend/integrations/google/connections")]).then(([config,connections])=>{setGoogleConfig(config);setGoogleConnections(connections);}).catch(e=>setError(e instanceof Error?e.message:"Não foi possível carregar as conexões Google agora. A autorização pode ter expirado; a administração precisa renová-la em Conexões."));},[refresh,loadInboxes]);
 async function connectGoogle(service:"calendar"|"drive"){setGoogleBusy(true);setError("");try{const result=await api<{authorizationUrl:string}>("/api/backend/integrations/google/start/"+service,{method:"POST"});window.location.assign(result.authorizationUrl);}catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização Google.");setGoogleBusy(false);}}
 async function forgetGoogleService(id:string,service:string){setGoogleBusy(true);try{await api('/api/backend/integrations/google/connections/'+id+'/services/'+service+'/forget',{method:'DELETE'});setGoogleConnections(rows=>rows.map(a=>a.id===id?{...a,disabledServices:[...a.disabledServices,'hidden:'+service]}:a));setNotice('Serviço desconectado removido da lista.')}catch(e){setError(e instanceof Error?e.message:'Falha ao remover')}finally{setGoogleBusy(false)}}


 async function showWhatsAppTemplates(inbox:InboxRow){
   setInboxBusy(true);setError("");
   try {
     const {templates}=await api<{templates:WhatsAppTemplate[]}>("/api/backend/channels/"+encodeURIComponent(inbox.id)+"/whatsapp/templates");
     setTemplateCatalog({channelName:inbox.name,templates});
   } catch(e) {
     setError(e instanceof Error?e.message:"Não foi possível consultar os templates aprovados.");
   } finally {
     setInboxBusy(false);
   }
 }

 async function reconnectInbox(inbox:InboxRow){
   setInboxBusy(true);setError("");
   try{
     if(inbox.provider==="ZERNIO"){const result=await api<{authorizationUrl:string}>("/api/backend/channels/zernio/oauth/start/"+encodeURIComponent(inbox.platform),{method:"POST"});window.location.assign(result.authorizationUrl);return;}
     await api("/api/backend/channels/"+encodeURIComponent(inbox.id)+"/connect",{method:"POST"});await loadInboxes();setNotice("Reconexão iniciada.");
   }catch(e){setError(e instanceof Error?e.message:"Não foi possível reconectar a inbox.");}finally{setInboxBusy(false);}
 }
 async function disconnectInbox(inbox:InboxRow){
   if(!window.confirm("Desconectar o canal "+inbox.name+"? O histórico das conversas será preservado."))return;
   setInboxBusy(true);setError("");try{await api("/api/backend/channels/"+encodeURIComponent(inbox.id)+"/disconnect",{method:"POST"});await loadInboxes();setNotice("Canal desconectado. O histórico foi preservado.");}catch(e){setError(e instanceof Error?e.message:"Não foi possível desconectar a inbox.");}finally{setInboxBusy(false);}
 }
 async function deleteInbox(inbox:InboxRow){
   if(!window.confirm("Remover o canal "+inbox.name+"? O histórico das conversas será preservado, mas o canal deixará de aparecer."))return;
   setInboxBusy(true);setError("");try{await api("/api/backend/channels/"+encodeURIComponent(inbox.id),{method:"DELETE"});setInboxes(rows=>rows.filter(row=>row.id!==inbox.id));setNotice("Canal removido. O histórico foi preservado.");}catch(e){setError(e instanceof Error?e.message:"Não foi possível remover a inbox.");}finally{setInboxBusy(false);}
 }
 async function renameInbox(id:string){
   const name=(renameValues[id]||"").trim();if(!name)return;
   setInboxBusy(true);setError("");
   try{const updated=await api<{id:string;name:string}>("/api/backend/channels/"+encodeURIComponent(id),{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({name})});setInboxes(rows=>rows.map(row=>row.id===id?{...row,name:updated.name}:row));setNotice("Nome do canal atualizado.");}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível renomear a inbox.");}
   finally{setInboxBusy(false);}
 }
 async function toggleAttachment(inbox:InboxRow,service:string,attached:boolean){
  setError("");
  try{await api<{id:string;service:string;attached:boolean}>("/api/backend/channels/"+encodeURIComponent(inbox.id)+"/attachments",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({service,attached})});setInboxes(rows=>rows.map(row=>row.id===inbox.id?{...row,attachments:{...(row.attachments||{}),[service]:attached}}:row));if(service==="CHATBOT"||service==="IA")setNotice(attached?"Robô ativado para este número — o fluxo publicado passa a responder.":"Robô desligado para este número.")}
  catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar este serviço.")}
 } async function saveInbox(id:string,mode:string,departmentId:string|null,targetType:string,targetId:string|null,revision?:string|null){
   setInboxBusy(true);setError("");
   try{await api("/api/backend/channels/"+encodeURIComponent(id)+"/inbox",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mode,departmentId:departmentId||null,targetType,targetId:targetId||null,expectedRevision:revision??null})});await loadInboxes();setEditingInbox(null);setNotice("Canal atualizado.");}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar a inbox.");}
   finally{setInboxBusy(false);}
 }
 async function openWahaSetup(id:string,name:string){setInboxBusy(true);setError("");setWahaSetup({id,name,status:"LOADING"});try{const status=await api<{status:string}>("/api/backend/channels/"+encodeURIComponent(id)+"/status");if(status.status==="CONNECTED"){setWahaSetup({id,name,status:status.status});setNotice("WhatsApp conectado.");}else{const qr=await api<{qrDataUrl:string}>("/api/backend/channels/"+encodeURIComponent(id)+"/qr");setWahaSetup({id,name,status:status.status,qrDataUrl:qr.qrDataUrl});}}catch(e){const message=e instanceof Error?e.message:"Não foi possível abrir o QR Code do WhatsApp.";setWahaSetup({id,name,status:"ERROR",error:message});setError(message);}finally{setInboxBusy(false);}}
 async function createWaha(){const name=wahaName.trim();if(!name){setError("Informe o nome da nova inbox.");return;}setInboxBusy(true);setError("");try{const created=await api<{id:string;name:string;status:string}>("/api/backend/channels/waha",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name})});setWahaName("");await loadInboxes();setNotice("WhatsApp criado. Escaneie o QR Code para conectar.");await openWahaSetup(created.id,created.name);}catch(e){setError(e instanceof Error?e.message:"Não foi possível criar a conexão WhatsApp.");}finally{setInboxBusy(false);}}
 async function connectSelected(){
   if(connectionPlatform==="waha"){await createWaha();return;}
   setBusy(true);setError("");setNotice("");
   try{const result=await api<{authorizationUrl:string}>("/api/backend/channels/zernio/oauth/start/"+connectionPlatform,{method:"POST"});window.location.assign(result.authorizationUrl);}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização.");setBusy(false);}
 }
 async function connectSocial(platform:"instagram"|"facebook"|"whatsapp"){
   setBusy(true);setError("");setNotice("");
   try{const result=await api<{authorizationUrl:string}>("/api/backend/channels/zernio/oauth/start/"+platform,{method:"POST"});window.location.assign(result.authorizationUrl);}
   catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a autorização OAuth.");setBusy(false);}
 }
 const visibleSocialAccounts=(diagnostic?.accounts||[]).filter(account=>!inboxes.some(inbox=>inbox.platform.toLowerCase()===account.platform.toLowerCase()&&((inbox.identity||"").replace(/^@/,"").toLowerCase()===(account.username||"").replace(/^@/,"").toLowerCase()||inbox.id===account.accountId)));
 return <section className={pageTw}>
 {error?<div className={alertErrorTw} role="alert"><AlertCircle size={17}/><span>{error}</span><button type="button" className={alertCloseTw} onClick={()=>setError("")} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button></div>:null}
 {notice?<div className={alertSuccessTw} role="status"><CheckCircle2 size={17}/><span>{notice}</span><button type="button" className={alertCloseTw} onClick={()=>setNotice("")} aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></button></div>:null}
  <div className={headingTw}><div><p className={eyebrowTw}>CANAIS DA EMPRESA</p><h1>Conexões</h1><p>Contas desta empresa, organizadas por provedor</p></div><button type="button" className={secondaryButton} onClick={()=>{void refresh(true);void loadInboxes();}} disabled={loading||inboxBusy}><RefreshCw size={15}/> Atualizar</button></div>
  <div className={connectionsLayoutTw}>
   <div className={connectionsColumnTw}>
  <div className={sectionTw}><div className={sectionHeadingTw}><span className={providerMarkTw}><Plug size={16} aria-hidden="true" /></span><div><h2 className={sectionHeadingTitleTw}>Conectar uma rede desta empresa</h2><p>Escolha uma rede e conecte uma nova conta ou número.</p></div></div>
  {diagnostic?.authenticated?<div className={formTw}><label className={formLabelTw}>Nome da conexão<input className={formInputTw} value={wahaName} onChange={e=>setWahaName(e.target.value)} placeholder="Ex.: WhatsApp Comercial" maxLength={100}/></label><label className={formLabelTw}>Rede<select className={formInputTw} value={connectionPlatform} onChange={e=>setConnectionPlatform(e.target.value as typeof connectionPlatform)}><option value="waha">WhatsApp · QR code</option><option value="whatsapp">WhatsApp · oficial</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label><button type="button" className={primaryButton} disabled={busy||inboxBusy||!wahaName.trim()} onClick={()=>void connectSelected()}>{connectionPlatform==="waha"?"Criar conexão":"Autorizar conta"}</button><div className={shortcutsTw}><span>Conectar rapidamente:</span><button type="button" className={textButton} disabled={busy} onClick={()=>void connectSocial("instagram")}>Conectar Instagram</button><button type="button" className={textButton} disabled={busy} onClick={()=>void connectSocial("facebook")}>Conectar Facebook</button><button type="button" className={textButton} disabled={busy} onClick={()=>void connectSocial("whatsapp")}>Conectar WhatsApp</button></div></div>:<p className={formNoteTw}>A autorização para novas conexões sociais ainda não foi confirmada. Os canais já cadastrados continuam visíveis abaixo; atualize para verificar novas contas.</p>}
  </div>
  <ZernioByoCard onChanged={() => { void refresh(); void loadInboxes(); }} />
  <MetaOficialCard onChanged={() => { void refresh(); void loadInboxes(); }} />
  <div className={sectionTw}><div className={sectionHeadingTw}><span className={providerMarkTw}><Check size={15} aria-hidden="true" /></span><div><h2 className={sectionHeadingTitleTw}>Canais conectados</h2><p>Esses canais podem receber conversas, IA e automações.</p></div><span className={metricTw}>{inboxes.length + visibleSocialAccounts.length}</span></div>
  {(inboxes.length||visibleSocialAccounts.length)?<div className={inboxGridTw}>{visibleSocialAccounts.map(account=><article className={inboxCardTw} key={"social-"+account.accountId}><div className={inboxTitleTw}><div><strong className={inboxNameTw}>{account.username?`@${account.username.replace(/^@/,"")}`:account.name||"Conta social"}</strong><p className={inboxMetaTw}><span className={inboxPlatformTw} style={{color:platformColor(account.platform)}}><PlatformIcon platform={account.platform} size={22}/></span>{platformLabel(account.platform)} · {statusText(account.status)}</p></div><span className={statusPillTw}>{statusText(account.status)}</span></div><small className={inboxRouteTw}>Conta social desta empresa</small></article>)}{inboxes.map(inbox=><article className={inboxCardTw} key={inbox.id}><div className={inboxTitleTw}><div><input className={inboxNameInputTw} aria-label={"Nome do canal "+inbox.name} value={renameValues[inbox.id]??inbox.name} onChange={e=>setRenameValues(values=>({...values,[inbox.id]:e.target.value}))} onBlur={()=>{if((renameValues[inbox.id]??inbox.name).trim()!==inbox.name)void renameInbox(inbox.id);}}/><p className={inboxMetaTw}><span className={inboxPlatformTw} style={{color:platformColor(inbox.platform)}}><PlatformIcon platform={inbox.platform} size={22}/></span>{platformLabel(inbox.platform)} · {inbox.identity||"Identidade não confirmada"} · {statusText(inbox.status)}</p></div><button type="button" className={secondaryButton} onClick={()=>setEditingInbox(editingInbox===inbox.id?null:inbox.id)}>Ajustar</button></div><small className={inboxRouteTw}>{inbox.routing.mode==="HUMAN"?"Atendimento humano":inbox.routing.mode==="AUTOMATION"?"Automação":"Configuração da empresa"}{inbox.departmentName?" · "+inbox.departmentName:""}</small><div className={inboxActionsTw}>{inbox.provider==="WAHA"?<button type="button" className={secondaryButton} disabled={inboxBusy} onClick={()=>void openWahaSetup(inbox.id,inbox.name)}>Ler QR Code</button>:null}{inbox.provider==="ZERNIO"&&inbox.platform.toLowerCase()==="whatsapp"&&inbox.status==="CONNECTED"?<button type="button" className={textButton} disabled={inboxBusy} onClick={()=>void showWhatsAppTemplates(inbox)}>Templates aprovados</button>:null}<button type="button" className={textButton} disabled={inboxBusy} onClick={()=>void reconnectInbox(inbox)}>Reconectar</button><button type="button" className={textButton} disabled={inboxBusy} onClick={()=>void disconnectInbox(inbox)}>Desconectar</button><button type="button" className={dangerTextButton} disabled={inboxBusy} onClick={()=>void deleteInbox(inbox)}>Remover</button></div>{editingInbox===inbox.id?<div className={editorTw}><details className={helpTw}><summary className={helpSummaryTw}><CircleHelp size={15} aria-hidden="true"/><span>O que cada opção faz (e um exemplo)</span></summary><div className={helpBodyTw}><section><h4 className={sectionHeadingTitleTw}>O que este número atende</h4><dl><div><dt>Atendimento</dt><dd>As conversas aparecem na caixa de entrada dos atendentes.<small>Ex.: sem marcar, ninguém da equipe vê quem pediu humano.</small></dd></div><div><dt>IA</dt><dd>Libera a IA da Véxora para responder livremente quando o fluxo pede.<small>Ex.: usado em fluxos com bloco “Agente de IA”.</small></dd></div><div><dt>Chatbot</dt><dd><strong>Obrigatório para o robô funcionar:</strong> o fluxo publicado responde o cliente sozinho.<small>Ex.: o cliente manda “oi” e recebe a saudação do fluxo.</small></dd></div><div><dt>Site</dt><dd>Conecta o balão de chat do seu site a este número.<small>Ex.: o visitante fala pelo site e a conversa cai aqui.</small></dd></div></dl></section><section><h4 className={sectionHeadingTitleTw}>Atendimento</h4><dl><div><dt>Configuração da empresa (recomendado)</dt><dd>O robô atende pelo fluxo publicado e só passa para gente quando o fluxo manda.<small>Ex.: o cliente conversa com o robô; quando pede, o robô transfere para o setor certo. É o modo normal do chatbot.</small></dd></div><div><dt>Automação</dt><dd>Quando o robô sai de cena, a conversa cai direto no destino escolhido abaixo, sem atendente pegar primeiro.<small>Ex.: pediu pagamento → cai direto em Financeiro.</small></dd></div><div><dt>Atendimento humano</dt><dd>O robô nunca responde; toda mensagem cai direto para a equipe humana.<small>Ex.: usar em linhas só humanas (pós-venda com gerente).</small></dd></div></dl></section><section><h4 className={sectionHeadingTitleTw}>Destino e Escolha</h4><dl><div><dt>Destino</dt><dd>Para onde a conversa vai quando o robô sai (ou quando o cliente pede humano): Departamento, Atendente, Agente de IA ou Fluxo de automação.<small>Ex.: Departamento — o mais comum.</small></dd></div><div><dt>Escolha</dt><dd>Qual objeto do destino acima receberá a conversa.<small>Ex.: “Atendimento”, “Financeiro”, “Comercial”. Pode deixar “Selecione um destino” para o modo padrão da empresa.</small></dd></div></dl></section><section><h4 className={sectionHeadingTitleTw}>Exemplo de aplicação (WhatsApp respondendo clientes)</h4><ol><li>Marque <strong>Chatbot</strong> em “O que este número atende”.</li><li><strong>Atendimento</strong> → “Configuração da empresa”.</li><li>Flow Studio → <strong>Publicar</strong> o fluxo incluindo este número.</li><li>Mande “oi” de outro celular — o robô responde pela saudação do fluxo.</li><li>Para transferir para gente: o cliente digita “atendente” (ou o fluxo decide) e a conversa cai no setor em “Escolha”.</li></ol></section></div></details><fieldset className={attachFieldsetTw}><legend className={attachLegendTw}>O que este número atende</legend><div className={attachGridTw}>{([["INBOX","Atendimento"],["IA","IA"],["CHATBOT","Chatbot"],["SITE","Site"]] as const).map(([service,label])=><label key={service} className={attachToggleTw}><input className="h-4 w-4 flex-none accent-blue-600" type="checkbox" checked={!!inbox.attachments?.[service]} onChange={e=>void toggleAttachment(inbox,service,e.target.checked)}/><span>{label}</span></label>)}</div>{!inbox.attachments?.CHATBOT && !inbox.attachments?.IA?<p className={attachWarningTw}>Robô desligado neste número — o cliente não recebe resposta automática. Ative o Chatbot (e a IA) para o fluxo publicado responder.</p>:null}</fieldset><label className={formLabelTw}>Atendimento<select className={formInputTw} defaultValue={inbox.routing.mode} id={"mode-"+inbox.id}><option value="INHERIT">Configuração da empresa</option><option value="AUTOMATION">Automação</option><option value="HUMAN">Atendimento humano</option></select></label><label className={formLabelTw}>Destino<select className={formInputTw} value={targetTypes[inbox.id]??inbox.routing.targetType??"DEPARTMENT"} onChange={e=>setTargetTypes(values=>({...values,[inbox.id]:e.target.value}))} id={"target-type-"+inbox.id}><option value="DEPARTMENT">Departamento</option><option value="USER">Atendente</option><option value="AI">Agente de IA</option><option value="AUTOMATION">Fluxo de automação</option></select></label><label className={formLabelTw}>Escolha<select className={formInputTw} defaultValue={inbox.routing.targetId||""} id={"target-id-"+inbox.id}><option value="">Selecione um destino</option>{(targetTypes[inbox.id]??inbox.routing.targetType??"DEPARTMENT")==="USER"?inboxAgents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>):(targetTypes[inbox.id]??inbox.routing.targetType??"DEPARTMENT")==="AI"?inboxAiAgents.map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>):inboxDepartments.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label><button type="button" className={primaryButton} disabled={inboxBusy} onClick={()=>{const mode=(document.getElementById("mode-"+inbox.id) as HTMLSelectElement).value;const targetType=(document.getElementById("target-type-"+inbox.id) as HTMLSelectElement).value;const targetId=(document.getElementById("target-id-"+inbox.id) as HTMLSelectElement).value||null;void saveInbox(inbox.id,mode,null,targetType,targetId,inbox.routing.revision);}}>Salvar</button></div>:null}</article>)}</div>:<p className={formNoteTw}>Nenhuma conexão encontrada. Adicione o primeiro canal acima.</p>}
  </div>
  </div>
   <div className={connectionsColumnTw}>
  <div className={sectionTw}><div className={sectionHeadingTw}><span className={providerMarkTw}><GoogleGlyph size={19}/></span><div><h2 className={sectionHeadingTitleTw}>Google</h2><p>Gmail, Agenda e Drive ficam juntos nesta área de conexões.</p></div><span className={metricTw}>{googleConnections.length}</span></div><div className={googleGridTw}><GmailOAuthMailboxSettings />{(["calendar","drive"] as const).map(service=>{const rows=googleConnections.filter(account=>account.scopes.toLowerCase().includes(service));const isCalendar=service==="calendar";return <article className={googleCardTw} key={service}><div className={sectionHeadingTw}><span className={inboxPlatformTw} style={{color:isCalendar?"#4285F4":"#0F9D58"}}>{isCalendar?<CalendarDays size={22}/>:<HardDrive size={22}/>}</span><div><h3 className={sectionHeadingTitleTw}>{isCalendar?"Google Agenda":"Google Drive"}</h3><p>{rows.length?"Conta conectada":"Nenhuma conta conectada"}</p></div></div>{rows.length?<div className={connectedListTw}>{rows.map(account=><div className={googleAccountTw} key={account.id}><strong>{account.email}</strong>{account.renewable===false?<small className={renewableWarningTw}>Sem autorização offline: a sincronização pode parar. Clique em Reconectar.</small>:null}<div className={googleAccountActionsTw}><button type="button" className={secondaryButton} disabled={googleBusy||!googleConfig?.configured} onClick={()=>void connectGoogle(service)}>Reconectar</button><button type="button" className={secondaryButton} disabled={googleBusy} onClick={()=>void forgetGoogleService(account.id,service)}>Desconectar</button></div></div>)}</div>:null}<button type="button" className={primaryButton} disabled={googleBusy||!googleConfig?.configured||!googleConfig.encryptionConfigured} onClick={()=>void connectGoogle(service)}>{rows.length?"Conectar outra conta":"Conectar "+(isCalendar?"Agenda":"Drive")}</button></article>})}</div></div>
  <EmailMailboxSettings />
  <AsaasSettings canConfigureAsaas={true} />
  <PaymentProvidersSettings canConfigure={true} />
  </div>
  </div>
 {templateCatalog&&<VexoraDialog open title="Templates aprovados" subtitle={templateCatalog.channelName} onClose={()=>setTemplateCatalog(null)}>
    {templateCatalog.templates.length?<ul>{templateCatalog.templates.map(template=><li key={template.name+"/"+template.language}><strong>{template.name}</strong> · {template.language}{template.category?" · "+template.category:""}</li>)}</ul>:<p>Nenhum template aprovado encontrado neste número.</p>}
  </VexoraDialog>}
  {wahaSetup&&<VexoraDialog open title="Conectar WhatsApp" subtitle={wahaSetup.name} onClose={()=>{if(!inboxBusy)setWahaSetup(null);}} footer={wahaSetup.status!=="ERROR"&&wahaSetup.status!=="LOADING"?<button type="button" className={secondaryButton} disabled={inboxBusy} onClick={()=>void openWahaSetup(wahaSetup.id,wahaSetup.name)}>{inboxBusy?"Atualizando…":"Atualizar QR Code"}</button>:undefined}>{wahaSetup.status==="LOADING"?<p className={formNoteTw} role="status">Preparando a conexão…</p>:wahaSetup.status==="ERROR"?<p className={formNoteTw} role="alert">{wahaSetup.error}</p>:wahaSetup.status==="CONNECTED"?<p className={formNoteTw}>Este WhatsApp já está conectado.</p>:wahaSetup.qrDataUrl?<><p className={formNoteTw}>Abra o WhatsApp no celular, vá em Dispositivos conectados e escaneie o código.</p><img className={qrTw} src={wahaSetup.qrDataUrl} alt="QR Code para conectar o WhatsApp"/></>:<p className={formNoteTw}>Preparando a conexão. Atualize o QR Code em alguns segundos.</p>}</VexoraDialog>}
 </section>;
}

