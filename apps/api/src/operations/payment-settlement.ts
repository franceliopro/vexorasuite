import { PrismaService } from "../prisma/prisma.service";
import { amountsMatch, paymentProviderAliases, type PaymentProvider } from "./payment-providers";

export type SettlementStatus = "PAID" | "CANCELLED" | "OVERDUE";
export type SettlementResult = { payment: any; conversation: any; paid: boolean };

/**
 * Aplica o resultado confirmado por um provedor a um Payment local.
 * Nunca aceita evento sem referência local, valor conferido ou environment compatível.
 */
export async function settleProviderPayment(
  prisma: PrismaService,
  tenantId: string,
  args: {
    provider: Exclude<PaymentProvider, "ASAAS">;
    externalId: string;
    status: SettlementStatus;
    event: string;
    environment: "TEST" | "LIVE" | "PRODUCTION";
    amountCents?: unknown;
    details?: Record<string, unknown>;
    internalNote?: string;
  },
): Promise<SettlementResult | null> {
  if (!args.externalId) return null;
  const existing = await prisma.payment.findFirst({
    where: { tenantId, provider: { in: paymentProviderAliases(args.provider) }, externalId: args.externalId },
    include: { conversation: { include: { contact: true, channelConnection: true } } },
  });
  if (!existing) return null;
  const expectedEnvironment = args.environment === "TEST" ? "SANDBOX" : "PRODUCTION";
  if (String(existing.environment) !== expectedEnvironment) return null;
  if (args.amountCents !== undefined && !amountsMatch(args.amountCents, existing.amount)) return null;
  if (existing.status === "PAID" && args.status !== "CANCELLED") return null;
  if (existing.status === args.status) return null;

  const statusGuard = args.status === "CANCELLED"
    ? { not: "CANCELLED" }
    : { notIn: ["PAID", "CANCELLED", args.status] };
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({
      where: { id: existing.id, tenantId, status: statusGuard },
      data: { status: args.status },
    });
    if (result.count) {
      await tx.auditLog.create({
        data: {
          tenantId,
          action: "payment.status_changed",
          entityType: "payment",
          entityId: existing.id,
          details: {
            provider: args.provider,
            externalId: args.externalId,
            event: args.event,
            fromStatus: existing.status,
            toStatus: args.status,
            environment: existing.environment,
            ...(args.details || {}),
          },
        },
      });
    }
    return result;
  });
  if (!changed.count) return null;

  const updated = await prisma.payment.findFirst({
    where: { id: existing.id, tenantId },
    include: { conversation: { include: { contact: true, channelConnection: true } } },
  });
  if (!updated) return null;
  const amount = Number(updated.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await prisma.message.create({
    data: {
      tenantId,
      conversationId: updated.conversationId,
      direction: "INTERNAL",
      status: "RECEIVED",
      content: args.internalNote || `${args.status === "PAID" ? "Pagamento confirmado" : "Pagamento atualizado"} por ${args.provider} · ${amount}`,
      contentType: "text",
      senderName: "Sistema financeiro",
      metadata: { provider: args.provider, paymentId: updated.id, event: args.event, environment: updated.environment },
    },
  });
  return { payment: updated, conversation: existing.conversation, paid: args.status === "PAID" };
}
