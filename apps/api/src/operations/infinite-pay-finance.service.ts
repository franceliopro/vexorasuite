import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { paymentProviderAliases } from "./payment-providers";

const CAVEAT = "Painel local e parcial: mostra somente links criados pela Véxora e confirmados por payment_check. Não representa a conta InfinitePay.";
const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID"]);
const EXCLUDED = new Set(["REFUNDED", "CANCELLED", "DELETED"]);

type Pagination = { offset: number; limit: number };
type DashboardRange = { from: Date; until: Date; months: number };

@Injectable()
export class InfinitePayFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private where(tenantId: string) {
    return { tenantId, provider: { in: paymentProviderAliases("INFINITEPAY") } };
  }

  private pagination(input: Partial<Pagination>): Pagination {
    const offset = Number.isSafeInteger(input.offset) && input.offset! >= 0 ? input.offset! : 0;
    const requested = Number.isSafeInteger(input.limit) && input.limit! > 0 ? input.limit! : 50;
    return { offset, limit: Math.min(requested, 100) };
  }

  async listCharges(tenantId: string, input: Partial<Pagination> = {}) {
    const { offset, limit } = this.pagination(input);
    const where = this.where(tenantId);
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          amount: true,
          status: true,
          invoiceUrl: true,
          environment: true,
          createdAt: true,
          contact: { select: { id: true, name: true, phone: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      source: "LOCAL_RECORDS",
      provider: "INFINITEPAY",
      caveat: CAVEAT,
      total,
      offset,
      limit,
      items: items.map((payment) => ({
        id: payment.id,
        externalId: payment.externalId || null,
        orderNsu: payment.externalId || payment.id,
        amount: Number(payment.amount),
        currency: "BRL",
        status: payment.status,
        environment: payment.environment,
        invoiceUrl: payment.invoiceUrl || null,
        createdAt: payment.createdAt.toISOString(),
        contact: {
          id: payment.contact.id,
          name: payment.contact.name,
          phone: payment.contact.phone || null,
          email: payment.contact.email || null,
        },
      })),
    };
  }

  async listCustomers(tenantId: string, input: Partial<Pagination> = {}) {
    const { offset, limit } = this.pagination(input);
    const rows = await this.prisma.payment.findMany({
      where: this.where(tenantId),
      select: { contactId: true, amount: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const grouped = new Map<string, { charges: number; outstandingCents: number; lastChargeAt: Date | null }>();
    for (const row of rows) {
      const current = grouped.get(row.contactId) || { charges: 0, outstandingCents: 0, lastChargeAt: null };
      current.charges += 1;
      if (!PAID.has(row.status.toUpperCase()) && !EXCLUDED.has(row.status.toUpperCase())) {
        current.outstandingCents += Math.round(Number(row.amount) * 100);
      }
      if (!current.lastChargeAt || row.createdAt > current.lastChargeAt) current.lastChargeAt = row.createdAt;
      grouped.set(row.contactId, current);
    }
    const ids = [...grouped.keys()].slice(offset, offset + limit);
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    });
    const byId = new Map(contacts.map((contact) => [contact.id, contact]));
    return {
      source: "LOCAL_RECORDS",
      provider: "INFINITEPAY",
      caveat: "Contatos da Véxora com links InfinitePay. A API da InfinitePay não expõe clientes da conta.",
      total: grouped.size,
      offset,
      limit,
      items: ids.map((id) => {
        const contact = byId.get(id);
        const summary = grouped.get(id)!;
        return {
          id,
          name: contact?.name || "Contato removido",
          phone: contact?.phone || null,
          email: contact?.email || null,
          createdAt: contact?.createdAt.toISOString() || null,
          charges: summary.charges,
          outstandingCents: summary.outstandingCents,
          lastChargeAt: summary.lastChargeAt?.toISOString() || null,
        };
      }),
    };
  }

  async listCatalog(tenantId: string, input: Partial<Pagination> = {}) {
    const { offset, limit } = this.pagination(input);
    const where = { tenantId, category: "INFINITEPAY", active: true };
    const [items, total] = await Promise.all([
      this.prisma.catalogItem.findMany({
        where,
        select: { id: true, kind: true, name: true, description: true, sku: true, priceCents: true, currency: true, unit: true, imageUrl: true, category: true },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      this.prisma.catalogItem.count({ where }),
    ]);
    return {
      source: "LOCAL_RECORDS",
      provider: "INFINITEPAY",
      caveat: "Catálogo local da Vexora. A InfinitePay recebe apenas descrição, preço e quantidade de cada item no link.",
      total,
      offset,
      limit,
      items,
    };
  }

  async dashboard(tenantId: string, range: DashboardRange) {
    const rows = await this.prisma.payment.findMany({
      where: { ...this.where(tenantId), createdAt: { gte: range.from, lte: range.until } },
      select: { id: true, amount: true, status: true, environment: true, createdAt: true, contactId: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const eligible = rows.filter((row) => !EXCLUDED.has(row.status.toUpperCase()));
    const totals = { billed: 0, paid: 0, open: 0, count: eligible.length, overdueCount: 0 };
    const buckets = Array.from({ length: range.months }, (_, index) => {
      const date = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth() + index, 1));
      return { month: date.toISOString().slice(0, 7), billed: 0, paid: 0, open: 0 };
    });
    for (const row of eligible) {
      const amount = Number(row.amount);
      const paid = PAID.has(row.status.toUpperCase());
      totals.billed += amount;
      if (paid) totals.paid += amount; else totals.open += amount;
      const bucket = buckets.find((candidate) => candidate.month === row.createdAt.toISOString().slice(0, 7));
      if (bucket) {
        bucket.billed += amount;
        if (paid) bucket.paid += amount; else bucket.open += amount;
      }
    }
    const outstanding = new Set(eligible.filter((row) => !PAID.has(row.status.toUpperCase())).map((row) => row.contactId));
    return {
      source: "LOCAL_RECORDS",
      provider: "INFINITEPAY",
      partial: rows.length === 10000,
      caveat: CAVEAT,
      environment: [...new Set(rows.map((row) => row.environment))],
      months: range.months,
      from: range.from.toISOString().slice(0, 10),
      to: range.until.toISOString().slice(0, 10),
      totals,
      series: buckets,
      outstandingContacts: outstanding.size,
      collectionRate: totals.billed > 0 ? Math.round((totals.paid / totals.billed) * 1000) / 10 : null,
    };
  }
}
