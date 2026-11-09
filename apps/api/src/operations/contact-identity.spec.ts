import { bindContactIdentity, resolveContactIdentity } from "./contact-identity";

describe("contact identities", () => {
  it("resolves the stable contact from a provider identity", async () => {
    const contact = { id: "contact-1", tenantId: "tenant-1", name: "Ana", phone: "5511999999999", externalId: "old@c.us" };
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      contactIdentity: {
        findUnique: jest.fn().mockResolvedValue({ id: "identity-1", contact }),
        update: jest.fn().mockResolvedValue({ contact }),
      },
    };
    const result = await resolveContactIdentity(tx, { tenantId: "tenant-1", provider: "waha", externalId: "5511888888888@c.us", phone: "5511888888888" });
    expect(result).toEqual(contact);
    expect(tx.contactIdentity.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "identity-1" } }));
    expect(tx.contact).toBeUndefined();
  });

  it("refuses to rebind an identity already owned by another contact", async () => {
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      contact: { findFirst: jest.fn().mockResolvedValue({ id: "contact-2", tenantId: "tenant-1", name: "Bia" }) },
      contactIdentity: { findUnique: jest.fn().mockResolvedValue({ id: "identity-1", contactId: "contact-1" }) },
    };
    await expect(bindContactIdentity(tx, { tenantId: "tenant-1", contactId: "contact-2", provider: "WAHA", externalId: "5511999999999@c.us" })).rejects.toThrow("IDENTITY_ALREADY_BOUND");
  });
});
