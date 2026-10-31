import { Injectable, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { decryptWebhookSecret, signWebhookPayload } from "./webhook-crypto";
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
      void this.deliver(delivery.id, subscription.url, decryptWebhookSecret(subscription.secretCiphertext), payload);
    }
  }

  private async deliver(id: string, url: string, secret: string, payload: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-vexora-event": "sha256=" + signWebhookPayload(secret, payload) }, body: payload, signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          await this.prisma?.webhookDelivery.update({ where: { id }, data: { status: "DELIVERED", attempts: attempt, responseStatus: response.status } });
          return;
        }
        throw new Error("HTTP " + response.status);
      } catch (error) {
        const final = attempt === 3;
        await this.prisma?.webhookDelivery.update({ where: { id }, data: { status: final ? "FAILED" : "RETRYING", attempts: attempt, responseStatus: null, lastError: error instanceof Error ? error.message.slice(0, 240) : "Falha na entrega." } });
        if (!final) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
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
