import { ForbiddenException } from "@nestjs/common";
import { BillingFollowUpPolicyController } from "./billing-follow-up-policy.controller";
import { DEFAULT_BILLING_FOLLOW_UP_POLICY, canSend, normalizeBillingFollowUpPolicy, pickVariant } from "./billing-follow-up-policy";

describe("Política de follow-up de cobrança", () => {
  it("exige pelo menos cinco variantes e mantém o opt-out obrigatório", () => {
    expect(() => normalizeBillingFollowUpPolicy({ variants: [] })).toThrow(/5 variantes/);

    const policy = normalizeBillingFollowUpPolicy({ ...DEFAULT_BILLING_FOLLOW_UP_POLICY, enabled: true, optOutRespected: false });

    expect(policy.enabled).toBe(true);
    expect(policy.optOutRespected).toBe(true);
    expect(policy.variants).toHaveLength(5);
  });

  it("escolhe a variante de forma determinística para o mesmo contato e tentativa", () => {
    const policy = normalizeBillingFollowUpPolicy(DEFAULT_BILLING_FOLLOW_UP_POLICY);

    const first = pickVariant(policy, "contact-1", 2);
    const second = pickVariant(policy, "contact-1", 2);

    expect(first).toEqual(second);
    expect(policy.variants).toContainEqual(first);
  });

  it("respeita intervalo, limite diário e janela silenciosa", () => {
    const policy = normalizeBillingFollowUpPolicy({
      ...DEFAULT_BILLING_FOLLOW_UP_POLICY,
      minIntervalMinutes: 60,
      maxPerDay: 2,
      quietStartHour: 20,
      quietEndHour: 8,
    });
    const noon = new Date("2026-11-26T12:00:00.000Z"); // 09:00 em America/Sao_Paulo

    expect(canSend({ policy, lastSentAt: new Date(noon.getTime() - 30 * 60_000), now: noon, sentToday: 0 })).toBe(false);
    expect(canSend({ policy, lastSentAt: new Date(noon.getTime() - 120 * 60_000), now: noon, sentToday: 1 })).toBe(true);
    expect(canSend({ policy, lastSentAt: null, now: noon, sentToday: 2 })).toBe(false);
    expect(canSend({ policy, lastSentAt: null, now: new Date("2026-11-26T23:00:00.000Z"), sentToday: 0 })).toBe(false);
  });
});

describe("BillingFollowUpPolicyController", () => {
  function setup(role = "ADMIN") {
    const request: any = { user: { tenantId: "tenant-a", sub: "user-1", role } };
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ integrations: {} }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma: any = {
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ integrations: {} }) },
      $transaction: jest.fn(async (callback: (value: any) => unknown) => callback(tx)),
    };
    return { controller: new BillingFollowUpPolicyController(prisma), request, prisma, tx };
  }

  it("lê a política do tenant atual", async () => {
    const { controller, request, prisma } = setup();
    prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({ integrations: { billingFollowUp: { ...DEFAULT_BILLING_FOLLOW_UP_POLICY, enabled: true } } });

    const result = await controller.get(request);

    expect(prisma.tenant.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "tenant-a" }, select: { integrations: true } });
    expect(result.enabled).toBe(true);
  });

  it("persiste a política no JSON do tenant sem tocar em outras integrações", async () => {
    const { controller, request, prisma, tx } = setup();

    const result = await controller.put(request, DEFAULT_BILLING_FOLLOW_UP_POLICY);

    expect(result).toMatchObject({ enabled: false, maxPerDay: 3, optOutRespected: true });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.tenant.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "tenant-a" },
      data: expect.objectContaining({ integrations: expect.objectContaining({ billingFollowUp: expect.any(Object) }) }),
    }));
  });

  it("nega leitura e escrita a papéis sem acesso financeiro", async () => {
    const { controller, request, prisma, tx } = setup("MANAGER");

    await expect(controller.get(request)).rejects.toThrow(ForbiddenException);
    await expect(controller.put(request, DEFAULT_BILLING_FOLLOW_UP_POLICY)).rejects.toThrow(ForbiddenException);
    expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });
});
