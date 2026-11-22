import { isLegacyPhpVersion, isPhpVersion } from "./php-versions.js";
import {
  ProvisionerError,
  type ProvisionAction,
  type ProvisionPlan,
  type ProvisionRequest,
} from "./types.js";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/;

export function databaseNameFor(slug: string): string {
  return `site_${slug.replaceAll("-", "_")}`;
}

export function folderFor(slug: string): string {
  return `/sites/${slug}`;
}

export function healthUrlFor(domain: string): string {
  return `https://${domain}/health`;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProvisionerError(
      `${field} é obrigatório`,
      "invalid_request",
      400,
    );
  }
  return value.trim();
}

export function validateRequest(input: unknown): ProvisionRequest {
  if (typeof input !== "object" || input === null) {
    throw new ProvisionerError(
      "Corpo da requisição inválido",
      "invalid_request",
      400,
    );
  }

  const raw = input as Record<string, unknown>;
  const requestId = requireText(raw.requestId, "requestId");
  const tenantId = requireText(raw.tenantId, "tenantId");
  const slug = requireText(raw.slug, "slug");
  const domain = requireText(raw.domain, "domain").toLowerCase();

  if (!SLUG_PATTERN.test(slug)) {
    throw new ProvisionerError(
      "slug deve conter apenas letras minúsculas, números e hífens",
      "invalid_request",
      400,
    );
  }
  if (!DOMAIN_PATTERN.test(domain)) {
    throw new ProvisionerError(
      "domain não é um domínio válido",
      "invalid_request",
      400,
    );
  }
  if (raw.type !== "php-mysql" && raw.type !== "nextjs") {
    throw new ProvisionerError(
      "type deve ser php-mysql ou nextjs",
      "invalid_request",
      400,
    );
  }
  if (raw.type === "php-mysql" && !isPhpVersion(raw.phpVersion)) {
    throw new ProvisionerError(
      "phpVersion deve estar na lista de versões suportadas",
      "invalid_request",
      400,
    );
  }
  if (
    raw.quotaGb !== undefined &&
    (typeof raw.quotaGb !== "number" || raw.quotaGb <= 0)
  ) {
    throw new ProvisionerError(
      "quotaGb deve ser um número positivo",
      "invalid_request",
      400,
    );
  }

  const request: ProvisionRequest = {
    requestId,
    tenantId,
    slug,
    domain,
    type: raw.type,
  };
  if (raw.type === "php-mysql" && isPhpVersion(raw.phpVersion)) {
    request.phpVersion = raw.phpVersion;
  }
  if (typeof raw.quotaGb === "number") {
    request.quotaGb = raw.quotaGb;
  }
  if (typeof raw.source === "string" && raw.source.trim().length > 0) {
    request.source = raw.source.trim();
  }
  return request;
}

export function fingerprintOf(request: ProvisionRequest): string {
  const ordered = JSON.stringify({
    domain: request.domain,
    phpVersion: request.phpVersion ?? null,
    quotaGb: request.quotaGb ?? null,
    requestId: request.requestId,
    slug: request.slug,
    source: request.source ?? null,
    tenantId: request.tenantId,
    type: request.type,
  });
  return ordered;
}

export function createPlan(request: ProvisionRequest): ProvisionPlan {
  const database = databaseNameFor(request.slug);
  const actions: ProvisionAction[] = [
    {
      kind: "folder",
      target: folderFor(request.slug),
      detail: "Pasta exclusiva do site",
    },
    {
      kind: "vhost",
      target: request.domain,
      detail: `Virtual host no Traefik para ${request.type}`,
    },
    {
      kind: "tls",
      target: request.domain,
      detail: "Certificado TLS a ser emitido no domínio final",
    },
    {
      kind: "healthcheck",
      target: healthUrlFor(request.domain),
      detail: "Health-check real antes de marcar publicado",
    },
  ];

  if (request.type === "php-mysql") {
    actions.unshift(
      { kind: "database", target: database, detail: "Banco exclusivo do site" },
      {
        kind: "user",
        target: database,
        detail: "Usuário de banco exclusivo; senha em Docker secret",
      },
    );
  }

  const warnings = [
    "SIMULAÇÃO: nenhum recurso real é criado neste esqueleto.",
    "A publicação só pode ser marcada após health-check real no domínio final.",
  ];
  if (request.phpVersion && isLegacyPhpVersion(request.phpVersion)) {
    warnings.push(
      `PHP ${request.phpVersion} está fora de suporte; confirmação explícita é obrigatória antes do apply.`,
    );
  }

  return {
    requestId: request.requestId,
    slug: request.slug,
    actions,
    warnings,
  };
}
