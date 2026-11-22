import { healthUrlFor } from "./plan.js";
import type { HealthResult } from "./types.js";

export interface HealthCheckOptions {
  timeoutMs: number;
  retries: number;
  fetchImpl?: typeof fetch;
}

function pending(url: string, detail: string): HealthResult {
  return {
    url,
    verified: false,
    statusCode: null,
    checkedAt: new Date().toISOString(),
    detail,
  };
}

/**
 * Faz uma requisição real ao domínio final. Nunca assume sucesso por configuração.
 * O modo simulação não chama esta função.
 */
export async function checkHealth(
  url: string,
  options: HealthCheckOptions,
): Promise<HealthResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = options.retries + 1;
  let last = pending(url, "health-check não executado");

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const verified = response.status >= 200 && response.status < 300;
      last = {
        url,
        verified,
        statusCode: response.status,
        checkedAt: new Date().toISOString(),
        detail: verified
          ? `health-check confirmado (tentativa ${attempt})`
          : `resposta HTTP ${response.status} (tentativa ${attempt})`,
      };
      if (verified) return last;
    } catch {
      last = pending(url, `falha de rede ou timeout (tentativa ${attempt})`);
    }
  }
  return last;
}

export function healthUrlOfDomain(domain: string): string {
  return healthUrlFor(domain);
}
