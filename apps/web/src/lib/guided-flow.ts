/** Modelo legível do roteiro. O JSON continua apenas como transporte interno. */

export type GuidedStep = {
  action?: "asaas.customer.lookup" | "asaas.payment.lookup" | "asaas.payment.pix" | "asaas.payment.boleto" | "human.handoff" | "crm.stage.move" | "crm.finalize";
  kind?: string;
  config?: string;
  id: string;
  title: string;
  message: string;
  options: string[];
  transitions?: Record<string, string>;
  position?: { x: number; y: number };
};

export type GuidedFlow = {
  name: string;
  welcome: string;
  askPreferredName?: boolean;
  steps: GuidedStep[];
  channelIds?: string[];
  triggers?: { kind: "message" | "keyword" | "dm" | "first_message"; keyword?: string }[];
};

export type GuidedDepartment = { key: string; name: string };

export type GuidedExplanation = {
  title: string;
  what: string;
  configure: string;
  sees: string;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

function pickDepartment(departments: readonly GuidedDepartment[], matcher: RegExp, preferredKey: string) {
  const byKey = departments.find(department => normalize(department.key) === normalize(preferredKey));
  return byKey ?? departments.find(department => matcher.test(normalize(department.key)) || matcher.test(normalize(department.name)));
}

function handoffStep(id: string, title: string, department: GuidedDepartment | undefined, position: { x: number; y: number }): GuidedStep {
  const usable = department?.key?.trim() ? department : undefined;
  return {
    id,
    title,
    kind: "human.handoff",
    message: usable
      ? `Encaminhei sua conversa para o time ${usable.name}. Um atendente continuará por aqui.`
      : "Encaminhei sua conversa para o atendimento humano.",
    config: JSON.stringify(usable ? { targetMode: "DEPARTMENT", departmentKey: usable.key } : { targetMode: "QUEUE" }),
    options: [],
    transitions: {},
    position,
  };
}

/**
 * Roteiro funcional de referência: identifica o nome preferido, guarda em
 * {{novo_nome}}, faz a triagem e encaminha para Suporte/Administrativo.
 * Nada é publicado por esta função; ela apenas devolve um rascunho.
 */
export function preferredNameFlow(departments: readonly GuidedDepartment[]): GuidedFlow {
  const support = pickDepartment(departments, /(suporte|support)/, "SUPORTE");
  const administrative = pickDepartment(departments, /(administrativo|administracao|adm)/, "ADM");
  return {
    name: "Atendimento com nome preferido",
    welcome: "Olá!",
    triggers: [{ kind: "message" }],
    steps: [
      {
        id: "nome",
        title: "1. Verificar nome identificado",
        kind: "condition",
        message: "",
        config: JSON.stringify({ variable: "nome_identificado", value: "" }),
        options: ["Sim", "Não"],
        transitions: { Sim: "nome-digitar", Não: "nome-escolha" },
        position: { x: 40, y: 40 },
      },
      {
        id: "nome-escolha",
        title: "2. Perguntar como prefere ser chamado",
        kind: "buttons",
        message: "Como você gostaria de ser chamado?",
        options: ["Usar {{nome_identificado}}", "Digitar outro nome"],
        transitions: { "Usar {{nome_identificado}}": "nome-manter", "Digitar outro nome": "nome-digitar" },
        position: { x: 360, y: 20 },
      },
      {
        id: "nome-manter",
        title: "3. Manter o nome identificado",
        kind: "variable",
        message: "",
        config: JSON.stringify({ variable: "novo_nome", value: "{{nome_identificado}}" }),
        options: ["Continuar"],
        transitions: { Continuar: "menu-triagem" },
        position: { x: 700, y: 0 },
      },
      {
        id: "nome-digitar",
        title: "3. Capturar o nome preferido",
        kind: "input.text",
        message: "Digite o nome pelo qual prefere ser chamado.",
        config: JSON.stringify({ variable: "novo_nome", validation: "preferred-name" }),
        options: ["Continuar"],
        transitions: { Continuar: "menu-triagem" },
        position: { x: 700, y: 210 },
      },
      {
        id: "menu-triagem",
        title: "4. Escolher a área",
        kind: "buttons",
        message: "{{novo_nome}}, qual área?",
        options: ["Suporte", "Administrativo"],
        transitions: { Suporte: "suporte", Administrativo: "administrativo" },
        position: { x: 1040, y: 100 },
      },
      handoffStep("suporte", "5. Encaminhar para Suporte", support, { x: 1380, y: 20 }),
      handoffStep("administrativo", "5. Encaminhar para Administrativo", administrative, { x: 1380, y: 260 }),
    ],
  };
}

export const flowGuide: ReadonlyArray<{
  id: string;
  label: string;
  when: string;
  configure: string;
  sees: string;
}> = [
  { id: "text", label: "Enviar mensagem", when: "Quando o bot só precisa informar algo e seguir em frente.", configure: "Texto da mensagem e o próximo passo.", sees: "A mensagem que você escreveu." },
  { id: "buttons", label: "Oferecer opções", when: "Quando o cliente deve escolher entre respostas previstas.", configure: "Cada opção e para onde ela leva.", sees: "A pergunta e botões numerados." },
  { id: "input.text", label: "Fazer pergunta", when: "Quando a resposta é livre, como um nome ou uma descrição.", configure: "Onde guardar a resposta e se ela precisa ser um nome válido.", sees: "A pergunta e um campo para digitar." },
  { id: "condition", label: "Verificar condição", when: "Quando o caminho muda conforme um dado já conhecido.", configure: "Qual informação verificar e o valor esperado.", sees: "Nada. É uma decisão interna." },
  { id: "variable", label: "Guardar informação", when: "Quando você quer reaproveitar um dado em mensagens ou transferências.", configure: "O nome do dado e seu valor, que pode usar {{variavel}}.", sees: "Nada. É uma ação interna." },
  { id: "human.handoff", label: "Transferir atendimento", when: "Quando uma pessoa deve continuar a conversa.", configure: "A mensagem de aviso e o time ou atendente de destino.", sees: "A mensagem de encaminhamento; depois, um atendente assume." },
  { id: "agent", label: "Agente de IA", when: "Quando um agente configurado deve conduzir a conversa.", configure: "Qual agente ativo será usado.", sees: "As respostas do agente dentro do fluxo." },
  { id: "catalog.item", label: "Item do catálogo", when: "Quando o bot deve apresentar um produto digital ou serviço cadastrado pela empresa.", configure: "Escolha explicitamente o item. Nome, tipo, SKU, categoria e preço vêm do cadastro; descrição e imagem internas não são enviadas pelo bot.", sees: "O item escolhido com dados públicos do item cadastrado e o link da vitrine, em vez da descrição e da imagem internas, sem preço ou condição inventados." },
  { id: "catalog.list", label: "Listar catálogo", when: "Quando o bot deve enviar o catálogo completo da vitrine, sem escolher um item.", configure: "Nada a selecionar: configure a URL HTTPS da vitrine no Catálogo.", sees: "O link do catálogo completo e o aviso honesto de que a vitrine não confirma pagamento, pedido ou conexão com provedor." },
  { id: "tag", label: "Adicionar tag", when: "Quando o contato deve ser classificado no CRM.", configure: "Nome e cor da tag.", sees: "Nada. A classificação fica no CRM." },
];

export function explainStep(step: Pick<GuidedStep, "kind" | "action" | "config">): GuidedExplanation {
  const type = step.action || step.kind || "text";
  let config: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(step.config || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) config = parsed as Record<string, string>;
  } catch { /* mantém a explicação genérica */ }

  if (type === "condition" && config.variable === "nome_identificado") return {
    title: "Verifica se já existe um nome identificado",
    what: "Esta é uma decisão interna: se o contato ainda não tiver nome, o bot pede que ele digite; se já tiver, oferece a escolha.",
    configure: "Você não precisa configurar nada aqui. As saídas Sim e Não são técnicas e não aparecem para o cliente.",
    sees: "Nada nesta etapa.",
  };
  if (type === "buttons" && config.validation === undefined) return {
    title: "Faz uma pergunta com opções",
    what: "O bot mostra a mensagem e espera que o cliente escolha uma das respostas.",
    configure: "Edite a mensagem, as opções e, em Conexões, para onde cada opção leva.",
    sees: "Sua mensagem e as opções, numeradas no WhatsApp.",
  };
  if (type === "input.text" && config.validation === "preferred-name") return {
    title: "Guarda o nome preferido do cliente",
    what: "O bot aceita apenas um nome válido e salva esse valor como {{novo_nome}} para usar nas próximas mensagens e no atendimento.",
    configure: "Edite a pergunta. O campo de destino já está configurado; não mexa no JSON.",
    sees: "A pergunta e um campo livre para digitar o nome.",
  };
  if (type === "input.text") return {
    title: "Faz uma pergunta com resposta livre",
    what: "O bot espera o cliente digitar e guarda a resposta em uma variável.",
    configure: "Escolha o nome da variável e escreva a pergunta.",
    sees: "A pergunta e um campo para digitar.",
  };
  if (type === "variable" && config.variable === "novo_nome") return {
    title: "Guarda o nome escolhido",
    what: "O bot reaproveita o nome identificado e passa a tratá-lo como {{novo_nome}} no restante do atendimento.",
    configure: "Não é necessário configurar nada aqui.",
    sees: "Nada nesta etapa.",
  };
  if (type === "human.handoff") return {
    title: "Passa a conversa para uma pessoa",
    what: "O bot encerra a automação e encaminha a conversa para o destino selecionado.",
    configure: "Escolha a mensagem de aviso e o destino: fila geral, time ou atendente.",
    sees: "A mensagem de encaminhamento; em seguida, um atendente entra.",
  };
  if (type === "agent") return {
    title: "Entrega a conversa a um agente de IA",
    what: "Um agente ativo da empresa responde dentro deste ponto do fluxo.",
    configure: "Selecione o agente.",
    sees: "As mensagens geradas pelo agente.",
  };
  if (type === "catalog.item") return {
    title: "Apresenta um item do catálogo",
    what: "O bot mostra o produto digital ou serviço escolhido com os dados públicos cadastrados pela empresa e o link da vitrine.",
    configure: "Selecione o item no painel. Não digite preço, disponibilidade ou condição manualmente.",
    sees: "Nome, tipo, SKU, categoria e preço do item cadastrado, com o link da vitrine; descrição e imagem internas não são enviadas pelo bot.",
  };
  if (type === "catalog.list") return {
    title: "Envia o catálogo completo",
    what: "O bot envia o link do catálogo completo da vitrine configurada, sem escolher item e sem inventar site.",
    configure: "Nada a selecionar. Configure a URL HTTPS da vitrine no Catálogo; se ela não existir, o bot avisa para configurá-la.",
    sees: "O link do catálogo completo e o aviso honesto de que a vitrine não confirma pagamento, pedido ou conexão com provedor.",
  };
  if (type === "variable") return {
    title: "Guarda uma informação",
    what: "O bot salva um valor para reaproveitar em mensagens, decisões ou transferências.",
    configure: "Nome do dado e valor. Use {{variavel}} para reaproveitar outro dado.",
    sees: "Nada nesta etapa.",
  };
  if (type === "condition") return {
    title: "Decide qual caminho seguir",
    what: "O bot compara um dado com um valor e escolhe a saída Sim ou Não.",
    configure: "Informação a verificar e valor esperado.",
    sees: "Nada nesta etapa.",
  };
  return {
    title: "Envia uma mensagem",
    what: "O bot mostra o texto e segue para o próximo passo.",
    configure: "Texto da mensagem e próximo passo.",
    sees: "A mensagem que você escreveu.",
  };
}

