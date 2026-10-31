import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type RoutingStrategy = "ROUND_ROBIN" | "LOAD_BALANCED";

@Injectable()
export class ConversationDistributionService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(tenantId: string, conversationId: string, departmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
      const integrations = tenant?.integrations && typeof tenant.integrations === "object" && !Array.isArray(tenant.integrations)
        ? tenant.integrations as Record<string, unknown>
        : {};
      const distribution = integrations.distributionSettings && typeof integrations.distributionSettings === "object" && !Array.isArray(integrations.distributionSettings)
        ? integrations.distributionSettings as Record<string, unknown>
        : {};
      if (distribution.enabled !== true) return null;

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
      const eligible = memberIds.filter((id) => {
        const limit = department.maxOpenConversations;
        return limit <= 0 || (counts.get(id) || 0) < limit;
      });
      if (!eligible.length) return null;

      const strategy = department.routingStrategy as RoutingStrategy;
      const selected = [...eligible].sort((a, b) => {
        const loadDiff = (counts.get(a) || 0) - (counts.get(b) || 0);
        return strategy === "LOAD_BALANCED" && loadDiff !== 0 ? loadDiff : a.localeCompare(b);
      })[0];

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
