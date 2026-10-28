import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ChannelConnection } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WahaService {
  constructor(private readonly prisma: PrismaService) {}

  assertConfigured(): void { this.config(); }

  private config(): { baseUrl: string; apiKey: string } {
    const rawUrl = process.env.WAHA_BASE_URL?.trim();
    const apiKey = process.env.WAHA_API_KEY?.trim();
    if (!rawUrl || !apiKey) throw new ServiceUnavailableException("O gateway WAHA ainda não está configurado no ambiente da Véxora.");
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new ServiceUnavailableException("WAHA_BASE_URL não é uma URL válida."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new ServiceUnavailableException("WAHA_BASE_URL deve usar HTTP/HTTPS sem credenciais embutidas.");
    }
    // WAHA listens on port 3000 inside Docker. Support the configured internal URL "http://waha".
    if (url.hostname === "waha" && !url.port) url.port = "3000";
    return { baseUrl: url.toString().replace(/\/$/, ""), apiKey };
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const { baseUrl, apiKey } = this.config();
    const headers = new Headers(init.headers);
    headers.set("X-Api-Key", apiKey);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    try {
      return await fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
    } catch {
      throw new BadGatewayException("Não foi possível acessar o gateway WhatsApp. Confira o endereço e a rede interna.");
    }
  }

  private webhookToken(channelId: string): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) throw new ServiceUnavailableException("JWT_ACCESS_SECRET precisa estar configurado para proteger os webhooks.");
    return createHmac("sha256", secret).update(`vexora:waha-webhook:${channelId}`).digest("hex");
  }

  webhookUrl(channelId: string): string {
    const configuredOrigin = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.vexorasuite.com.br";
    let origin: string;
    try {
      const parsed = new URL(configuredOrigin);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("invalid protocol");
      origin = parsed.origin;
    } catch { throw new ServiceUnavailableException("PUBLIC_APP_URL não é uma URL pública válida."); }
    return `${origin}/api/webhooks/waha/${channelId}/${this.webhookToken(channelId)}`;
  }

  verifyWebhookToken(channelId: string, supplied: string): boolean {
    try {
      if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
      const expected = Buffer.from(this.webhookToken(channelId), "hex");
      const actual = Buffer.from(supplied, "hex");
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
  }

  async connect(channel: ChannelConnection): Promise<void> {
    const config = { webhooks: [{ url: this.webhookUrl(channel.id), events: ["message", "message.ack", "session.status"], retries: { policy: "linear", delaySeconds: 2, attempts: 5 } }] };
    let response = await this.request("/api/sessions", { method: "POST", body: JSON.stringify({ name: channel.sessionName, start: true, config }) });
    if (response.status === 409 || response.status === 422) {
      response = await this.request(`/api/sessions/${encodeURIComponent(channel.sessionName)}`, { method: "PUT", body: JSON.stringify({ name: channel.sessionName, config }) });
      if (!response.ok) throw new BadGatewayException(`WAHA recusou a atualização da sessão (${response.status}).`);
      response = await this.request(`/api/sessions/${encodeURIComponent(channel.sessionName)}/start`, { method: "POST", body: "{}" });
    }
    if (!response.ok) throw new BadGatewayException(`WAHA recusou a conexão da sessão (${response.status}).`);
    await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "CONNECTING", lastError: null } });
  }



  /** WAHA NOWEB may omit contact photos from message webhooks. Retrieve a photo URL only
   * from the configured gateway, never from a user-supplied URL. */
  async contactPicture(channel: ChannelConnection, chatId: string): Promise<string | null> {
    if (!/^[0-9]{8,18}@(c\.us|lid)$/.test(chatId)) return null;
    const query = new URLSearchParams({ contactId: chatId, session: channel.sessionName });
    try {
      const response = await this.request(`/api/contacts/profile-picture?${query.toString()}`);
      if (!response.ok) return null;
      const payload = await response.json() as { profilePictureURL?: unknown; profilePictureUrl?: unknown; url?: unknown };
      const candidate = payload.profilePictureURL || payload.profilePictureUrl || payload.url;
      if (typeof candidate !== "string") return null;
      const parsed = new URL(candidate);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  async contactPhoto(channel:ChannelConnection,chatId:string):Promise<Buffer|null>{
    if(!/^[0-9]{8,18}@(c\.us|lid)$/.test(chatId))return null;
    try{
      const query=new URLSearchParams({contactId:chatId,session:channel.sessionName});
      const response=await this.request('/api/contacts/profile-picture?'+query,{redirect:'error'});if(!response.ok)return null;
      const data=await response.json() as any;const candidate=data.profilePictureURL||data.profilePictureUrl||data.url;if(typeof candidate!=='string')return null;
      const {baseUrl}=this.config();const target=new URL(candidate,baseUrl+'/');if(target.username||target.password)return null;
      const internal=target.toString().startsWith(baseUrl+'/');
      const publicHost=['whatsapp.net','fbcdn.net','fbsbx.com'].some(d=>target.hostname===d||target.hostname.endsWith('.'+d));
      if(!internal&&(target.protocol!=='https:'||target.port||!publicHost))return null;
      const photo=internal?await this.request(target.toString().slice(baseUrl.length),{redirect:'error'}):await fetch(target,{redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!photo.ok||Number(photo.headers.get('content-length')||0)>1024*1024)return null;
      const reader=photo.body?.getReader();if(!reader)return null;const chunks:Buffer[]=[];let size=0;
      try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024*1024)return null;chunks.push(Buffer.from(part.value));}return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    }catch{return null;}
  }

  async listGroups(channel: ChannelConnection): Promise<{ id: string; name: string }[]> {
    const response = await this.request(`/api/${encodeURIComponent(channel.sessionName)}/chats`);
    if (!response.ok) throw new BadGatewayException(`WAHA não conseguiu listar as conversas (${response.status}).`);
    const payload = await response.json() as unknown;
    const rows = Array.isArray(payload) ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { chats?: unknown }).chats)
        ? (payload as { chats: unknown[] }).chats : [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const item = row as Record<string, unknown>;
      const rawId = typeof item.id === "string" ? item.id
        : item.id && typeof item.id === "object" && "_serialized" in item.id
          ? String((item.id as { _serialized: unknown })._serialized) : "";
      if (!rawId.endsWith("@g.us")) return [];
      const name = String(item.name || item.formattedTitle || item.pushName || rawId).trim().slice(0, 160);
      return [{ id: rawId, name }];
    }).slice(0, 500);
  }

  async disconnect(channel: ChannelConnection): Promise<void> {
    const response = await this.request(`/api/sessions/${encodeURIComponent(channel.sessionName)}/stop`, { method: "POST", body: "{}" });
    if (!response.ok && response.status !== 404) throw new BadGatewayException(`WAHA não conseguiu desconectar a sessão (${response.status}).`);
    await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "DISCONNECTED", lastError: null } });
  }

  async deleteSession(channel: ChannelConnection): Promise<void> {
    const response = await this.request(`/api/sessions/${encodeURIComponent(channel.sessionName)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new BadGatewayException(`WAHA não conseguiu excluir a sessão (${response.status}).`);
    await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { isActive: false, status: "DISCONNECTED", lastError: null } });
  }

  async status(channel: ChannelConnection) {
    const response = await this.request(`/api/sessions/${encodeURIComponent(channel.sessionName)}`);
    if (response.status === 404) {
      await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "DISCONNECTED" } });
      return { status: "DISCONNECTED", providerStatus: "NOT_FOUND" };
    }
    if (!response.ok) throw new BadGatewayException(`WAHA não conseguiu consultar a sessão (${response.status}).`);
    const payload = await response.json() as { status?: string; me?: { pushName?: string; name?: string; id?: string | { _serialized?: string } } };
    const providerStatus = payload.status || "UNKNOWN";
    const status = ({ WORKING: "CONNECTED", SCAN_QR_CODE: "QR", STARTING: "CONNECTING", STOPPED: "DISCONNECTED", FAILED: "ERROR" } as Record<string, string>)[providerStatus] || "UNKNOWN";
    const meId = typeof payload.me?.id === "string" ? payload.me.id : payload.me?.id?._serialized;
    await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status, lastError: status === "ERROR" ? "WAHA_SESSION_FAILED" : null } });
    return { status, providerStatus, accountName: payload.me?.pushName || payload.me?.name || null, phone: meId?.split("@")[0] || null };
  }

  async qr(channel: ChannelConnection): Promise<string> {
    const response = await this.request(`/api/${encodeURIComponent(channel.sessionName)}/auth/qr`, { headers: { accept: "image/png" } });
    if (!response.ok) throw new BadGatewayException(`QR do WhatsApp ainda não está disponível (${response.status}). Consulte o estado da sessão e tente novamente.`);
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  }

  async sendText(channel: ChannelConnection, chatId: string, text: string): Promise<string | null> {
    const response = await this.request("/api/sendText", { method: "POST", body: JSON.stringify({ session: channel.sessionName, chatId, text }) });
    if (!response.ok) throw new BadGatewayException(`WAHA não enviou a mensagem (${response.status}).`);
    const result = await response.json().catch(() => ({})) as { id?: string | { _serialized?: string } };
    return typeof result.id === "string" ? result.id : result.id?._serialized || null;
  }
 /** Download only the gateway's authenticated file path; never request a webhook-supplied host. */
 async incomingAudio(channel:ChannelConnection,raw:string):Promise<{buffer:Buffer;mimetype:string}>{const {baseUrl}=this.config();let url:URL;try{url=new URL(raw,baseUrl+'/')}catch{throw new BadGatewayException('Áudio indisponível.');}if(!/^\/api\/files\//.test(url.pathname)||url.username||url.password||url.search||url.hash)throw new BadGatewayException('Caminho de áudio inválido.');const response=await this.request(url.pathname,{redirect:'error'});const mime=(response.headers.get('content-type')||'').split(';')[0]!;if(!response.ok||!mime.startsWith('audio/')||Number(response.headers.get('content-length')||0)>12*1024*1024)throw new BadGatewayException('Áudio indisponível ou acima do limite.');const reader=response.body?.getReader();if(!reader)throw new BadGatewayException('Áudio vazio.');const chunks:Buffer[]=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>12*1024*1024)throw new BadGatewayException('Áudio acima do limite.');chunks.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}return {buffer:Buffer.concat(chunks),mimetype:mime};}
 async sendVoice(channel:ChannelConnection,chatId:string,buffer:Buffer):Promise<string|null>{if(!buffer.length||buffer.length>12*1024*1024)throw new BadGatewayException('Áudio inválido.');const response=await this.request('/api/sendVoice',{method:'POST',body:JSON.stringify({session:channel.sessionName,chatId,file:{mimetype:'audio/mpeg',data:buffer.toString('base64'),filename:'resposta.mp3'},convert:true})});if(!response.ok)throw new BadGatewayException('Não foi possível confirmar o áudio.');const result=await response.json() as any;return typeof result.id==='string'?result.id:result.id?._serialized||null;}

}