export const guidedKindOptions: ReadonlyArray<readonly [string, string]> = [
  ["text", "Enviar mensagem"],
  ["buttons", "Oferecer opções"],
  ["input.text", "Fazer pergunta"],
  ["input.cpf", "Pedir CPF/CNPJ"],
  ["condition", "Verificar condição"],
  ["variable", "Guardar informação"],
  ["human.handoff", "Transferir atendimento"],
  ["department.route", "Abrir atendimento do departamento"],
  ["agent", "Agente de IA"],
  ["catalog.item", "Item do catálogo"],
  ["catalog.list", "Listar catálogo"],
  ["tag", "Adicionar tag"],
];

export function guidedKindDefaults(kind: string): Partial<GuidedStep> {
  const common = { kind, action: undefined as GuidedStep["action"], transitions: {} as Record<string, string> };
  switch (kind) {
    case "buttons": return { ...common, config: undefined, options: [] };
    case "input.text": return { ...common, config: JSON.stringify({ variable: "novo_nome" }), options: ["Continuar"] };
    case "input.cpf": return { ...common, config: JSON.stringify({ variable: "cpf" }), options: ["Continuar"] };
    case "condition": return { ...common, config: JSON.stringify({ variable: "nome_identificado", value: "" }), options: ["Sim", "Não"] };
    case "variable": return { ...common, config: JSON.stringify({ variable: "novo_nome", value: "" }), options: ["Continuar"] };
    case "human.handoff": return { ...common, config: JSON.stringify({ targetMode: "QUEUE" }), options: [] };
    case "department.route": return { ...common, config: JSON.stringify({ targetMode: "DEPARTMENT" }), options: ["Continuar"] };
    case "agent": return { ...common, config: JSON.stringify({ agentId: "" }), options: ["Continuar"] };
    case "catalog.item": return { ...common, config: JSON.stringify({ itemId: "" }), options: ["Continuar"] };
    case "catalog.list": return { ...common, config: undefined, options: ["Continuar"] };
    case "tag": return { ...common, config: JSON.stringify({ name: "Novo lead" }), options: ["Continuar"] };
    default: return { ...common, config: undefined, options: ["Continuar"] };
  }
}

