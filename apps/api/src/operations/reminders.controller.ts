import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_SETTINGS = { enabled: true, minutesBefore: [15, 60], sound: true, push: true };
const clampMinute = (v: unknown) => Math.min(Math.max(Math.floor(Number(v)), 1), 1440);

/** Configuração e consulta de lembretes de tarefas e compromissos. */
@Controller("reminders")
@UseGuards(AuthGuard)
export class RemindersController {
  constructor(private readonly prisma: PrismaService) {}

  private async root(req: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    return tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, any> : {};
  }

  @Get("settings") async getSettings(@Req() req: AuthenticatedRequest) {
    const root = await this.root(req);
    const raw = root.reminders && typeof root.reminders === "object" && !Array.isArray(root.reminders) ? root.reminders as Record<string, any> : {};
    const minutesBefore = Array.isArray(raw.minutesBefore) ? [...new Set((raw.minutesBefore as unknown[]).map(clampMinute))].sort((a: number, b: number) => a - b).slice(0, 5) : DEFAULT_SETTINGS.minutesBefore;
    return { enabled: raw.enabled !== false, minutesBefore: minutesBefore.length ? minutesBefore : DEFAULT_SETTINGS.minutesBefore, sound: raw.sound !== false, push: raw.push !== false };
  }

  @Put("settings") async putSettings(@Req() req: AuthenticatedRequest, @Body() body: any) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Somente gestão pode alterar os lembretes da empresa.");
    const enabled = body?.enabled !== false;
    const sound = body?.sound !== false;
    const push = body?.push !== false;
    const sourceList: unknown[] = Array.isArray(body?.minutesBefore) ? body.minutesBefore : DEFAULT_SETTINGS.minutesBefore;
    const minutesBefore = [...new Set<number>(sourceList.map(clampMinute))].sort((a, b) => a - b).slice(0, 5);
    if (!minutesBefore.length) throw new BadRequestException("Informe ao menos um minuto de antecedência (1 a 1440).");
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const current = await this.root(req);
      const next = { ...current, reminders: { enabled, minutesBefore, sound, push } };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as any } });
    });
    return { enabled, minutesBefore, sound, push };
  }

  /** Itens devidos do usuário atual: tarefas atrasadas ou prestes a vencer. */
  @Get("due") async due(@Req() req: AuthenticatedRequest, @Query("withinMinutes") withinMinutes?: string) {
    const minutes = Math.min(Math.max(Math.floor(Number(withinMinutes) || 120), 5), 720);
    const me = req.user.sub;
    const visibility = ["OWNER", "ADMIN", "MANAGER"].includes(req.user.role) ? {} : { OR: [{ assigneeId: me }, { createdById: me }, { assigneeId: null }] };
    const now = Date.now();
    const tasks = await this.prisma.workTask.findMany({
      where: { tenantId: req.user.tenantId, status: { not: "DONE" }, dueAt: { gte: new Date(now - 24 * 3600e3), lte: new Date(now + minutes * 60e3) }, ...visibility },
      orderBy: { dueAt: "asc" },
      take: 50,
      select: { id: true, title: true, dueAt: true, priority: true, assigneeId: true, createdById: true },
    });
    return { tasks };
  }
}
