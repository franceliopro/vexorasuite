import { ConversationDistributionService } from "./conversation-distribution.service";

describe("ConversationDistributionService", () => {
  it("selects the least-loaded active member and assigns the conversation", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      tenant: { findUnique: jest.fn().mockResolvedValue({ integrations: { distributionSettings: { enabled: true } } }) },
      department: { findFirst: jest.fn().mockResolvedValue({ id: "dept", routingStrategy: "LOAD_BALANCED", maxOpenConversations: 0, members: [{ userId: "b" }, { userId: "a" }] }) },
      conversation: { groupBy: jest.fn().mockResolvedValue([{ assigneeId: "a", _count: { _all: 2 } }, { assigneeId: "b", _count: { _all: 0 } }]), updateMany },
      auditLog: { findMany: jest.fn().mockResolvedValue([]), create: auditCreate },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) } as any;
    const service = new ConversationDistributionService(prisma);
    await expect(service.assign("tenant", "conversation", "dept")).resolves.toBe("b");
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assigneeId: "b", handlingMode: "HUMAN" } }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "conversation.distribution.assigned", details: { departmentId: "dept", assigneeId: "b", strategy: "LOAD" } }) }));
  });

  it("continues the round-robin cursor from the last assignment audit", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      tenant: { findUnique: jest.fn().mockResolvedValue({ integrations: { distributionSettings: { enabled: true, strategy: "ROUND_ROBIN" } } }) },
      department: { findFirst: jest.fn().mockResolvedValue({ id: "dept", routingStrategy: "ROUND_ROBIN", maxOpenConversations: 0, members: [{ userId: "a" }, { userId: "b" }, { userId: "c" }] }) },
      conversation: { groupBy: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { findMany: jest.fn().mockResolvedValue([{ details: { departmentId: "dept", assigneeId: "b", strategy: "ROUND_ROBIN" } }]), create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) } as any;
    await expect(new ConversationDistributionService(prisma).assign("tenant", "conversation", "dept")).resolves.toBe("c");
  });

  it("does not assign when every member reached the configured limit", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      tenant: { findUnique: jest.fn().mockResolvedValue({ integrations: { enabled: true } }) },
      department: { findFirst: jest.fn().mockResolvedValue({ id: "dept", routingStrategy: "ROUND_ROBIN", maxOpenConversations: 1, members: [{ userId: "a" }] }) },
      conversation: { groupBy: jest.fn().mockResolvedValue([{ assigneeId: "a", _count: { _all: 1 } }]), updateMany: jest.fn() },
      auditLog: { findMany: jest.fn(), create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) } as any;
    await expect(new ConversationDistributionService(prisma).assign("tenant", "conversation", "dept")).resolves.toBeNull();
  });
});
