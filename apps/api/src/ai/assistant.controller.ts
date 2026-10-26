import { Body, Controller, ForbiddenException, Get, Put, Post, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { Prisma } from "@prisma/client";

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
  constructor(private readonly prisma: PrismaService) {}
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
    if (/agenda|compromissos/i.test(question)) return { source: "rules", usedAi: false, answer: "A consulta de compromissos ainda não está conectada. Abra o módulo Agenda para visualizar seus eventos." };
    if (/financeiro|faturamento|cobranças/i.test(question)) return { source: "rules", usedAi: false, answer: "Os relatórios financeiros devem ser consultados no módulo Financeiro. A assistente ainda não acessa esses dados." };
    return { source: "rules", usedAi: false, answer: "Ainda não tenho uma automação segura para essa solicitação. Nenhuma IA foi acionada." };
  }
}
