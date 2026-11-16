import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { randomBytes } from "node:crypto";

const DEFAULT_SETTINGS = { enabled: true, minutesBefore: [15, 60], sound: true, push: true };
const clampMinute = (v: unknown) => Math.min(Math.max(Math.floor(Number(v)), 1), 1440);

type AgendaReminder = { enabled: boolean; minutesBefore: number[] };
export type PersonalAlarm = { id: string; title: string; time: string; date?: string; weekdays?: number[]; enabled: boolean };

function sanitizeAgendaKey(key: unknown): string | null {
  const value = String(key || "").trim();
  if (!value || value.length > 130 || !/^[A-Za-z0-9_-]+:[^/\s]{1,110}$/.test(value)) return null;
  return value;
}

function sanitizeAgendaMap(input: unknown): Record<string, AgendaReminder> {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const out: Record<string, AgendaReminder> = {};
  for (const [rawKey, rawValue] of Object.entries(source).slice(0, 200)) {
    const key = sanitizeAgendaKey(rawKey); if (!key) continue;
    const value = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) ? rawValue as Record<string, unknown> : {};
    const enabled = value.enabled !== false;
    const list = Array.isArray(value.minutesBefore) ? value.minutesBefore : [];
    const minutesBefore = [...new Set<number>(list.map(clampMinute))].sort((a, b) => a - b).slice(0, 5);
    if (!minutesBefore.length) continue;
    out[key] = { enabled, minutesBefore };
  }
  return out;
}

/** Valida e normaliza os alarmes pessoais do atendente. */
function sanitizeAlarms(input: unknown): PersonalAlarm[] {
  const list = Array.isArray(input) ? input : Array.isArray((input as { alarms?: unknown[] } | null)?.alarms) ? (input as { alarms: unknown[] }).alarms : [];
  const out: PersonalAlarm[] = [];
  for (const raw of list.slice(0, 60)) {
    const item = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
    const time = typeof item.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) ? item.time : "";
    if (title.length < 1 || !time) continue;
    const date = typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && !Number.isNaN(Date.parse(item.date + "T00:00:00")) ? item.date : undefined;
    const weekdays = Array.isArray(item.weekdays)
      ? [...new Set(item.weekdays.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a: number, b: number) => a - b).slice(0, 7)
      : undefined;
    if (!date && !(weekdays && weekdays.length)) continue;
    const id = typeof item.id === "string" && /^[A-Za-z0-9_-]{6,40}$/.test(item.id) ? item.id : randomBytes(6).toString("hex");
    out.push({ id, title, time, ...(date ? { date } : {}), ...(weekdays && weekdays.length ? { weekdays } : {}), enabled: item.enabled !== false });
  }
  return out;
}

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
      const next = { ...current, reminders: { ...(current.reminders as Record<string, any> | undefined), enabled, minutesBefore, sound, push } };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as any } });
    });
    return { enabled, minutesBefore, sound, push };
  }

  @Get("agendas") async getAgendas(@Req() req: AuthenticatedRequest) {
    const root = await this.root(req);
    const reminders = root.reminders && typeof root.reminders === "object" && !Array.isArray(root.reminders) ? root.reminders as Record<string, any> : {};
    return { agendas: sanitizeAgendaMap(reminders.agenda) };
  }

  @Put("agendas") async putAgendas(@Req() req: AuthenticatedRequest, @Body() body: any) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Somente gestão pode alterar os lembretes desta agenda.");
    const agendas = sanitizeAgendaMap(body?.agendas || body || {});
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const current = await this.root(req);
      const next = { ...current, reminders: { ...(current.reminders as Record<string, any> | undefined), agenda: agendas } };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as any } });
    });
    return { agendas };
  }

  @Get("alarms") async getAlarms(@Req() req: AuthenticatedRequest) {
    const root = await this.root(req);
    const map = root.personalAlarms && typeof root.personalAlarms === "object" && !Array.isArray(root.personalAlarms) ? root.personalAlarms as Record<string, unknown> : {};
    return { alarms: sanitizeAlarms(map[req.user.sub]) };
  }

  @Put("alarms") async putAlarms(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const alarms = sanitizeAlarms(body);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const current = await this.root(req);
      const map = current.personalAlarms && typeof current.personalAlarms === "object" && !Array.isArray(current.personalAlarms)
        ? { ...(current.personalAlarms as Record<string, unknown>) }
        : {};
      map[req.user.sub] = alarms;
      const next = { ...current, personalAlarms: map };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as any } });
    });
    return { alarms };
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
