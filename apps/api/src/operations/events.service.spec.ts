import { EventsService } from "./events.service";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("EventsService", () => {
  it("notifies local subscribers for the right tenant only", () => {
    const service = new EventsService();
    const received: string[] = [];
    const subscription = service.stream("tenant-a").subscribe((event) => received.push(String(event.data.label)));
    service.publish("tenant-a", "message.created", { label: "a" });
    service.publish("tenant-b", "message.created", { label: "b" });
    subscription.unsubscribe();
    expect(received).toEqual(["a"]);
  });

  it("does not crash when the database rejects the durable write", async () => {
    const prisma: any = {
      $executeRaw: jest.fn().mockRejectedValue(new Error("db down")),
      webhookSubscription: { findMany: jest.fn().mockRejectedValue(new Error("db down")) },
    };
    const service = new EventsService(prisma);
    const received: string[] = [];
    const subscription = service.observe().subscribe((event) => received.push(event.type));

    expect(() => service.publish("tenant-a", "conversation.updated", { id: "1" })).not.toThrow();
    await wait(1200);

    // The screen still updates; the failure stays in the log instead of becoming an
    // unhandled rejection that would terminate the API process.
    expect(received).toEqual(["conversation.updated"]);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    subscription.unsubscribe();
  });

  it("retries the durable write until it succeeds", async () => {
    const prisma: any = {
      $executeRaw: jest
        .fn()
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce(1),
      webhookSubscription: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new EventsService(prisma);
    service.publish("tenant-a", "payment.updated", {});
    await wait(600);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("enqueues one webhook delivery per matching subscription", async () => {
    const prisma: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      webhookSubscription: { findMany: jest.fn().mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]) },
      webhookDelivery: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new EventsService(prisma);
    service.publish("tenant-a", "conversation.created", { id: "c1" });
    await wait(150);
    expect(prisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
    const payload = prisma.webhookDelivery.create.mock.calls[0][0].data;
    expect(payload).toMatchObject({ tenantId: "tenant-a", eventType: "conversation.created" });
  });
  it("advances the replica cursor by timestamp and id", async () => {
    jest.useFakeTimers();
    try {
      const occurredAt = new Date("2026-11-03T21:00:00.000Z");
      const eventAt = (index: number) => ({
        id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
        type: "conversation.updated",
        data: { index },
        occurred_at: occurredAt,
      });
      const firstPage = Array.from({ length: 100 }, (_, index) => eventAt(index));
      const secondPage = [eventAt(100)];
      const prisma: any = {
        $queryRaw: jest.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage),
        webhookSubscription: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = new EventsService(prisma);
      const subscription = service.stream("tenant-a").subscribe();
      await jest.advanceTimersByTimeAsync(5000);
      await jest.advanceTimersByTimeAsync(5000);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      const secondCall = prisma.$queryRaw.mock.calls[1] as unknown[];
      expect(secondCall.at(-1)).toBe(firstPage[99]!.id);
      subscription.unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });

});
