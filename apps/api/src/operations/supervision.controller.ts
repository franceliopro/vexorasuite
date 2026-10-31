import { BadRequestException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("supervision")
@UseGuards(AuthGuard)
export class SupervisionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("overview")
  async overview(@Req() request: AuthenticatedRequest, @Query("slaMinutes") slaMinutesInput?: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) {
      throw new BadRequestException("Somente a supervisão pode consultar este painel.");
    }
    const slaMinutes = slaMinutesInput === undefined ? 30 : Number(slaMinutesInput);
    if (!Number.isInteger(slaMinutes) || slaMinutes < 1 || slaMinutes > 1440) {
      throw new BadRequestException("O SLA deve estar entre 1 e 1.440 minutos.");
    }
    const tenantId = request.user.tenantId;
    const now = Date.now();
    const rows = await this.prisma.conversation.findMany({
      where: { tenantId, archivedAt: null, deletedAt: null, status: { in: ["OPEN", "PENDING"] } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        assigneeId: true,
        departmentId: true,
        contact: { select: { name: true } },
        assignee: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 1000,
    });
    const waiting = rows.filter((row) => !row.assigneeId);
    const stale = rows.filter((row) => now - row.updatedAt.getTime() >= slaMinutes * 60_000);
    const byDepartment = new Map<string, { id: string; name: string; waiting: number; open: number; stale: number }>();
    for (const row of rows) {
      const id = row.departmentId || "unassigned";
      const group = byDepartment.get(id) || { id, name: row.department?.name || "Sem departamento", waiting: 0, open: 0, stale: 0 };
      if (!row.assigneeId) group.waiting++;
      if (row.status === "OPEN") group.open++;
      if (now - row.updatedAt.getTime() >= slaMinutes * 60_000) group.stale++;
      byDepartment.set(id, group);
    }
    return {
      slaMinutes,
      totals: { open: rows.filter((row) => row.status === "OPEN").length, pending: rows.filter((row) => row.status === "PENDING").length, waiting: waiting.length, stale: stale.length },
      oldestWaiting: waiting[0] ? { conversationId: waiting[0].id, contactName: waiting[0].contact.name, createdAt: waiting[0].createdAt } : null,
      byDepartment: [...byDepartment.values()].sort((a, b) => b.waiting - a.waiting || b.stale - a.stale),
      staleConversations: stale.slice(0, 50).map((row) => ({ id: row.id, contactName: row.contact.name, assignee: row.assignee?.name || null, department: row.department?.name || null, updatedAt: row.updatedAt, status: row.status })),
    };
  }
}
