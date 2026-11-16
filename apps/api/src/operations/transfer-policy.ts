import { PrismaService } from "../prisma/prisma.service";

export type TransferScope = { anyDepartment: boolean; ownDepartment: boolean; directAgent: boolean };

const DEFAULT_SCOPE: TransferScope = { anyDepartment: false, ownDepartment: true, directAgent: true };

export function sanitizeTransferScope(input: unknown): TransferScope | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Record<string, unknown>;
  return {
    anyDepartment: raw.anyDepartment === true,
    ownDepartment: raw.ownDepartment === true,
    directAgent: raw.directAgent === true,
  };
}

/** Lê o escopo de transferência de um usuário direto das integrations já carregadas. */
export function readTransferScopeFromIntegrations(integrations: unknown, userId: string): TransferScope {
  const raw =
    integrations && typeof integrations === "object" && !Array.isArray(integrations)
      ? (integrations as Record<string, unknown>)
      : {};
  const map =
    raw.teamTransferScope && typeof raw.teamTransferScope === "object" && !Array.isArray(raw.teamTransferScope)
      ? (raw.teamTransferScope as Record<string, Partial<TransferScope>>)
      : {};
  const entry = map[userId];
  if (!entry) return { ...DEFAULT_SCOPE };
  return {
    anyDepartment: entry.anyDepartment === true,
    ownDepartment: entry.ownDepartment === true,
    directAgent: entry.directAgent === true,
  };
}

/**
 * Permissões de transferência por atendente (mapa em integrations.teamTransferScope).
 * Padrão seguro: próprio setor + atendente direto liberados; outros setores bloqueados.
 */
export async function transferScopeOf(
  prisma: PrismaService,
  tenantId: string,
  userId: string,
): Promise<TransferScope> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
  return readTransferScopeFromIntegrations(tenant?.integrations, userId);
}
