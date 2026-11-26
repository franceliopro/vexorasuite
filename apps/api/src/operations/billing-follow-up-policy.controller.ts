import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { mutateTenantSetting } from "../prisma/tenant-settings";
import { BillingFollowUpPolicy, normalizeBillingFollowUpPolicy } from "./billing-follow-up-policy";

/** Configuração persistida da régua de cobrança. Não dispara mensagens por si só. */
@Controller("finance/follow-up-policy")
@UseGuards(AuthGuard)
export class BillingFollowUpPolicyController {
  constructor(private readonly prisma: PrismaService) {}

  private assertRole(req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) {
      throw new ForbiddenException("Acesso financeiro restrito à administração.");
    }
  }

  private async read(req: AuthenticatedRequest): Promise<BillingFollowUpPolicy> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: req.user.tenantId },
      select: { integrations: true },
    });
    const root = tenant.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
      ? tenant.integrations as Record<string, unknown>
      : {};
    return normalizeBillingFollowUpPolicy(root.billingFollowUp);
  }

  @Get()
  async get(@Req() req: AuthenticatedRequest) {
    this.assertRole(req);
    return this.read(req);
  }

  @Put()
  async put(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.assertRole(req);
    let policy: BillingFollowUpPolicy;
    try {
      policy = normalizeBillingFollowUpPolicy(body);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Política de follow-up inválida.");
    }
    await mutateTenantSetting(this.prisma, req.user.tenantId, "billingFollowUp", () => policy as unknown as Prisma.InputJsonValue);
    return policy;
  }
}
