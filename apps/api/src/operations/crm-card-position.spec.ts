import { ContactsController } from "./contacts.controller";

const tenantId = "tenant";
const pipelineId = "12345678-1234-4234-8234-123456789abc";
const req: any = { user: { tenantId, sub: "admin", role: "ADMIN" } };
type Row = { id: string; crmPosition: number | null; metadata?: Record<string, unknown> };

function fixture(rowsByStage: Record<string, Row[]>, moved: Row) {
  const written: Array<{ where: any; data: any }> = [];
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    contact: {
      findFirst: jest.fn().mockResolvedValue({
        id: "a",
        tenantId,
        pipelineId,
        metadata: { crmStage: moved.metadata?.crmStage ?? "new" },
        crmPosition: moved.crmPosition,
      }),
      findMany: jest.fn().mockImplementation(async (args: any) => {
        const stage = args.where?.metadata?.equals;
        return (rowsByStage[stage] ?? []).filter((row) => !args.where?.id || row.id !== args.where.id.not);
      }),
      update: jest.fn().mockImplementation(async (args: any) => ({ id: "a", ...args.data })),
      updateMany: jest.fn().mockImplementation(async (args: any) => {
        written.push(args);
        return { count: 1 };
      }),
    },
  };
  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    contact: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn() },
  };
  const events: any = { publish: jest.fn() };
  return { tx, prisma, events, written, controller: new ContactsController(prisma, events, {} as any) };
}

it("insere no índice escolhido e desloca os vizinhos na mesma etapa", async () => {
  const f = fixture(
    { new: [{ id: "b", crmPosition: 0 }, { id: "c", crmPosition: 1 }, { id: "d", crmPosition: 2 }] },
    { id: "a", crmPosition: 0, metadata: { crmStage: "new" } },
  );
  await f.controller.updateStage(req, "a", { stage: "new", position: 1 });

  const positions = Object.fromEntries(f.written.map(({ where, data }) => [where.id, data.crmPosition]));
  expect(positions).toEqual({ c: 2, d: 3, a: 1 });
  expect(f.written.some(({ where }) => where.id === "b")).toBe(false);
  for (const { where } of f.written) expect(where.tenantId).toBe(tenantId);
  expect(f.tx.$queryRaw).toHaveBeenCalled();
  expect(f.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      tenantId,
      action: "contact.stage_changed",
      details: expect.objectContaining({ from: "new", to: "new", position: 1, previousPosition: 0 }),
    }),
  }));
  expect(f.events.publish).toHaveBeenCalledWith(tenantId, "contact.stage_changed", expect.objectContaining({ position: 1 }));
});

it("acrescenta ao fim quando o chamador envia apenas a etapa", async () => {
  const f = fixture(
    {
      new: [{ id: "b", crmPosition: 0 }, { id: "c", crmPosition: 1 }],
      qualification: [{ id: "x", crmPosition: 0 }, { id: "y", crmPosition: 1 }],
    },
    { id: "a", crmPosition: 0, metadata: { crmStage: "qualification" } },
  );
  await f.controller.updateStage(req, "a", { stage: "new" });

  const positions = Object.fromEntries(f.written.map(({ where, data }) => [where.id, data.crmPosition]));
  expect(positions).toEqual({ a: 2 });
  expect(f.written.some(({ where }) => ["b", "c"].includes(where.id))).toBe(false);
  expect(f.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ details: expect.objectContaining({ from: "qualification", to: "new", position: 2 }) }),
  }));
});

it("rejeita posição inválida sem escrever nem auditar", async () => {
  const f = fixture({ new: [] }, { id: "a", crmPosition: 0 });
  await expect(f.controller.updateStage(req, "a", { stage: "new", position: -1 })).rejects.toThrow("Posição");
  expect(f.written).toEqual([]);
  expect(f.tx.auditLog.create).not.toHaveBeenCalled();
});

it("ordena a listagem por posição, com desempate determinístico", async () => {
  const f = fixture({}, { id: "a", crmPosition: 0 });
  await f.controller.list(req);
  expect(f.prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
    orderBy: [
      { crmPosition: { sort: "asc", nulls: "last" } },
      { updatedAt: "desc" },
      { id: "asc" },
    ],
  }));
});
