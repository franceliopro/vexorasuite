import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  Post,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { entitlementsFromPlanLimits, preservePlansAccess } from "../auth/entitlements";

/**
 * Webhook da cobrança de planos (Asaas da própria Véxora).
 * Sem AuthGuard — a autenticidade é pelo header asaas-access-token
 * (configure o mesmo valor em PLATFORM_ASAAS_WEBHOOK_TOKEN e no painel do Asaas).
 * No evento PAYMENT_CONFIRMED/PAYMENT_RECEIVED do pagamento vinculado a um
 * `externalReference` no formato "vexora:plan:<plano>:<tenantId>", o plano é ativado
 * automaticamente (o mesmo efeito do assignPlan de administração).
 */
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

@Controller("billing/webhooks")
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  @Post("asaas")
  @HttpCode(200)
  async receive(@Headers("asaas-access-token") token?: string, @Body() body?: unknown) {
    const expected = (process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN || "").trim();
    if (!expected || !token || token !== expected) {
      throw new ForbiddenException("Token do webhook de cobrança inválido.");
    }
    const root = object(body);
    const event = typeof root.event === "string" ? root.event : "";
    const payment = object(root.payment);
    const externalReference = typeof payment.externalReference === "string" ? payment.externalReference.trim() : "";
    const match = /^vexora:plan:([a-z0-9_-]{2,40}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(externalReference);
    if (!match) return { ok: true, ignored: true };
    if (event !== "PAYMENT_CONFIRMED" && event !== "PAYMENT_RECEIVED") {
      this.logger.log(`Webhook de cobrança: evento ${event} ignorado para ${externalReference}.`);
      return { ok: true, ignored: true, event };
    }
    const code = match[1]!.toLowerCase();
    const tenantId = match[2]!.toLowerCase();
    // O plano personalizado é contratado com a Véxora: nunca é ativado por cobrança automática.
    if (code === "personalizado") {
      this.logger.warn(`Webhook de cobrança: ativação automática do plano personalizado ignorada para o tenant ${tenantId}.`);
      return { ok: true, ignored: true, plan: "contract-only" };
    }
    const plan = await this.prisma.plan.findFirst({ where: { code } });
    if (!plan) {
      this.logger.warn(`Webhook de cobrança: plano "${code}" não encontrado.`);
      return { ok: true, ignored: true, plan: "not-found" };
    }
    const previous = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { entitlements: true } });
    const entitlements = preservePlansAccess(previous?.entitlements, entitlementsFromPlanLimits(plan.limits as any)) as any;
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { planId: plan.id, entitlements } });
    await this.prisma.auditLog.create({
      data: { tenantId, userId: null, action: "plan.activated", entityType: "plan", entityId: plan.id, details: { code: plan.code, event, paymentId: payment.id ?? null, source: "asaas_webhook" } },
    });
    this.events.publish(tenantId, "plan.updated", { planId: plan.id, code: plan.code });
    this.logger.log(`Plano ${plan.code} ativado para o tenant ${tenantId} via webhook.`);
    return { ok: true, activated: true, planCode: plan.code };
  }
}
