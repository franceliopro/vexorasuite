import { providerApiKey, CredentialProvider, credentialProviders } from "./provider-credentials";

export type ConnectionProbe = { provider: string; status: "connected" | "rejected" | "offline" | "not_configured"; httpStatus?: number; message: string; checkedAt: string };

type CheckSpec = { url: string; headers: (key: string) => Record<string, string> };

/** Endpoints públicos de verificação — barato, sem efetuar chamadas cobradas. */
const CHECKS: Record<CredentialProvider, CheckSpec> = {
  openrouter: { url: "https://openrouter.ai/api/v1/auth/key", headers: (key) => ({ authorization: "Bearer " + key }) },
  openai: { url: "https://api.openai.com/v1/models", headers: (key) => ({ authorization: "Bearer " + key }) },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/models", headers: (key) => ({ "x-goog-api-key": key }) },
  anthropic: { url: "https://api.anthropic.com/v1/models", headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }) },
  deepseek: { url: "https://api.deepseek.com/models", headers: (key) => ({ authorization: "Bearer " + key }) },
  qwen: { url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models", headers: (key) => ({ authorization: "Bearer " + key }) },
  brave: { url: "https://api.search.brave.com/res/v1/web/search?q=test&count=1", headers: (key) => ({ "X-Subscription-Token": key, accept: "application/json" }) },
  groq: { url: "https://api.groq.com/openai/v1/models", headers: (key) => ({ authorization: "Bearer " + key }) },
  "vercel-gateway": { url: "https://ai-gateway.vercel.sh/v1/credits", headers: (key) => ({ authorization: "Bearer " + key }) },
  nvidia: { url: "https://integrate.api.nvidia.com/v1/models", headers: (key) => ({ authorization: "Bearer " + key }) },
};

/**
 * Verifica (ao vivo, com timeout curto e sem cobrança) se a chave de cada provedor
 * está funcionando. Nunca vaza o valor da chave e nunca modifica dados.
 */
export async function probeConnections(integrations: unknown, tenantId: string): Promise<ConnectionProbe[]> {
  const checkedAt = new Date().toISOString();
  return Promise.all(credentialProviders.map(async (provider): Promise<ConnectionProbe> => {
    let key: string | undefined;
    try { key = providerApiKey(provider, integrations, tenantId); } catch { key = undefined; }
    if (!key) return { provider, status: "not_configured", message: "Sem chave cadastrada", checkedAt };
    const spec = CHECKS[provider];
    try {
      const response = await fetch(spec.url, { headers: { ...spec.headers(key), accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8000) });
      if (response.ok) return { provider, status: "connected", httpStatus: response.status, message: "Conexão ativa", checkedAt };
      if (response.status === 401 || response.status === 403) return { provider, status: "rejected", httpStatus: response.status, message: "Chave rejeitada ou expirada", checkedAt };
      return { provider, status: "offline", httpStatus: response.status, message: "Provedor respondeu com erro " + response.status, checkedAt };
    } catch {
      return { provider, status: "offline", message: "Não foi possível conectar agora", checkedAt };
    }
  }));
}
