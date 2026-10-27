import { MailService } from "./mail.service";
describe("tenant mail operations", () => {
  const req: any = {
    user: { tenantId: "tenant", sub: "owner", role: "OWNER" },
  };
  it("rejects non-admins before accessing credentials or inboxes", async () => {
    const prisma: any = { mailAccount: { findMany: jest.fn() } };
    await expect(
      new MailService(prisma).list({
        user: { ...req.user, role: "AGENT" },
      } as any),
    ).rejects.toThrow();
    expect(prisma.mailAccount.findMany).not.toHaveBeenCalled();
  });
  it("never falls back to another tenant account", async () => {
    const prisma: any = {
      mailItem: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(
      new MailService(prisma).read(req, "unknown"),
    ).rejects.toThrow();
    expect(prisma.mailItem.findFirst).toHaveBeenCalledWith({
      where: { id: "unknown", tenantId: "tenant" },
    });
  });
  it("deduplicates a campaign audience and excludes suppressed contacts", async () => {
    const create = jest.fn().mockResolvedValue({ id: "campaign" }),
      createMany = jest.fn();
    const prisma: any = {
      mailAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: "account",
            tenantId: "tenant",
            configEncrypted: "",
          }),
      },
      contact: {
        findMany: jest.fn().mockResolvedValue([
          { name: "Ana", email: "ANA@example.test", metadata: {} },
          { name: "Ana", email: "ana@example.test", metadata: {} },
          {
            name: "B",
            email: "b@example.test",
            metadata: { communications: { emailOptOut: true } },
          },
        ]),
      },
      $transaction: (fn: any) =>
        fn({ mailCampaign: { create }, mailDelivery: { createMany } }),
    };
    const service = new MailService(prisma);
    jest.spyOn(service as any, "account").mockResolvedValue({ id: "account" });
    const result = await service.campaign(req, {
      accountId: "account",
      name: "Aniversário",
      subject: "Parabéns",
      html: "<p>Olá</p>",
      contactIds: ["a", "b", "c"],
    });
    expect(result.recipients).toBe(1);
    expect(createMany.mock.calls[0][0].data).toEqual([
      {
        tenantId: "tenant",
        campaignId: "campaign",
        email: "ana@example.test",
        name: "Ana",
      },
    ]);
  });
});
