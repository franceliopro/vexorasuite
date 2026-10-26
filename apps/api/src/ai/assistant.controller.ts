import { routeIntelligence, proposeWorkflow } from "./intelligence-engine";
import { Body, Controller, ForbiddenException, Get, Put, Post, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { Prisma } from "@prisma/client";
import { GoogleCalendarController } from "../operations/google-calendar.controller";

type ModelSelection = { provider: string; model: string; tier: string; endpoint?: string };
type VoiceSelection = { provider: string; model: string; endpoint?: string };
type AgentConfig = { id: string; name: string; role: string; tier: string; enabled: boolean; instructions: string; profile?: { tone: string; channels: string[] }; behavior?: { rules: string; prohibitions: string }; allowedActions?: string[]; customActions?: string[]; bindings?: { mode: string; specialists: string[]; flows: string[]; pipelines: string[]; externalSystems: string[]; modules: string[] }; knowledgeUrls?: string[]; llm?: ModelSelection; stt?: VoiceSelection; tts?: VoiceSelection };
type Config = { name: string; wakeWord: string; enabled: boolean; agents: AgentConfig[]; llm?: ModelSelection; stt?: VoiceSelection; tts?: VoiceSelection };
const initial: Config = { name: "Véxora", wakeWord: "Olá Véxora", enabled: false, agents: [] };
function parseConfig(value: unknown): Config {
  if (!value || typeof value !== "object" || Array.isArray(value)) return initial;
  const item = (value as Record<string, unknown>).assistant;
  if (!item || typeof item !== "object" || Array.isArray(item)) return initial;
  const cfg = item as Partial<Config>;
  return { name: typeof cfg.name === "string" ? cfg.name : initial.name, wakeWord: typeof cfg.wakeWord === "string" ? cfg.wakeWord : initial.wakeWord, enabled: cfg.enabled === true, agents: Array.isArray(cfg.agents) ? cfg.agents : [], llm: cfg.llm, stt: cfg.stt, tts: cfg.tts };
}

@Controller("assistant")
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly prisma: PrismaService, private readonly calendar: GoogleCalendarController) {}
  // Central registry: skills are capabilities, not arbitrary executable prompts.
  @Get("skills")
  skills() {
    return { version: 1, executionEnabled: false, skills: [
      { id: "assistant.contacts.read", name: "Consultar contatos", category: "CRM", cost: "zero", implemented: true, permission: "contacts.read" },
      { id: "assistant.tasks.read", name: "Consultar tarefas", category: "Operações", cost: "zero", implemented: true, permission: "tasks.read" },
      { id: "assistant.calendar.read", name: "Consultar agenda", category: "Agenda", cost: "external", implemented: true, permission: "calendar.read" },
      { id: "assistant.finance.read", name: "Consultar resumo financeiro", category: "Financeiro", cost: "zero", implemented: true, permission: "finance.admin" },
      { id: "asaas.payment.lookup", name: "Consultar cobrança Asaas", category: "Financeiro", cost: "external", implemented: false, permission: "finance.read" },
      { id: "asaas.pix.create", name: "Gerar PIX", category: "Financeiro", cost: "external", implemented: false, permission: "finance.write", confirmationRequired: true },
      { id: "crm.opportunity.create", name: "Criar oportunidade", category: "CRM", cost: "zero", implemented: false, permission: "crm.write" },
      { id: "crm.lead.qualify", name: "Qualificar lead", category: "CRM", cost: "zero", implemented: false, permission: "crm.write" },
      { id: "crm.tag.apply", name: "Aplicar etiqueta", category: "CRM", cost: "zero", implemented: false, permission: "contacts.write" },
      { id: "inbox.transfer", name: "Transferir para humano ou equipe", category: "Atendimento", cost: "zero", implemented: false, permission: "inbox.transfer" },
      { id: "inbox.agent.route", name: "Encaminhar para agente de IA", category: "Atendimento", cost: "zero", implemented: false, permission: "inbox.route" },
      { id: "inbox.participant.invite", name: "Convidar participante", category: "Atendimento", cost: "zero", implemented: false, permission: "inbox.invite" },
      { id: "inbox.stage.move", name: "Mover etapa do atendimento", category: "Atendimento", cost: "zero", implemented: false, permission: "inbox.write" },
      { id: "inbox.resolve", name: "Concluir atendimento", category: "Atendimento", cost: "zero", implemented: false, permission: "inbox.resolve", confirmationRequired: true },
      { id: "calendar.event.create", name: "Criar agendamento", category: "Agenda", cost: "external", implemented: false, permission: "calendar.write", confirmationRequired: true },
      { id: "crm.contact.update", name: "Atualizar campo do contato", category: "CRM", cost: "zero", implemented: false, permission: "contacts.write" },
      { id: "crm.pipeline.move", name: "Mover oportunidade no CRM", category: "CRM", cost: "zero", implemented: false, permission: "crm.write" },
      { id: "chatbot.flow.trigger", name: "Acionar fluxo de chatbot", category: "Automação", cost: "zero", implemented: false, permission: "automation.execute" },
      { id: "tracking.triage", name: "Triagem de rastreamento", category: "Suporte", cost: "zero", implemented: false, permission: "tracking.read" },
      { id: "catalog.menu.show", name: "Mostrar cardápio", category: "Comercial", cost: "zero", implemented: false, permission: "catalog.read" },
      { id: "catalog.products.show", name: "Mostrar produtos", category: "Comercial", cost: "zero", implemented: false, permission: "catalog.read" },
      { id: "external.api.call", name: "Consultar ou acionar API", category: "Integrações", cost: "external", implemented: false, permission: "integrations.execute", confirmationRequired: true },
      { id: "drive.files.search", name: "Buscar arquivos no Google Drive", category: "Conhecimento", cost: "external", implemented: false, permission: "drive.read" },
      { id: "voice.stt", name: "Transcrever áudio", category: "Voz", cost: "model", implemented: false, permission: "voice.use" },
      { id: "voice.tts", name: "Responder por voz", category: "Voz", cost: "model", implemented: false, permission: "voice.use" },
    ] };
  }

  @Post("engine/propose-workflow")
  async propose(@Req() req: AuthenticatedRequest, @Body() body: { request?: string }) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Permissão insuficiente");
    if (typeof body?.request !== "string" || !body.request.trim() || body.request.length > 2000) throw new BadRequestException("Descrição inválida");
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    if (!parseConfig(tenant.integrations).enabled) throw new ForbiddenException("Intelligence Engine desabilitado nesta empresa");
    return { ...proposeWorkflow(body.request), engine: "vexora-intelligence-v1", persisted: false, sideEffects: false };
  }

  @Post("engine/route")
  async route(@Req() req: AuthenticatedRequest, @Body() body: { text?: string; selectedIntent?: string }) {
    if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > 1000) throw new BadRequestException("Mensagem inválida");
    if (body.selectedIntent !== undefined && !["payment", "finance", "support", "sales", "administration"].includes(body.selectedIntent)) throw new BadRequestException("Intenção inválida");
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    if (!parseConfig(tenant.integrations).enabled) throw new ForbiddenException("Intelligence Engine desabilitado nesta empresa");
    const decision = routeIntelligence({ text: body.text, selectedIntent: body.selectedIntent as "payment" | "finance" | "support" | "sales" | "administration" | undefined });
    return { ...decision, engine: "vexora-intelligence-v1", executedSkills: [], sideEffects: false };
  }

  @Get("model-catalog")
  async modelCatalog() {
    const providers = ["openrouter", "openai", "gemini", "anthropic", "deepseek", "ollama", "vllm", "openai-compatible"];
    const voices = { stt: ["whisper-local", "openai", "deepgram", "openai-compatible"], tts: ["piper-local", "openai", "gemini", "openai-compatible"] };
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models?sort=pricing-low-to-high", { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Catalog unavailable");
      const data = await response.json() as { data?: { id: string; name: string; pricing?: { prompt?: string; completion?: string } }[] };
      return { providers, voices, models: (data.data || []).filter(m => typeof m.id === "string").slice(0, 1000).map(m => ({ provider: "openrouter", id: m.id, name: m.name, pricePerMillionInputUsd: Number(m.pricing?.prompt || 0) * 1000000, pricePerMillionOutputUsd: Number(m.pricing?.completion || 0) * 1000000 })), source: "openrouter", live: true };
    } catch {
      return { providers, voices, models: [], source: "openrouter", live: false, message: "Catálogo temporariamente indisponível; selecione o modelo manualmente." };
    }
  }

  @Get("config")
  async config(@Req() req: AuthenticatedRequest) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    return parseConfig(tenant.integrations);
  }
  @Put("config")
  async save(@Req() req: AuthenticatedRequest, @Body() input: Config) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException();
    if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 80 || typeof input.wakeWord !== "string" || input.wakeWord.length > 80 || typeof input.enabled !== "boolean" || !Array.isArray(input.agents) || input.agents.length > 30) throw new BadRequestException("Configuração inválida");
    const selection = (value: unknown, voice = false): ModelSelection | VoiceSelection | undefined => {
      if (value === undefined) return undefined;
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Modelo inválido");
      const v = value as Record<string, unknown>;
      if (typeof v.provider !== "string" || !/^[a-z0-9-]{2,40}$/.test(v.provider) || typeof v.model !== "string" || !v.model.trim() || v.model.length > 180 || (v.endpoint !== undefined && (typeof v.endpoint !== "string" || v.endpoint.length > 300))) throw new BadRequestException("Seleção de modelo inválida");
      if (v.endpoint && !/^https:\/\//.test(v.endpoint as string) && !/^http:\/\/localhost(?::\d+)?(?:\/|$)/.test(v.endpoint as string)) throw new BadRequestException("Endpoint deve usar HTTPS ou localhost");
      if (!voice && !["Econômico", "Equilíbrio", "Inteligente"].includes(String(v.tier))) throw new BadRequestException("Perfil inválido");
      return { provider: v.provider, model: v.model.trim(), ...(voice ? {} : { tier: v.tier }), ...(v.endpoint ? { endpoint: v.endpoint } : {}) } as ModelSelection;
    };
    const strings = (v: unknown, max = 40) => { if (v === undefined) return []; if (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== "string" || x.length > 300)) throw new BadRequestException("Lista inválida"); return v.map((x: string) => x.trim()).filter(Boolean); };
    const longText = (v: unknown) => { if (v === undefined) return ""; if (typeof v !== "string" || v.length > 6000) throw new BadRequestException("Texto inválido"); return v; };
    const agents = input.agents.map(a => {
      if (!a || typeof a.id !== "string" || a.id.length > 80 || typeof a.name !== "string" || !a.name.trim() || a.name.length > 80 || typeof a.role !== "string" || a.role.length > 120 || !["Econômico", "Equilíbrio", "Inteligente"].includes(a.tier) || typeof a.enabled !== "boolean" || typeof a.instructions !== "string" || a.instructions.length > 6000) throw new BadRequestException("Agente inválido");
      return { id: a.id, name: a.name.trim(), role: a.role, tier: a.tier, enabled: a.enabled, instructions: a.instructions, profile: { tone: longText(a.profile?.tone).slice(0, 100), channels: strings(a.profile?.channels, 20) }, behavior: { rules: longText(a.behavior?.rules), prohibitions: longText(a.behavior?.prohibitions) }, allowedActions: strings(a.allowedActions, 100), customActions: strings(a.customActions, 60), bindings: { mode: a.bindings?.mode === "specialist" ? "specialist" : "principal", specialists: strings(a.bindings?.specialists), flows: strings(a.bindings?.flows), pipelines: strings(a.bindings?.pipelines), externalSystems: strings(a.bindings?.externalSystems), modules: strings(a.bindings?.modules) }, knowledgeUrls: strings(a.knowledgeUrls, 100).filter(url => { try { return new URL(url).protocol === "https:"; } catch { return false; } }), llm: selection(a.llm) as ModelSelection | undefined, stt: selection(a.stt, true), tts: selection(a.tts, true) };
    });
    const config = { name: input.name.trim(), wakeWord: input.wakeWord.trim(), enabled: input.enabled, agents, llm: selection(input.llm), stt: selection(input.stt, true), tts: selection(input.tts, true) };
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
