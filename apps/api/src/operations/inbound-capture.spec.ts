import { ForbiddenException } from "@nestjs/common";
import { InboundCaptureController } from "./inbound-capture.controller";
import { InboundCaptureService, routeInbound } from "./inbound-capture.service";
import { resolveContactIdentity } from "./contact-identity";
import type { CaptureInboundDto } from "./dto/capture-inbound.dto";

jest.mock("./contact-identity", () => ({ resolveContactIdentity: jest.fn() }));

const input = {
  provider: "GHL",
  externalEventId: "evt-123",
  externalContactId: "lead-456",
  name: "Maria",
  phone: "11999999999",
  email: "maria@example.com",
  content: "Olá, preciso de ajuda",
  channel: "API",
  source: "landing-page",
  campaignId: "camp-1",
} as CaptureInboundDto;

describe("Captura inbound unificada", () => {
  function setup() {
    const contact = { id: "contact-1", name: "Maria", phone: null, email: null, externalId: "lead-456" };
    const occurredAt = new Date("2026-11-26T12:00:00.000Z");
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      message: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "message-1", occurredAt }),
      },
      contact: { update: jest.fn().mockResolvedValue(contact) },
      conversation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "conversation-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
      department: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: (value: any) => unknown) => callback(tx)),
      channelConnection: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const events: any = { publish: jest.fn() };
    (resolveContactIdentity as jest.Mock).mockResolvedValue(contact);
    return { service: new InboundCaptureService(prisma, events), prisma, events, tx, contact };
  }

  it(" decide o destino por regras determinísticas antes de qualquer IA", () => {
    expect(routeInbound("atendente")).toMatchObject({ reason: "explicit_human_request", optOut: false });
    expect(routeInbound("PARAR")).toMatchObject({ reason: "opt_out_requested", optOut: true });
    expect(routeInbound("Olá")).toMatchObject({ reason: "deterministic_default", handlingMode: "HUMAN" });
  });

  it("grava contato, conversa, mensagem e auditoria no tenant da sessão", async () => {
    const { service, tx, events } = setup();

    const result = await service.capture("tenant-a", "user-1", input);

    expect(result).toMatchObject({ ok: true, duplicate: false, conversationId: "conversation-1", messageId: "message-1", handlingMode: "HUMAN" });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(resolveContactIdentity).toHaveBeenCalledWith(tx, expect.objectContaining({ tenantId: "tenant-a", provider: "GHL", externalId: "lead-456" }));
    expect(tx.conversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-a", handlingMode: "HUMAN", channel: "API" }),
    }));
    expect(tx.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-a", providerMessageId: "inbound:GHL:evt-123", direction: "INBOUND" }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: "tenant-a", userId: "user-1", action: "inbound.captured" }),
    }));
    expect(events.publish).toHaveBeenCalledWith("tenant-a", "inbound.captured", expect.any(Object));
    expect(events.publish).toHaveBeenCalledWith("tenant-a", "message.received", expect.any(Object));
  });

  it("trata o mesmo externalEventId como duplicata sem gravar ou publicar de novo", async () => {
    const { service, tx, events } = setup();
    tx.message.findFirst.mockResolvedValueOnce({ id: "message-1" });

    const result = await service.capture("tenant-a", "user-1", input);

    expect(result).toMatchObject({ ok: true, duplicate: true });
    expect(tx.message.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("rejeita canal de outro tenant", async () => {
    const { service, prisma } = setup();
    prisma.channelConnection.findFirst.mockResolvedValueOnce(null);

    await expect(service.capture("tenant-a", "user-1", { ...input, channelConnectionId: "11111111-1111-4111-8111-111111111111" }))
      .rejects.toThrow(/Canal não encontrado/);
  });
});

describe("InboundCaptureController", () => {
  it("nega captura a papéis sem permissão administrativa", async () => {
    const service: any = { capture: jest.fn() };
    const controller = new InboundCaptureController(service);
    const request: any = { user: { tenantId: "tenant-a", sub: "user-1", role: "MANAGER" } };

    await expect(controller.capture(request, input)).rejects.toThrow(ForbiddenException);
    expect(service.capture).not.toHaveBeenCalled();
  });

  it("usa somente o tenant da sessão", async () => {
    const service: any = { capture: jest.fn().mockResolvedValue({ ok: true, duplicate: false }) };
    const controller = new InboundCaptureController(service);
    const request: any = { user: { tenantId: "tenant-a", sub: "user-1", role: "ADMIN" } };

    await controller.capture(request, input);

    expect(service.capture).toHaveBeenCalledWith("tenant-a", "user-1", input);
  });
});
