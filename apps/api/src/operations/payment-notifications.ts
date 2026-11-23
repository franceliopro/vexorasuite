import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { WahaService } from "./waha.service";
import type { SettlementResult } from "./payment-settlement";

/** Publica os eventos locais e, quando aplicável, a confirmação outbound ao contato. */
export async function publishSettlement(
  prisma: PrismaService,
  events: EventsService,
  waha: WahaService,
  tenantId: string,
  result: SettlementResult,
  providerLabel: string,
  logger: Logger,
): Promise<void> {
  const payment = result.payment;
  events.publish(tenantId, "payment.updated", { id: payment.id, status: payment.status, conversationId: payment.conversationId });
  events.publish(tenantId, "conversation.updated", { id: payment.conversationId });
  if (!result.paid || payment.environment !== "PRODUCTION") return;

  const conversation = result.conversation;
  const channel = conversation?.channelConnection;
  const contact = conversation?.contact;
  const chatId = contact?.externalId?.includes("@") ? contact.externalId
    : contact?.phone ? contact.phone.replace(/\D/g, "") + "@c.us" : null;
  if (!channel || !channel.isActive || channel.provider !== "WAHA" || !chatId || chatId.endsWith("@g.us")) return;

  const amount = Number(payment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const content = `✅ Pagamento confirmado!\nValor: ${amount}\nReferência: ${payment.externalId}\n\nA confirmação foi recebida diretamente do ${providerLabel}. Obrigado!`;
  const queued = await prisma.message.create({
    data: {
      tenantId,
      conversationId: payment.conversationId,
      direction: "OUTBOUND",
      status: "QUEUED",
      content,
      contentType: "text",
      senderName: "Assistente financeiro",
      metadata: { provider: "WAHA", paymentId: payment.id, paymentConfirmation: true },
    },
  });
  events.publish(tenantId, "message.queued", { conversationId: payment.conversationId, message: { id: queued.id, direction: queued.direction, status: queued.status, content: queued.content } });
  void waha.sendText(channel, chatId, content)
    .then(async (providerMessageId) => {
      const sent = await prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId } });
      events.publish(tenantId, "message.sent", { conversationId: payment.conversationId, message: { id: sent.id, direction: sent.direction, status: sent.status, content: sent.content, occurredAt: sent.occurredAt.toISOString() } });
    })
    .catch(async () => {
      const failed = await prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: "WAHA", paymentId: payment.id, paymentConfirmation: true, errorCode: "SEND_FAILED" } } });
      events.publish(tenantId, "message.failed", { conversationId: payment.conversationId, message: { id: failed.id, status: failed.status, content: failed.content } });
    })
    .catch((error) => logger.error("Falha ao atualizar status da confirmação WhatsApp: " + (error instanceof Error ? error.message : "erro desconhecido")));
}
