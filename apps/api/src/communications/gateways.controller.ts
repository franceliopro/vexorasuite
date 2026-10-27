import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { mailAdmin } from "./mail.service";
import { whatsappPhone } from "../operations/whatsapp-bridge";
/** Hosts and tenant routing are provisioned by the operator, never taken from an outbound request. */
function tenantRoute(kind: "SMS" | "VOICE", tenantId: string) {
  try {
    const routes = JSON.parse(
      process.env[
        kind === "SMS" ? "JASMIN_TENANT_ROUTES" : "ASTERISK_TENANT_ROUTES"
      ] || "{}",
    );
    return routes[tenantId] || null;
  } catch {
    return null;
  }
}
function gatewayUrl(name: string) {
  const raw = process.env[name];
  if (!raw)
    throw new ServiceUnavailableException(
      "Configure o gateway da sua empresa.",
    );
  const url = new URL(raw);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new ServiceUnavailableException("Configuração do gateway inválida.");
  return url.toString().replace(/\/$/, "");
}
@Controller("communications/gateways")
@UseGuards(AuthGuard)
export class GatewaysController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() status(@Req() req: AuthenticatedRequest) {
    mailAdmin(req);
    return {
      sms: {
        configured:
          !!process.env.JASMIN_BASE_URL &&
          !!tenantRoute("SMS", req.user.tenantId),
        provider: "Jasmin",
        description: "Gateway aberto; requer rota e créditos da operadora.",
      },
      voice: {
        configured:
          !!process.env.ASTERISK_ARI_URL &&
          !!tenantRoute("VOICE", req.user.tenantId),
        provider: "Asterisk",
        description:
          "A chamada toca primeiro no ramal autorizado e depois no telefone do contato.",
      },
      whatsappCalls: {
        configured: false,
        description:
          "Exigem WhatsApp Business Calling e integração própria. A conexão de mensagens WAHA não habilita chamadas ao vivo.",
      },
      aiCalls: {
        configured: false,
        description:
          "Exigem agente de voz, serviço de mídia e rota de telefonia. Não são ativadas automaticamente.",
      },
    };
  }
  private async reserve(req: AuthenticatedRequest, input: any, kind: string) {
    mailAdmin(req);
    if (!isUUID(input.requestKey) || !isUUID(input.contactId))
      throw new BadRequestException(
        "Selecione um contato e use uma nova solicitação.",
      );
    const contact = await this.prisma.contact.findFirst({
      where: { id: input.contactId, tenantId: req.user.tenantId },
    });
    if (!contact?.phone)
      throw new BadRequestException(
        "Cadastre o telefone internacional do contato.",
      );
    const phone = whatsappPhone(contact.phone);
    if ((contact.metadata as any)?.communications?.smsOptOut && kind === "SMS")
      throw new BadRequestException("O contato não deseja receber SMS.");
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
      const prior = await tx.auditLog.findFirst({
        where: {
          tenantId: req.user.tenantId,
          action: "communication.dispatch",
          details: { path: ["requestKey"], equals: input.requestKey },
        },
      });
      if (prior) return { prior: true, id: prior.id };
      const log = await tx.auditLog.create({
        data: {
          tenantId: req.user.tenantId,
          userId: req.user.sub,
          action: "communication.dispatch",
          entityType: "contact",
          entityId: contact.id,
          details: { requestKey: input.requestKey, kind, status: "SUBMITTING" },
        },
      });
      return { prior: false, id: log.id };
    });
    if (row.prior)
      throw new BadRequestException(
        "Esta solicitação já foi recebida. Confira o histórico antes de repetir.",
      );
    return { ...row, phone, contact };
  }
  @Post("sms") async sms(@Req() req: AuthenticatedRequest, @Body() input: any) {
    mailAdmin(req);
    const route = tenantRoute("SMS", req.user.tenantId);
    if (!route?.username || !route?.password)
      throw new ServiceUnavailableException(
        "Conecte uma rota Jasmin para esta empresa.",
      );
    const base = gatewayUrl("JASMIN_BASE_URL");
    if (
      typeof input.content !== "string" ||
      !input.content.trim() ||
      input.content.length > 480
    )
      throw new BadRequestException("Use uma mensagem de até 480 caracteres.");
    const reserved = await this.reserve(req, input, "SMS");
    try {
      const response = await fetch(base + "/send", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: route.username,
          password: route.password,
          to: reserved.phone,
          "hex-content": Buffer.from(input.content, "utf16le")
            .swap16()
            .toString("hex"),
          coding: "8",
          ...(route.from ? { from: String(route.from) } : {}),
        }),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.text();
      if (!response.ok || !/^Success\s*"[\w-]+"/.test(result)) throw Error();
      await this.prisma.auditLog.update({
        where: { id: reserved.id },
        data: {
          details: {
            requestKey: input.requestKey,
            kind: "SMS",
            status: "ACCEPTED",
          },
        },
      });
      return {
        accepted: true,
        message:
          "O gateway aceitou o SMS. Isso ainda não confirma a entrega no aparelho.",
      };
    } catch {
      await this.prisma.auditLog.update({
        where: { id: reserved.id },
        data: {
          details: {
            requestKey: input.requestKey,
            kind: "SMS",
            status: "REVIEW",
          },
        },
      });
      throw new BadGatewayException(
        "Não foi possível confirmar o envio. Confira o gateway antes de repetir.",
      );
    }
  }
  @Post("call") async call(
    @Req() req: AuthenticatedRequest,
    @Body() input: any,
  ) {
    mailAdmin(req);
    const route = tenantRoute("VOICE", req.user.tenantId);
    if (
      !route?.agentEndpoint ||
      !route?.context ||
      !process.env.ASTERISK_ARI_USERNAME ||
      !process.env.ASTERISK_ARI_PASSWORD
    )
      throw new ServiceUnavailableException(
        "Conecte o ramal e a rota de telefonia desta empresa.",
      );
    const base = gatewayUrl("ASTERISK_ARI_URL"),
      reserved = await this.reserve(req, input, "VOICE");
    try {
      const query = new URLSearchParams({
        endpoint: route.agentEndpoint,
        context: route.context,
        extension: reserved.phone,
        priority: "1",
        timeout: "30",
        channelId: randomUUID(),
      });
      const response = await fetch(base + "/channels?" + query, {
        method: "POST",
        headers: {
          authorization:
            "Basic " +
            Buffer.from(
              process.env.ASTERISK_ARI_USERNAME +
                ":" +
                process.env.ASTERISK_ARI_PASSWORD,
            ).toString("base64"),
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error();
      await this.prisma.auditLog.update({
        where: { id: reserved.id },
        data: {
          details: {
            requestKey: input.requestKey,
            kind: "VOICE",
            status: "ACCEPTED",
          },
        },
      });
      return {
        accepted: true,
        message: "Chamada solicitada. Atenda seu ramal para chamar o contato.",
      };
    } catch {
      await this.prisma.auditLog.update({
        where: { id: reserved.id },
        data: {
          details: {
            requestKey: input.requestKey,
            kind: "VOICE",
            status: "REVIEW",
          },
        },
      });
      throw new BadGatewayException(
        "Não foi possível confirmar a chamada. Confira seu ramal antes de repetir.",
      );
    }
  }
}
