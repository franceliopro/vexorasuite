import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { economicalProviders } from "./economical-providers";
import { agentPersonaBlock } from "./product-skills";
import { webDesignerAgent, WEB_DESIGNER_AGENT_ID } from "./web-designer-agent";

export function configuredCreativeAgent(root: any) {
  const agents = root?.assistant?.agents;
  return (Array.isArray(agents) ? agents.find((entry: any) => entry?.id === WEB_DESIGNER_AGENT_ID) : undefined) ?? webDesignerAgent();
}

export function resolveCreativeAgent(root: any, tenantId: string) {
  const assistant = root?.assistant;
  if (assistant?.enabled !== true) {
    throw new ForbiddenException({ code: "ASSISTANT_DISABLED", message: "Ative a IA da empresa em Agentes de IA → Configuração geral." });
  }
  const agent = configuredCreativeAgent(root);
  if (agent.enabled !== true) {
    throw new ForbiddenException("Ative o agente Design Gráfico & Web em Agentes de IA.");
  }
  if (!agent.llm?.provider || !agent.llm.model) {
    throw new ServiceUnavailableException("Selecione o provedor e o modelo em Design Gráfico & Web → Modelos e Voz.");
  }
  const providers = economicalProviders({ llm: agent.llm }, undefined, root, tenantId, { explicitOnly: true });
  if (!providers.length) {
    throw new ServiceUnavailableException("O modelo " + agent.llm.model + " de Design Gráfico & Web está indisponível pela conexão ou política de custos. Confira a conexão e o modelo do agente.");
  }
  const persona = agentPersonaBlock({ ...root, assistant: { ...assistant, agents: [agent] } }, WEB_DESIGNER_AGENT_ID);
  return { agent, providers, persona };
}
