export type TenantConfig = {
  tenantId: string;
  provider: string;
  webhookSecret: string;
};

export type TelephonyConfig = {
  port: number;
  host: string;
  mode: "simulation" | "real";
  allowReal: boolean;
  toleranceSeconds: number;
  databaseUrl: string;
  tenants: Map<string, TenantConfig>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER = /^[A-Z][A-Z0-9_-]{1,39}$/;

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}`);
  }
  return value;
}

function readTenants(raw: string | undefined): Map<string, TenantConfig> {
  if (!raw) throw new Error("TELEPHONY_TENANTS é obrigatório");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TELEPHONY_TENANTS não é JSON válido");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("TELEPHONY_TENANTS deve ser um objeto por tenantId");
  }
  const tenants = new Map<string, TenantConfig>();
  for (const [tenantId, entry] of Object.entries(parsed)) {
    if (!UUID.test(tenantId)) throw new Error("tenantId inválido em TELEPHONY_TENANTS");
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`Configuração inválida para o tenant ${tenantId}`);
    }
    const candidate = entry as Record<string, unknown>;
    const provider = typeof candidate.provider === "string" ? candidate.provider.trim().toUpperCase() : "";
    const secret = typeof candidate.webhookSecret === "string" ? candidate.webhookSecret : "";
    if (!PROVIDER.test(provider)) throw new Error(`provider inválido para o tenant ${tenantId}`);
    if (secret.length < 16) throw new Error(`webhookSecret muito curto para o tenant ${tenantId}`);
    tenants.set(tenantId, { tenantId, provider, webhookSecret: secret });
  }
  if (tenants.size === 0) throw new Error("TELEPHONY_TENANTS está vazio");
  return tenants;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TelephonyConfig {
  const rawMode = env.TELEPHONY_MODE ?? "simulation";
  if (rawMode !== "simulation" && rawMode !== "real") {
    throw new Error("TELEPHONY_MODE deve ser simulation ou real");
  }
  const allowReal = (env.TELEPHONY_ALLOW_REAL ?? "").toLowerCase() === "true";
  if (rawMode === "real" && !allowReal) {
    throw new Error("Modo real exige TELEPHONY_ALLOW_REAL=true e credenciais da operadora no cofre");
  }
  const databaseUrl = env.DATABASE_URL ?? "";
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("DATABASE_URL deve apontar para o Postgres exclusivo deste serviço");
  }
  return {
    port: integer(env, "TELEPHONY_PORT", 3002, 1, 65535),
    host: env.TELEPHONY_HOST ?? "127.0.0.1",
    mode: rawMode,
    allowReal,
    toleranceSeconds: integer(env, "TELEPHONY_WEBHOOK_TOLERANCE_SECONDS", 300, 30, 3600),
    databaseUrl,
    tenants: readTenants(env.TELEPHONY_TENANTS),
  };
}

/** Nunca inclui segredos, números ou dados de tenants. */
export function publicConfig(config: TelephonyConfig): Record<string, unknown> {
  return {
    mode: config.mode,
    tenantCount: config.tenants.size,
    webhookToleranceSeconds: config.toleranceSeconds,
  };
}
