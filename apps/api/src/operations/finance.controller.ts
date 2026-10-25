import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID"]);
const EXCLUDED = new Set(["REFUNDED", "CANCELLED", "DELETED"]);
const money = (value: unknown) => Number(value || 0);
@Controller("finance")
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dashboard")
  async dashboard(@Req() req: AuthenticatedRequest, @Query("months") period?: string) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Acesso financeiro restrito à administração.");
    const months = [2, 3, 6, 12].includes(Number(period)) ? Number(period) : 6;
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
    const payments = await this.prisma.payment.findMany({
      where: { tenantId: req.user.tenantId, createdAt: { gte: from }, provider: "ASAAS" },
      select: { id: true, amount: true, status: true, environment: true, createdAt: true, contactId: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const eligible = payments.filter(p => !EXCLUDED.has(p.status.toUpperCase()));
    const totals = { billed: 0, paid: 0, open: 0, count: eligible.length, overdueCount: 0 };
    const buckets = Array.from({ length: months }, (_, i) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1 + i, 1));
      return { month: date.toISOString().slice(0, 7), billed: 0, paid: 0, open: 0 };
    });
    for (const p of eligible) {
      const amount = money(p.amount);
      const paid = PAID.has(p.status.toUpperCase());
      const month = p.createdAt.toISOString().slice(0, 7);
      const bucket = buckets.find(b => b.month === month);
      totals.billed += amount;
      if (paid) totals.paid += amount; else totals.open += amount;
      if (bucket) { bucket.billed += amount; if (paid) bucket.paid += amount; else bucket.open += amount; }
    }
    const outstandingByContact = new Map<string, { count: number; amount: number }>();
    for (const p of eligible.filter(p => !PAID.has(p.status.toUpperCase()))) {
      const previous = outstandingByContact.get(p.contactId) || { count: 0, amount: 0 };
      outstandingByContact.set(p.contactId, { count: previous.count + 1, amount: previous.amount + money(p.amount) });
    }
    return {
      source: "LOCAL_PAYMENT_RECORDS", partial: payments.length === 10000,
      caveat: "Indicadores calculados somente sobre pagamentos registrados em atendimentos na Véxora. Não representam a carteira completa do Asaas; vencimento e inadimplência real exigem conciliação de cobranças.",
      environment: [...new Set(payments.map(p => p.environment))],
      months, totals, series: buckets, outstandingContacts: outstandingByContact.size,
      collectionRate: totals.billed > 0 ? Math.round(totals.paid / totals.billed * 1000) / 10 : null,
    };
  }
}
