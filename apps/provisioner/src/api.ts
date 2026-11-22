import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { fileURLToPath } from "node:url";
import {
  type ProvisionExecutor,
  RealExecutor,
  SimulationExecutor,
} from "./adapters.js";
import { loadConfig, publicConfig, type ProvisionerConfig } from "./config.js";
import { checkHealth, type HealthCheckOptions } from "./health.js";
import { isLegacyPhpVersion, PHP_VERSIONS } from "./php-versions.js";
import { healthUrlFor } from "./plan.js";
import { readSecret } from "./secrets.js";
import { JobStore } from "./store.js";
import { ProvisionerError, type ProvisionJob } from "./types.js";
import { verifyWebhook } from "./webhook.js";

const MAX_BODY_BYTES = 64 * 1024;
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

/** Rotas estáticas da GUI: apenas estes arquivos são servidos, nunca o diretório inteiro. */
const STATIC_FILES: Record<string, { file: string; contentType: string }> = {
  "/": { file: "index.html", contentType: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", contentType: "text/css; charset=utf-8" },
  "/app.js": {
    file: "app.js",
    contentType: "text/javascript; charset=utf-8",
  },
};

interface Context {
  config: ProvisionerConfig;
  store: JobStore;
  executor: ProvisionExecutor;
  healthCheck: (
    url: string,
    options: HealthCheckOptions,
  ) => ReturnType<typeof checkHealth>;
}

export interface ServerOptions {
  config?: ProvisionerConfig;
  store?: JobStore;
  executor?: ProvisionExecutor;
  healthCheck?: Context["healthCheck"];
}

function sendStatic(response: ServerResponse, pathname: string): boolean {
  const target = STATIC_FILES[pathname];
  if (!target) return false;
  try {
    const body = readFileSync(join(PUBLIC_DIR, target.file));
    response.writeHead(200, {
      "content-type": target.contentType,
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    sendJson(response, 404, {
      error: "Arquivo da GUI não encontrado",
      code: "not_found",
    });
  }
  return true;
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function sendError(response: ServerResponse, error: unknown): void {
  if (error instanceof ProvisionerError) {
    sendJson(response, error.httpStatus, {
      error: error.message,
      code: error.code,
    });
    return;
  }
  sendJson(response, 500, { error: "Erro interno", code: "internal_error" });
}

async function readRaw(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new ProvisionerError(
        "Corpo da requisição muito grande",
        "invalid_request",
        413,
      );
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    throw new ProvisionerError(
      "Corpo da requisição vazio",
      "invalid_request",
      400,
    );
  }
  return Buffer.concat(chunks);
}

async function readJson(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  const raw = await readRaw(request);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new ProvisionerError("JSON inválido", "invalid_request", 400);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ProvisionerError(
      "Corpo da requisição inválido",
      "invalid_request",
      400,
    );
  }
  return parsed as Record<string, unknown>;
}

function requireRequestId(body: Record<string, unknown>): string {
  const value = body.requestId;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProvisionerError(
      "requestId é obrigatório",
      "invalid_request",
      400,
    );
  }
  return value.trim();
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

async function runApply(
  context: Context,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const requestId = requireRequestId(body);
  const job = context.store.get(requestId);

  if (context.config.mode === "real") {
    if (!job.approval) {
      throw new ProvisionerError(
        "Aprovação humana registrada é obrigatória antes do apply",
        "invalid_state",
        409,
      );
    }
    if (
      job.request.phpVersion &&
      isLegacyPhpVersion(job.request.phpVersion) &&
      body.confirmLegacy !== true
    ) {
      throw new ProvisionerError(
        `PHP ${job.request.phpVersion} é fora de suporte; confirmação explícita obrigatória`,
        "invalid_request",
        409,
      );
    }

    const steps = await context.executor.execute(job, context.config);
    if (steps.some((step) => step.status === "failed")) {
      context.store.markFailed(requestId, "Falha em um ou mais recursos");
      throw new ProvisionerError(
        "Falha ao criar recursos; nenhuma publicação foi marcada",
        "upstream",
        502,
      );
    }

    const health = await context.healthCheck(healthUrlFor(job.request.domain), {
      timeoutMs: context.config.healthTimeoutMs,
      retries: context.config.healthRetries,
    });
    if (!health.verified) {
      context.store.markFailed(requestId, "Health-check não confirmado");
      throw new ProvisionerError(
        "Health-check real não confirmado; publicação não marcada",
        "health_check",
        502,
      );
    }

    const applied = context.store.apply(requestId, {
      requireApproval: true,
      requireHealth: true,
      evidence: {
        executedAt: new Date().toISOString(),
        steps,
        health,
      },
    });
    return {
      requestId,
      status: applied.status,
      mode: context.config.mode,
      appliedAt: applied.appliedAt ?? null,
      health,
    };
  }

  const applied: ProvisionJob = context.store.apply(requestId);
  return {
    requestId,
    status: applied.status,
    mode: "simulation",
    appliedAt: applied.appliedAt ?? null,
  };
}

async function runRollback(
  context: Context,
  requestId: string,
): Promise<Record<string, unknown>> {
  const job = context.store.get(requestId);
  if (context.config.mode === "real") {
    await context.executor.rollback(job, context.config);
  }
  const rolledBack = context.store.rollback(requestId);
  return {
    requestId,
    status: rolledBack.status,
    mode: context.config.mode,
    rolledBackAt: rolledBack.rolledBackAt ?? null,
  };
}

async function handleWebhook(
  context: Context,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!context.config.webhookSecretFile) {
    throw new ProvisionerError(
      "Webhook não configurado neste provisionador",
      "configuration",
      503,
    );
  }
  const raw = await readRaw(request);
  const verified = verifyWebhook(
    raw,
    request.headers as IncomingHttpHeaders,
    readSecret(context.config.webhookSecretFile),
    context.config.webhookToleranceSeconds,
  );
  const { event, payload, correlationId } = verified;

  if (event === "provision.dry-run") {
    const { plan, created } = context.store.plan(payload);
    sendJson(response, created ? 201 : 200, { plan, created, correlationId });
    return;
  }
  if (event === "provision.approve") {
    const requestId = requireRequestId(payload);
    if (typeof payload.approver !== "string" || !payload.approver.trim()) {
      throw new ProvisionerError(
        "approver é obrigatório",
        "invalid_request",
        400,
      );
    }
    const approval = context.store.approve(
      requestId,
      payload.approver,
      correlationId,
    );
    sendJson(response, 200, { requestId, approval, correlationId });
    return;
  }
  if (event === "provision.apply") {
    sendJson(response, 200, {
      ...(await runApply(context, payload)),
      correlationId,
    });
    return;
  }
  if (event === "provision.status") {
    sendJson(response, 200, {
      ...context.store.status(requireRequestId(payload)),
      correlationId,
    });
    return;
  }
  if (event === "provision.rollback") {
    sendJson(response, 200, {
      ...(await runRollback(context, requireRequestId(payload))),
      correlationId,
    });
    return;
  }
  throw new ProvisionerError(
    "Evento de webhook desconhecido",
    "invalid_request",
    400,
  );
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  context: Context,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const segments = pathSegments(url.pathname);
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      mode: context.config.mode,
      persistence: context.config.stateFile ? "file" : "memory",
    });
    return;
  }

  if (method === "GET" && url.pathname === "/meta") {
    sendJson(response, 200, {
      ...publicConfig(context.config),
      phpVersions: PHP_VERSIONS,
      legacyVersions: PHP_VERSIONS.filter(isLegacyPhpVersion),
    });
    return;
  }

  if (method === "GET" && sendStatic(response, url.pathname)) return;

  if (method === "POST" && url.pathname === "/webhooks/provision") {
    await handleWebhook(context, request, response);
    return;
  }

  if (method === "POST" && url.pathname === "/provision/dry-run") {
    const { plan, created } = context.store.plan(await readJson(request));
    sendJson(response, created ? 201 : 200, { plan, created });
    return;
  }

  if (method === "POST" && url.pathname === "/provision/apply") {
    sendJson(response, 200, await runApply(context, await readJson(request)));
    return;
  }

  if (segments.length === 3 && segments[0] === "provision") {
    const requestId = segments[1] ?? "";
    const action = segments[2];

    if (method === "GET" && action === "status") {
      sendJson(response, 200, context.store.status(requestId));
      return;
    }
    if (method === "POST" && action === "approve") {
      const body = await readJson(request);
      if (typeof body.approver !== "string" || !body.approver.trim()) {
        throw new ProvisionerError(
          "approver é obrigatório",
          "invalid_request",
          400,
        );
      }
      const approval = context.store.approve(
        requestId,
        body.approver,
        typeof body.correlationId === "string" ? body.correlationId : undefined,
      );
      sendJson(response, 200, {
        requestId,
        approval,
        mode: context.config.mode,
      });
      return;
    }
    if (method === "POST" && action === "rollback") {
      sendJson(response, 200, await runRollback(context, requestId));
      return;
    }
  }

  sendJson(response, 404, { error: "Rota não encontrada", code: "not_found" });
}

export function createProvisionerServer(options: ServerOptions = {}): Server {
  const config = options.config ?? loadConfig();
  const context: Context = {
    config,
    store:
      options.store ??
      new JobStore({ mode: config.mode, stateFile: config.stateFile }),
    executor:
      options.executor ??
      (config.mode === "real" ? new RealExecutor() : new SimulationExecutor()),
    healthCheck: options.healthCheck ?? checkHealth,
  };
  return createServer((request, response) => {
    void handle(request, response, context).catch((error: unknown) =>
      sendError(response, error),
    );
  });
}
