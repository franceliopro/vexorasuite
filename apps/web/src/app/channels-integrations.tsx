
const platformNames: Record<string,string> = { email:"E-mail", instagram:"Instagram", facebook:"Facebook", messenger:"Messenger", whatsapp:"WhatsApp", tiktok:"TikTok", linkedin:"LinkedIn", youtube:"YouTube", threads:"Threads", pinterest:"Pinterest", x:"X", twitter:"X", reddit:"Reddit", bluesky:"Bluesky", telegram:"Telegram", discord:"Discord", snapchat:"Snapchat", googlebusiness:"Google Business" };
const platformColors: Record<string,string> = { email:"#6258DF", instagram:"#D9468D", facebook:"#1877F2", messenger:"#168AFF", whatsapp:"#159B75", tiktok:"#20242B", linkedin:"#0A66C2", youtube:"#E53935", threads:"#303030", pinterest:"#BD081C", x:"#111827", twitter:"#111827", reddit:"#FF4500", bluesky:"#1685FE", telegram:"#229ED9", discord:"#5865F2", snapchat:"#E5C900", googlebusiness:"#4285F4" };
async function api<T>(url:string, init?:RequestInit):Promise<T>{ const response=await fetch(url,{...init,cache:"no-store"}); const body=await response.json().catch(()=>({})); if(!response.ok) { if(response.status===401) throw new Error("Sua sessão da Véxora expirou ou não foi encontrada. Entre novamente na Véxora para verificar a integração Zernio."); const detail=body?.message&&typeof body.message==="object"?body.message:null; const message=Array.isArray(body.message)?body.message.join(" "):typeof body.message==="string"?body.message:detail?.message||body.error||"Não foi possível concluir a operação."; const suffix=detail?.dashboardUrl?` Abra a página de cobrança da Zernio: ${detail.dashboardUrl}`:""; throw new Error(message+suffix); } return body as T; }
function platformName(platform:string){return platformNames[platform.toLowerCase()]||platform;}
function platformColor(platform:string){return platformColors[platform.toLowerCase()]||"#6258DF";}
function PlatformIcon({platform,size=18}:{platform:string;size?:number}){
 const value=platform.toLowerCase();
 if(value==="email")return <MailIcon size={size} strokeWidth={2.2}/>;
 if(value==="instagram")return <Instagram size={size} strokeWidth={2.2}/>;
 if(value==="facebook"||value==="messenger")return <Facebook size={size} strokeWidth={2.2}/>;
 return <MessageCircle size={size} strokeWidth={2.2}/>;