/**
 * Véxora Intelligence Engine — deterministic routing layer.
 * No model invocation, no remote requests and no side effects.
 * Rules are intentionally narrow: uncertain input goes to human review.
 */
export type EngineIntent = "payment" | "finance" | "support" | "sales" | "administration" | "unknown";
export type EngineDecision = {
  intent: EngineIntent;
  source: "explicit_choice" | "rules" | "fallback";
  confidence: number;
  nextStep: "ask_payment_option" | "ask_platform" | "ask_customer_type" | "administration_contact" | "human_review";
  needsLlm: boolean;
  tokensUsed: 0;
  message: string;
};
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const patterns: { intent: Exclude<EngineIntent, "unknown">; terms: RegExp; nextStep: EngineDecision["nextStep"]; message: string }[] = [
  { intent: "payment", terms: /\b(pagar|pagamento|pix|boleto|segunda via|2a via|mensalidade|fatura)\b/, nextStep: "ask_payment_option", message: "Você deseja pagar uma cobrança? Posso orientar o próximo passo ou encaminhar ao Financeiro." },
  { intent: "finance", terms: /\b(financeiro|cobranca|vencimento|nota fiscal)\b/, nextStep: "ask_platform", message: "Qual plataforma você utiliza: Ceeb Vision, Link ou Rastreabem?" },
  { intent: "support", terms: /\b(suporte|tecnico|rastreador|localizacao|veiculo|instalacao|sem sinal|bloqueio)\b/, nextStep: "ask_platform", message: "Para o suporte técnico, qual plataforma você utiliza: Ceeb Vision, Link ou Rastreabem?" },
  { intent: "sales", terms: /\b(comercial|comprar|contratar|vendas|orcamento|plano|preco)\b/, nextStep: "ask_customer_type", message: "O atendimento comercial é para Pessoa Física ou Jurídica?" },
  { intent: "administration", terms: /\b(administrativo|administracao|gerencia|diretoria)\b/, nextStep: "administration_contact", message: "Vou direcionar sua solicitação ao contato administrativo configurado." },
];
export function routeIntelligence(input: { text: string; selectedIntent?: EngineIntent }): EngineDecision {
  const text = normalize(input.text);
  if (!text || text.length > 1000) throw new Error("Mensagem inválida");
  const selected = input.selectedIntent && patterns.find(p => p.intent === input.selectedIntent);
  const matches = selected ? [selected] : patterns.filter(p => p.terms.test(text));
  if (matches.length !== 1 || !matches[0]) return { intent: "unknown", source: "fallback", confidence: 0, nextStep: "human_review", needsLlm: false, tokensUsed: 0, message: "Como podemos ajudar? Escolha Financeiro, Suporte Técnico, Comercial ou Administrativo, ou solicite um atendente." };
  const item = matches[0];
  return { intent: item.intent, source: selected ? "explicit_choice" : "rules", confidence: selected ? 1 : 0.8, nextStep: item.nextStep, needsLlm: false, tokensUsed: 0, message: item.message };
}

/** Safe, deterministic workflow draft. No activation or external side effects. */
export function proposeWorkflow(text: string) {
  const request = normalize(text);
  if (!request || request.length > 2000) throw new Error("Descrição inválida");
  const rastreabem = /rastreabem|ceeb vision|rastreamento veicular/.test(request);
  const marketing = /carrossel|instagram|campanha|marketing|palavra.chave/.test(request);
  if (rastreabem) return {
    template: "rastreabem-triage", status: "draft", requiresApproval: true, active: false,
    title: "Triagem de atendimento Rastreabem",
    steps: [
      { id: "start", type: "trigger", label: "Mensagem recebida em canal autorizado" },
      { id: "sector", type: "choice", label: "Financeiro, Suporte, Comercial ou Administrativo" },
      { id: "finance", type: "choice", label: "Financeiro: selecionar plataforma e Pagar ou Atendente" },
      { id: "payment", type: "skill", skill: "asaas.payment.lookup", label: "Diálogo financeiro Asaas com verificação de identidade" },
      { id: "support", type: "route", label: "Suporte: selecionar plataforma e equipe" },
      { id: "sales", type: "choice", label: "Comercial: Pessoa Física ou Jurídica" },
      { id: "admin", type: "route", label: "Administrativo: contato configurado" },
      { id: "human", type: "handoff", label: "Encaminhamento humano quando necessário" },
    ],
    missing: ["Destinos reais de cada setor", "Contato comercial PF/PJ", "Contato administrativo", "Credenciais Asaas e validação sandbox", "Configuração dos canais e permissões"],
    estimatedLlmTokens: 0,
  };
  if (marketing) return {
    template: "marketing-carousel", status: "draft", requiresApproval: true, active: false,
    title: "Campanha de carrossel com resposta por palavra-chave",
    steps: [
      { id: "research", type: "skill", skill: "web.research", label: "Pesquisar fontes verificáveis" },
      { id: "script", type: "agent", label: "Criar roteiro, legenda e CTA" },
      { id: "design", type: "skill", skill: "media.carousel.generate", label: "Gerar artes e revisar formato" },
      { id: "approval", type: "approval", label: "Revisão e autorização de publicação" },
      { id: "publish", type: "skill", skill: "social.publish", label: "Publicar na conta autorizada" },
      { id: "comment", type: "event", label: "Receber webhook de comentário e verificar palavra-chave" },
      { id: "reply", type: "skill", skill: "social.private_reply", label: "Responder conforme permissões e limites da plataforma" },
    ],
    missing: ["Conta profissional autorizada", "Permissões Meta/Zernio", "Fontes de pesquisa", "Identidade visual", "Texto ou link de resposta", "Palavra-chave e aprovação", "Validar publicação na conta autorizada; resposta privada por palavra-chave ainda pendente"],
    estimatedLlmTokens: null,
  };
  return { template: "unclassified", status: "needs_clarification", requiresApproval: true, active: false, title: "Automação personalizada", steps: [], missing: ["Objetivo, gatilho, ações, destinatários e critérios de conclusão"], estimatedLlmTokens: null };
}

