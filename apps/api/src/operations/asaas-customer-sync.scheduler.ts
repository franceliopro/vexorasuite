import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AsaasService } from "./asaas.service";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AsaasCustomerSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsaasCustomerSyncScheduler.name);
  private startupTimer?: NodeJS.Timeout;
  private dailyTimer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly asaas: AsaasService) {}

  onModuleInit() {
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
      await this.asaas.syncEnabledTenants();
    } catch (error) {
      this.logger.error("Falha geral na sincronização programada de clientes Asaas.", error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
