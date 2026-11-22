import {
  isPhpVersion,
  isLegacyPhpVersion,
  PHP_VERSIONS,
} from "./php-versions.js";
import { ProvisionerError, type ProvisionerMode } from "./types.js";

/** Configuração toda vem do ambiente. Nenhum valor de segredo entra neste objeto — apenas caminhos de arquivo. */
export interface ProvisionerConfig {
  mode: ProvisionerMode;
  stateFile: string | null;
  sitesRoot: string | null;
  traefikConfigDir: string | null;
  traefikNetwork: string;
  tlsResolver: string | null;
  siteContainerTemplate: string;
  sitePort: number;
  phpImageTemplate: string | null;
  phpImageOverrides: Record<string, string>;
  dbAdminUrl: string | null;
  dbAdminSecretFile: string | null;
  filebrowserUrl: string | null;
  filebrowserSecretFile: string | null;
  webhookSecretFile: string | null;
  webhookToleranceSeconds: number;
  healthTimeoutMs: number;
  healthRetries: number;
  allowRealApply: boolean;
}

export interface PublicConfig {
  mode: ProvisionerMode;
  persistence: "file" | "memory";
  capabilities: {
    folder: boolean;
    vhost: boolean;
    database: boolean;
    filebrowser: boolean;
    webhook: boolean;
    healthCheck: boolean;
  };
  phpVersions: string[];
  legacyVersions: string[];
  allowRealApply: boolean;
}

function text(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function integer(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = text(env, key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ProvisionerError(
      `${key} deve ser um inteiro entre ${min} e ${max}`,
      "configuration",
      500,
    );
  }
  return parsed;
}

function enabled(env: NodeJS.ProcessEnv, key: string): boolean {
  const value = text(env, key)?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function httpUrl(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = text(env, key);
  if (raw === null) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocolo inválido");
    }
    return raw.replace(/\/$/, "");
  } catch {
    throw new ProvisionerError(
      `${key} deve ser uma URL http(s) válida`,
      "configuration",
      500,
    );
  }
}

function noLatest(label: string, value: string): void {
  if (/latest/i.test(value)) {
    throw new ProvisionerError(
      `${label} não pode usar a tag latest`,
      "configuration",
      500,
    );
  }
}

