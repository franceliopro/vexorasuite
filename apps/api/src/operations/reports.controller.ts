import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type JsonRecord = Record<string, unknown>;
const DAY = 24 * 60 * 60 * 1000;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function dateOnly(value: string | undefined, fallback: string): string {
  const candidate = value || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate) || new Date(candidate + "T00:00:00.000Z").toISOString().slice(0, 10) !== candidate) {
    throw new Error("Informe um período válido no formato AAAA-MM-DD.");
  }
  return candidate;
}
function range(fromInput?: string, toInput?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const from = dateOnly(fromInput, new Date(Date.now() - 29 * DAY).toISOString().slice(0, 10));
  const to = dateOnly(toInput, today);
  if (from > to) throw new Error("A data inicial não pode ser posterior à data final.");
  const start = new Date(from + "T00:00:00.000Z");
  const end = new Date(new Date(to + "T00:00:00.000Z").getTime() + DAY);
  const duration = Math.round((end.getTime() - start.getTime()) / DAY);
  return {
    from, to, start, end,
    previousFrom: new Date(start.getTime() - duration * DAY).toISOString().slice(0, 10),
    previousTo: new Date(start.getTime() - DAY).toISOString().slice(0, 10),
  };
}
function summarize(rows: any[]) {
  const closed = rows.filter((row) => row.status === "CLOSED" || row.status === "RESOLVED");
  const responseSeconds = rows.map((row) => row.messages?.[0]?.occurredAt
    ? Math.max(0, (new Date(row.messages[0].occurredAt).getTime() - new Date(row.createdAt).getTime()) / 1000)
    : null).filter((value): value is number => value !== null);
  return {
    total: rows.length,
    open: rows.filter((row) => row.status === "OPEN").length,
    pending: rows.filter((row) => row.status === "PENDING").length,
    resolved: rows.filter((row) => row.status === "RESOLVED").length,
    closed: rows.filter((row) => row.status === "CLOSED").length,
    bot: rows.filter((row) => row.handlingMode === "BOT").length,
    human: rows.filter((row) => row.handlingMode === "HUMAN").length,
    contacts: new Set(rows.map((row) => row.contactId)).size,
    messages: rows.reduce((total, row) => total + row._count.messages, 0),
    firstMessageSeconds: responseSeconds.length ? Math.round(responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length) : null,
    firstMessageSample: responseSeconds.length,
    finished: closed.length,
  };
}
function grouped(rows: any[], getKey: (row: any) => string, getName: (row: any) => string) {
  const groups = new Map<string, { id: string; name: string; total: number; open: number; pending: number; finished: number; bot: number; human: number }>();
  for (const row of rows) {
    const id = getKey(row) || "unassigned";
    const name = getName(row) || "Sem responsável";
    const group = groups.get(id) || { id, name, total: 0, open: 0, pending: 0, finished: 0, bot: 0, human: 0 };
    group.total++;
    if (row.status === "OPEN") group.open++;
    if (row.status === "PENDING") group.pending++;
    if (row.status === "RESOLVED" || row.status === "CLOSED") group.finished++;
    if (row.handlingMode === "BOT") group.bot++;
    if (row.handlingMode === "HUMAN") group.human++;
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
}

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  private assertCanView(request: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) {
      throw new ForbiddenException("Você não tem permissão para consultar relatórios gerenciais.");
    }
  }

  private async conversations(tenantId: string, start: Date, end: Date) {
    return this.prisma.conversation.findMany({
      where: { tenantId, createdAt: { gte: start, lt: end }, deletedAt: null },
      select: {
        id: true, status: true, handlingMode: true, channel: true, createdAt: true, updatedAt: true,
        contactId: true, assigneeId: true, departmentId: true,
        contact: { select: { name: true, source: true } },
        assignee: { select: { name: true } },
        department: { select: { name: true } },
        messages: { where: { direction: "OUTBOUND" }, orderBy: { occurredAt: "asc" }, take: 1, select: { occurredAt: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
  }

  @Get("service")
  async service(@Req() request: AuthenticatedRequest, @Query("from") from?: string, @Query("to") to?: string) {
    this.assertCanView(request);
    const period = range(from, to);
    const [rows, previous] = await Promise.all([
      this.conversations(request.user.tenantId, period.start, period.end),
      this.conversations(request.user.tenantId, new Date(period.start.getTime() - (period.end.getTime() - period.start.getTime())), period.start),
    ]);
    return {
      period: { from: period.from, to: period.to },
      comparisonPeriod: { from: period.previousFrom, to: period.previousTo },
      summary: summarize(rows),
      comparison: summarize(previous),
      byChannel: grouped(rows, (row) => row.channel, (row) => row.channel),
      byAgent: grouped(rows, (row) => row.assigneeId, (row) => row.assignee?.name || "Sem responsável"),
      byDepartment: grouped(rows, (row) => row.departmentId, (row) => row.department?.name || "Sem equipe"),
      basis: "Conversas criadas no período. Primeira resposta considera a primeira mensagem enviada registrada; sem resposta registrada, o caso não entra na média. Volume e status refletem os dados atuais das conversas.",
    };
  }

  @Get("lead-origins")
  async leadOrigins(@Req() request: AuthenticatedRequest, @Query("from") from?: string, @Query("to") to?: string) {
    this.assertCanView(request);
    const period = range(from, to);
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId: request.user.tenantId, createdAt: { gte: period.start, lt: period.end } },
      select: { id: true, name: true, phone: true, email: true, source: true, metadata: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const normalizeOrigin = (contact: typeof contacts[number]) => {
      const metadata = record(contact.metadata);
      const leadOrigin = record(metadata.leadOrigin);
      const legacyOrigin = record(metadata.lead_origin);
      const value = String(leadOrigin.source || legacyOrigin.source || contact.source || "").trim();
      if (!value || value.toUpperCase() === "CRM") return "Não identificada";
      if (value.toUpperCase() === "ASAAS") return "Asaas";
      return value;
    };
    const byOrigin = new Map<string, { name: string; total: number; won: number; lost: number; open: number; withCampaign: number }>();
    const stages = new Map<string, number>();
    for (const contact of contacts) {
      const metadata = record(contact.metadata);
      const finalization = record(metadata.crmFinalization);
      const originMeta = { ...record(metadata.lead_origin), ...record(metadata.leadOrigin) };
      const origin = normalizeOrigin(contact);
      const group = byOrigin.get(origin) || { name: origin, total: 0, won: 0, lost: 0, open: 0, withCampaign: 0 };
      group.total++;
      if (finalization.outcome === "WON") group.won++;
      else if (finalization.outcome === "LOST") group.lost++;
      else group.open++;
      if (typeof originMeta.campaign === "string" && originMeta.campaign.trim()) group.withCampaign++;
      byOrigin.set(origin, group);
      const stage = finalization.outcome === "WON" ? "Ganho" : finalization.outcome === "LOST" ? "Perda" : ({
        new: "Novo", qualification: "Qualificação", proposal: "Proposta",
      } as Record<string, string>)[String(metadata.crmStage || "new")] || "Em andamento";
      stages.set(stage, (stages.get(stage) || 0) + 1);
    }
    return {
      period: { from: period.from, to: period.to },
      total: contacts.length,
      identified: contacts.filter((contact) => normalizeOrigin(contact) !== "Não identificada").length,
      unidentified: contacts.filter((contact) => normalizeOrigin(contact) === "Não identificada").length,
      byOrigin: [...byOrigin.values()].sort((a, b) => b.total - a.total),
      stages: [...stages.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      recent: contacts.slice(0, 50).map((contact) => {
        const metadata = record(contact.metadata);
        const finalization = record(metadata.crmFinalization);
        const leadOrigin = { ...record(metadata.lead_origin), ...record(metadata.leadOrigin) };
        return {
          id: contact.id, name: contact.name, source: normalizeOrigin(contact),
          campaign: typeof leadOrigin.campaign === "string" ? leadOrigin.campaign : null,
          stage: finalization.outcome === "WON" ? "Ganho" : finalization.outcome === "LOST" ? "Perda" : "Em andamento",
          createdAt: contact.createdAt,
        };
      }),
      basis: "Origem exibida somente quando foi informada ou registrada. Contatos sem origem explícita permanecem como Não identificada; o canal de atendimento não é usado como origem de aquisição.",
    };
  }
}
