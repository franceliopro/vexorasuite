import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { TelephonyConfig } from "./config.js";
import type { WebhookHandler } from "./handler.js";
import { TelephonyInputError } from "./webhook.js";

const MAX_BODY_BYTES = 64 * 1024;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

async function readRaw(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new TelephonyInputError("Corpo da requisição muito grande", 413);
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    throw new TelephonyInputError("Corpo da requisição vazio");
  }
  return Buffer.concat(chunks);
}

export function createTelephonyServer(deps: {
  config: TelephonyConfig;
  handler: WebhookHandler;
}): Server {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          status: "ok",
          mode: deps.config.mode,
          tenantCount: deps.config.tenants.size,
        });
        return;
      }
      const prefix = "/webhooks/";
      if (request.method === "POST" && url.pathname.startsWith(prefix)) {
        const tenantId = decodeURIComponent(url.pathname.slice(prefix.length));
        if (!tenantId || tenantId.includes("/")) {
          sendJson(response, 404, { error: "Rota não encontrada", code: "not_found" });
          return;
        }
        const result = await deps.handler(tenantId, await readRaw(request), request.headers);
        sendJson(response, result.status, result.body);
        return;
      }
      sendJson(response, 404, { error: "Rota não encontrada", code: "not_found" });
    } catch (error) {
      if (error instanceof TelephonyInputError) {
        sendJson(response, error.httpStatus, { error: error.message, code: "invalid_request" });
        return;
      }
      sendJson(response, 500, { error: "Erro interno", code: "internal_error" });
    }
  });
}
