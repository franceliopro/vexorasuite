import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { balanceOf, isUuid, isoDate, utcDate } from "./music-school-rules";

/** Leituras tenant-scoped da Escola de Música; nenhum dado de outra empresa é aceito. */
@Injectable()
export class MusicSchoolReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listClasses(tenantId: string) {
    const rows = await this.prisma.musicClass.findMany({
      where: { tenantId },
      include: { enrollments: { where: { status: "ACTIVE" }, select: { id: true } } },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      take: 100,
    });
    const ids = rows.map((row) => row.id);
    const events = ids.length
      ? await this.prisma.musicAttendance.findMany({ where: { tenantId, classId: { in: ids } }, select: { classId: true, outcome: true }, take: 10_000 })
      : [];
    const departments = await this.prisma.department.findMany({
      where: { tenantId, id: { in: rows.map((row) => row.departmentId) } },
      select: { id: true, name: true }, take: 100,
    });
    const names = new Map(departments.map((department) => [department.id, department.name]));
    return rows.map((row) => {
      const balance = balanceOf(0, 0, events.filter((event) => event.classId === row.id).map((event) => event.outcome));
      return {
        id: row.id, name: row.name, instrument: row.instrument,
        departmentId: row.departmentId, departmentName: names.get(row.departmentId) ?? null,
        weekday: row.weekday, startTime: row.startTime, durationMinutes: row.durationMinutes,
        active: row.active, studentCount: row.enrollments.length, pendingMakeups: balance.pendingMakeups,
      };
    });
  }

  async listAttendances(tenantId: string, classId?: string, from?: string, to?: string) {
    if (classId && !isUuid(classId)) throw new BadRequestException("Plano do aluno inválido.");
    const start = from ? isoDate(from) : null;
    const end = to ? isoDate(to) : null;
    if (from && !start) throw new BadRequestException("Data inicial inválida.");
    if (to && !end) throw new BadRequestException("Data final inválida.");
    if (start && end && start > end) throw new BadRequestException("O período está invertido.");
    const where: Record<string, unknown> = { tenantId };
    if (classId) where.classId = classId;
    if (start || end) where.sessionDate = { ...(start ? { gte: utcDate(start) } : {}), ...(end ? { lte: utcDate(end) } : {}) };
    return this.prisma.musicAttendance.findMany({
      where, include: { enrollment: { select: { contactId: true, classId: true } } },
      orderBy: { sessionDate: "desc" }, take: 500,
    });
  }

  async listBalances(tenantId: string, contactId?: string) {
    if (contactId && !isUuid(contactId)) throw new BadRequestException("Aluno inválido.");
    const where: Record<string, unknown> = { tenantId };
    if (contactId) where.contactId = contactId;
    const rows = await this.prisma.musicEnrollment.findMany({
      where,
      include: { class: { select: { id: true, name: true } }, attendances: { select: { outcome: true, sessionDate: true } } },
      orderBy: { createdAt: "desc" }, take: 200,
    });
    const contacts = rows.length
      ? await this.prisma.contact.findMany({ where: { tenantId, id: { in: rows.map((row) => row.contactId) } }, select: { id: true, name: true }, take: 200 })
      : [];
    const names = new Map(contacts.map((contact) => [contact.id, contact.name]));
    return rows.map((row) => {
      const balance = balanceOf(row.contractedSessions, row.purchasedSessions, row.attendances.map((event) => event.outcome));
      return {
        enrollmentId: row.id, classId: row.classId, className: row.class.name,
        contactId: row.contactId, contactName: names.get(row.contactId) ?? null,
        ...balance,
        billing: { status: row.billingStatus, nextDueDate: row.billingNextDueDate, amountCents: row.billingAmountCents, executed: false, confirmed: false },
      };
    });
  }

  /** Listas curtas para os formulários; nunca inclui dados de outra empresa. */
  async options(tenantId: string) {
    const [departments, contacts] = await Promise.all([
      this.prisma.department.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      this.prisma.contact.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ]);
    return { departments, contacts };
  }
}