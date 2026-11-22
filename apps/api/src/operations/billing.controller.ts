import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { entitlementsFromPlanLimits } from "../auth/entitlements";

/**
 * Cobrança automática da assinatura da Véxora (self-service billing).
 *
 * Requer no ambiente (Dokploy) as variáveis:
 *   PLATFORM_ASAAS_API_KEY    — chave de API da CONTA ASAAS DA VÉXORA (não a do cliente)
 *   PLATFORM_ASAAS_BASE_URL   — opcional, padrão https://api.asaas.com/v3
 *   PLATFORM_ASAAS_WEBHOOK_TOKEN — segredo exigido no header asaas-access-token do webhook
 *
 * Sem essas variáveis o recurso responde honestamente "indisponível" e a empresa usa o canal
 * comercial — nada é cobrado por engano.
 */
const object = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

@Controller("billing")
@UseGuards(AuthGuard)
export class BillingController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private config() {
    const apiKey = (process.env.PLATFORM_ASAAS_API_KEY || "").trim();
    const baseUrl = (process.env.PLATFORM_ASAAS_BASE_URL || "https://api.asaas.com/v3").replace(/\/+$/, "");
    return { apiKey, baseUrl, configured: Boolean(apiKey) };
  }

  private async asaas<T>(path: string, init?: RequestInit): Promise<T> {
    const { apiKey, baseUrl } = this.config();
    const response = await fetch(baseUrl + path, {
      ...(init || {}),
      headers: { "content-type": "application/json", access_token: apiKey, ...((init?.headers as Record<string, string>) || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errors = Array.isArray((data as any)?.errors) ? (data as any).errors : [];
      const detail = errors.map((item: any) => item?.description).filter((item: unknown) => typeof item === "string").join("; ") || response.statusText;
      throw new ServiceUnavailableException(`O Asaas recusou a operação: ${String(detail).slice(0, 300)}`);
    }
    return data as T;
  }

  @Post("activate")
  async activate(@Req() req: AuthenticatedRequest, @Body() input: any) {
    if (req.user.role !== "OWNER" && req.user.isPlatformAdmin !== true) {
      throw new ForbiddenException("Somente o proprietário da empresa pode ativar ou trocar o plano.");
    }
    const { configured } = this.config();
    if (!configured) {
      throw new HttpException("A cobrança automática ainda não está configurada para esta instalação. Fale com o comercial para ativar o plano.", 424);
    }
    const code = typeof input?.planCode === "string" ? input.planCode.trim().toLowerCase() : "";
    if (!/^[a-z0-9_-]{2,40}$/.test(code)) throw new BadRequestException("Plano inválido.");
    // O plano personalizado é contratado com a Véxora: nunca gera cobrança automática.
    if (code === "personalizado") throw new BadRequestException("O plano personalizado é contratado com a Véxora. Fale com o comercial.");
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: req.user.tenantId },
      select: { id: true, name: true, kind: true, integrations: true, planId: true },
    });
    if (tenant.kind === "PLATFORM") throw new BadRequestException("A administração da plataforma não assina planos.");
    const plan = await this.prisma.plan.findFirst({ where: { code, isActive: true, isPublic: true } });
    if (!plan) throw new NotFoundException("Plano não encontrado no catálogo.");
    if (tenant.planId === plan.id) throw new BadRequestException("Sua empresa já está neste plano.");

    const root = object(tenant.integrations);
    const org = object(root.organization);
    const doc = String(org.cnpj || "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) {
      throw new BadRequestException("Complete os Dados da empresa com o CNPJ ou CPF do responsável antes de ativar a cobrança automática.");
    }
    const razaoSocial = (typeof org.legalName === "string" && org.legalName.trim()) || tenant.name;

    const byReference = await this.asaas<{ data?: Array<{ id: string }> }>("/customers?" + new URLSearchParams({ externalReference: "vexora:tenant:" + tenant.id }));
    let customerId = byReference?.data?.[0]?.id;
    if (!customerId) {
      const byDoc = await this.asaas<{ data?: Array<{ id: string }> }>("/customers?" + new URLSearchParams({ cpfCnpj: doc }));
      customerId = byDoc?.data?.[0]?.id;
    }
    if (!customerId) {
      const created = await this.asaas<{ id?: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({ name: String(razaoSocial).slice(0, 120), cpfCnpj: doc, externalReference: "vexora:tenant:" + tenant.id }),
      });
      if (!created?.id) throw new ServiceUnavailableException("O Asaas não confirmou o cadastro do cliente.");
      customerId = created.id;
    }

    const value = Number((plan.priceCents / 100).toFixed(2));
    const nextDueDate = new Date().toISOString().slice(0, 10);
    const subscription = await this.asaas<{ id?: string; nextDueDate?: string; status?: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        value,
        cycle: "MONTHLY",
        nextDueDate,
        billingType: "BOLETO",
        description: "Véxora Suite — " + plan.name,
        externalReference: "vexora:plan:" + plan.code + ":" + tenant.id,
      }),
    });
    if (!subscription?.id) throw new ServiceUnavailableException("O Asaas não retornou a assinatura.");

    let paymentUrl: string | null = null;
    try {
      const payments = await this.asaas<{ data?: Array<{ id: string; invoiceUrl?: string | null }> }>(
        "/payments?" + new URLSearchParams({ subscription: subscription.id, limit: "5" }),
      );
      paymentUrl = payments?.data?.[0]?.invoiceUrl ?? null;
    } catch {
      paymentUrl = null;
    }

    await this.prisma.auditLog.create({
      data: { tenantId: tenant.id, userId: req.user.sub, action: "plan.checkout_started", entityType: "plan", entityId: plan.id, details: { code: plan.code, subscriptionId: subscription.id, value, billingType: "BOLETO" } },
    });
    this.events.publish(tenant.id, "billing.checkout_started", { planId: plan.id, code: plan.code, subscriptionId: subscription.id });
    return { subscriptionId: subscription.id, customerId, value, plan: { code: plan.code, name: plan.name }, paymentUrl, pendingPayment: true };
  }
}
