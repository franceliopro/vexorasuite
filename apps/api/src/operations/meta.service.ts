import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { metaAccessTokenFor } from "./meta-credentials";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
const digits = (value: string) => value.replace(/\D/g, "");
const trim = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export interface MetaPhoneInfo {
  verifiedName?: string;
  displayPhoneNumber?: string;
}

@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  private integrationsOf(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { integrations: true } })
      .then((tenant) => object(tenant.integrations));
  }

  async request<T>(tenantId: string, path: string, init?: RequestInit): Promise<T> {
    const integrations = await this.integrationsOf(tenantId);
    const token = metaAccessTokenFor(integrations, tenantId);
    if (!token) {
      throw new ServiceUnavailableException("Configure o WhatsApp Oficial em Conexões antes de enviar mensagens.");
    }
    const response = await fetch(GRAPH_BASE + path, {
      ...init,
      headers: {
        authorization: "Bearer " + token,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = trim(object(data)?.error?.message, 300) || `HTTP ${response.status}`;
      throw new BadRequestException(`A Meta recusou: ${detail}`);
    }
    return data as T;
  }

  /** Verdade de conectividade: consulta o número na Graph API com o token. */
  async verifyPhone(tenantId: string, phoneNumberId: string, token?: string): Promise<MetaPhoneInfo> {
    const provided = token?.trim();
    const integrations = await this.integrationsOf(tenantId);
    const effective = provided || metaAccessTokenFor(integrations, tenantId);
    if (!effective) throw new ServiceUnavailableException("Configure o token do WhatsApp Oficial em Conexões.");
    const response = await fetch(`${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}?fields=verified_name,display_phone_number`, {
      headers: { authorization: "Bearer " + effective },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = trim(object(data)?.error?.message, 300) || `HTTP ${response.status}`;
      throw new BadRequestException(`Verificamos o número na Meta e ela recusou: ${detail}`);
    }
    const root = object(data);
    return {
      verifiedName: typeof root.verified_name === "string" ? root.verified_name : undefined,
      displayPhoneNumber: typeof root.display_phone_number === "string" ? root.display_phone_number : undefined,
    };
  }

  async sendText(tenantId: string, phoneNumberId: string, to: string, textValue: string): Promise<string> {
    const body = trim(textValue, 4000);
    if (!body) throw new BadRequestException("Digite uma mensagem.");
    const recipient = digits(to);
    if (!recipient) throw new BadRequestException("Número do destinatário inválido.");
    const result = await this.request<any>(tenantId, `/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { preview_url: false, body },
      }),
    });
    const messages = Array.isArray(object(result)?.messages) ? (object(result).messages as any[]) : [];
    const firstId = messages[0]?.id;
    if (typeof firstId === "string" && firstId) return firstId;
    throw new BadGatewayException("A Meta confirmou a mensagem mas não retornou o identificador da mensagem.");
  }

  async markSeen(tenantId: string, phoneNumberId: string, wamid: string): Promise<void> {
    await this.request(tenantId, `/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: wamid }),
    });
  }
}
