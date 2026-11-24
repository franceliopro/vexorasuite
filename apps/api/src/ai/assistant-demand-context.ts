/**
 * Resposta direta para demandas ainda não cobertas pelas regras do assistente.
 * Determinística, sem modelo, sem escrita e sem chamada externa: apenas leitura
 * curta e tenant-scoped. Se não houver fonte segura, devolve null e o chamador
 * mantém o fallback atual.
 */
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { normalize } from "./flow-runtime";

export type AssistantDemandContext = {
  source: string;
  answer: string;
  context?: Record<string, unknown>;
  usedAi: false;
  tokensUsed: 0;
};

type Capability = { module: string; label: string };

const CAPABILITIES: Capability[] = [
  { module: "INBOX", label: "Atendimento (conversas abertas e resolvidas)" },
  { module: "TASKS", label: "Tarefas (pendentes e com prazo vencido)" },
  { module: "CRM", label: "Contatos e leads (total registrado)" },
  { module: "CALENDAR", label: "Agenda (próximos eventos, com conta conectada)" },
  { module: "FINANCE", label: "Financeiro (pagamentos Asaas registrados na Véxora)" },
  { module: "AUTOMATION", label: "Relatórios PDF/CSV e comandos do fluxo do chatbot" },
];

/** Lista curta do que é seguro consultar, filtrada pelos módulos do usuário. */
export function assistantCapabilities(allowedModules?: string[]): string {
  const allowed = Array.isArray(allowedModules) ? new Set(allowedModules) : undefined;
  const available = CAPABILITIES.filter(item => !allowed || allowed.has(item.module));
  if (!available.length) return "Nenhuma consulta está disponível para os módulos deste usuário.";
  return "Consulto diretamente: " + available.map(item => item.label).join("; ") +
    ". Não executo cobrança, publicação, envio nem alteração de dados sem confirmação e evidência. Nenhuma IA foi acionada.";
}

/**
 * Chamado depois das regras existentes de `ask`, antes do fallback genérico.
 * Intenções ambíguas retornam null para não inventar resposta.
 */
export async function resolveAssistantDemandContext(
  prisma: PrismaService,
  req: AuthenticatedRequest,
  question: string,
): Promise<AssistantDemandContext | null> {
  const text = normalize(question);
  const capabilities = /^(o que voce (faz|pode fazer|consegue fazer)|quais (sao|seriam) (suas )?(funcoes|capacidades|habilidades)|como voce pode (ajudar|me ajudar)|o que posso (pedir|fazer|consultar)|me fale sobre voce|quem e voce)\b/i.test(text) ||
    /\b(o que voce faz|suas funcoes|suas capacidades|como pode me ajudar|o que posso pedir)\b/i.test(text);
  if (capabilities) {
    return {
      source: "rules",
      answer: assistantCapabilities(req.user.allowedModules),
      context: { scope: "capabilities" },
      usedAi: false,
      tokensUsed: 0,
    };
  }

  // Contagem de atendimentos do próprio departamento quando não é administração.
  const attendance = /^(quantas|quantos|resuma|me mostre|traga).*(conversas|atendimentos|chamados)\b/i.test(text) ||
    /^(status|situacao|resumo) (do |da )?(atendimento|inbox|suporte)\b/i.test(text);
  if (attendance && ["OWNER", "ADMIN"].includes(req.user.role)) {
    const departmentIds = Array.isArray(req.user.departmentIds) ? req.user.departmentIds : [];
    const where = { tenantId: req.user.tenantId, deletedAt: null, ...(departmentIds.length ? { departmentId: { in: departmentIds } } : {}) };
    const [open, resolved] = await Promise.all([
      prisma.conversation.count({ where: { ...where, status: "OPEN" } }),
      prisma.conversation.count({ where: { ...where, status: "RESOLVED" } }),
    ]);
    return {
      source: "database",
      answer: `Atendimento: ${open} conversas abertas e ${resolved} resolvidas${departmentIds.length ? " nos seus departamentos" : " na empresa"}. Totais registrados, sem filtro de período. Nenhuma ação foi executada.`,
      context: { scope: "attendance", open, resolved },
      usedAi: false,
      tokensUsed: 0,
    };
  }

  return null;
}