function phpImageOverrides(raw: string | null): Record<string, string> {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProvisionerError(
      "PROVISIONER_PHP_IMAGES deve ser um JSON de versão para imagem",
      "configuration",
      500,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ProvisionerError(
      "PROVISIONER_PHP_IMAGES deve ser um objeto",
      "configuration",
      500,
    );
  }
  const result: Record<string, string> = {};
  for (const [version, image] of Object.entries(parsed)) {
    if (!isPhpVersion(version) || typeof image !== "string" || !image.trim()) {
      throw new ProvisionerError(
        "PROVISIONER_PHP_IMAGES contém versão ou imagem inválida",
        "configuration",
        500,
      );
    }
    noLatest(`Imagem PHP ${version}`, image);
    result[version] = image.trim();
  }
  return result;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): ProvisionerConfig {
  const mode = text(env, "PROVISIONER_MODE") ?? "simulation";
  if (mode !== "simulation" && mode !== "real") {
    throw new ProvisionerError(
      "PROVISIONER_MODE deve ser simulation ou real",
      "configuration",
      500,
    );
  }

  const phpImageTemplate = text(env, "PROVISIONER_PHP_IMAGE_TEMPLATE");
  if (phpImageTemplate !== null) {
    if (!phpImageTemplate.includes("{version}")) {
      throw new ProvisionerError(
        "PROVISIONER_PHP_IMAGE_TEMPLATE deve conter {version}",
        "configuration",
        500,
      );
    }
    noLatest("PROVISIONER_PHP_IMAGE_TEMPLATE", phpImageTemplate);
  }

  const siteContainerTemplate =
    text(env, "PROVISIONER_SITE_CONTAINER_TEMPLATE") ?? "{slug}";
  if (!siteContainerTemplate.includes("{slug}")) {
    throw new ProvisionerError(
      "PROVISIONER_SITE_CONTAINER_TEMPLATE deve conter {slug}",
      "configuration",
      500,
    );
  }

  const config: ProvisionerConfig = {
    mode,
    stateFile: text(env, "PROVISIONER_STATE_FILE"),
    sitesRoot: text(env, "PROVISIONER_SITES_ROOT"),
    traefikConfigDir: text(env, "PROVISIONER_TRAEFIK_CONFIG_DIR"),
    traefikNetwork:
      text(env, "PROVISIONER_TRAEFIK_NETWORK") ?? "estudio-de-sites",
    tlsResolver: text(env, "PROVISIONER_TLS_RESOLVER"),
    siteContainerTemplate,
    sitePort: integer(env, "PROVISIONER_SITE_PORT", 80, 1, 65535),
    phpImageTemplate,
    phpImageOverrides: phpImageOverrides(text(env, "PROVISIONER_PHP_IMAGES")),
    dbAdminUrl: httpUrl(env, "PROVISIONER_DB_ADMIN_URL"),
    dbAdminSecretFile: text(env, "PROVISIONER_DB_ADMIN_SECRET_FILE"),
    filebrowserUrl: httpUrl(env, "PROVISIONER_FILEBROWSER_URL"),
    filebrowserSecretFile: text(env, "PROVISIONER_FILEBROWSER_SECRET_FILE"),
    webhookSecretFile: text(env, "PROVISIONER_WEBHOOK_SECRET_FILE"),
    webhookToleranceSeconds: integer(
      env,
      "PROVISIONER_WEBHOOK_TOLERANCE_SECONDS",
      300,
      30,
      3600,
    ),
    healthTimeoutMs: integer(
      env,
      "PROVISIONER_HEALTH_TIMEOUT_MS",
      5000,
      500,
      60000,
    ),
    healthRetries: integer(env, "PROVISIONER_HEALTH_RETRIES", 1, 0, 10),
    allowRealApply: enabled(env, "PROVISIONER_ALLOW_REAL_APPLY"),
  };

  if (mode === "real") {
    const missing: string[] = [];
    if (!config.stateFile) missing.push("PROVISIONER_STATE_FILE");
    if (!config.sitesRoot) missing.push("PROVISIONER_SITES_ROOT");
    if (!config.traefikConfigDir)
      missing.push("PROVISIONER_TRAEFIK_CONFIG_DIR");
    if (!config.tlsResolver) missing.push("PROVISIONER_TLS_RESOLVER");
    if (!config.webhookSecretFile)
      missing.push("PROVISIONER_WEBHOOK_SECRET_FILE");
    if (
      !config.phpImageTemplate &&
      Object.keys(config.phpImageOverrides).length === 0
    ) {
      missing.push("PROVISIONER_PHP_IMAGE_TEMPLATE");
    }
    if (!config.allowRealApply) missing.push("PROVISIONER_ALLOW_REAL_APPLY=1");
    if (missing.length > 0) {
      throw new ProvisionerError(
        `Configuração real incompleta: ${missing.join(", ")}`,
        "configuration",
        500,
      );
    }
    for (const version of PHP_VERSIONS) {
      noLatest(`Imagem PHP ${version}`, phpImageFor(config, version));
    }
  }

  return config;
}

export function phpImageFor(
  config: ProvisionerConfig,
  version: string,
): string {
  if (!isPhpVersion(version)) {
    throw new ProvisionerError("Versão PHP inválida", "invalid_request", 400);
  }
  const override = config.phpImageOverrides[version];
  if (override) return override;
  if (!config.phpImageTemplate) {
    throw new ProvisionerError(
      "Nenhuma imagem PHP configurada",
      "configuration",
      500,
    );
  }
  return config.phpImageTemplate.replaceAll("{version}", version);
}

export function publicConfig(config: ProvisionerConfig): PublicConfig {
  return {
    mode: config.mode,
    persistence: config.stateFile ? "file" : "memory",
    capabilities: {
      folder: config.sitesRoot !== null,
      vhost: config.traefikConfigDir !== null,
      database: config.dbAdminUrl !== null && config.dbAdminSecretFile !== null,
      filebrowser:
        config.filebrowserUrl !== null && config.filebrowserSecretFile !== null,
      webhook: config.webhookSecretFile !== null,
      healthCheck: true,
    },
    phpVersions: [...PHP_VERSIONS],
    legacyVersions: PHP_VERSIONS.filter(isLegacyPhpVersion),
    allowRealApply: config.allowRealApply,
  };
}
