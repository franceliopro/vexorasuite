import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AsaasService } from "./asaas.service";
import { schedulersEnabled } from "../common/scheduler-mode";

const DAY_MS = 24 * 60 * 60 * 1000;
// A transaction-scoped advisory lock keeps the daily reconciliation single-flight
// when the API is scaled to more than one replica.
const ASAAS_SYNC_LOCK = 73910483;

@Injectable()
export class AsaasCustomerSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsaasCustomerSyncScheduler.name);
  private startupTimer?: NodeJS.Timeout;
  private dailyTimer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly asaas: AsaasService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!schedulersEnabled()) return;
    // Give the API a short startup window, then reconcile enabled tenants daily.
    this.startupTimer = setTimeout(() => {
      void this.run();
      this.dailyTimer = setInterval(() => void this.run(), DAY_MS);
      this.dailyTimer.unref();
    }, 60_000);
    this.startupTimer.unref();
  }

  onModuleDestroy() {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.dailyTimer) clearInterval(this.dailyTimer);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
            SELECT pg_try_advisory_xact_lock(${ASAAS_SYNC_LOCK}) AS locked
          `;
          if (!lock?.locked) {
            this.logger.debug("Sincronização Asaas já está em execução em outra réplica.");
            return;
          }
          await this.asaas.syncEnabledTenants();
        },
        { maxWait: 5_000, timeout: 120_000 },
      );
    } catch (error) {
      this.logger.error(
        "Falha geral na sincronização programada de clientes Asaas.",
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
