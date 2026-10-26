import { Body, Controller, ForbiddenException, Get, Put, Post, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { Prisma } from "@prisma/client";
import { GoogleCalendarController } from "../operations/google-calendar.controller";

type Config = { name: string; wakeWord: string; enabled: boolean; agents: { id: string; name: string; role: string; tier: string; enabled: boolean; instructions: string }[] };
const initial: Config = { name: "Véxora", wakeWord: "Olá Véxora", enabled: false, agents: [] };
function parseConfig(value: unknown): Config {
  if (!value || typeof value !== "object" || Array.isArray(value)) return initial;
  const item = (value as Record<string, unknown>).assistant;
  if (!item || typeof item !== "object" || Array.isArray(item)) return initial;
  const cfg = item as Partial<Config>;
  return { name: typeof cfg.name === "string" ? cfg.name : initial.name, wakeWord: typeof cfg.wakeWord === "string" ? cfg.wakeWord : initial.wakeWord, enabled: cfg.enabled === true, agents: Array.isArray(cfg.agents) ? cfg.agents : [] };
}

@Controller("assistant")
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly prisma: PrismaService, private readonly calendar: GoogleCalendarController) {}
  @Get("config")
  async config(@Req() req: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    return parseConfig(tenant.integrations);
  }
  @Put("config")
  async save(@Req() req: AuthenticatedRequest, @Body() input: Config) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException();
    if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 80 || typeof input.wakeWord !== "string" || input.wakeWord.length > 80 || typeof input.enabled !== "boolean" || !Array.isArray(input.agents) || input.agents.length > 30) throw new BadRequestException("Configuração inválida");
    const agents = input.agents.map(a => {
      if (!a || typeof a.id !== "string" || a.id.length > 80 || typeof a.name !== "string" || !a.name.trim() || a.name.length > 80 || typeof a.role !== "string" || a.role.length > 120 || !["Econômico", "Equilíbrio", "Inteligente"].includes(a.tier) || typeof a.enabled !== "boolean" || typeof a.instructions !== "string" || a.instructions.length > 6000) throw new BadRequestException("Agente inválido");
      return { id: a.id, name: a.name.trim(), role: a.role, tier: a.tier, enabled: a.enabled, instructions: a.instructions };
    });
    const config = { name: input.name.trim(), wakeWord: input.wakeWord.trim(), enabled: input.enabled, agents };
    // Transaction locks tenant row to avoid losing concurrent updates to integrations.
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const current = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations) ? tenant.integrations as Record<string, Prisma.JsonValue> : {};
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: { ...current, assistant: config } as Prisma.InputJsonObject } });
    });
    return config;
  }
  @Post("ask")
  async ask(@Req() req: AuthenticatedRequest, @Body() body: { question?: string }) {
    const question = body?.question?.trim() ?? "";
    if (!question || question.length > 500) throw new BadRequestException("Solicitação inválida");
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    if (!parseConfig(tenant.integrations).enabled) throw new ForbiddenException("Assistente desabilitada para esta empresa");
    // Deterministic, tenant-scoped queries. No LLM calls or token usage.
    if (/conversas|atendimento|desempenho/i.test(question)) {
      const [open, resolved] = await Promise.all([
        this.prisma.conversation.count({ where: { tenantId: req.user.tenantId, status: "OPEN", deletedAt: null } }),
        this.prisma.conversation.count({ where: { tenantId: req.user.tenantId, status: "RESOLVED", deletedAt: null } }),
      ]);
      return { source: "database", usedAi: false, answer: `Atendimento: ${open} conversas abertas e ${resolved} resolvidas (totais registrados, sem filtro de período).` };
    }
    if (/tarefas|pendências|pendencias|prioridades/i.test(question)) {
      const [open, overdue] = await Promise.all([
        this.prisma.workTask.count({ where: { tenantId: req.user.tenantId, status: { notIn: ["DONE", "COMPLETED", "CANCELLED"] }, OR: [{ assigneeId: req.user.sub }, { createdById: req.user.sub }] } }),
        this.prisma.workTask.count({ where: { tenantId: req.user.tenantId, status: { notIn: ["DONE", "COMPLETED", "CANCELLED"] }, dueAt: { lt: new Date() }, OR: [{ assigneeId: req.user.sub }, { createdById: req.user.sub }] } }),
      ]);
      return { source: "database", usedAi: false, answer: `Você possui ${open} tarefas em andamento ou pendentes, das quais ${overdue} estão com prazo vencido. Consideradas apenas tarefas atribuídas a você ou criadas por você.` };
    }
    if (/clientes|contatos|leads/i.test(question)) {
      const total = await this.prisma.contact.count({ where: { tenantId: req.user.tenantId } });
      return { source: "database", usedAi: false, answer: `Esta empresa possui ${total} contatos cadastrados (total geral, sem filtro por período ou tipo).` };
    }
    if (/agenda|compromissos|reuniões|reunioes|eventos/i.test(question)) {
      const accounts = await this.calendar.accounts(req);
      if (!accounts.length) return { source: "rules", usedAi: false, answer: "Nenhuma conta Google Agenda autorizada está conectada nesta empresa." };
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 86400000);
      const upcoming: { title: string; date: string }[] = [];
      let calendarsChecked = 0;
      for (const account of accounts.slice(0, 3)) {
        const calendars = await this.calendar.calendars(req, account.id) as { items?: { id: string }[] };
        for (const calendar of (calendars.items || []).slice(0, 5)) {
          const events = await this.calendar.events(req, account.id, calendar.id, start.toISOString(), end.toISOString()) as { items?: { summary?: string; start?: { dateTime?: string; date?: string }; status?: string }[] };
          calendarsChecked++;
          for (const event of events.items || []) {
            if (event.status === "cancelled") continue;
            const date = event.start?.dateTime || event.start?.date;
            if (date) upcoming.push({ title: event.summary || "Sem título", date });
          }
        }
      }
      upcoming.sort((a, b) => a.date.localeCompare(b.date));
      const format = (date: string) => new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
      const details = upcoming.slice(0, 5).map(e => `${format(e.date)} — ${e.title}`).join("; ");
      return { source: "google_calendar", usedAi: false, answer: `Agenda dos próximos 7 dias: ${upcoming.length} eventos encontrados em ${calendarsChecked} calendários acessíveis${details ? ". Próximos: " + details : "."} Consulta limitada às primeiras 3 contas e 5 agendas por conta.` };
    }
    if (/financeir|faturamento|cobranças|cobrancas|receita|pagamentos/i.test(question)) {
      if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Acesso financeiro restrito à administração.");
      const from = new Date();
      from.setUTCDate(1); from.setUTCHours(0, 0, 0, 0);
      const rows = await this.prisma.payment.findMany({ where: { tenantId: req.user.tenantId, provider: "ASAAS", createdAt: { gte: from } }, select: { amount: true, status: true, environment: true }, take: 10001 });
      const limited = rows.length > 10000;
      const payments = rows.slice(0, 10000).filter(p => !["REFUNDED", "CANCELLED", "DELETED"].includes(p.status.toUpperCase()));
      const paid = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "PAID"]);
      const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const received = payments.filter(p => paid.has(p.status.toUpperCase())).reduce((sum, p) => sum + Number(p.amount), 0);
      const env = [...new Set(payments.map(p => p.environment))].join(", ") || "não informado";
      return { source: "local_payments", usedAi: false, answer: `Resumo financeiro do mês atual, somente pagamentos Asaas registrados na Véxora: ${payments.length} registros, total ${money(total)}, recebidos ${money(received)}, demais situações ${money(total - received)}. Ambientes: ${env}. Não representa a carteira completa do Asaas nem inadimplência conciliada.${limited ? " Resultado parcial: limite de 10 mil registros." : ""}` };
    }
    return { source: "rules", usedAi: false, answer: "Ainda não tenho uma automação segura para essa solicitação. Nenhuma IA foi acionada." };
  }
}
