import {assertSocialRequest} from '../auth/product-scope';
import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE_URL = "https://zernio.com/api/v1";

@Injectable()
export class ZernioService {
  assertConfigured(): void {
    if (!process.env.ZERNIO_API_KEY?.trim()) {
      throw new ServiceUnavailableException("A integração Zernio ainda não foi configurada no servidor.");
    }
  }

  verifyWebhook(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
    if (!rawBody || !signature || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async request<T = unknown>(path: string, options: { method?: "GET" | "POST" | "DELETE"; body?: unknown; idempotencyKey?: string; allowPartialFailure?: boolean } = {}): Promise<T> {
    assertSocialRequest(path,options.method??'GET');
    this.assertConfigured();
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || path.includes("?") || path.includes("#")) {
      throw new ServiceUnavailableException("Caminho de integração inválido.");
    }
    let response: Response;
    try {
      response = await fetch(BASE_URL + path, {
        method: options.method ?? "GET",
        headers: {
          authorization: "Bearer " + process.env.ZERNIO_API_KEY!.trim(),
          ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new BadGatewayException("Não foi possível alcançar o serviço Zernio.");
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload && typeof payload === "object" && "success" in payload && payload.success === false) || (!options.allowPartialFailure && payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object" && "partialFailure" in payload.data && payload.data.partialFailure)) {
      throw new BadGatewayException({
        message: "A Zernio não confirmou a operação. Confira a conta, as permissões e os requisitos da rede social.",
        providerStatus: response.status,
      });
    }
    return payload as T;
  }
}
