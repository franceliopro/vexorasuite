import { socialUsername } from "./social-identity";
import { BadGatewayException, BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Delete, Req, UseGuards } from "@nestjs/common";
import { randomBytes } from "node:crypto";
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

  @Get("zernio/diagnostics")
  async zernioDiagnostics(@Req() request: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) {
      throw new ForbiddenException("Somente gestores podem validar a integração Zernio.");
    }
    const configured = Boolean(process.env.ZERNIO_API_KEY?.trim());
    const publicUrlConfigured = Boolean(process.env.API_PUBLIC_URL?.trim());
    if (!configured) {
      return { configured: false, publicUrlConfigured, authenticated: false, accountCount: 0, accounts: [], checkedAt: new Date().toISOString(), message: "ZERNIO_API_KEY não está configurada no servidor." };
    }
    let verification: { valid?: boolean };
    try {
      verification = await this.zernio.request<{ valid?: boolean }>("/auth/verify");
      if (verification.valid !== true) {
        return { configured, publicUrlConfigured, authenticated: false, accountCount: 0, accounts: [], checkedAt: new Date().toISOString(), message: "A Zernio não confirmou a validade da chave API.", diagnosticStage: "authentication" };
      }
    } catch (error) {
      const status = error instanceof BadGatewayException ? (error.getResponse() as { providerStatus?: number })?.providerStatus : undefined;
      return { configured, publicUrlConfigured, authenticated: false, accountCount: 0, accounts: [], checkedAt: new Date().toISOString(), message: status === 401 ? "Chave Zernio recusada (401). Verifique a chave ativa no serviço da API." : "Não foi possível verificar a chave na Zernio. Consulte a conectividade da API e o endpoint de autenticação.", diagnosticStage: "authentication", ...(status ? { providerStatus: status } : {}) };
    }
    try {
      const response = await this.zernio.request<unknown>("/accounts");
      const raw: unknown[] = (() => {
        if (Array.isArray(response)) return response;
        if (!response || typeof response !== "object") return [];
        const payload = response as Record<string, unknown>;
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.accounts)) return payload.accounts;
        if (payload.data && typeof payload.data === "object" && Array.isArray((payload.data as Record<string, unknown>).accounts)) return (payload.data as { accounts: unknown[] }).accounts;
        return [];
      })();
      const accounts = raw.map((item) => {
        const account = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          accountId: String(account.accountId ?? account.id ?? account._id ?? ""),
          platform: String(account.platform ?? ""),
          username: socialUsername(account),
          name: typeof account.name === "string" ? account.name : typeof account.displayName === "string" ? account.displayName : undefined,
          status: typeof account.status === "string" ? account.status : typeof account.isActive === "boolean" ? account.isActive ? "ACTIVE" : "DISCONNECTED" : undefined,
          profileName: typeof account.profileName === "string" ? account.profileName : undefined,
        };
      }).filter((account) => account.accountId && account.platform);
      return { configured, publicUrlConfigured, authenticated: true, accountCount: accounts.length, accounts, checkedAt: new Date().toISOString() };
    } catch (error) {
      const status = error instanceof BadGatewayException ? (error.getResponse() as { providerStatus?: number })?.providerStatus : undefined;
      return { configured, publicUrlConfigured, authenticated: true, accountCount: 0, accounts: [], checkedAt: new Date().toISOString(), message: "Chave Zernio válida, mas a listagem de contas falhou. Confira as permissões de leitura das contas.", diagnosticStage: "accounts", ...(status ? { providerStatus: status } : {}) };
    }
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
  async createZernio(
    @Req() request: AuthenticatedRequest,
    @Body() input: { name?: unknown; platform?: unknown; accountId?: unknown; username?: unknown; profileName?: unknown },
  ) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) {
      throw new ForbiddenException("Somente gestores podem conectar contas sociais.");
    }
    this.zernio.assertConfigured();
    const name = typeof input.name === "string" ? input.name.trim().slice(0, 100) : "";
    const platform = typeof input.platform === "string" ? input.platform.trim().toLowerCase() : "";
    const accountId = typeof input.accountId === "string" ? input.accountId.trim() : "";
    if (!name || !accountId || accountId.length > 200 || !["instagram", "facebook", "messenger", "whatsapp", "tiktok", "linkedin", "youtube", "threads", "pinterest", "x"].includes(platform)) {
      throw new BadRequestException("Informe um nome, uma conta Zernio e uma rede social compatível.");
    }
    const existing = await this.prisma.channelConnection.findMany({
      where: { provider: "ZERNIO", isActive: true },
      select: { tenantId: true, settings: true },
    });
    const claimed = existing.find((row) => row.settings && typeof row.settings === "object" && !Array.isArray(row.settings) &&
      (row.settings as Record<string, unknown>).accountId === accountId);
    if (claimed && claimed.tenantId !== request.user.tenantId) {
      throw new ForbiddenException("Esta conta social já está vinculada a outra empresa.");
    }
    if (claimed) throw new BadRequestException("Esta conta já está conectada nesta empresa.");
    const webhookSecret = randomBytes(32).toString("hex");
    const channel = await this.prisma.channelConnection.create({
      data: {
        tenantId: request.user.tenantId, provider: "ZERNIO", name,
        sessionName: `zn-${request.user.tenantId.replace(/-/g, "").slice(0, 10)}-${randomBytes(5).toString("hex")}`,
        status: "CONNECTING",
        settings: { platform, accountId, webhookSecret, username: typeof input.username === "string" ? input.username.trim().slice(0, 100) : "", profileName: typeof input.profileName === "string" ? input.profileName.trim().slice(0, 120) : "" },
      },
    });
    this.events.publish(request.user.tenantId, "channel.created", { id: channel.id, provider: channel.provider, status: channel.status });
    const publicUrl = (process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
    return {
      id: channel.id, name: channel.name, provider: channel.provider, platform, accountId, status: channel.status,
      webhookUrl: publicUrl ? publicUrl + "/api/webhooks/zernio/" + channel.id : null,
      webhookSecret,
      webhookSetup: "Configure a URL e o segredo no painel Zernio e selecione os eventos necessários. O segredo só é exibido nesta resposta.",
    };
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
