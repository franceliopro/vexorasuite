/**
 * Agente built-in para execução direta de fluxos do chatbot.
 * Materializado de forma preguiçosa em integrations.assistant.agents, sem migração.
 * Diferente do agente criativo, ele não faz pesquisa: recebe um mapa compacto
 * do fluxo e devolve operações curtas, aplicadas no backend.
 */
export const FLOW_ARCHITECT_AGENT_ID = 'vexora:flow-architect';

export type FlowArchitectAgent = {
  id: string; name: string; role: string; tier: string; enabled: boolean;
  instructions: string;
  profile: { tone: string; channels: string[] };
  behavior: { rules: string; prohibitions: string };
  allowedActions: string[];
  bindings: { mode: string; specialists: string[]; flows: string[]; pipelines: string[]; externalSystems: string[]; modules: string[]; inboxes: string[] };
};

export function flowArchitectAgent(): FlowArchitectAgent {
  return {
    id: FLOW_ARCHITECT_AGENT_ID,
    name: 'Arquiteto de Fluxo',
    role: 'Automação',
    tier: 'Econômico',
    enabled: true,
    instructions: 'Você executa comandos de linguagem natural no Chatbot Véxora. Para ajustes, responda somente operações curtas; para criação, responda somente o JSON do fluxo. Não faça pesquisa, não explique e não devolva o fluxo completo em um ajuste. Preserve blocos, IDs, opções e transições não pedidos.',
    profile: { tone: 'Direto e operacional', channels: [] },
    behavior: {
      rules: 'Localize blocos pelo id ou título recebido no mapa. Acrescentar uma opção de menu também cria um bloco de destino e conecta a opção, quando o pedido não indicar outro destino.',
      prohibitions: 'Não invente integração, link de pagamento, status de cobrança, publicação ou dados de cliente. Não altere canais, gatilhos ou blocos não citados.',
    },
    allowedActions: ['chatbot.flow.direct', 'assistant.direct.context'],
    bindings: { mode: 'specialist', specialists: [], flows: [], pipelines: [], externalSystems: [], modules: ['AUTOMATION'], inboxes: [] },
  };
}
