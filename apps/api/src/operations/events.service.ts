import { Injectable } from "@nestjs/common";
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

  publish(tenantId: string, type: string, data: Record<string, unknown>): void {
    this.events.next({ tenantId, type, data, occurredAt: new Date().toISOString() });
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
