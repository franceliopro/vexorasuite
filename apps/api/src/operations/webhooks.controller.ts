import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { encryptWebhookSecret, generateWebhookSecret } from "./webhook-crypto";

const ALLOWED_EVENTS = ["conversation.created", "conversation.updated", "message.received", "contact.updated", "payment.updated"];

@Controller("webhooks")
@UseGuards(AuthGuard)
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  private admin(req: AuthenticatedRequest) {
    if (!req.user.isPlatformAdmin && !["OWNER", "ADMIN"].includes(req.user.role))
      throw new ForbiddenException("Somente administradores configuram webhooks.");
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    return this.prisma.webhookSubscription.findMany({
      where: { tenantId: req.user.tenantId },
      select: { id: true, name: true, url: true, events: true, active: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.admin(req);
    if (typeof body?.url !== "string" || !/^https:\/\//i.test(body.url.trim()) || body.url.length > 500)
      throw new BadRequestException("Informe uma URL HTTPS válida para o webhook.");
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "Webhook";
    const events: string[] = Array.isArray(body.events) ? Array.from(new Set(body.events.filter((value: unknown): value is string => typeof value === "string" && ALLOWED_EVENTS.includes(value)))) as string[] : [...ALLOWED_EVENTS];
    if (!events.length) throw new BadRequestException("Selecione pelo menos um evento.");
    const secret = generateWebhookSecret();
    const row = await this.prisma.webhookSubscription.create({
      data: { tenantId: req.user.tenantId, name, url: body.url.trim(), events, secretCiphertext: encryptWebhookSecret(secret) },
      select: { id: true, name: true, url: true, events: true, active: true, createdAt: true },
    });
    return { ...row, secret, warning: "Guarde este segredo agora. Ele não será exibido novamente." };
  }

  @Delete(":id")
  async revoke(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.admin(req);
    const result = await this.prisma.webhookSubscription.updateMany({
      where: { id, tenantId: req.user.tenantId, active: true },
      data: { active: false },
    });
    if (!result.count) throw new BadRequestException("Webhook não encontrado ou já desativado.");
    return { active: false };
  }
}
