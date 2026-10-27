import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { credentialProviders, CredentialProvider, encryptProviderKey, providerConnectionStatus } from './provider-credentials';
import { aiRuntimeStatus } from './local-services';
import { mutateTenantSetting } from '../prisma/tenant-settings';
const object = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

@Controller('assistant/provider-connections')
@UseGuards(AuthGuard)
export class ProviderConnectionsController {
  constructor(private readonly prisma: PrismaService) {}
  private authorize(req: AuthenticatedRequest) {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem configurar as conexões de IA.');
  }
  @Get()
  async status(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    return { connections: providerConnectionStatus(tenant.integrations, req.user.tenantId),...aiRuntimeStatus(tenant.integrations) };
  }
  @Put()
  async save(@Req() req: AuthenticatedRequest, @Body() body: { provider?: string; key?: string }) {
    this.authorize(req);
    if (!body || !(credentialProviders as readonly unknown[]).includes(body.provider) || typeof body.key !== 'string' || !/^[\x21-\x7e]{12,512}$/.test(body.key.trim())) throw new BadRequestException('Selecione um provedor e informe uma chave válida, sem espaços ou quebras de linha.');
    const provider = body.provider as CredentialProvider;
    const encryptedKey = encryptProviderKey(req.user.tenantId, provider, body.key.trim());
    const root = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const current = object(tenant.integrations);
      const next = { ...current, aiProviderCredentials: { ...object(current.aiProviderCredentials), [provider]: { encryptedKey, updatedAt: new Date().toISOString() } } };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as Prisma.InputJsonObject } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'assistant.provider.configured', entityType: 'integration', details: { provider } } });
      return next;
    });
    return { connections: providerConnectionStatus(root, req.user.tenantId),...aiRuntimeStatus(root) };
  }
  @Put('policy')
  async policy(@Req() req:AuthenticatedRequest,@Body() body:{freeFirst?:boolean;allowPaidFallback?:boolean}){
    this.authorize(req);
    if(!body||typeof body.freeFirst!=='boolean'||typeof body.allowPaidFallback!=='boolean')throw new BadRequestException('Política de custo inválida.');
    const policy={freeFirst:body.freeFirst,allowPaidFallback:body.allowPaidFallback};
    await mutateTenantSetting(this.prisma,req.user.tenantId,'aiCostPolicy',()=>policy);
    return {costPolicy:policy};
  }
}
