import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Read after locking: a profile edit must preserve concurrent financial/routing data. */
export async function lockedContact(tx: Prisma.TransactionClient, tenantId: string, contactId: string) {
  await tx.$queryRaw`SELECT id FROM contacts WHERE id = ${contactId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
  const contact = await tx.contact.findFirst({ where: { id: contactId, tenantId } });
  if (!contact) throw new BadRequestException('Contato não encontrado nesta empresa.');
  return contact;
}

export function contactMetadata(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export async function mutateContactMetadata(
  prisma: PrismaService,
  tenantId: string,
  contactId: string,
  mutate: (current: Prisma.JsonObject) => Prisma.InputJsonObject,
) {
  return prisma.$transaction(async tx => {
    const contact = await lockedContact(tx, tenantId, contactId);
    return tx.contact.update({
      where: { id: contact.id },
      data: { metadata: mutate(contactMetadata(contact.metadata)) },
    });
  });
}
