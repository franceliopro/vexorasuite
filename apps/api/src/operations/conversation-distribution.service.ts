import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type DistributionStrategy = "QUEUE" | "ROUND_ROBIN" | "LOAD" | "PRIORITY";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

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
      // Sem configuração explícita, a distribuição é ligada por padrão para que um
      // responsável seja sempre definido no transbordo (rodízio do departamento).
      // Quando a empresa salva enabled:false ou estratégia QUEUE, respeitamos.
      if (settings.enabled === false) return null;

      // Serializa decisões por departamento para que duas mensagens simultâneas não
      // escolham o mesmo cursor de rodízio antes de uma delas confirmar a atribuição.
      await tx.$queryRaw`SELECT id FROM departments WHERE id=${departmentId}::uuid AND tenant_id=${tenantId}::uuid FOR UPDATE`;

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
        const recentAssignments = await tx.auditLog.findMany({
          where: { tenantId, action: "conversation.distribution.assigned", entityType: "conversation" },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { details: true },
        });
        const previousAssignment = recentAssignments
          .map((row) => object(row.details))
          .find((details) => details.departmentId === departmentId && typeof details.assigneeId === "string");
        const previousAssignee = typeof previousAssignment?.assigneeId === "string" ? previousAssignment.assigneeId : null;
        if (!previousAssignee) {
          const previous = await tx.conversation.findFirst({
            where: { tenantId, departmentId, assigneeId: { in: memberIds } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: { assigneeId: true },
          });
          const previousIndex = previous?.assigneeId ? memberIds.indexOf(previous.assigneeId) : -1;
          selected = eligible.find((id) => memberIds.indexOf(id) > previousIndex) || eligible[0]!;
        } else {
          const previousIndex = memberIds.indexOf(previousAssignee);
          selected = eligible.find((id) => memberIds.indexOf(id) > previousIndex) || eligible[0]!;
        }
      } else {
        // LOAD e PRIORITY protegem a capacidade; a prioridade mantém o desempate
        // determinístico por carga até existir uma ordem de prioridade por atendente.
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
      if (!updated.count) return null;
      await tx.auditLog.create({
        data: {
          tenantId,
          action: "conversation.distribution.assigned",
          entityType: "conversation",
          entityId: conversationId,
          details: { departmentId, assigneeId: selected, strategy },
        },
      });
      return selected;
    });
  }
}
