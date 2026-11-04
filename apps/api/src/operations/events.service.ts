import { Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { filter, interval, map, merge, mergeMap, Observable, Subject, tap } from "rxjs";

export interface TenantEvent {
  id: string;
  tenantId: string;
  type: string;
  data: Record<string, unknown>;
  occurredAt: string;
}

type PersistedEvent = { id: string; type: string; data: Record<string, unknown>; occurred_at: Date };

/** Poll cadence used only to pick up events written by other replicas. */
const REPLICA_POLL_MS = Number(process.env.REALTIME_POLL_MS || 5000);
/** Bounded dedupe window: a long-lived stream must not grow one Set forever. */
const SEEN_LIMIT = 5000;
const PERSIST_ATTEMPTS = 3;

@Injectable()
export class EventsService {
  private readonly events = new Subject<TenantEvent>();
  private readonly logger = new Logger(EventsService.name);
  private readonly retentionDays = Math.max(1, Number(process.env.REALTIME_EVENT_RETENTION_DAYS || 7));
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  observe(): Observable<TenantEvent> { return this.events.asObservable(); }

  /**
   * Fan out an event that was already committed by the caller.
   *
   * The local subject is notified synchronously so the screen updates immediately, while the
   * durable copy (realtime_events) and the webhook outbox are written in the background.
   * Background failures are logged and never surface as an unhandled rejection, which would
   * terminate the API process.
   */
  publish(tenantId: string, type: string, data: Record<string, unknown>): void {
    const event: TenantEvent = { id: randomUUID(), tenantId, type, data, occurredAt: new Date().toISOString() };
    this.events.next(event);
    this.background("persistir evento em tempo real", () => this.persist(event));
    this.background("enfileirar webhooks do evento", () => this.dispatch(event));
  }

  private background(label: string, task: () => Promise<void>): void {
    void task().catch((error: unknown) => {
      this.logger.error(`Falha ao ${label}.`, error instanceof Error ? error.stack : String(error));
    });
  }

  private async persist(event: TenantEvent): Promise<void> {
    if (!this.prisma) return;
    for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt += 1) {
      try {
        await this.prisma.$executeRaw`
          INSERT INTO realtime_events (id, tenant_id, type, data, occurred_at, expires_at)
          VALUES (${event.id}::uuid, ${event.tenantId}::uuid, ${event.type}, ${JSON.stringify(event.data)}::jsonb, ${new Date(event.occurredAt)}, NOW() + (${this.retentionDays} * INTERVAL '1 day'))
          ON CONFLICT (id) DO NOTHING
        `;
        return;
      } catch (error) {
        if (attempt === PERSIST_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }
    }
  }

  private async dispatch(event: TenantEvent): Promise<void> {
    if (!this.prisma) return;
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { tenantId: event.tenantId, active: true, OR: [{ events: { has: event.type } }, { events: { has: "*" } }] },
      select: { id: true },
    });
    const payload = { id: event.id, type: event.type, data: event.data, occurredAt: event.occurredAt };
    for (const subscription of subscriptions) {
      await this.prisma.webhookDelivery.create({
        data: {
          id: randomUUID(),
          tenantId: event.tenantId,
          subscriptionId: subscription.id,
          eventId: event.id,
          eventType: event.type,
          payload: JSON.parse(JSON.stringify(payload)),
        },
      });
    }
  }

  stream(tenantId: string): Observable<{ type: string; data: Record<string, unknown> }> {
    const seen = new Set<string>();
    const remember = (id: string) => {
      seen.add(id);
      if (seen.size > SEEN_LIMIT) {
        const oldest = seen.values().next().value;
        if (oldest) seen.delete(oldest);
      }
    };
    const local = this.events.pipe(
      filter((event) => event.tenantId === tenantId),
      tap((event) => remember(event.id)),
      map((event) => ({ type: event.type, data: { ...event.data, occurredAt: event.occurredAt } })),
    );
    if (!this.prisma) return local;

    let cursorAt = new Date(0);
    // Timestamp precision is not enough under bursts: the id breaks ties deterministically.
    let cursorId = "00000000-0000-0000-0000-000000000000";
    const remote = interval(REPLICA_POLL_MS).pipe(
      // A transient database error must not close an open stream: the next tick retries.
      mergeMap(async () => {
        try {
          const rows = await this.prisma!.$queryRaw<PersistedEvent[]>`
            SELECT id, type, data, occurred_at
            FROM realtime_events
            WHERE tenant_id = ${tenantId}::uuid
              AND (occurred_at, id) > (${cursorAt}, ${cursorId}::uuid)
            ORDER BY occurred_at ASC, id ASC
            LIMIT 100
          `;
          if (rows.length) {
            const last = rows[rows.length - 1]!;
            cursorAt = last.occurred_at;
            cursorId = last.id;
          }
          return rows;
        } catch (error) {
          this.logger.warn(
            `Não foi possível ler eventos de outra réplica: ${error instanceof Error ? error.message : String(error)}`,
          );
          return [] as PersistedEvent[];
        }
      }),
      mergeMap((rows) => rows),
      filter((row) => !seen.has(row.id)),
      tap((row) => remember(row.id)),
      map((row) => ({ type: row.type, data: { ...row.data, occurredAt: row.occurred_at.toISOString() } })),
    );
    return merge(local, remote);
  }
}