export type StepIO = {
  label: string;
  input: string;
  output: string;
  writes: string[];
  reads: string[];
  kind: "text" | "variable" | "condition" | "flow";
  note: string;
};

function varsIn(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map(match => match[1] ?? "");
}

export function stepIO(step: Pick<GuidedStep, "kind" | "action" | "config" | "message" | "options">): StepIO {
  const type = step.action || step.kind || "text";
  const config = (() => {
    try {
      const parsed: unknown = JSON.parse(step.config || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
    } catch { return {}; }
  })();
  const outputs = step.options?.length ? step.options : ["Continuar"];
  const reads = varsIn([step.message || "", ...(step.options || [])].join(" "));
  if (type === "condition") return {
    label: "Verificar condi\u00E7\u00E3o", input: config.variable || "Informa\u00E7\u00E3o", output: "Sim / N\u00E3o",
    writes: [], reads: config.variable ? [config.variable] : [], kind: "condition",
    note: "Decis\u00E3o interna: o cliente n\u00E3o v\u00EA esta etapa.",
  };
  if (type === "variable") return {
    label: "Guardar informa\u00E7\u00E3o", input: config.value ? "Valor: " + config.value : "Valor informado",
    output: outputs.join(", "), writes: config.variable ? [config.variable] : [],
    reads: Array.from(new Set([...reads, ...varsIn(config.value || "")])), kind: "variable",
    note: "Salva um valor para usar depois com {{variavel}}.",
  };
  if (String(type).startsWith("input.")) return {
    label: type === "input.text" ? "Fazer pergunta" : "Pedir dado", input: "Resposta do cliente",
    output: outputs.join(", "), writes: config.variable ? [config.variable] : [], reads: [], kind: "variable",
    note: "A resposta \u00E9 salva na vari\u00E1vel indicada.",
  };
  if (type === "buttons" || type === "quick-reply") return {
    label: "Oferecer op\u00E7\u00F5es", input: "Escolha do cliente", output: outputs.join(", "),
    writes: [], reads, kind: "text", note: "Cada op\u00E7\u00E3o leva a um pr\u00F3ximo passo.",
  };
  if (type === "catalog.item") return {
    label: "Item do catálogo", input: "Item escolhido no cadastro da empresa", output: outputs.join(", "),
    writes: [], reads: [], kind: "text", note: "Nome, tipo, SKU, categoria e preço vêm do cadastro; descrição e imagem são internas; o bot não inventa condições.",
  };
  if (type === "catalog.list") return {
    label: "Listar catálogo", input: "Nenhum item selecionado", output: outputs.join(", "),
    writes: [], reads: [], kind: "text", note: "Envia o link do catálogo completo da vitrine configurada e o aviso honesto; nunca inventa domínio.",
  };
  return {
    label: "Enviar mensagem", input: "Nenhum dado de entrada", output: outputs.join(", "),
    writes: [], reads, kind: "text", note: "Apenas informa e segue em frente.",
  };
}