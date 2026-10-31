import { ConversationDistributionService } from "./conversation-distribution.service";

describe("ConversationDistributionService", () => {
  it("selects the least-loaded active member and assigns the conversation", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      department: { findFirst: jest.fn().mockResolvedValue({ id: "dept", routingStrategy: "LOAD_BALANCED", maxOpenConversations: 0, members: [{ userId: "b" }, { userId: "a" }] }) },
      conversation: { groupBy: jest.fn().mockResolvedValue([{ assigneeId: "a", _count: { _all: 2 } }, { assigneeId: "b", _count: { _all: 0 } }]), updateMany },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) } as any;
    const service = new ConversationDistributionService(prisma);
    await expect(service.assign("tenant", "conversation", "dept")).resolves.toBe("b");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assigneeId: "b", handlingMode: "HUMAN" } }));
  });

  it("does not assign when every member reached the configured limit", async () => {
    const tx = {
      department: { findFirst: jest.fn().mockResolvedValue({ id: "dept", routingStrategy: "ROUND_ROBIN", maxOpenConversations: 1, members: [{ userId: "a" }] }) },
      conversation: { groupBy: jest.fn().mockResolvedValue([{ assigneeId: "a", _count: { _all: 1 } }]), updateMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) } as any;
    await expect(new ConversationDistributionService(prisma).assign("tenant", "conversation", "dept")).resolves.toBeNull();
  });
});
