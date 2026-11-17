import { McpController } from "./mcp.controller";
const tokenRow = { id: "token-1", tenantId: "tenant-1" };
const rpc = (method: string, params?: unknown, id: unknown = 1) => ({ jsonrpc: "2.0", id, method, params });

function setup() {
  const tx: any = {
    publicApiToken: { findFirst: jest.fn().mockResolvedValue(tokenRow), update: jest.fn().mockResolvedValue(tokenRow) },
    conversation: {
      findMany: jest.fn().mockResolvedValue([{ id: "c1", status: "OPEN", priority: "NORMAL", channel: "whatsapp", subject: "Oi", updatedAt: new Date(), handlingMode: "HUMAN", assigneeId: null, contact: { id: "ct1", name: "Ana", phone: "5566", email: null } }]),
      findFirst: jest.fn().mockResolvedValue({ id: "c1" }),
      groupBy: jest.fn().mockResolvedValue([{ status: "OPEN", _count: { _all: 3 } }]),
    },
    contact: { findFirst: jest.fn().mockResolvedValue({ id: "ct1", metadata: {} }), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockImplementation(async (args: any) => ({ id: "ct1", ...args.data })) },
    crmPipeline: { findFirst: jest.fn().mockResolvedValue({ id: "p1", stages: [{ id: "new", label: "Novos", tone: "violet" }, { id: "qualification", label: "Qualificação", tone: "blue" }] }), findMany: jest.fn().mockResolvedValue([{ id: "p1", name: "Vendas", template: "SALES", stages: [{ id: "new", label: "Novos", tone: "violet" }] }]) },
    workTask: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockImplementation(async (_a: any) => ({ id: "t1" })) },
    message: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async (_a: any) => ({ id: "m1", conversationId: "c1", createdAt: new Date() })) },
    membership: { findFirst: jest.fn().mockResolvedValue({ userId: "owner-1" }) },
    auditLog: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([{ stage: "new", count: 2n }]),
  };
  const prisma: any = { ...tx, $transaction: jest.fn((fn: any) => fn(tx)) };
  const events: any = { publish: jest.fn() };
  const ai: any = { generate: jest.fn() };
  return { controller: new McpController(prisma, events, ai), prisma: tx, events };
}

describe("Véxora MCP server", () => {
  it("rejects requests without a token", async () => {
    const { controller } = setup();
    await expect(controller.handle(undefined, undefined, rpc("ping"))).rejects.toThrow("Token");
  });

  it("answers the MCP initialize handshake", async () => {
    const { controller } = setup();
    const out: any = await controller.handle("vx_live_test", undefined, rpc("initialize"));
    expect(out.result.serverInfo.name).toBe("vexora-mcp");
    expect(out.result.capabilities.tools).toBeDefined();
  });

  it("lists sanitized tools and scopes conversations to the tenant", async () => {
    const { controller, prisma } = setup();
    const out: any = await controller.handle("vx_live_test", undefined, rpc("tools/list"));
    const names = (out.result.tools as any[]).map((t) => t.name);
    expect(names).toContain("list_conversations");
    expect(names).toContain("draft_reply");
    expect(JSON.stringify(out)).not.toContain("tokenHash");
    const call: any = await controller.handle("vx_live_test", undefined, rpc("tools/call", { name: "list_conversations", arguments: { limit: 5 } }));
    const payload = JSON.parse(call.result.content[0].text);
    expect(payload.conversations).toHaveLength(1);
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1" }) }));
  });

  it("reports unknown tools as errors without crashing", async () => {
    const { controller } = setup();
    const out: any = await controller.handle("vx_live_test", undefined, rpc("tools/call", { name: "exfiltrate_everything", arguments: {} }));
    expect(out.error.code).toBe(-32602);
  });

  it("adds internal notes and refuses foreign conversations", async () => {
    const { controller, prisma } = setup();
    const ok: any = await controller.handle("vx_live_test", undefined, rpc("tools/call", { name: "add_internal_note", arguments: { conversationId: "c1", text: "Cliente retornar amanhã" } }));
    expect(ok.result.isError).toBe(false);
    expect(prisma.message.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ direction: "INTERNAL", senderName: "Véxora MCP" }) }));
    prisma.conversation.findFirst.mockResolvedValue(null);
    const missing: any = await controller.handle("vx_live_test", undefined, rpc("tools/call", { name: "add_internal_note", arguments: { conversationId: "nope", text: "x" } }));
    expect(missing.result.isError).toBe(true);
  });

  it("moves cards only to stages that belong to the pipeline", async () => {
    const { controller } = setup();
    const moved: any = await controller.handle("vx_live_test", undefined, rpc("tools/call", { name: "move_card_stage", arguments: { contactId: "ct1", pipelineId: "p1", stageId: "qualification" } }));
    expect(moved.result.isError).toBe(false);
    const invalid: any = await controller.handle("vx_live_test", undefined, rpc("tools/call", { name: "move_card_stage", arguments: { contactId: "ct1", pipelineId: "p1", stageId: "stage-nao-existe" } }));
    expect(invalid.result.isError).toBe(true);
    expect(invalid.result.content[0].text).toContain("Etapa");
  });
});
