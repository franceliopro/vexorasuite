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
  list(@Req() request: AuthenticatedRequest) {
    return this.prisma.channelConnection.findMany({
      where: { tenantId: request.user.tenantId, isActive: true },
      select: { id: true, name: true, provider: true, sessionName: true, status: true, lastError: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
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
    @Body() input: { name?: unknown; platform?: unknown; accountId?: unknown },
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
        status: "CONNECTED",
        settings: { platform, accountId, webhookSecret },
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
