import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { schedulersEnabled } from "../common/scheduler-mode";
import { PushService } from "./push.service";

/** Varredura periódica de tarefas com prazo próximo/atrasado e disparo de push para o responsável. */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly notified = new Map<string, number>();
  constructor(private readonly prisma: PrismaService, private readonly push: PushService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === "test" || !schedulersEnabled()) return;
    this.timer = setInterval(() => void this.tick(), 60000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { status: "ACTIVE" }, select: { id: true, integrations: true } });
      for (const tenant of tenants) {
        const root = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, any> : {};
        const settings = root.reminders && typeof root.reminders === "object" && !Array.isArray(root.reminders) ? root.reminders as Record<string, any> : {};
        if (settings.enabled === false) continue;
        if (settings.push === false) continue;
        const minutesBefore = (Array.isArray(settings.minutesBefore) ? settings.minutesBefore : [15, 60])
          .map((n: any) => Math.floor(Number(n))).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 1440);
        const windowMin = minutesBefore.length ? Math.max(...minutesBefore) : 60;
        const now = Date.now();
        const tasks = await this.prisma.workTask.findMany({
          where: { tenantId: tenant.id, status: { not: "DONE" }, assigneeId: { not: null }, dueAt: { gte: new Date(now - 6 * 3600e3), lte: new Date(now + windowMin * 60e3) } },
          select: { id: true, title: true, dueAt: true, assigneeId: true },
        });
        for (const task of tasks) {
          if (!task.assigneeId || !task.dueAt) continue;
          const key = tenant.id + ":" + task.id;
          const last = this.notified.get(key) || 0;
          if (now - last < 30 * 60e3) continue;
          try {
            await this.push.notifyReminder(tenant.id, [task.assigneeId], {
              title: "Lembrete: " + task.title,
              body: "Vence " + task.dueAt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + ". Abra a Véxora para ver.",
              url: "/?module=Tarefas",
              tag: "task-" + task.id,
            });
            this.notified.set(key, now);
          } catch (error) {
            this.logger.warn("Falha no push de lembrete", error);
          }
        }
      }
      if (this.notified.size > 5000) this.notified.clear();
    } finally {
      this.running = false;
    }
  }
}
