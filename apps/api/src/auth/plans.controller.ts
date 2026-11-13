import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthenticatedRequest } from "./auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { FULL_ENTITLEMENTS, entitlementsFromPlanLimits, resolveEntitlements, entitlementsView } from "./entitlements";
const PRICE_MIN = 0, PRICE_MAX = 99999000;
const VALID_CYCLE = new Set(["MONTH","YEAR","ONCE"]);
const VALID_KIND = new Set(["PLAN","PACKAGE"]);
function parseLimits(input: any): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as Record<string, unknown>;
  try { const parsed = JSON.parse(String(input ?? "{}")); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed; } catch {}
  throw new BadRequestException("limits deve ser um objeto JSON válido (ex.: {\"attendants\":5,\"bots\":1,\"modules\":[\"INBOX\"]}).");
}
/** Catálogo de planos e pacotes — administração Véxora (PLATFORM) e leitura para clientes autenticados. */
@UseGuards(AuthGuard)
@Controller("plans")
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}
  private admin(request: AuthenticatedRequest) {
    // Somente administradores da plataforma (isPlatformAdmin) gerenciam o catálogo — papel OWNER de
    // uma empresa cliente nunca é administrador da Véxora.
    if (request.user.isPlatformAdmin !== true) throw new ForbiddenException("Apenas a administração da Véxora gerencia planos.");
  }
  @Get() async list(@Req() req: AuthenticatedRequest) {
    // PLATFORM + isPlatformAdmin veem tudo; clientes veem só o catálogo ativo.
    const platform = req.user.isPlatformAdmin === true;
    const rows = await this.prisma.plan.findMany({ where: platform ? {} : { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const shaped = rows.map(row => ({ ...row, limits: typeof row.limits === "string" ? safeParse(row.limits) : row.limits }));
    return platform ? { plans: shaped, full: FULL_ENTITLEMENTS, currentTenantPlan: null } : { plans: shaped.filter(p => p.isPublic) };
  }
  @Post() async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.admin(req);
    const code = String(body?.code || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,40}$/.test(code)) throw new BadRequestException("Código deve ter 2-40 caracteres [a-z0-9_-].");
    const name = String(body?.name || "").trim();
    if (name.length < 2 || name.length > 80) throw new BadRequestException("Informe um nome válido (2-80 caracteres).");
    const kind = VALID_KIND.has(String(body?.kind)) ? String(body.kind) : "PLAN";
    const cycle = VALID_CYCLE.has(String(body?.cycle)) ? String(body.cycle) : "MONTH";
    const price = Number(body?.priceCents);
    if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) throw new BadRequestException("Preço inválido.");
    const limits = parseLimits(body?.limits);
    const created = await this.prisma.plan.create({ data: { code, kind, name, tagline: String(body?.tagline || "").slice(0, 160), description: String(body?.description || "").slice(0, 2000), audience: String(body?.audience || "").slice(0, 160), priceCents: Math.round(price), cycle, limits: limits as any, isActive: body?.isActive !== false, isPublic: body?.isPublic !== false, sortOrder: Number(body?.sortOrder) || 0 } });
    return created;
  }
  @Patch(":id") async update(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: any) {
    this.admin(req);
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Plano não encontrado.");
    const data: Record<string, unknown> = {};
    if (body?.name !== undefined) { const name = String(body.name).trim(); if (name.length < 2 || name.length > 80) throw new BadRequestException("Nome inválido."); data.name = name; }
    if (body?.code !== undefined) { const code = String(body.code).trim().toLowerCase(); if (!/^[a-z0-9_-]{2,40}$/.test(code)) throw new BadRequestException("Código inválido."); data.code = code; }
    if (body?.tagline !== undefined) data.tagline = String(body.tagline).slice(0, 160);
    if (body?.description !== undefined) data.description = String(body.description).slice(0, 2000);
    if (body?.audience !== undefined) data.audience = String(body.audience).slice(0, 160);
    if (body?.priceCents !== undefined) { const price = Number(body.priceCents); if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) throw new BadRequestException("Preço inválido."); data.priceCents = Math.round(price); }
    if (body?.cycle !== undefined) { if (!VALID_CYCLE.has(String(body.cycle))) throw new BadRequestException("Ciclo inválido (MONTH, YEAR ou ONCE)."); data.cycle = String(body.cycle); }
    if (body?.kind !== undefined) { if (!VALID_KIND.has(String(body.kind))) throw new BadRequestException("Tipo inválido (PLAN ou PACKAGE)."); data.kind = String(body.kind); }
    if (body?.limits !== undefined) data.limits = parseLimits(body.limits) as any;
    if (body?.isActive !== undefined) data.isActive = body.isActive === true;
    if (body?.isPublic !== undefined) data.isPublic = body.isPublic === true;
    if (body?.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
    return this.prisma.plan.update({ where: { id }, data });
  }
  @Delete(":id") async remove(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.admin(req);
    // Arquiva (desativa) em vez de excluir: empresas já vinculadas preservam o snapshot.
    const inUse = await this.prisma.tenant.count({ where: { planId: id } });
    if (inUse > 0) { await this.prisma.plan.update({ where: { id }, data: { isActive: false, isPublic: false } }); return { archived: true, inUse }; }
    await this.prisma.plan.delete({ where: { id } });
    return { archived: false, deleted: true };
  }
  @Get("customers") async customers(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const tenants = await this.prisma.tenant.findMany({ where: { kind: { not: "PLATFORM" } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true, status: true, createdAt: true, planId: true, entitlements: true, _count: { select: { memberships: true, channelConnections: true, conversations: true } } } });
    const plans = await this.prisma.plan.findMany({ select: { id: true, code: true, name: true, priceCents: true, cycle: true } });
    const byId = new Map(plans.map(p => [p.id, p]));
    // Uso aproximado: contagens reais do banco; dinheiro vem do plano atribuído.
    const rows = tenants.map(t => {
      const plan = t.planId ? byId.get(t.planId) || null : null;
      const view = entitlementsView(t.entitlements);
      return { id: t.id, name: t.name, slug: t.slug, status: t.status, createdAt: t.createdAt, plan, seats: t._count.memberships, channels: t._count.channelConnections, conversations: t._count.conversations, entitlements: view, monthlyPriceCents: plan ? (plan.cycle === "YEAR" ? Math.round(plan.priceCents / 12) : plan.priceCents) : 0 };
    });
    const mrr = rows.filter(r => r.status === "ACTIVE").reduce((sum, r) => sum + r.monthlyPriceCents, 0);
    return { customers: rows, mrrCents: mrr, total: rows.length };
  }
  @Patch("customers/:id/plan") async assignPlan(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) tenantId: string, @Body() body: any) {
    this.admin(req);
    const planId = body?.planId === null ? null : String(body?.planId || "");
    let entitlements: Record<string, unknown> = FULL_ENTITLEMENTS as any;
    if (planId) {
      if (!/^[a-f0-9-]{36}$/i.test(planId)) throw new BadRequestException("planId inválido.");
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new NotFoundException("Plano não encontrado.");
      entitlements = entitlementsFromPlanLimits(plan.limits as Record<string, unknown>) as any;
    }
    const updated = await this.prisma.tenant.update({ where: { id: tenantId }, data: { planId: planId || null, entitlements: entitlements as any }, select: { id: true, name: true, slug: true, planId: true, entitlements: true } });
    return updated;
  }
}
function safeParse(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value !== "string") return value as Record<string, unknown>;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
}
