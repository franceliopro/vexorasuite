import { Injectable } from "@nestjs/common";
import { administrative, effectiveModules, patternModules } from "../auth/module-policy";
import { AuthPayload } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { assignedConversationScope } from "./conversation-visibility";

type SseEvent = { type: string; data: Record<string, unknown> };

@Injectable()
export class EventsAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(user: AuthPayload, event: SseEvent): Promise<SseEvent | null> {
    const memberPromise = this.prisma.membership.findFirst({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        user: { isActive: true, mustChangePassword: false },
        tenant: { status: "ACTIVE" },
      },
      select: {
        role: true,
        modules: true,
        deniedModules: true,
        user: { select: { authVersion: true, isPlatformAdmin: true } },
        tenant: { select: { kind: true, integrations: true } },
      },
    });
    const departmentsPromise = this.prisma.departmentMember.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.sub,
        department: { isActive: true },
      },
      select: { department: { select: { id: true, modules: true } } },
    });

    // These reads are independent. Running them as one authorization batch lowers SSE
    // latency without caching permissions or weakening revocation checks.
    const [member, rows] = await Promise.all([memberPromise, departmentsPromise]);
    if (
      !member ||
      (user.sessionVersion ?? 0) !== member.user.authVersion ||
      (member.tenant.kind === "PLATFORM" && !member.user.isPlatformAdmin)
    ) {
      return null;
    }

    const admin = administrative(member.role);
    const ids = rows.filter((row) => row.department.modules.includes("INBOX")).map((row) => row.department.id);
    const crmIds = rows.filter((row) => row.department.modules.includes("CRM")).map((row) => row.department.id);
    const allowed = effectiveModules(
      member.role,
      member.modules,
      rows.map((row) => row.department),
      patternModules(member.tenant.integrations, user.sub, rows.map((row) => row.department.id)),
      member.deniedModules,
    );

    if (!member.user.isPlatformAdmin && !allowed.includes("INBOX") && !allowed.includes("CRM")) return null;
    if (admin) return { type: event.type, data: event.data };

    const conversationId =
      typeof event.data.conversationId === "string"
        ? event.data.conversationId
        : event.type.startsWith("conversation.") && typeof event.data.id === "string"
          ? event.data.id
          : null;

    if (conversationId) {
      const visible = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          tenantId: user.tenantId,
          ...assignedConversationScope(user.tenantId, user.sub, ids),
        },
        select: { id: true },
      });
      if (!visible) return null;
    } else if (event.type === "contact.stage_changed") {
      if (!allowed.includes("CRM") || typeof event.data.pipelineId !== "string" || !crmIds.length) return null;
      const visible = await this.prisma.crmPipeline.findFirst({
        where: {
          id: event.data.pipelineId,
          tenantId: user.tenantId,
          enabled: true,
          departmentId: { in: crmIds },
          department: { isActive: true, modules: { has: "CRM" } },
        },
        select: { id: true },
      });
      if (!visible) return null;
    } else if (event.type === "contact.updated" || event.type === "contact.created") {
      if (!allowed.includes("CRM") || typeof event.data.id !== "string" || !crmIds.length) return null;
      const visible = await this.prisma.contact.findFirst({
        where: {
          id: event.data.id,
          tenantId: user.tenantId,
          OR: [
            { pipeline: { enabled: true, departmentId: { in: crmIds }, department: { isActive: true, modules: { has: "CRM" } } } },
            { conversations: { some: { departmentId: { in: crmIds }, department: { isActive: true, modules: { has: "CRM" } } } } },
          ],
        },
        select: { id: true },
      });
      if (!visible) return null;
    } else if (!allowed.includes("INBOX") || !["channel.status", "channel.created", "team.updated"].includes(event.type)) {
      return null;
    }

    return { type: event.type, data: event.data };
  }
}
