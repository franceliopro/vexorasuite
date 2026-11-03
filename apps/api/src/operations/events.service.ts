import { Injectable, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { decryptWebhookSecret } from "./webhook-crypto";
import { filter, map, Observable, Subject } from "rxjs";

export interface TenantEvent {
  tenantId: string;
  type: string;
  data: Record<string, unknown>;
  occurredAt: string;
}

@Injectable()
export class EventsService {
  private readonly events = new Subject<TenantEvent>();
  constructor(@Optional() private readonly prisma?: PrismaService) {}
  observe(): Observable<TenantEvent> { return this.events.asObservable(); }

  publish(tenantId: string, type: string, data: Record<string, unknown>): void {
    const event = { tenantId, type, data, occurredAt: new Date().toISOString() };
    this.events.next(event);
    void this.dispatch(event);
  }


  private async dispatch(event: TenantEvent) {
    if (!this.prisma) return;
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { tenantId: event.tenantId, active: true, OR: [{ events: { has: event.type } }, { events: { has: "*" } }] },
      select: { id: true, url: true, secretCiphertext: true },
    });
    const eventId = randomUUID();
    const payload = JSON.stringify({ id: eventId, type: event.type, data: event.data, occurredAt: event.occurredAt });
    for (const subscription of subscriptions) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: { id: randomUUID(), tenantId: event.tenantId, subscriptionId: subscription.id, eventId, eventType: event.type, payload: JSON.parse(payload) },
      });
      // A fila persistida é processada pelo webhook-worker. Não fazemos fetch dentro da requisição.\n      // Isso permite recuperar entregas após reinícios e evita concorrência entre réplicas.
    }
  }

  stream(tenantId: string): Observable<{ type: string; data: Record<string, unknown> }> {
    return this.events.pipe(
      filter((event) => event.tenantId === tenantId),
      map((event) => ({
        type: event.type,
        data: { ...event.data, occurredAt: event.occurredAt },
      })),
    );
  }
}
