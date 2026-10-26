import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { AsaasService } from "./asaas.service";

const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID"]);
const EXCLUDED = new Set(["REFUNDED", "CANCELLED", "DELETED"]);
const money = (value: unknown) => Number(value || 0);
@Controller("finance")
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(private readonly prisma: PrismaService, private readonly asaas: AsaasService) {}

  @Get("executive")
  async executive(@Req() req:AuthenticatedRequest,@Query("months") raw?:string,@Query("from") from?:string,@Query("to") to?:string,@Query("all") all?:string){
    if(!["OWNER","ADMIN"].includes(req.user.role))throw new ForbiddenException("Acesso financeiro restrito à administração.");
    const months=raw===undefined?6:Number(raw);
    if(![1,3,6,12].includes(months))throw new ForbiddenException("Período inválido.");
    const valid=(s:string|undefined)=>!!s&&/^\\d{4}-\\d{2}-\\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
    if(all!=="true"&&(from||to)&&(!valid(from)||!valid(to)||from!>to!))throw new ForbiddenException("Intervalo inválido.");
    return this.asaas.executiveDashboard(req.user.tenantId,months,all==="true"?undefined:from,all==="true"?undefined:to,all==="true");
  }

  @Get("debts")
  async debts(@Req() req:AuthenticatedRequest,@Query("document") document?:string){
    if(!["OWNER","ADMIN"].includes(req.user.role))throw new ForbiddenException("Consulta financeira restrita à administração.");
    return this.asaas.debtsByDocument(req.user.tenantId,document||"");
  }

  @Get("catalog")
  async catalog(@Req() req:AuthenticatedRequest,@Query("offset") offsetRaw?:string,@Query("limit") limitRaw?:string){
    if(!["OWNER","ADMIN"].includes(req.user.role))throw new ForbiddenException("Acesso financeiro restrito à administração.");
    const offset=offsetRaw===undefined?0:Number(offsetRaw),limit=limitRaw===undefined?50:Number(limitRaw);
    if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ForbiddenException("Paginação inválida.");
    return this.asaas.listCatalog(req.user.tenantId,offset,limit);
  }

  @Get("portfolio")
  async portfolio(@Req() req: AuthenticatedRequest, @Query("status") status?: string, @Query("dueFrom") dueFrom?: string, @Query("dueTo") dueTo?: string, @Query("offset") offsetRaw?: string, @Query("limit") limitRaw?: string) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Acesso financeiro restrito à administração.");
    const offset = offsetRaw === undefined ? 0 : Number(offsetRaw);
    const limit = limitRaw === undefined ? 50 : Number(limitRaw);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ForbiddenException("Paginação inválida.");
    return this.asaas.listPortfolio(req.user.tenantId, { status, dueFrom, dueTo, offset, limit });
  }

  @Get("dashboard")
  async dashboard(@Req() req: AuthenticatedRequest, @Query("months") period?: string, @Query("from") start?: string, @Query("to") end?: string, @Query("all") all?: string) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Acesso financeiro restrito à administração.");
    const months = [1, 2, 3, 6, 12].includes(Number(period)) ? Number(period) : 1;
    const now = new Date();
    const validDate = (s: string | undefined) => !!s && /^\\d{4}-\\d{2}-\\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
    if ((start || end) && (!validDate(start) || !validDate(end) || start! > end!)) throw new ForbiddenException("Informe datas inicial e final válidas.");
    const from = all === "true" ? new Date("2000-01-01T00:00:00.000Z") : start ? new Date(start + "T00:00:00.000Z") : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
    const until = end ? new Date(end + "T23:59:59.999Z") : now;
    if (all !== "true" && until.getTime() - from.getTime() > 366 * 86400000) throw new ForbiddenException("Selecione um intervalo de até 366 dias.");
    const bucketCount = all === "true" ? Math.max(1, now.getUTCFullYear() - 2000 + 1) : start ? Math.min(13, (until.getUTCFullYear() - from.getUTCFullYear()) * 12 + until.getUTCMonth() - from.getUTCMonth() + 1) : months;
    const payments = await this.prisma.payment.findMany({
      where: { tenantId: req.user.tenantId, createdAt: { gte: from, lte: until }, provider: "ASAAS" },
      select: { id: true, amount: true, status: true, environment: true, createdAt: true, contactId: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const eligible = payments.filter(p => !EXCLUDED.has(p.status.toUpperCase()));
    const totals = { billed: 0, paid: 0, open: 0, count: eligible.length, overdueCount: 0 };
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const date = new Date(Date.UTC(from.getUTCFullYear() + (all === "true" ? i : 0), all === "true" ? 0 : from.getUTCMonth() + i, 1));
      return { month: date.toISOString().slice(0, 7), billed: 0, paid: 0, open: 0 };
    });
    for (const p of eligible) {
      const amount = money(p.amount);
      const paid = PAID.has(p.status.toUpperCase());
      const month = all === "true" ? p.createdAt.getUTCFullYear() + "-01" : p.createdAt.toISOString().slice(0, 7);
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
      months: bucketCount, from: from.toISOString().slice(0,10), to: until.toISOString().slice(0,10), totals, series: buckets, outstandingContacts: outstandingByContact.size,
      collectionRate: totals.billed > 0 ? Math.round(totals.paid / totals.billed * 1000) / 10 : null,
    };
  }
}
