import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { touchWorkerHeartbeat } from "./worker-heartbeat";

const workerId = process.env.WORKER_ID || process.env.HOSTNAME || "scheduler-worker";

export type WorkerCycleLog = {
  workerId: string;
  cycle: number;
  durationMs: number;
  itemsProcessed: number;
  consecutiveFailures: number;
};

export function formatWorkerCycleLog(metrics: WorkerCycleLog): string {
  return JSON.stringify({ event: "worker_cycle", ...metrics });
}

/**
 * Dedicated process for the periodic jobs: audio triage, workflow cadence, channel health and
 * the daily Asaas reconciliation.
 *
 * Running them outside the HTTP process means a slow provider call no longer competes with
 * request handling. Every tick still takes a row in `scheduler_leases`, so a second replica of
 * this worker (or an API process left in `in-process` mode) cannot run the same tick twice.
 *
 * Start with: node dist/scheduler-worker.js
 */
async function bootstrap() {
  process.env.SCHEDULER_ROLE = "worker";
  if (!process.env.SCHEDULER_MODE) process.env.SCHEDULER_MODE = "worker";

  const logger = new Logger("SchedulerWorker");
  // Application context only: no HTTP listener, no route table.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });
  app.enableShutdownHooks();
  await app.init();
  logger.log("Jobs periódicos ativos neste processo.");

  let cycleNumber = 0;
  let consecutiveFailures = 0;
  const runHeartbeatCycle = async () => {
    const cycleStartedAt = Date.now();
    let cycleFailures = 0;
    try {
      await touchWorkerHeartbeat();
    } catch (error) {
      cycleFailures = 1;
      logger.warn(`Não foi possível atualizar o heartbeat do scheduler worker: ${error instanceof Error ? error.message : String(error)}`);
    }
    consecutiveFailures = cycleFailures > 0 ? consecutiveFailures + 1 : 0;
    cycleNumber += 1;
    logger.log(formatWorkerCycleLog({
      workerId,
      cycle: cycleNumber,
      durationMs: Date.now() - cycleStartedAt,
      itemsProcessed: 0,
      consecutiveFailures,
    }));
  };

  // This referenced timer keeps the application context alive and makes the worker liveness
  // observable without pretending that external providers or individual jobs are healthy.
  await runHeartbeatCycle();
  const heartbeatTimer = setInterval(() => void runHeartbeatCycle(), 10_000);

  const shutdown = async (signal: string) => {
    clearInterval(heartbeatTimer);
    logger.log(`Encerrando após ${signal}.`);
    await app.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (require.main === module) {
  void bootstrap();
}
