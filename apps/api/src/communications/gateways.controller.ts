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
import { isUUID } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { mailAdmin } from "./mail.service";
import { whatsappPhone } from "../operations/whatsapp-bridge";
/** Hosts and tenant routing are provisioned by the operator, never taken from an outbound request. */
function tenantRoute(kind: "SMS", tenantId: string) {
  try {
    const routes = JSON.parse(
      process.env[
        "JASMIN_TENANT_ROUTES"
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
}
