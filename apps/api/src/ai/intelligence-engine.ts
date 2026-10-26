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
  if (matches.length !== 1) return { intent: "unknown", source: "fallback", confidence: 0, nextStep: "human_review", needsLlm: false, tokensUsed: 0, message: "Como podemos ajudar? Escolha Financeiro, Suporte Técnico, Comercial ou Administrativo, ou solicite um atendente." };
  const item = matches[0];
  return { intent: item.intent, source: selected ? "explicit_choice" : "rules", confidence: selected ? 1 : 0.8, nextStep: item.nextStep, needsLlm: false, tokensUsed: 0, message: item.message };
}
