import { AuditCovered } from "../common/audit/audit.decorator";
import { randomBytes } from "node:crypto";
import { BadRequestException, Body, Controller, Delete, Get, Put, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { encryptZernioCredential, zernioConnectionStatus } from "./zernio-credentials";

const object = (value: any): Record<string, any> => value && typeof value === "object" && !Array.isArray(value) ? value : {};

/**
 * BYO Zernio: a empresa cadastra a própria conta Zernio (2 conexões grátis por conta),
 * sem custo para a Véxora por cliente. Sem isso, as conexões usam a conta compartilhada
 * do servidor (ZERNIO_API_KEY), quando existir.
 */
@AuditCovered()
@Controller('channels/zernio')
@UseGuards(AuthGuard)
export class ZernioConnectionsController {
  constructor(private readonly prisma: PrismaService) {}
  private authorize(req: AuthenticatedRequest) {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem configurar a conta Zernio da empresa.');
  }

  @Get('setup')
  async status(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    const webhookUrl = process.env.API_PUBLIC_URL?.trim() ? process.env.API_PUBLIC_URL.trim().replace(/\/$/, "") + "/api/webhooks/zernio/team" : null;
    return { ...zernioConnectionStatus(tenant.integrations), webhookUrl };
  }

  @Put('setup')
  async save(@Req() req: AuthenticatedRequest, @Body() body: { apiKey?: string }) {
    this.authorize(req);
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (!/^[\x21-\x7e]{12,512}$/.test(apiKey)) throw new BadRequestException("Informe a chave da API do Zernio (sem espaços ou quebras de linha).");
    let check: Response;
    try {
      check = await fetch("https://zernio.com/api/v1/auth/verify", { headers: { authorization: "Bearer " + apiKey }, redirect: "error", signal: AbortSignal.timeout(10000) });
    } catch {
      throw new BadRequestException("Não foi possível alcançar a Zernio agora. Tente novamente.");
    }
    if (!check.ok) throw new BadRequestException("A Zernio recusou essa chave (HTTP " + check.status + "). Confira a chave no painel do seu Zernio.");
    const webhookSecret = randomBytes(24).toString("hex");
    const encApiKey = encryptZernioCredential(req.user.tenantId, "apiKey", apiKey);
    const encSecret = encryptZernioCredential(req.user.tenantId, "webhookSecret", webhookSecret);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const current = object(tenant.integrations);
      const next = {
        ...current,
        zernioCredentials: {
          apiKey: { encryptedKey: encApiKey, updatedAt: new Date().toISOString() },
          webhookSecret: { encryptedKey: encSecret, updatedAt: new Date().toISOString() },
        },
      };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as Prisma.InputJsonObject } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "zernio.connections.configured", entityType: "integration", details: { mode: "tenant" } } });
    });
    const webhookUrl = process.env.API_PUBLIC_URL?.trim() ? process.env.API_PUBLIC_URL.trim().replace(/\/$/, "") + "/api/webhooks/zernio/team" : null;
    return { ok: true, webhookSecret, webhookUrl, message: "Conta Zernio ativada. Cole o segredo do webhook no painel do seu Zernio (Webhooks) para receber os eventos de conexão." };
  }

  @Delete('setup')
  async remove(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const current = object(tenant.integrations);
      const { zernioCredentials: _drop, ...rest } = current;
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: rest as Prisma.InputJsonObject } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "zernio.connections.cleared", entityType: "integration", details: { mode: "server" } } });
    });
    return { ok: true };
  }
}
