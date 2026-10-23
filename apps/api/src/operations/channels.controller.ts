import { BadGatewayException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Delete, Req, UseGuards } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { CreateWahaChannelDto } from "./dto/create-waha-channel.dto";
import { WahaService } from "./waha.service";

@Controller("channels")
@UseGuards(AuthGuard)
export class ChannelConnectionsController {
  constructor(private readonly prisma: PrismaService, private readonly waha: WahaService, private readonly events: EventsService) {}

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

  private async findOwned(tenantId: string, id: string) {
    const channel = await this.prisma.channelConnection.findFirst({ where: { id, tenantId, provider: "WAHA", isActive: true } });
    if (!channel) throw new NotFoundException("Canal não encontrado nesta empresa.");
    return channel;
  }
}
