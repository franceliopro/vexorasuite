/**
 * Pure, tenant-independent Rastreabem conversation policy.
 * Side effects (protocol persistence, Asaas and transfers) belong to the caller.
 * Never infer a verified customer from a WhatsApp display name.
 */
export const RASTREABEM_PLATFORMS = ["Ceeb Vision", "Link", "Rastreabem"] as const;
export type Platform = typeof RASTREABEM_PLATFORMS[number];
export type Sector = "FINANCEIRO" | "SUPORTE" | "COMERCIAL" | "ADMINISTRATIVO";
export type Step = "IDENTIFY" | "CONFIRM_NAME" | "ASK_NAME" | "SECTOR" | "PLATFORM" | "FINANCE_CHOICE" | "DOCUMENT" | "DONE";
export type BotState = {
  step: Step;
  protocol: string;
  novo_nome?: string;
  sector?: Sector;
  platform?: Platform;
  document?: string;
};
export type BotEffect =
  | { type: "TRANSFER"; sector: Sector; platform?: Platform }
  | { type: "ASAAS_LOOKUP"; document: string; platform: Platform }
  | { type: "EXTERNAL_CONTACT"; sector: "COMERCIAL" | "ADMINISTRATIVO" };
export type BotResult = { state: BotState; messages: string[]; effects: BotEffect[] };
const sectors: Sector[] = ["FINANCEIRO", "SUPORTE", "COMERCIAL", "ADMINISTRATIVO"];
const normalize = (text: string) => text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const pick = (answer: string, options: readonly string[]) => {
  const value = normalize(answer);
  const numeric = Number(value);
  if (/^[1-9]$/.test(value) && numeric <= options.length) return numeric - 1;
  return options.findIndex(option => normalize(option) === value);
};
const sectorMenu = "Qual setor deseja acessar?\n1. Financeiro\n2. Suporte Técnico\n3. Comercial\n4. Administrativo";
const platformMenu = "Qual plataforma você utiliza?\n1. Ceeb Vision\n2. Link\n3. Rastreabem";
const financeMenu = "Como deseja continuar?\n1. Falar com atendente\n2. Realizar pagamento pelo Asaas";
const cleanName = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 80);
const validName = (value: string) => value.length >= 2 && /\p{L}/u.test(value) && !/[<>\n\r]/.test(value);
export function startRastreabemBot(input: { protocol: string; verifiedCustomerName?: string; suggestedName?: string }): BotResult {
  if (!/^[A-Za-z0-9-]{6,60}$/.test(input.protocol)) throw new Error("Protocolo inválido");
  const state: BotState = { step: "ASK_NAME", protocol: input.protocol };
  const messages = [`Olá! Seu protocolo de atendimento é ${input.protocol}.`];
  if (input.verifiedCustomerName?.trim()) {
    state.novo_nome = cleanName(input.verifiedCustomerName);
    state.step = "SECTOR";
    messages.push(`Olá, ${state.novo_nome}! ${sectorMenu}`);
  } else if (input.suggestedName?.trim()) {
    state.step = "CONFIRM_NAME";
    messages.push(`Posso chamar você de ${cleanName(input.suggestedName)}? Responda sim ou informe como prefere ser chamado.`);
  } else {
    messages.push("Como você gostaria de ser chamado?");
  }
  return { state, messages, effects: [] };
}
export function advanceRastreabemBot(state: BotState, answer: string, suggestedName?: string): BotResult {
  const next: BotState = { ...state };
  const messages: string[] = [];
  const effects: BotEffect[] = [];
  const value = answer.trim();
  switch (state.step) {
    case "IDENTIFY":
      return { state: next, messages: ["Identificação pendente. Aguarde a confirmação."], effects };
    case "ASK_NAME":
    case "CONFIRM_NAME": {
      const name = state.step === "CONFIRM_NAME" && /^(sim|s|isso|correto)$/i.test(normalize(value))
        ? cleanName(suggestedName || "") : cleanName(value);
      if (!validName(name)) {
        messages.push("Não consegui identificar seu nome. Como gostaria de ser chamado?");
        next.step = "ASK_NAME";
        break;
      }
      next.novo_nome = name;
      next.step = "SECTOR";
      messages.push(`Obrigado, ${name}! ${sectorMenu}`);
      break;
    }
    case "SECTOR": {
      const index = pick(value, ["Financeiro", "Suporte Técnico", "Comercial", "Administrativo"]);
      if (index < 0) { messages.push(sectorMenu); break; }
      next.sector = sectors[index];
      if (next.sector === "FINANCEIRO" || next.sector === "SUPORTE") {
        next.step = "PLATFORM";
        messages.push(platformMenu);
      } else {
        next.step = "DONE";
        effects.push({ type: "EXTERNAL_CONTACT", sector: next.sector });
      }
      break;
    }
    case "PLATFORM": {
      const index = pick(value, RASTREABEM_PLATFORMS);
      if (index < 0) { messages.push(platformMenu); break; }
      next.platform = RASTREABEM_PLATFORMS[index];
      if (next.sector === "SUPORTE") {
        next.step = "DONE";
        effects.push({ type: "TRANSFER", sector: "SUPORTE", platform: next.platform });
      } else {
        next.step = "FINANCE_CHOICE";
        messages.push(financeMenu);
      }
      break;
    }
    case "FINANCE_CHOICE": {
      const index = pick(value, ["Falar com atendente", "Realizar pagamento pelo Asaas"]);
      if (index < 0) { messages.push(financeMenu); break; }
      if (index === 0) {
        next.step = "DONE";
        effects.push({ type: "TRANSFER", sector: "FINANCEIRO", platform: next.platform });
      } else {
        next.step = "DOCUMENT";
        messages.push("Informe seu CPF ou CNPJ para consultar suas cobranças. Não envie senhas nem dados de cartão.");
      }
      break;
    }
    case "DOCUMENT": {
      const digits = value.replace(/\D/g, "");
      if (![11, 14].includes(digits.length) || !/^\d+$/.test(digits)) {
        messages.push("Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.");
        break;
      }
      next.document = digits;
      next.step = "DONE";
      effects.push({ type: "ASAAS_LOOKUP", document: digits, platform: next.platform! });
      break;
    }
    case "DONE":
      messages.push("Seu atendimento já foi encaminhado. Aguarde o retorno.");
      break;
  }
  return { state: next, messages, effects };
}
