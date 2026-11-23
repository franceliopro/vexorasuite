import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { amountToCents, canonicalPaymentProvider, firstString } from "./payment-providers";

/** Cria o registro local que vincula um atendimento a uma cobrança de provedor. */
@Injectable()
export class PaymentRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    userId: string,
    input: {
      provider?: unknown;
      contactId?: unknown;
      conversationId?: unknown;
      amount?: unknown;
      description?: unknown;
    },
  ) {
    const provider = canonicalPaymentProvider(input.provider);
    if (provider !== "STRIPE" && provider !== "INFINITEPAY") {
      throw new BadRequestException("Informe um provedor válido (STRIPE ou INFINITEPAY). Cobranças Asaas usam o fluxo financeiro existente.");
    }
    const contactId = firstString(input.contactId);
    const conversationId = firstString(input.conversationId);
    if (!contactId || !conversationId) throw new BadRequestException("Informe o contato e o atendimento vinculados ao pagamento.");
    const cents = amountToCents(input.amount);
    if (cents < 50) throw new BadRequestException("Informe um valor válido de pelo menos R$ 0,50.");
    if (cents > 999_999_999_999) throw new BadRequestException("Valor acima do limite permitido.");

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, contactId, deletedAt: null },
      select: { id: true, contactId: true },
    });
    if (!conversation) throw new BadRequestException("Atendimento não encontrado para este contato e empresa.");
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true },
    });
    if (!contact) throw new BadRequestException("Contato não encontrado para esta empresa.");

    const description = firstString(input.description);
    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId,
          conversationId,
          contactId,
          provider,
          amount: new Prisma.Decimal(cents).dividedBy(100),
          status: "PENDING",
          environment: provider === "INFINITEPAY" ? "PRODUCTION" : "SANDBOX",
          billingType: null,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: "payment.record_created",
          entityType: "payment",
          entityId: created.id,
          details: { provider, conversationId, contactId, amount: created.amount.toNumber(), environment: created.environment, description: description.slice(0, 120) || null },
        },
      });
      return created;
    });
    return {
      id: payment.id,
      provider: payment.provider,
      amount: payment.amount.toNumber(),
      status: payment.status,
      environment: payment.environment,
      conversationId: payment.conversationId,
      contactId: payment.contactId,
    };
  }
}
