import { Prisma } from "@prisma/client";

type IdentityInput = {
  tenantId: string;
  provider: string;
  externalId: string;
  phone?: string | null;
  displayName?: string | null;
  metadata?: Prisma.InputJsonValue;
  createContact?: { name: string; source?: string | null };
};

/**
 * Provider IDs are aliases, not the contact's primary identity. This resolver
 * always prefers the durable ContactIdentity record and only uses the legacy
 * Contact.externalId as a migration fallback.
 */
export async function resolveContactIdentity(tx: Prisma.TransactionClient, input: IdentityInput) {
  const provider = input.provider.trim().toUpperCase();
  const externalId = input.externalId.trim();
  if (!provider || !externalId) throw new Error("A identidade externa precisa de provedor e identificador.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId + ":identity:" + provider + ":" + externalId}, 0))`;

  let identity = await tx.contactIdentity.findUnique({
    where: { tenantId_provider_externalId: { tenantId: input.tenantId, provider, externalId } },
    include: { contact: true },
  });
  if (identity) {
    const update: Prisma.ContactIdentityUpdateInput = {
      lastSeenAt: new Date(),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      revokedAt: null,
    };
    identity = await tx.contactIdentity.update({ where: { id: identity.id }, data: update, include: { contact: true } });
    if (input.phone && !identity.contact.phone) {
      return tx.contact.update({ where: { id: identity.contact.id }, data: { phone: input.phone } });
    }
    return identity.contact;
  }

  // Backfill-on-read makes this safe while old tenants migrate asynchronously.
  let contact = await tx.contact.findFirst({ where: { tenantId: input.tenantId, externalId } });
  if (contact) {
    await tx.contactIdentity.create({
      data: {
        tenantId: input.tenantId,
        contactId: contact.id,
        provider,
        externalId,
        phone: input.phone || contact.phone,
        displayName: input.displayName || contact.name,
        metadata: input.metadata || {},
      },
    });
    if (input.phone && !contact.phone) {
      return tx.contact.update({ where: { id: contact.id }, data: { phone: input.phone } });
    }
    return contact;
  }

  if (!input.createContact) return null;
  contact = await tx.contact.create({
    data: {
      tenantId: input.tenantId,
      name: input.createContact.name,
      phone: input.phone || null,
      externalId,
      source: input.createContact.source || provider,
      metadata: input.metadata || {},
    },
  });
  await tx.contactIdentity.create({
    data: {
      tenantId: input.tenantId,
      contactId: contact.id,
      provider,
      externalId,
      phone: input.phone || null,
      displayName: input.displayName || contact.name,
      metadata: input.metadata || {},
    },
  });
  return contact;
}

export async function bindContactIdentity(
  tx: Prisma.TransactionClient,
  input: IdentityInput & { contactId: string },
) {
  const provider = input.provider.trim().toUpperCase();
  const externalId = input.externalId.trim();
  if (!provider || !externalId) throw new Error("A identidade externa precisa de provedor e identificador.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId + ":identity:" + provider + ":" + externalId}, 0))`;
  const contact = await tx.contact.findFirst({ where: { id: input.contactId, tenantId: input.tenantId } });
  if (!contact) return null;
  const existing = await tx.contactIdentity.findUnique({ where: { tenantId_provider_externalId: { tenantId: input.tenantId, provider, externalId } } });
  if (existing && existing.contactId !== contact.id) throw new Error("IDENTITY_ALREADY_BOUND");
  const identity = existing
    ? await tx.contactIdentity.update({ where: { id: existing.id }, data: { phone: input.phone || null, displayName: input.displayName || contact.name, lastSeenAt: new Date(), revokedAt: null }, include: { contact: true } })
    : await tx.contactIdentity.create({ data: { tenantId: input.tenantId, contactId: contact.id, provider, externalId, phone: input.phone || null, displayName: input.displayName || contact.name, metadata: input.metadata || {} }, include: { contact: true } });
  await tx.contact.update({ where: { id: contact.id }, data: { phone: input.phone || contact.phone, externalId } });
  return identity;
}

