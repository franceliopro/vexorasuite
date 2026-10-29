import { socialUsername } from "./social-identity";
import { BadGatewayException, BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Query, Res, Post, Delete, Req, UseGuards } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateWahaChannelDto } from "./dto/create-waha-channel.dto";
import { WahaService } from "./waha.service";
import { ZernioService } from "./zernio.service";

@Controller("channels")
@UseGuards(AuthGuard)
export class ChannelConnectionsController {
  constructor(private readonly prisma: PrismaService, private readonly waha: WahaService, private readonly events: EventsService, private readonly zernio: ZernioService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    const rows = await this.prisma.channelConnection.findMany({
      where: { tenantId: request.user.tenantId, isActive: true },
      select: { id: true, name: true, provider: true, sessionName: true, status: true, lastError: true, isActive: true, createdAt: true, updatedAt: true, settings: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(({ settings, ...channel }) => {
      const safeSettings = settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : {};
      return { ...channel, healthCheckedAt: typeof safeSettings.healthCheckedAt === 'string' ? safeSettings.healthCheckedAt : null, healthProviderStatus: safeSettings.healthProviderStatus || null, ...(channel.provider === "ZERNIO" ? {
        platform: typeof safeSettings.platform === "string" ? safeSettings.platform : undefined,
        accountId: typeof safeSettings.accountId === "string" ? safeSettings.accountId : undefined,
        username: typeof safeSettings.username === "string" ? safeSettings.username : undefined,
        profileName: typeof safeSettings.profileName === "string" ? safeSettings.profileName : undefined,
        webhookVerifiedAt: typeof safeSettings.webhookVerifiedAt === "string" ? safeSettings.webhookVerifiedAt : undefined,
      } : {}) };
    });
  }

  @Post("zernio/oauth/start/:platform")
  async startZernioOAuth(@Req() request: AuthenticatedRequest, @Param("platform") platformValue: string) {
    if (!["OWNER","ADMIN","MANAGER"].includes(request.user.role)) throw new ForbiddenException("Somente gestores podem autorizar contas sociais.");
    const platform = platformValue.trim().toLowerCase();
    if (!["instagram","facebook","whatsapp"].includes(platform)) throw new BadRequestException("Rede social não suportada para OAuth.");
    this.zernio.assertConfigured();
    const tenant = await this.prisma.tenant.findFirst({where:{id:request.user.tenantId,status:"ACTIVE"},select:{id:true,name:true,kind:true}});
    if (!tenant || tenant.kind==="PLATFORM") throw new ForbiddenException("A conexão deve ser iniciada no painel de uma empresa cliente.");
    const profileId=await this.resolveZernioProfile(tenant.id,tenant.name);
    const apiBase=(process.env.API_PUBLIC_URL||"").replace(/\/$/,"");
    if (!apiBase.startsWith("https://")) throw new BadGatewayException("Configure API_PUBLIC_URL com HTTPS para OAuth.");
    const state=randomBytes(32).toString("base64url");
    const attempt=await this.prisma.zernioOAuthAttempt.create({data:{stateHash:createHash("sha256").update(state).digest("hex"),tenantId:tenant.id,userId:request.user.sub,profileId,platform,expiresAt:new Date(Date.now()+10*60*1000)}});
    const response=await this.zernio.request<any>("/connect/"+platform+"?profileId="+encodeURIComponent(profileId)+"&redirect_url="+encodeURIComponent(apiBase+"/api/channels/zernio/oauth/callback?attempt="+encodeURIComponent(state))+"&welcome=true&brandName="+encodeURIComponent("Véxora"));
    const authUrl=typeof response?.authUrl==="string"?response.authUrl:typeof response?.authorizationUrl==="string"?response.authorizationUrl:"";
    if (!authUrl || !authUrl.startsWith("https://")) {
      await this.prisma.zernioOAuthAttempt.delete({where:{stateHash:attempt.stateHash}}).catch(()=>undefined);
      throw new BadGatewayException("A Zernio não retornou uma URL OAuth válida.");
    }
    return {authorizationUrl:authUrl,profileConfigured:true,profileId};
  }

  @Get("zernio/oauth/callback")
  async finishZernioOAuth(@Query() query: Record<string,string>, @Res() response: Response) {
    const appBase=(process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");
    const redirect=(status:string)=>response.redirect(303,(appBase||"https://app.vexorasuite.com.br")+"/?module=Canais+e+integra%C3%A7%C3%B5es&zernio="+encodeURIComponent(status));
    const attemptValue=typeof query.attempt==="string"?query.attempt:"";
    if (!attemptValue || attemptValue.length>200) return redirect("invalid");
    const hash=createHash("sha256").update(attemptValue).digest("hex");
    const now=new Date();
    const attempt=await this.prisma.zernioOAuthAttempt.findUnique({where:{stateHash:hash}});
    if (!attempt || attempt.expiresAt<=now) {
      await this.prisma.zernioOAuthAttempt.deleteMany({where:{stateHash:hash}});
      return redirect("expired");
    }
    const claimed=await this.prisma.zernioOAuthAttempt.deleteMany({where:{stateHash:hash,expiresAt:{gt:now}}});
    if (!claimed.count) return redirect("expired");
    const tenant=await this.prisma.tenant.findFirst({where:{id:attempt.tenantId,status:"ACTIVE"},select:{name:true,kind:true}});
    const membership=await this.prisma.membership.findFirst({where:{tenantId:attempt.tenantId,userId:attempt.userId,tenant:{status:"ACTIVE"},user:{isActive:true},role:{in:["OWNER","ADMIN","MANAGER"]},deniedModules:{not:{has:"CHANNELS"}}},select:{id:true}});
    if (!tenant || tenant.kind==="PLATFORM" || !membership) return redirect("unauthorized");
    const profile=await this.prisma.zernioProfile.findUnique({where:{tenantId:attempt.tenantId}});
    if (!profile || profile.profileId!==attempt.profileId) return redirect("profile-mismatch");
    if(query.error) return redirect("denied");
    const connected=String(query.connected||"").toLowerCase(), callbackProfile=String(query.profileId||""),accountId=String(query.accountId||"");
    if (connected!==attempt.platform || callbackProfile!==profile.profileId || !accountId || accountId.length>200) return redirect("invalid");
    try {
      const list=await this.zernio.request<unknown>("/accounts?profileId="+encodeURIComponent(profile.profileId));
      const accounts=Array.isArray(list)?list:list&&typeof list==="object"?(Array.isArray((list as any).accounts)?(list as any).accounts:Array.isArray((list as any).data)?(list as any).data:[]):null;
      if (!accounts) return redirect("pending");
      const providerAccount=accounts.find((a:any)=>String(a.accountId||a.id||a._id||"")===accountId&&String(a.profileId||"")===profile.profileId&&String(a.platform||"").toLowerCase()===attempt.platform);
      if(!providerAccount) return redirect("unverified");
      const existing=await this.prisma.channelConnection.findFirst({where:{provider:"ZERNIO",isActive:true,settings:{path:["accountId"],equals:accountId}}});
      if(existing&&existing.tenantId!==attempt.tenantId) return redirect("already-assigned");
      const settings={platform:attempt.platform,accountId,profileId:profile.profileId,username:socialUsername(providerAccount)||"",profileName:typeof providerAccount.profileName==="string"?providerAccount.profileName:"",oauthConnectedAt:new Date().toISOString()};
      const saved=await this.prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM tenants WHERE id=${attempt.tenantId}::uuid FOR UPDATE`;
        const current=await tx.channelConnection.findFirst({where:{provider:"ZERNIO",isActive:true,settings:{path:["accountId"],equals:accountId}});
        if(current&&current.tenantId!==attempt.tenantId) throw new ForbiddenException("Esta conta social pertence a outra empresa.");
        if(current) return await tx.channelConnection.update({where:{id:current.id},data:{name:String(providerAccount.name||providerAccount.username||attempt.platform).slice(0,100),status:"CONNECTING",lastError:null,settings:{...(current.settings&&typeof current.settings==="object"&&!Array.isArray(current.settings)?current.settings as Record<string,unknown>:{}),...settings}}});
        return await tx.channelConnection.create({data:{tenantId:attempt.tenantId,provider:"ZERNIO",name:String(providerAccount.name||providerAccount.username||attempt.platform).slice(0,100),sessionName:"zn-"+attempt.tenantId.replace(/-/g,"").slice(0,10)+"-"+randomBytes(5).toString("hex"),status:"CONNECTING",settings}});
      });
      this.events.publish(attempt.tenantId,"channel.updated",{id:saved.id,provider:"ZERNIO",status:"CONNECTING"});
      return redirect("connected");
    } catch {
      return redirect("pending");
    }
  }

  private async resolveZernioProfile(tenantId: string, tenantName: string): Promise<string> {
    this.zernio.assertConfigured();
    const externalId = "vexora-tenant-" + tenantId;
    const stored = await this.prisma.zernioProfile.findUnique({ where: { tenantId } });
    if (stored) {
      if (stored.externalId !== externalId) throw new BadGatewayException("Perfil Zernio da empresa inconsistente.");
      return stored.profileId;
    }
    let profilesResponse: unknown;
    try { profilesResponse = await this.zernio.request<unknown>("/profiles?externalId=" + encodeURIComponent(externalId)); }
    catch (error) {
      const status = error instanceof BadGatewayException ? (error.getResponse() as { providerStatus?: number })?.providerStatus : undefined;
      if (status !== 404) throw error;
      profilesResponse = [];
    }
    const parseProfiles = (value: unknown): Record<string, unknown>[] => {
      const raw = Array.isArray(value) ? value : value && typeof value === "object" ?
        (Array.isArray((value as any).profiles) ? (value as any).profiles : Array.isArray((value as any).data) ? (value as any).data : []) : [];
      return raw.filter((x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
    };
    let profiles = parseProfiles(profilesResponse);
    if (!profiles.length) {
      try {
        await this.zernio.request("/profiles", { method: "POST", body: { name: tenantName.slice(0, 80), externalId }, idempotencyKey: "vexora-zernio-profile-" + tenantId });
      } catch (error) {
        const providerStatus = error instanceof BadGatewayException ? (error.getResponse() as { providerStatus?: number })?.providerStatus : undefined;
        if (providerStatus !== 409) throw error;
      }
      const recovered = await this.zernio.request<unknown>("/profiles?externalId=" + encodeURIComponent(externalId));
      profiles = parseProfiles(recovered);
    }
    const match = profiles.filter(x => String(x.externalId || "") === externalId);
    const profileId = match.length === 1 ? String(match[0]?.id || match[0]?._id || "") : "";
    if (!profileId || match.length !== 1) throw new BadGatewayException("A Zernio não confirmou um perfil único para esta empresa.");
    try {
      const saved = await this.prisma.zernioProfile.create({ data: { tenantId, profileId, externalId } });
      return saved.profileId;
    } catch {
      const winner = await this.prisma.zernioProfile.findUnique({ where: { tenantId } });
      if (winner?.profileId === profileId && winner.externalId === externalId) return winner.profileId;
      throw new BadGatewayException("Não foi possível reservar o perfil Zernio desta empresa.");
    }
  }

  @Get("zernio/diagnostics")
  async zernioDiagnostics(@Req() request: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) throw new ForbiddenException("Somente gestores podem validar a integração Zernio.");
    const tenant=await this.prisma.tenant.findFirst({where:{id:request.user.tenantId,status:"ACTIVE"},select:{kind:true}});
    if (!tenant || tenant.kind==="PLATFORM") throw new ForbiddenException("A Zernio multiempresa é gerenciada dentro do painel de cada empresa.");
    const profile = await this.prisma.zernioProfile.findUnique({ where: { tenantId: request.user.tenantId } });
    const configured = Boolean(process.env.ZERNIO_API_KEY?.trim());
    if (!configured) return { configured:false, publicUrlConfigured:Boolean(process.env.API_PUBLIC_URL?.trim()), authenticated:false, accountCount:0, accounts:[], profileConfigured:!!profile, checkedAt:new Date().toISOString(), message:"A integração Zernio ainda não foi configurada no servidor." };
    try {
      const verification = await this.zernio.request<{ valid?: boolean }>("/auth/verify");
      if (verification.valid !== true) throw new BadGatewayException("A Zernio não confirmou a chave central.");
      if (!profile) return { configured:true, publicUrlConfigured:Boolean(process.env.API_PUBLIC_URL?.trim()), authenticated:true, accountCount:0, accounts:[], profileConfigured:false, checkedAt:new Date().toISOString(), message:"O perfil desta empresa será criado ao iniciar a primeira conexão OAuth." };
      const response = await this.zernio.request<unknown>("/accounts?profileId=" + encodeURIComponent(profile.profileId));
      const raw = Array.isArray(response) ? response : response && typeof response === "object" ?
        (Array.isArray((response as any).accounts) ? (response as any).accounts : Array.isArray((response as any).data) ? (response as any).data : []) : null;
      if (!raw) throw new Error("Invalid Zernio profile account response");
      const accounts = raw.map((item: any) => ({ accountId:String(item.accountId??item.id??item._id??""), platform:String(item.platform??""), username:socialUsername(item), name:typeof item.name==="string"?item.name:typeof item.displayName==="string"?item.displayName:undefined, status:typeof item.status==="string"?item.status:typeof item.isActive==="boolean"?item.isActive?"ACTIVE":"DISCONNECTED":undefined, profileName:typeof item.profileName==="string"?item.profileName:undefined }));
      if (accounts.some((account: any)=>!account.accountId||!account.platform)) throw new Error("Invalid account entry");
      return { configured:true, publicUrlConfigured:Boolean(process.env.API_PUBLIC_URL?.trim()), authenticated:true, profileConfigured:true, accountCount:accounts.length, accounts, checkedAt:new Date().toISOString() };
    } catch {
      return { configured:true, publicUrlConfigured:Boolean(process.env.API_PUBLIC_URL?.trim()), authenticated:false, accountCount:0, accounts:[], profileConfigured:!!profile, checkedAt:new Date().toISOString(), message:"Não foi possível validar o perfil de redes sociais desta empresa na Zernio." };
    }
  }

  @Post("zernio/sync")
  async syncZernio(@Req() request: AuthenticatedRequest) {
    const startedAt = new Date().toISOString();
    const diagnostic = await this.zernioDiagnostics(request);
    if (!diagnostic.authenticated || !diagnostic.profileConfigured || "diagnosticStage" in diagnostic) return { ...diagnostic, synchronized:false };
    const accounts = diagnostic.accounts;
    if (new Set(accounts.map(a => a.accountId)).size !== accounts.length) throw new BadGatewayException("A listagem do perfil Zernio está ambígua. Tente atualizar.");
    const tenantId = request.user.tenantId;
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
      const rows = await tx.channelConnection.findMany({ where:{tenantId,provider:"ZERNIO",isActive:true}, orderBy:{id:"asc"} });
      for (const channel of rows) {
        await tx.$queryRaw`SELECT id FROM channel_connections WHERE id=${channel.id}::uuid AND tenant_id=${tenantId}::uuid FOR UPDATE`;
        const row = await tx.channelConnection.findFirst({ where:{id:channel.id,tenantId,provider:"ZERNIO",isActive:true} });
        if (!row) continue;
        const settings = row.settings && typeof row.settings==="object" && !Array.isArray(row.settings) ? row.settings as Record<string,any> : {};
        if (typeof settings.socialSyncStartedAt==="string" && settings.socialSyncStartedAt>=startedAt) continue;
        const account = accounts.find(a=>a.accountId===settings.accountId);
        const changed = !!account && account.platform.toLowerCase()!==String(settings.platform||"").toLowerCase();
        const state = String(account?.status||"UNKNOWN").toUpperCase();
        const unavailable = !account || changed;
        const status = unavailable ? "DISCONNECTED" : ["ACTIVE","CONNECTED","HEALTHY"].includes(state) ? settings.webhookVerifiedAt ? "CONNECTED" : "CONNECTING" : ["DISCONNECTED","REVOKED","ERROR","FAILED","INACTIVE"].includes(state) ? "DISCONNECTED" : "UNKNOWN";
        await tx.channelConnection.update({ where:{id:row.id}, data:{ status, lastError:!account?"ZERNIO_ACCOUNT_MISSING":changed?"ZERNIO_ACCOUNT_CHANGED":status==="DISCONNECTED"?"ZERNIO_ACCOUNT_DISCONNECTED":null,
          ...(!unavailable&&account?.name?{name:account.name.slice(0,100)}:{}), settings:{...settings,socialSyncStartedAt:startedAt,healthCheckedAt:diagnostic.checkedAt,healthProviderStatus:!account?"MISSING":changed?"CHANGED":state,
            ...(!unavailable?{username:account.username||"",profileName:account.profileName||"",identityCheckedAt:diagnostic.checkedAt}:{})} } });
      }
    });
    this.events.publish(tenantId,"channel.updated",{provider:"ZERNIO"});
    return {...diagnostic,synchronized:true};
  }

  @Post("waha")
  async createWaha(@Req() request: AuthenticatedRequest, @Body() input: CreateWahaChannelDto) {
    this.waha.assertConfigured();
    const tenantId = request.user.tenantId;
    const sessionName = `vx-${tenantId.replace(/-/g, "").slice(0, 12)}-${randomBytes(4).toString("hex")}`;
    let channel = await this.prisma.channelConnection.create({ data: { tenantId, provider: "WAHA", name: input.name.trim(), sessionName, status: "CONNECTING" } });
    try { await this.waha.connect(channel); }
    catch {
      channel = await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { status: "ERROR", lastError: "WAHA_CONNECT_FAILED" } });
    }
    this.events.publish(tenantId, "channel.created", { id: channel.id, provider: channel.provider, status: channel.status });
    return { id: channel.id, name: channel.name, provider: channel.provider, sessionName: channel.sessionName, status: channel.status, lastError: channel.lastError, qrEndpoint: `/api/channels/${channel.id}/qr`, statusEndpoint: `/api/channels/${channel.id}/status` };
  }

  @Post("zernio")
  async createZernio(@Req() request: AuthenticatedRequest, @Body() input: { name?: unknown; platform?: unknown; accountId?: unknown; username?: unknown; profileName?: unknown }) {
    if (!["OWNER","ADMIN","MANAGER"].includes(request.user.role)) throw new ForbiddenException("Somente gestores podem conectar contas sociais.");
    const platform = typeof input.platform==="string" ? input.platform.trim().toLowerCase() : "";
    const accountId = typeof input.accountId==="string" ? input.accountId.trim() : "";
    if (!["instagram","facebook","messenger","whatsapp","tiktok","linkedin","youtube","threads","pinterest","x"].includes(platform) || !accountId || accountId.length>200) throw new BadRequestException("Conta social inválida.");
    const profile = await this.prisma.zernioProfile.findUnique({where:{tenantId:request.user.tenantId}});
    if (!profile) throw new BadRequestException("Conecte esta conta pelas opções OAuth da empresa.");
    const response = await this.zernio.request<unknown>("/accounts?profileId="+encodeURIComponent(profile.profileId));
    const listed = Array.isArray(response) ? response : response && typeof response==="object" ? (Array.isArray((response as any).accounts)?(response as any).accounts:Array.isArray((response as any).data)?(response as any).data:[]) : [];
    const owned = listed.find((item:any)=>String(item.accountId??item.id??item._id??"")===accountId && String(item.platform||"").toLowerCase()===platform);
    if (!owned || String(owned.profileId||profile.profileId)!==profile.profileId) throw new ForbiddenException("Esta conta não pertence ao perfil Zernio desta empresa. Use a autorização OAuth da empresa.");
    const sessionName="zn-"+request.user.tenantId.replace(/-/g,"").slice(0,10)+"-"+randomBytes(5).toString("hex");
    const settings={platform,accountId,profileId:profile.profileId,username:socialUsername(owned)||"",profileName:typeof owned.profileName==="string"?owned.profileName:""};
    const created=await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${request.user.tenantId}::uuid FOR UPDATE`;
      const duplicate=await tx.channelConnection.findFirst({where:{provider:"ZERNIO",isActive:true,settings:{path:["accountId"],equals:accountId}}});
      if(duplicate && duplicate.tenantId!==request.user.tenantId) throw new ForbiddenException("Esta conta social pertence a outra empresa.");
      if(duplicate) throw new BadRequestException("Esta conta já está vinculada nesta empresa.");
      const channel=await tx.channelConnection.create({data:{tenantId:request.user.tenantId,provider:"ZERNIO",name:String(owned.name||owned.username||input.name||platform).slice(0,100),sessionName,status:"CONNECTING",settings}});
      return channel;
    });
    this.events.publish(request.user.tenantId,"channel.created",{id:created.id,provider:created.provider,status:created.status});
    return {id:created.id,name:created.name,platform,accountId,status:created.status};
  }

  @Post(":id/connect")
  async connect(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    try {
      await this.waha.connect(channel);
      this.events.publish(request.user.tenantId, "channel.status", { id, status: "CONNECTING" });
      return { ok: true, status: "CONNECTING" };
    } catch {
      await this.prisma.channelConnection.update({ where: { id }, data: { status: "ERROR", lastError: "WAHA_CONNECT_FAILED" } });
      throw new BadGatewayException("Não foi possível iniciar a sessão WhatsApp. Verifique o gateway WAHA.");
    }
  }

  @Post(":id/disconnect")
  async disconnect(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    await this.waha.disconnect(channel);
    this.events.publish(request.user.tenantId, "channel.status", { id, status: "DISCONNECTED" });
    return { ok: true, status: "DISCONNECTED" };
  }

  @Delete(":id")
  async deleteSession(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    await this.waha.deleteSession(channel);
    this.events.publish(request.user.tenantId, "channel.status", { id, status: "DISCONNECTED", deleted: true });
    return { ok: true, status: "DISCONNECTED", deleted: true };
  }

  @Get(":id/status")
  async status(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    const result = await this.waha.status(channel);
    this.events.publish(request.user.tenantId, "channel.status", { id, ...result });
    return result;
  }

  @Get(":id/qr")
  async qr(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    return { qrDataUrl: await this.waha.qr(channel) };
  }


  @Get(":id/groups")
  async groups(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    return { groups: await this.waha.listGroups(channel) };
  }

  @Get(":id/group-settings")
  async groupSettings(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const channel = await this.findOwned(request.user.tenantId, id);
    const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings)
      ? channel.settings as Record<string, unknown> : {};
    const allowedGroupIds = Array.isArray(settings.allowedGroupIds)
      ? settings.allowedGroupIds.filter((value): value is string => typeof value === "string") : [];
    return { groupsEnabled: settings.groupsEnabled === true, allowedGroupIds };
  }

  @Post(":id/group-settings")
  async updateGroupSettings(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: { groupsEnabled?: unknown; allowedGroupIds?: unknown },
  ) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) {
      throw new ForbiddenException("Somente gestores podem alterar as regras de recebimento de grupos.");
    }
    const channel = await this.findOwned(request.user.tenantId, id);
    if (typeof input.groupsEnabled !== "boolean") {
      throw new BadRequestException("Informe se o recebimento de grupos deve ficar ativado.");
    }
    if (input.allowedGroupIds !== undefined && (!Array.isArray(input.allowedGroupIds) ||
      input.allowedGroupIds.some((value) => typeof value !== "string" || value.length > 180))) {
      throw new BadRequestException("A lista de grupos é inválida.");
    }
    const allowedGroupIds = [...new Set((Array.isArray(input.allowedGroupIds) ? input.allowedGroupIds : [])
      .map((value) => String(value).trim()).filter(Boolean))].slice(0, 100);
    const previous = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings)
      ? channel.settings as Record<string, unknown> : {};
    const settings = { ...previous, groupsEnabled: input.groupsEnabled, allowedGroupIds };
    await this.prisma.channelConnection.update({ where: { id: channel.id }, data: { settings } });
    this.events.publish(request.user.tenantId, "channel.settings.updated", { id: channel.id });
    return { groupsEnabled: input.groupsEnabled, allowedGroupIds };
  }

  private async findOwned(tenantId: string, id: string) {
    const channel = await this.prisma.channelConnection.findFirst({ where: { id, tenantId, provider: "WAHA", isActive: true } });
    if (!channel) throw new NotFoundException("Canal não encontrado nesta empresa.");
    return channel;
  }
}
