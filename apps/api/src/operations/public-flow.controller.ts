import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Optional,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  HttpException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { AiService } from "../ai/ai.service";
import { economicalProviders } from "../ai/economical-providers";
import { reserveAiExecution, dailyAiLimit } from "../ai/ai-budget";
import { selectPublication, RuntimeScope } from "./runtime-scope";
import { randomUUID } from "node:crypto";

type JsonObject = Record<string, any>;
const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
const interpolate = (template: string, variables: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");

type PublicStep = {
  id: string;
  kind?: string;
  title: string;
  message: string;
  options: string[];
  transitions?: Record<string, string>;
  position?: { x: number; y: number };
  config?: string;
};

type Session = {
  variables: Record<string, string>;
  stepId: string | null;
  completed: boolean;
  history: { role: "user" | "assistant"; content: string }[];
  lastUserText: string;
  lastAt: number;
  messages: number;
  createdAt: number;
};

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_MESSAGES = 60;
const MAX_SESSIONS_PER_TOKEN = 150;
const rateWindows = new Map<string, number[]>();

function sweepSessions() {
  const now = Date.now();
  for (const [key, value] of sessions) if (now - value.lastAt > SESSION_TTL_MS) sessions.delete(key);
  for (const [key, hits] of rateWindows) {
    const fresh = hits.filter((t) => now - t < 60_000);
    if (fresh.length) rateWindows.set(key, fresh); else rateWindows.delete(key);
  }
}
function rateLimit(key: string, limit = 25, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (rateWindows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  rateWindows.set(key, hits);
  return true;
}
function sessionKeyOf(token: string, sessionId: string) {
  return `${token}:${sessionId}`;
}

const safeConfigKeys = new Set(["variable", "value", "departmentKey", "outcome", "reason", "url", "name", "color", "agentId", "pipelineId", "stage", "targetMode", "userId"]);
const sanitizeConfig = (kind: string | undefined, raw: unknown): string | undefined => {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  if (!["condition", "variable"].includes(String(kind))) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (safeConfigKeys.has(key) && typeof value === "string" && value.length <= 300 && !/[<>"]/.test(value)) out[key] = value;
    }
    return JSON.stringify(out);
  } catch {
    return undefined;
  }
};
const sanitizeStep = (step: PublicStep) => ({
  id: step.id,
  kind: step.kind,
  title: typeof step.title === "string" ? step.title.slice(0, 120) : "Etapa",
  message: typeof step.message === "string" ? step.message.slice(0, 4000) : "",
  options: Array.isArray(step.options) ? step.options.filter((o): o is string => typeof o === "string" && o.length <= 160).slice(0, 12) : [],
  transitions: step.transitions && typeof step.transitions === "object" && !Array.isArray(step.transitions) ? Object.fromEntries(Object.entries(step.transitions).filter(([k, v]) => typeof k === "string" && typeof v === "string" && k.length <= 160)) : undefined,
  config: sanitizeConfig(step.kind, step.config),
  position: step.position && Number.isFinite(step.position.x) && Number.isFinite(step.position.y) ? { x: Math.round(step.position.x), y: Math.round(step.position.y) } : undefined,
});

@Controller("public/flows")
export class PublicFlowController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    @Optional() private readonly ai?: AiService,
  ) {}

  private async resolve(token: string) {
    if (!/^[a-f0-9]{48}$/.test(token)) return null;
    const tenants = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM tenants WHERE integrations->'publicFlows' ? ${token} LIMIT 1`;
    const tenantId = tenants[0]?.id;
    if (!tenantId) return null;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true, integrations: true } });
    if (!tenant) return null;
    const root = object(tenant.integrations);
    const binding = object(object(root.publicFlows)[token]);
    if (binding.disabled === true) return null;
    const scopeKey = typeof binding.scopeKey === "string" ? binding.scopeKey : "default";
    const scope: RuntimeScope = scopeKey === "default" ? {} : { departmentId: scopeKey.replace(/^department:/, "") };
    const selection = selectPublication(root, scope);
    if (!selection || !selection.publication.flow) return null;
    const flow = selection.publication.flow as any;
    if (!Array.isArray(flow.steps) || !flow.steps.length) return null;
    const brand = object(root.brandSettings);
    const image = (key: string) => typeof brand[key] === "string" && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(brand[key]) ? (brand[key] as string) : "";
    return {
      tenant,
      root,
      scopeKey,
      flow,
      theme: {
        backgroundKind: ["default", "solid", "gradient", "image"].includes(String(object(binding.theme).backgroundKind)) ? String(object(binding.theme).backgroundKind) : "default",
        color: typeof object(binding.theme).color === "string" && /^#[0-9a-fA-F]{6}$/.test(String(object(binding.theme).color)) ? String(object(binding.theme).color) : "#101317",
        color2: typeof object(binding.theme).color2 === "string" && /^#[0-9a-fA-F]{6}$/.test(String(object(binding.theme).color2)) ? String(object(binding.theme).color2) : "#0E7A5C",
        imageUrl: typeof object(binding.theme).imageUrl === "string" && (object(binding.theme).imageUrl as string).length <= 2000 && /^https:\/\//.test(String(object(binding.theme).imageUrl)) ? String(object(binding.theme).imageUrl) : "",
      },
      brand: {
        primaryColor: typeof brand.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(String(brand.primaryColor)) ? String(brand.primaryColor) : "#0E7A5C",
        logoLight: image("logoLight"),
        logoDark: image("logoDark"),
        logoShape: brand.logoShape === "square" || brand.logoShape === "round" ? String(brand.logoShape) : "rectangular",
        showCompanyName: brand.showCompanyName !== false,
      },
    };
  }

  @Get(":token")
  async read(@Param("token") token: string) {
    sweepSessions();
    const resolved = await this.resolve(token);
    if (!resolved) throw new NotFoundException("Esta página não existe ou não está mais disponível.");
    const { flow, brand, theme, tenant } = resolved;
    return {
      tenantName: tenant.name,
      slug: tenant.slug,
      brand,
      theme,
      flow: {
        name: typeof flow.name === "string" ? flow.name.slice(0, 120) : "Atendimento",
        welcome: typeof flow.welcome === "string" ? flow.welcome.slice(0, 1000) : "",
        steps: flow.steps.filter((step: PublicStep) => step && typeof step.id === "string").map(sanitizeStep),
      },
    };
  }

  @Post(":token/message")
  async message(
    @Param("token") token: string,
    @Body() body: { sessionId?: unknown; text?: unknown },
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    sweepSessions();
    const resolved = await this.resolve(token);
    if (!resolved) throw new NotFoundException("Esta página não existe ou não está mais disponível.");
    const ip = (request?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || request?.ip || "unknown";
    if (!rateLimit(`${token}:${ip}`, 25)) throw new HttpException("Muitas mensagens em sequência. Aguarde um instante.", 429);
    const sessionId = typeof body?.sessionId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(body.sessionId) ? body.sessionId : randomUUID();
    const key = sessionKeyOf(token, sessionId);
    const scopedCount = [...sessions.keys()].filter((k) => k.startsWith(token + ":")).length;
    if (scopedCount >= MAX_SESSIONS_PER_TOKEN && !sessions.has(key)) throw new HttpException("Esta página está recebendo muitas visitas agora. Tente novamente em instantes.", 429);
    const session: Session = sessions.get(key) ?? { variables: {}, stepId: null, completed: false, history: [], lastUserText: "", lastAt: 0, messages: 0, createdAt: Date.now() };
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
    if (session.messages >= MAX_MESSAGES) { sessions.delete(key); return { sessionId, finished: true, handoff: false, messages: ["Esta conversa atingiu o limite de mensagens. Se precisar, fale com nossa equipe pelos canais de atendimento."] }; }
    session.messages += 1;
    session.lastAt = Date.now();
    session.lastUserText = text;
    const { flow, tenant } = resolved;
    const steps: PublicStep[] = Array.isArray(flow.steps) ? flow.steps : [];
    const findStep = (id: string | undefined) => steps.find((step) => step?.id === id);
    const render = (step: PublicStep | undefined): string => (step ? interpolate(String(step.message || ""), session.variables) : "");
    const advance = (step: PublicStep | undefined): PublicStep | undefined => {
      if (!step) return undefined;
      const nextId = step.transitions?.[Object.keys(step.transitions)[0]!];
      return nextId ? findStep(nextId) : undefined;
    };
    const finishWithHandoff = async (departmentKey?: string, reason?: string) => {
      const internalLines = Object.entries(session.variables).filter(([, value]) => String(value).trim()).map(([k, v]) => `${k}: ${v}`);
      const summary = [
        "Contexto do atendimento — página pública do chatbot",
        `Fluxo: ${flow.name || "Chatbot"}`,
        reason ? `Motivo: ${reason}` : null,
        internalLines.length ? "Informações coletadas:\n" + internalLines.join("\n") : null,
        `Última mensagem: ${session.lastUserText.slice(0, 500)}`,
      ].filter(Boolean).join("\n");
      try {
        await this.prisma.$transaction(async (tx) => {
          let contact = null as { id: string } | null;
          const phone = String(session.variables.telefone || session.variables.celular || "").replace(/\D/g, "");
          if (phone.length >= 10) contact = await tx.contact.findFirst({ where: { tenantId: tenant.id, phone }, select: { id: true } });
          if (!contact) {
            contact = await tx.contact.create({
              data: { tenantId: tenant.id, name: String(session.variables.novo_nome || session.variables.nome || "Cliente da página").slice(0, 120), phone: phone || null, source: "Chatbot público", externalId: `public:${key}`, metadata: { publicFlow: flow.name, origin: "page" } },
              select: { id: true },
            });
          }
          let departmentId: string | null = null;
          if (departmentKey) {
            const department = await tx.department.findFirst({ where: { tenantId: tenant.id, key: departmentKey, isActive: true }, select: { id: true } });
            departmentId = department?.id ?? null;
          }
          const conversation = await tx.conversation.create({
            data: { tenantId: tenant.id, contactId: contact.id, channelConnectionId: null, handlingMode: "HUMAN", status: "OPEN", channel: "WEBCHAT", priority: "NORMAL", subject: `Chatbot · ${flow.name}`, departmentId, lastMessageAt: new Date(), botState: { flow: "PUBLIC", scopeKey: resolved.scopeKey, variables: session.variables } as any },
            select: { id: true },
          });
          await tx.message.create({ data: { tenantId: tenant.id, conversationId: conversation.id, direction: "INTERNAL", status: "SENT", content: summary, contentType: "text", senderName: "Contexto do atendimento", metadata: { kind: "handoff_context", reason: reason ?? "public_flow" } } });
          await tx.message.create({ data: { tenantId: tenant.id, conversationId: conversation.id, direction: "INBOUND", status: "RECEIVED", content: session.lastUserText || "(conversa iniciada pela página pública)", contentType: "text", senderName: "Cliente (página pública)", metadata: { origin: "public_flow" } } });
          await tx.auditLog.create({ data: { tenantId: tenant.id, action: "engine.public_handoff", entityType: "conversation", entityId: conversation.id, details: { scopeKey: resolved.scopeKey, reason: reason ?? "public_flow" } } });
        });
        this.events.publish(tenant.id, "conversation.created", { channel: "WEBCHAT" });
      } catch {
        return null;
      }
      return true;
    };
    const systemNotice = "Combinado! Você será atendido pela nossa equipe agora. Aguarde um instante.";
    const heldBack = ["asaas.customer.lookup", "asaas.payment.lookup", "asaas.payment.pix", "asaas.payment.boleto", "contact.lookup", "api", "webhook", "integration"];
    const handoffKinds = new Set(["human.handoff", "assignment", "crm.stage.move", "crm.finalize", "tag", ...heldBack]);
    const outcome = async (): Promise<{ messages: string[]; options?: string[]; finished?: boolean; handoff?: boolean; redirect?: string }> => {
      if (!session.stepId) {
        // Primeira mensagem: saudar e posicionar no primeiro passo útil.
        if (flow.welcome) session.history.push({ role: "assistant", content: String(flow.welcome) });
        const first = steps.find((s) => s.kind === "trigger") ?? steps[0];
        if (!first) return { messages: [String(flow.welcome || "Olá! Como podemos ajudar?")] };
        return runStep(first);
      }
      const current = findStep(session.stepId);
      if (!current) { session.completed = true; return { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true }; }
      return runStep(current, text);
    };
    const runStep = async (step: PublicStep, userText?: string): Promise<{ messages: string[]; options?: string[]; finished?: boolean; handoff?: boolean; redirect?: string }> => {
      const kind = String(step.kind || "text");
      if (kind === "trigger") {
        const next = advance(step);
        return next ? runStep(next) : { messages: [render({ ...step, message: String(flow.welcome || "Olá! Como podemos ajudar?") })] };
      }
      if (kind === "input.text" || kind === "input.number" || kind === "input.cpf" || kind === "input.email" || kind === "input.phone" || kind === "input.date" || kind === "input.url") {
        if (userText === undefined) return promptInput(step, kind);
        const config = parseConfig(step);
        const variable = String(config.variable || "resposta");
        let value = String(userText).trim().slice(0, 500);
        if (kind === "input.cpf") value = value.replace(/\D/g, "");
        if (kind === "input.cpf" && ![11, 14].includes(value.length)) {
          return { messages: ["Envie um CPF com 11 dígitos ou CNPJ com 14 dígitos. Pode usar pontos, traços e espaços."], options: undefined };
        }
        session.variables[variable] = value;
        session.history.push({ role: "user", content: value.slice(0, 300) });
        const nextId = step.transitions?.[step.options?.[0] ?? ""] ?? Object.values(step.transitions ?? {})[0];
        return nextId ? (findStep(nextId) ? runStep(findStep(nextId)!) : { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true }) : { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true };
      }
      if (kind === "buttons" || kind === "quick-reply" || kind === "text") {
        const options = Array.isArray(step.options) ? step.options : [];
        if (userText !== undefined && options.length) {
          const index = optionIndex(options, String(userText));
          if (index >= 0) {
            const key = options[index]!;
            session.variables["ultima_opcao"] = key;
            session.history.push({ role: "user", content: key.slice(0, 300) });
            const nextId = step.transitions?.[key];
            return nextId && findStep(nextId) ? runStep(findStep(nextId)!) : { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true };
          }
          if (userText.trim()) {
            session.history.push({ role: "user", content: String(userText).slice(0, 300) });
            return { messages: ["Escolha uma das opções abaixo ou digite atendente."], options };
          }
        }
        if (userText === undefined && options.length === 0) {
          // Texto simples: avança direto.
          const next = advance(step);
          return next ? runStep(next) : { messages: [render(step)], options: [], finished: true };
        }
        const message = render(step);
        session.history.push({ role: "assistant", content: message.slice(0, 400) });
        return { messages: message ? [message] : [], options };
      }
      if (kind === "condition") {
        const config = parseConfig(step);
        const actual = session.variables[String(config.variable || "")] ?? "";
        const option = actual === String(config.value ?? "") ? "Sim" : "Não";
        const nextId = step.transitions?.[option];
        return nextId && findStep(nextId) ? runStep(findStep(nextId)!) : { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true };
      }
      if (kind === "variable") {
        const config = parseConfig(step);
        const target = String(config.variable || "variavel");
        session.variables[target] = interpolate(String(config.value ?? ""), session.variables);
        const next = advance(step);
        return next ? runStep(next) : { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true };
      }
      if (kind === "delay") {
        const next = advance(step);
        return next ? runStep(next) : { messages: [], finished: true };
      }
      if (kind === "redirect") {
        const config = parseConfig(step);
        const url = String(config.url || "");
        if (url && /^https:\/\//.test(url)) return { messages: ["Abrindo agora…"], redirect: url, finished: true };
        const next = advance(step);
        return next ? runStep(next) : { messages: ["Encerramos por aqui. Até logo! 🙂"], finished: true };
      }
      if (kind === "agent") {
        return agentTurn(step, userText, render(step));
      }
      if (kind === "finish") {
        session.completed = true;
        return { messages: [render(step) || "Encerramos por aqui. Até logo! 🙂"], finished: true };
      }
      if (kind === "department.route") {
        const config = parseConfig(step);
        const ok = await finishWithHandoff(String(config.departmentKey || "") || undefined, "department_route");
        session.completed = true;
        return { messages: ["Perfeito! Encaminhei sua solicitação para a equipe responsável. Em breve alguém continuará por aqui."], finished: true, handoff: true };
      }
      if (handoffKinds.has(kind)) {
        const config = parseConfig(step);
        const departmentKey = ["human.handoff", "assignment"].includes(kind) ? String(config.departmentKey || "") || undefined : undefined;
        await finishWithHandoff(departmentKey, kind);
        session.completed = true;
        return { messages: ["Certo! Vou encaminhar para nossa equipe continuar com você por aqui."], finished: true, handoff: true };
      }
      // Bloco desconhecido: nunca trava — encaminha para a equipe.
      await finishWithHandoff(undefined, "unsupported_step");
      session.completed = true;
      return { messages: ["Vou encaminhar para nossa equipe continuar com você."], finished: true, handoff: true };
    };
    const promptInput = (step: PublicStep, kind: string) => {
      const message = render(step);
      session.history.push({ role: "assistant", content: message.slice(0, 400) });
      return { messages: message ? [message] : ["Pode me informar, por favor?"] };
    };
    const parseConfig = (step: PublicStep): Record<string, string> => {
      try { return JSON.parse(String(step.config || "{}")) as Record<string, string>; } catch { return {}; }
    };
    const optionIndex = (options: string[], raw: string): number => {
      const wanted = normalized(raw).replace(/^[0-9]+[.)]?\s*/, "").trim();
      const byNumber = /^[0-9]+$/.test(raw.trim()) ? Number(raw.trim()) - 1 : -1;
      if (byNumber >= 0 && byNumber < options.length) return byNumber;
      return options.findIndex((option) => normalized(option) === wanted || normalized(option).startsWith(wanted) && wanted.length >= 3);
    };
    const agentTurn = async (step: PublicStep, userText: string | undefined, fallback: string): Promise<{ messages: string[]; options?: string[]; finished?: boolean }> => {
      const options = Array.isArray(step.options) && step.options.length ? step.options : undefined;
      const systemBase = "Você é a assistente virtual pública desta empresa atendendo pelo chat. Responda de forma curta (no máximo 2 frases), cordial e objetiva. Não execute ações, não prometa nada e não revele dados de cadastros — se faltar informação, peça para a pessoa escolher uma opção ou dizer 'atendente'.";
      if (!this.ai) return { messages: [fallback || "Certo! Posso ajudar com outra coisa?"], options };
      const config = parseConfig(step);
      const assistant = object(resolved.root.assistant);
      const agent = Array.isArray(assistant.agents) ? assistant.agents.find((item: any) => item && String(item.id) === String(config.agentId) && item.enabled === true) : null;
      if (!agent) return { messages: ["Posso ajudar com outra coisa? Se preferir, digite atendente."], options };
      const providers = economicalProviders(assistant, agent.llm || assistant.llm, resolved.root, tenant.id);
      if (!providers.length) return { messages: ["Posso ajudar com outra coisa? Se preferir, digite atendente."], options };
      try {
        await reserveAiExecution(this.prisma, tenant.id, dailyAiLimit(assistant.dailyAiLimit), "public_agent_turn");
      } catch {
        return { messages: ["No momento não consigo responder com a IA, mas posso encaminhar para a equipe. Digite atendente."], options };
      }
      const history = session.history.slice(-8).map((item) => ({ role: item.role, content: item.content.slice(0, 500) }));
      const system = systemBase + "\n\nOrientação do agente: " + String(agent.instructions || "").slice(0, 2000) + "\n\nConhecimento da empresa: " + String(assistant.companyKnowledge || "").slice(0, 3000);
      let reply = "";
      try {
        const generated = await this.ai.generate([
          { role: "system", content: system },
          ...history,
          ...(userText !== undefined ? [{ role: "user" as const, content: userText.slice(0, 500) }] : []),
        ], providers.map((p) => ({ ...p, maxTokens: 350 })));
        reply = String(generated.text || "").slice(0, 1000);
      } catch {
        reply = "";
      }
      const safe = reply.trim() || "Posso ajudar com outra coisa? Se preferir, digite atendente.";
      session.history.push({ role: "assistant", content: safe.slice(0, 400) });
      return { messages: [safe], options };
    };
    const result = await outcome();
    sessions.set(key, session);
    if (sessions.size > 4000) { for (const [k, v] of sessions) { if (Date.now() - v.lastAt > SESSION_TTL_MS) sessions.delete(k); } }
    return { sessionId, ...result };
  }
}
