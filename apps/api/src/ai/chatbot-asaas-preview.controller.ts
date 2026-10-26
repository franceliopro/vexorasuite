import { BadRequestException, Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type PreviewBody = { conversationId?: string; contactId?: string; action?: string };
const actions = ["asaas.customer.lookup", "asaas.payment.lookup", "asaas.payment.pix", "asaas.payment.boleto"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Administrative sandbox inspection only. This endpoint never calls Asaas,
 * sends messages, creates a payment or exposes payment instruments.
 */
@Controller("chatbot/asaas")
@UseGuards(AuthGuard)
export class ChatbotAsaasPreviewController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("preview")
  async preview(@Req() req: AuthenticatedRequest, @Body() body: PreviewBody) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Acesso financeiro restrito");
    if (!body || !uuid.test(body.conversationId || "") || !uuid.test(body.contactId || "") ||
        !actions.includes(body.action as typeof actions[number])) {
      throw new BadRequestException("Parâmetros inválidos");
    }
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: body.conversationId, tenantId: req.user.tenantId, contactId: body.contactId },
      select: { id: true },
    });
    if (!conversation) throw new ForbiddenException("Conversa e contato não pertencem à empresa");
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: req.user.tenantId, conversationId: conversation.id,
        contactId: body.contactId, provider: "ASAAS", environment: "SANDBOX",
      },
      select: { id: true, status: true, billingType: true, amount: true, environment: true },
      orderBy: { createdAt: "desc" }, take: 20,
    });
    return {
      mode: "sandbox_local_preview", action: body.action,
      executed: false, sent: false, created: false,
      verifiedCustomer: false, requiresCustomerAuthorization: true,
      source: "local_payments_only",
      payments: payments.map(p => ({
        id: p.id, status: p.status, billingType: p.billingType,
        amount: p.amount.toString(), environment: p.environment,
      })),
      message: "Prévia administrativa de pagamentos sandbox já registrados. Não consulta o Asaas ao vivo, não gera PIX ou boleto e não autoriza divulgação ao cliente.",
    };
  }
}
