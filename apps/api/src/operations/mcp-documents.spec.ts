import { randomBytes } from "node:crypto";
import { McpController } from "./mcp.controller";

const token = "vx_live_test_documents_seed_spec";
const tokenRow = { id: "token-doc-1", tenantId: "tenant-doc-1" };
const rpc = (method: string, params?: unknown, id: unknown = 1) => ({ jsonrpc: "2.0", id, method, params });

function setup() {
  const template: any = {
    id: "template-1",
    tenantId: tokenRow.tenantId,
    kind: "QUOTE",
    name: "Orçamento",
    description: "",
    variables: [
      { key: "nome_cliente", label: "Nome", type: "text", required: true },
      { key: "escopo", label: "Escopo", type: "longtext", required: true },
      { key: "valor", label: "Valor", type: "money", required: true },
    ],
    body: "Proposta para {{nome_cliente}}\nEscopo:\n{{escopo}}\nValor: {{valor}}\nEmitido em {{data}}",
    tenant: { name: "V-Corporation", integrations: { organization: { legalName: "V-Corporation Tecnologia Ltda", cnpj: "00.000.000/0001-91", address: "Av. Brasil, 100", city: "Rondonópolis", state: "MT" } } },
  };
  const txBase: any = {
    crmPipeline: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue({ id: "p1", stages: [{ id: "new", label: "Novos" }] }) },
    contact: { findFirst: jest.fn().mockResolvedValue({ id: "c1", metadata: {} }), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockImplementation(async (a: any) => ({ id: "c1", ...a.data })) },
    documentTemplate: { findFirst: jest.fn().mockImplementation(async (_a: any, args: any) => template) },
    $queryRaw: jest.fn().mockResolvedValue([{ stage: "new", count: 0n }]),
  };
  const prisma: any = {
    ...txBase,
    publicApiToken: { findFirst: jest.fn().mockResolvedValue(tokenRow), update: jest.fn().mockResolvedValue(tokenRow) },
    conversation: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), groupBy: jest.fn().mockResolvedValue([]) },
    workTask: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: "t1" }) },
    message: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async (a: any) => ({ id: "m1", ...a.data })) },
    auditLog: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn((fn: any) => fn(txBase)),
    generatedDocument: { create: jest.fn().mockImplementation(async (a: any) => ({ id: "doc-1", ...a.data, createdAt: new Date() })) },
    documentTemplate: { ...txBase.documentTemplate, findMany: jest.fn().mockImplementation(async () => [template]) },
  };
  const events: any = { publish: jest.fn() };
  const ai: any = { generate: jest.fn() };
  return { controller: new McpController(prisma, events, ai), prisma };
}

describe("MCP documents tools", () => {
  it("lists prepared templates", async () => {
    const { controller } = setup();
    const out: any = await controller.handle(token, undefined, rpc("tools/call", { name: "list_document_templates", arguments: {} }));
    const parsed = JSON.parse(out.result.content[0].text);
    expect(parsed.templates).toHaveLength(1);
    expect(out.result.isError).toBe(false);
  });
  it("rejects create_document without required values", async () => {
    const { controller } = setup();
    const out: any = await controller.handle(token, undefined, rpc("tools/call", { name: "create_document", arguments: { kind: "QUOTE", values: {} } }));
    expect(out.result.isError).toBe(true);
    expect(out.result.content[0].text).toContain("Preencha");
  });
  it("creates a document with contact-independent values", async () => {
    const { controller, prisma } = setup();
    const out: any = await controller.handle(
      token,
      undefined,
      rpc("tools/call", { name: "create_document", arguments: { kind: "QUOTE", values: { nome_cliente: "Ana Paula", escopo: "Cartão de visita", valor: "R$ 1.200,00" } } }),
    );
    expect(out.result.isError).toBe(false);
    const parsed = JSON.parse(out.result.content[0].text);
    expect(parsed.content).toContain("Proposta para Ana Paula");
    expect(prisma.generatedDocument.create.mock.calls[0][0].data.name).toBe("Orçamento");
  });
});
