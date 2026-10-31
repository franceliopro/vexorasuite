import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type DistributionStrategy = "QUEUE" | "ROUND_ROBIN" | "LOAD" | "PRIORITY";

@Injectable()
export class ConversationDistributionService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(tenantId: string, conversationId: string, departmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
      const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
        ? tenant.integrations as Record<string, unknown>
        : {};
      const settings = integrations.distributionSettings && typeof integrations.distributionSettings === "object" && !Array.isArray(integrations.distributionSettings)
        ? integrations.distributionSettings as Record<string, unknown>
        : {};
      if (settings.enabled !== true) return null;

      const department = await tx.department.findFirst({
        where: { id: departmentId, tenantId, isActive: true },
        select: {
          id: true,
          routingStrategy: true,
          maxOpenConversations: true,
          members: {
            where: { user: { isActive: true } },
            orderBy: { userId: "asc" },
            select: { userId: true },
          },
        },
      });
      if (!department || !department.members.length) return null;

      const configured = String(settings.strategy || "").toUpperCase();
      const strategy: DistributionStrategy = ["QUEUE", "ROUND_ROBIN", "LOAD", "PRIORITY"].includes(configured)
        ? configured as DistributionStrategy
        : department.routingStrategy === "LOAD_BALANCED" ? "LOAD" : "ROUND_ROBIN";
      if (strategy === "QUEUE") return null;

      const memberIds = department.members.map((member) => member.userId);
      const openCounts = await tx.conversation.groupBy({
        by: ["assigneeId"],
        where: {
          tenantId,
          departmentId,
          assigneeId: { in: memberIds },
          status: { in: ["OPEN", "PENDING"] },
          archivedAt: null,
          deletedAt: null,
        },
        _count: { _all: true },
      });
      const counts = new Map(openCounts.map((row) => [row.assigneeId || "", row._count._all]));
      const eligible = memberIds.filter((id) => department.maxOpenConversations <= 0 || (counts.get(id) || 0) < department.maxOpenConversations);
      if (!eligible.length) return null;

      let selected: string;
      if (strategy === "ROUND_ROBIN") {
        const previous = await tx.conversation.findFirst({
          where: { tenantId, departmentId, assigneeId: { in: memberIds } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: { assigneeId: true },
        });
        const previousIndex = previous?.assigneeId ? memberIds.indexOf(previous.assigneeId) : -1;
        selected = eligible.find((id) => memberIds.indexOf(id) > previousIndex) || eligible[0]!;
      } else {
        // LOAD and PRIORITY both protect capacity; priority is applied by the caller's
        // ordered handoff and uses load as the deterministic tie-breaker here.
        selected = [...eligible].sort((a, b) => (counts.get(a) || 0) - (counts.get(b) || 0) || a.localeCompare(b))[0]!;
      }

      const updated = await tx.conversation.updateMany({
        where: {
          id: conversationId,
          tenantId,
          departmentId,
          status: { in: ["OPEN", "PENDING"] },
          archivedAt: null,
          deletedAt: null,
          assigneeId: null,
        },
        data: { assigneeId: selected, handlingMode: "HUMAN" },
      });
      return updated.count ? selected : null;
    });
  }
}
