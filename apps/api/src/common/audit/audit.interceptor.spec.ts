import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { firstValueFrom } from "rxjs";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditCovered } from "./audit.decorator";

const flush = () => new Promise((resolve) => setImmediate(resolve));
const handlerOf = (value: unknown = "ok"): CallHandler => ({ handle: () => of(value) });

interface Options {
  method?: string;
  user?: { sub: string; tenantId: string } | undefined;
  body?: unknown;
  params?: Record<string, string>;
  status?: number;
  covered?: boolean;
}

function setup(options: Options) {
  const create = jest.fn().mockResolvedValue({});
  const prisma = { auditLog: { create } } as any;
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(Boolean(options.covered)) } as any;
  const interceptor = new AuditInterceptor(prisma, reflector);
  const request = {
    method: options.method ?? "POST",
    path: "/api/contacts",
    route: { path: "/contacts" },
    params: options.params ?? {},
    user: options.user === null ? undefined : options.user ?? { sub: "user-1", tenantId: "tenant-1" },
    body: options.body,
  };
  const response = { statusCode: options.status ?? 201 };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
  return { interceptor, context, create };
}

describe("AuditInterceptor", () => {
  it("records the actor, route and status of a state-changing request", async () => {
    const { interceptor, context, create } = setup({
      method: "POST",
      params: { id: "2f6f0c1e-0b7a-4c2f-9a1e-9c1f2d3e4f50" },
    });
    await firstValueFrom(interceptor.intercept(context, handlerOf()));
    await flush();
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "api.post",
      entityType: "contacts",
      entityId: "2f6f0c1e-0b7a-4c2f-9a1e-9c1f2d3e4f50",
    });
    expect(data.details).toMatchObject({ method: "POST", route: "/contacts", status: 201 });
  });

  it("never stores the request body, which carries passwords and personal data", async () => {
    const { interceptor, context, create } = setup({
      method: "POST",
      body: { password: "segredo", email: "cliente@exemplo.com", content: "mensagem privada" },
    });
    await firstValueFrom(interceptor.intercept(context, handlerOf()));
    await flush();
    const details = JSON.stringify(create.mock.calls[0][0].data.details);
    expect(details).not.toContain("segredo");
    expect(details).not.toContain("cliente@exemplo.com");
    expect(details).not.toContain("mensagem privada");
  });

  it("ignores reads", async () => {
    const { interceptor, context, create } = setup({ method: "GET" });
    await firstValueFrom(interceptor.intercept(context, handlerOf()));
    await flush();
    expect(create).not.toHaveBeenCalled();
  });

  it("ignores anonymous requests, which have no tenant to attach to", async () => {
    const { interceptor, context, create } = setup({ method: "POST", user: null as any });
    await firstValueFrom(interceptor.intercept(context, handlerOf()));
    await flush();
    expect(create).not.toHaveBeenCalled();
  });

  it("leaves controllers with semantic entries alone", async () => {
    const { interceptor, context, create } = setup({ covered: true });
    await firstValueFrom(interceptor.intercept(context, handlerOf()));
    await flush();
    expect(create).not.toHaveBeenCalled();
  });

  it("records the failure and still propagates the error", async () => {
    const { interceptor, context, create } = setup({ method: "DELETE" });
    const failure = Object.assign(new Error("Contato não encontrado"), { status: 404 });
    await expect(
      firstValueFrom(interceptor.intercept(context, { handle: () => throwError(() => failure) })),
    ).rejects.toThrow("Contato não encontrado");
    await flush();
    expect(create.mock.calls[0][0].data.details).toMatchObject({
      method: "DELETE",
      status: 404,
      error: "Contato não encontrado",
    });
  });

  it("does not fail the request when the audit write breaks", async () => {
    const { interceptor, context, create } = setup({ method: "POST" });
    create.mockRejectedValue(new Error("db down"));
    await expect(firstValueFrom(interceptor.intercept(context, handlerOf()))).resolves.toBe("ok");
    await flush();
  });

  it("exposes the decorator used by covered controllers", () => {
    expect(typeof AuditCovered()).toBe("function");
  });
});
