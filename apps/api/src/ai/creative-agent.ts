import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { economicalProviders } from "./economical-providers";
import { agentPersonaBlock } from "./product-skills";
import { webDesignerAgent, WEB_DESIGNER_AGENT_ID } from "./web-designer-agent";
import { providerApiKey } from "./provider-credentials";
import { localLlmOrigin } from "./llm-providers";

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
    const policy = root?.aiCostPolicy;
    const pProvider = String(agent.llm?.provider ?? "?");
    const pModel = String(agent.llm?.model ?? "?");
    const isLocal = !!localLlmOrigin(pProvider);
    let hasKey = isLocal ? Boolean(process.env[localLlmOrigin(pProvider)!]) : false;
    if (!isLocal) {
      try { hasKey = Boolean(providerApiKey(pProvider, root, tenantId)); } catch { hasKey = false; }
    }
    if (!hasKey) {
      throw new ServiceUnavailableException(`Nenhuma chave conectada para o provedor ${pProvider} (${pModel}). Cadastre a chave em Agentes de IA → Conexões de IA (ou defina ${isLocal ? "o endereço do serviço local" : "a variável no servidor"}) e tente novamente.`);
    }
    if (policy?.freeFirst && !(policy?.allowPaidFallback === true)) {
      throw new ServiceUnavailableException(`O agente Design Gráfico & Web usa "${pModel}" do provedor ${pProvider}, que é pago — e a empresa está configurada com "Priorizar modelos locais e gratuitos". Ative "Permitir modelos pagos configurados como contingência" em Agentes de IA → Conexões de IA, ou troque para Gemini (gratuito) / modelo local.`);
    }
    throw new ServiceUnavailableException(`O modelo ${pModel} do provedor ${pProvider} não respondeu nesta empresa. Verifique a conexão e o modelo do Design Gráfico & Web em Agentes de IA.`);
  }
  const persona = agentPersonaBlock({ ...root, assistant: { ...assistant, agents: [agent] } }, WEB_DESIGNER_AGENT_ID);
  return { agent, providers, persona };
}
