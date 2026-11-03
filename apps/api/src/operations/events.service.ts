import { Injectable, Optional } from "@nestjs/common";
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

@Injectable()
export class EventsService {
  private readonly events = new Subject<TenantEvent>();
  private readonly retentionDays = Math.max(1, Number(process.env.REALTIME_EVENT_RETENTION_DAYS || 7));
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  observe(): Observable<TenantEvent> { return this.events.asObservable(); }

  publish(tenantId: string, type: string, data: Record<string, unknown>): void {
    const event: TenantEvent = { id: randomUUID(), tenantId, type, data, occurredAt: new Date().toISOString() };
    this.events.next(event);
    void this.persist(event);
    void this.dispatch(event);
  }

  private async persist(event: TenantEvent): Promise<void> {
    if (!this.prisma) return;
    await this.prisma.$executeRaw`
      INSERT INTO realtime_events (id, tenant_id, type, data, occurred_at, expires_at)
      VALUES (${event.id}::uuid, ${event.tenantId}::uuid, ${event.type}, ${JSON.stringify(event.data)}::jsonb, ${new Date(event.occurredAt)}, NOW() + (${this.retentionDays} * INTERVAL '1 day'))
      ON CONFLICT (id) DO NOTHING
    `;
  }

  private async dispatch(event: TenantEvent): Promise<void> {
    if (!this.prisma) return;
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { tenantId: event.tenantId, active: true, OR: [{ events: { has: event.type } }, { events: { has: "*" } }] },
      select: { id: true },
    });
    const payload = JSON.stringify({ id: event.id, type: event.type, data: event.data, occurredAt: event.occurredAt });
    for (const subscription of subscriptions) {
      await this.prisma.webhookDelivery.create({
        data: { id: randomUUID(), tenantId: event.tenantId, subscriptionId: subscription.id, eventId: event.id, eventType: event.type, payload: JSON.parse(payload) },
      });
    }
  }

  stream(tenantId: string): Observable<{ type: string; data: Record<string, unknown> }> {
    const seen = new Set<string>();
    const local = this.events.pipe(
      filter((event) => event.tenantId === tenantId),
      tap((event) => seen.add(event.id)),
      map((event) => ({ type: event.type, data: { ...event.data, occurredAt: event.occurredAt } })),
    );
    if (!this.prisma) return local;

    let cursor = new Date();
    const remote = interval(2000).pipe(
      mergeMap(async () => {
        const rows = await this.prisma!.$queryRaw<PersistedEvent[]>`
          SELECT id, type, data, occurred_at
          FROM realtime_events
          WHERE tenant_id = ${tenantId}::uuid AND occurred_at > ${cursor}
          ORDER BY occurred_at ASC
          LIMIT 100
        `;
        if (rows.length) cursor = rows[rows.length - 1]!.occurred_at;
        return rows;
      }),
      mergeMap((rows) => rows),
      filter((row) => !seen.has(row.id)),
      tap((row) => seen.add(row.id)),
      map((row) => ({ type: row.type, data: { ...row.data, occurredAt: row.occurred_at.toISOString() } })),
    );
    return merge(local, remote);
  }
}