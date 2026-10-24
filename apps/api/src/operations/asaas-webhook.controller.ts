import { Body, Controller, ForbiddenException, Headers, Logger, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { AsaasService } from "./asaas.service";
import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";
import { WahaService } from "./waha.service";

@Controller("webhooks/asaas")
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);
  constructor(private readonly prisma: PrismaService, private readonly asaas: AsaasService, private readonly events: EventsService, private readonly waha: WahaService) {}

  @Post(":tenantId")
  async receive(@Param("tenantId", ParseUUIDPipe) tenantId: string, @Headers("asaas-access-token") token: string | undefined, @Body() body: unknown) {
    if (!(await this.asaas.verifyWebhookToken(tenantId, token))) {
      this.logger.warn("Webhook Asaas recusado: token inválido.");
      throw new ForbiddenException("Token do webhook Asaas inválido.");
    }
    const result = await this.asaas.settleWebhook(tenantId, body);
    if (!result) return { ok: true, ignored: true };
    const payment = result.payment;
    this.events.publish(tenantId, "payment.updated", { id: payment.id, status: payment.status, conversationId: payment.conversationId });
    this.events.publish(tenantId, "conversation.updated", { id: payment.conversationId });
    if (result.paid && payment.environment === "PRODUCTION") {
      const conversation = result.conversation;
      const channel = conversation.channelConnection;
      const contact = conversation.contact;
      const chatId = contact.externalId?.includes("@") ? contact.externalId
        : contact.phone ? contact.phone.replace(/\D/g, "") + "@c.us" : null;
      if (channel && channel.isActive && channel.provider === "WAHA" && chatId && !chatId.endsWith("@g.us")) {
        const amount = Number(payment.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const content = "✅ Pagamento confirmado!\nValor: " + amount + "\nReferência: " + payment.externalId + "\n\nA confirmação foi recebida diretamente do Asaas. Obrigado!";
        const queued = await this.prisma.message.create({ data: { tenantId, conversationId: payment.conversationId, direction: "OUTBOUND", status: "QUEUED", content, contentType: "text", senderName: "Assistente financeiro", metadata: { provider: "WAHA", paymentId: payment.id, paymentConfirmation: true } } });
        this.events.publish(tenantId, "message.queued", { conversationId: payment.conversationId, message: { id: queued.id, direction: queued.direction, status: queued.status, content: queued.content } });

        // Acknowledge Asaas without waiting for the WhatsApp provider; slow sends must not time out the webhook.
        void this.waha.sendText(channel, chatId, content)
          .then(async (providerMessageId) => {
            const sent = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId } });
            this.events.publish(tenantId, "message.sent", { conversationId: payment.conversationId, message: { id: sent.id, direction: sent.direction, status: sent.status, content: sent.content, occurredAt: sent.occurredAt.toISOString() } });
          })
          .catch(async () => {
            const failed = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: "WAHA", paymentId: payment.id, paymentConfirmation: true, errorCode: "SEND_FAILED" } } });
            this.events.publish(tenantId, "message.failed", { conversationId: payment.conversationId, message: { id: failed.id, status: failed.status, content: failed.content } });
          })
          .catch((error) => this.logger.error("Falha ao atualizar status da confirmação WhatsApp: " + (error instanceof Error ? error.message : "erro desconhecido")));
      }
    }
    return { ok: true };
  }
}
