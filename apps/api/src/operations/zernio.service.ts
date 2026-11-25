import {assertSocialRequest} from '../auth/product-scope';
import { BadGatewayException, Injectable, Optional, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { zernioApiKeyFor } from "./zernio-credentials";
import { isAllowedMediaUrl, readMediaResponse } from "./inbound-media";

const BASE_URL = "https://zernio.com/api/v1";

@Injectable()
export class ZernioService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private async resolveApiKey(tenantId?: string): Promise<string | undefined> {
    if (tenantId && this.prisma) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } }).catch(() => null);
      if (tenant) return zernioApiKeyFor(tenant.integrations, tenantId);
    }
    return process.env.ZERNIO_API_KEY?.trim() || undefined;
  }

  async assertConfigured(tenantId?: string): Promise<void> {
    if (!(await this.resolveApiKey(tenantId))) {
      throw new ServiceUnavailableException("Esta empresa ainda não tem a conexão Zernio. Cadastre a própria conta em Canais e integrações (2 conexões grátis por conta) ou peça à Véxora para habilitar a conta compartilhada.");
    }
  }

  verifyWebhook(rawBody: Buffer | undefined, signature: string | undefined, secret: string): boolean {
    if (!rawBody || !signature || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async request<T = unknown>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; idempotencyKey?: string; allowPartialFailure?: boolean } = {}, tenantId?: string): Promise<T> {
    assertSocialRequest(path,options.method??'GET');
    const apiKey = await this.resolveApiKey(tenantId);
    if (!apiKey) {
      throw new ServiceUnavailableException("Esta empresa ainda não tem a conexão Zernio. Cadastre a própria conta em Canais e integrações (2 conexões grátis por conta) ou peça à Véxora para habilitar a conta compartilhada.");
    }
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || path.includes("#")) {
      throw new ServiceUnavailableException("Caminho de integração inválido.");
    }
    const multipart = options.body instanceof FormData;
    let response: Response;
    try {
      response = await fetch(BASE_URL + path, {
        method: options.method ?? "GET",
        headers: {
          authorization: "Bearer " + apiKey,
          ...(options.body !== undefined && !multipart ? { "content-type": "application/json" } : {}),
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
        },
        ...(options.body !== undefined ? { body: options.body instanceof FormData ? options.body : JSON.stringify(options.body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new BadGatewayException("Não foi possível alcançar o serviço Zernio.");
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload && typeof payload === "object" && "success" in payload && payload.success === false) || (!options.allowPartialFailure && payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object" && "partialFailure" in payload.data && payload.data.partialFailure)) {
      const provider = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      const providerError = provider.error && typeof provider.error === "object" ? provider.error as Record<string, unknown> : {};
      const providerMessage = [provider.message, provider.error, providerError.message].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      const providerCode = [provider.code, providerError.code].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      const providerReason = [provider.reason, providerError.reason].find((value): value is string => typeof value === "string" && value.trim().length > 0);
      const dashboardUrl = [provider.dashboard_url, provider.dashboardUrl, providerError.dashboard_url, providerError.dashboardUrl].find((value): value is string => typeof value === "string" && value.startsWith("https://"));
      throw new BadGatewayException({
        message: providerMessage || "A Zernio não confirmou a operação. Confira a conta, as permissões e os requisitos da rede social.",
        providerStatus: response.status,
        providerCode,
        providerReason,
        dashboardUrl,
      });
    }
    return payload as T;
  }

  /** Busca mídia de redes sociais apenas em URL https allowlisted, usando a chave
   * cifrada da empresa no servidor. Nunca busca host livre recebido no webhook. */
  async downloadMedia(tenantId: string, url: string): Promise<{ buffer: Buffer; mimetype: string }> {
    if (!isAllowedMediaUrl(url)) throw new BadGatewayException("A Zernio não forneceu uma URL de mídia segura.");
    const apiKey = await this.resolveApiKey(tenantId);
    const response = await fetch(url, {
      ...(apiKey ? { headers: { authorization: "Bearer " + apiKey } } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    return readMediaResponse(response);
  }
}
