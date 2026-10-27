import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Serialize writes to one settings key without overwriting other modules' JSON. */
export async function mutateTenantSetting(
  prisma: PrismaService,
  tenantId: string,
  key: string,
  update: (current: Prisma.JsonValue | undefined) => Prisma.InputJsonValue,
) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { integrations: true } });
    const current = tenant.integrations && typeof tenant.integrations === 'object' && !Array.isArray(tenant.integrations) ? tenant.integrations as Prisma.JsonObject : {};
    const value = update(current[key]);
    await tx.tenant.update({ where: { id: tenantId }, data: { integrations: { ...current, [key]: value } as Prisma.InputJsonObject } });
    return value;
  });
}
