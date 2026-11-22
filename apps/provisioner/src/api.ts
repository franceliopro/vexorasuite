import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { JobStore } from "./store.js";
import { ProvisionerError } from "./types.js";

const MAX_BODY_BYTES = 64 * 1024;

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

async function readJson(request: IncomingMessage): Promise<unknown> {
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ProvisionerError("JSON inválido", "invalid_request", 400);
  }
}

function pathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function createProvisionerServer(
  store: JobStore = new JobStore(),
): Server {
  return createServer((request, response) => {
    void handle(request, response, store).catch((error: unknown) =>
      sendError(response, error),
    );
  });
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  store: JobStore,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const segments = pathSegments(url.pathname);
  const method = request.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, mode: "simulation" });
    return;
  }

  if (method === "POST" && url.pathname === "/provision/dry-run") {
    const { plan, created } = store.plan(await readJson(request));
    sendJson(response, created ? 201 : 200, { plan, created });
    return;
  }

  if (method === "POST" && url.pathname === "/provision/apply") {
    const body = await readJson(request);
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { requestId?: unknown }).requestId !== "string"
    ) {
      throw new ProvisionerError(
        "requestId é obrigatório",
        "invalid_request",
        400,
      );
    }
    const job = store.apply((body as { requestId: string }).requestId);
    sendJson(response, 200, {
      requestId: job.requestId,
      status: job.status,
      mode: "simulation",
      appliedAt: job.appliedAt ?? null,
    });
    return;
  }

  if (segments.length === 3 && segments[0] === "provision") {
    const requestId = segments[1] ?? "";
    const action = segments[2];

    if (method === "GET" && action === "status") {
      sendJson(response, 200, store.status(requestId));
      return;
    }
    if (method === "POST" && action === "rollback") {
      const job = store.rollback(requestId);
      sendJson(response, 200, {
        requestId: job.requestId,
        status: job.status,
        mode: "simulation",
        rolledBackAt: job.rolledBackAt ?? null,
      });
      return;
    }
  }

  sendJson(response, 404, { error: "Rota não encontrada", code: "not_found" });
}
