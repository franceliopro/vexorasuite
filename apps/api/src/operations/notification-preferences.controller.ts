import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { isUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import {
  normalizeNotificationEvents,
  notificationEventsOf,
  NotificationEvent,
} from "./notification-preferences";

/** Preferências do atendente sobre os avisos que já existem na aplicação. */
@Controller("notification-preferences")
@UseGuards(AuthGuard)
export class NotificationPreferencesController {
  constructor(private readonly prisma: PrismaService) {}

  private async target(req: AuthenticatedRequest, requested: unknown): Promise<string> {
    const userId = requested === undefined || requested === null || requested === "" ? req.user.sub : requested;
    if (typeof userId !== "string" || !isUUID(userId)) throw new BadRequestException("Atendente inválido.");
    if (userId !== req.user.sub) {
      if (!req.user.isPlatformAdmin && !["OWNER", "ADMIN"].includes(req.user.role))
        throw new ForbiddenException("Somente administradores alteram preferências de outros atendentes.");
      const member = await this.prisma.membership.findFirst({
        where: { tenantId: req.user.tenantId, userId },
        select: { id: true },
      });
      if (!member) throw new BadRequestException("Atendente não pertence a esta empresa.");
    }
    return userId;
  }

  @Get() async read(@Req() req: AuthenticatedRequest, @Query("userId") userId?: string) {
    const target = await this.target(req, userId);
    const preference = await this.prisma.userNotificationPreference.findUnique({
      where: { tenantId_userId: { tenantId: req.user.tenantId, userId: target } },
      select: { events: true },
    });
    return { userId: target, events: notificationEventsOf(preference?.events) };
  }

  @Patch() async save(@Req() req: AuthenticatedRequest, @Body() body: { userId?: unknown; events?: unknown }) {
    const target = await this.target(req, body?.userId);
    let events: NotificationEvent[];
    try {
      events = normalizeNotificationEvents(body?.events);
    } catch {
      throw new BadRequestException("Selecione somente eventos de notificação existentes.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userNotificationPreference.upsert({
        where: { tenantId_userId: { tenantId: req.user.tenantId, userId: target } },
        create: { tenantId: req.user.tenantId, userId: target, events },
        update: { events },
      });
      if (target !== req.user.sub) {
        await tx.auditLog.create({
          data: {
            tenantId: req.user.tenantId,
            userId: req.user.sub,
            action: "team.notification_preferences_updated",
            entityType: "user",
            entityId: target,
            details: { events },
          },
        });
      }
    });
    return { saved: true, userId: target, events };
  }
}
