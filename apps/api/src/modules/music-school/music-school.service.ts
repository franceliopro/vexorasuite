import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MusicSchoolReadService } from "./music-school-read.service";
import { integer, isManager, isUuid, isoDate, optionalInteger, OUTCOMES, text, utcDate, Outcome } from "./music-school-rules";

/**
 * Escola de Música — escrita do slice 1. Departamento é o professor e
 * Contato do CRM é o aluno. Presença e saldo são determinísticos; a cobrança
 * fica apenas agendada, sem envio. Toda mutação é filtrada por tenantId e a
 * identidade vem da sessão. Leituras são feitas por MusicSchoolReadService.
 */
@Injectable()
export class MusicSchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly read: MusicSchoolReadService,
  ) {}

  private async lockTenant(tx: any, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  async createClass(body: Record<string, unknown>, tenantId: string, role: string, userId: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela empresa podem cadastrar planos individuais.");
    const name = text(body?.name, 80);
    if (name.length < 2) throw new BadRequestException("Informe o nome do plano do aluno.");
    const departmentId = body?.departmentId;
    if (!isUuid(departmentId)) throw new BadRequestException("Informe o departamento/professor do plano.");
    const weekday = integer(body?.weekday, 1, 7, "Dia da semana");
    const startTime = text(body?.startTime, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) throw new BadRequestException("Informe o horário no formato HH:mm.");
    const durationMinutes = integer(body?.durationMinutes ?? 60, 30, 180, "Duração");
    const instrument = text(body?.instrument, 40) || null;
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId, isActive: true },
      select: { id: true, name: true },
    });
    if (!department) throw new NotFoundException("Departamento/professor não encontrado nesta empresa.");
    const created = await this.prisma.musicClass.create({
      data: { tenantId, name, instrument, departmentId, weekday, startTime, durationMinutes, active: true, createdById: userId },
    });
    return { ...created, departmentName: department.name };
  }

  async enroll(body: Record<string, unknown>, classId: string, tenantId: string, role: string, userId: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela empresa podem matricular alunos.");
    if (!isUuid(classId)) throw new BadRequestException("Plano do aluno inválido.");
    const contactId = body?.contactId;
    if (!isUuid(contactId)) throw new BadRequestException("Informe o aluno do CRM.");
    const contractedSessions = integer(body?.contractedSessions, 1, 1000, "Aulas contratadas");
    const purchasedSessions = integer(body?.purchasedSessions ?? 0, 0, 1000, "Aulas adicionais");
    const billingAmountCents = optionalInteger(body?.billingAmountCents, 0, 100_000_000, "Valor mensal");
    const due = isoDate(body?.billingNextDueDate);
    if (billingAmountCents !== null && !due) throw new BadRequestException("Informe a primeira data de vencimento quando houver valor mensal.");
    if (due && billingAmountCents === null) throw new BadRequestException("Informe o valor mensal quando houver vencimento.");
    const schoolClass = await this.prisma.musicClass.findFirst({
      where: { id: classId, tenantId },
      select: { id: true, name: true },
    });
    if (!schoolClass) throw new NotFoundException("Plano do aluno não encontrado nesta empresa.");
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundException("Aluno não encontrado nesta empresa.");
    const created = await this.prisma.$transaction(async (tx: any) => {
      await this.lockTenant(tx, tenantId);
      const duplicate = await tx.musicEnrollment.findFirst({ where: { tenantId, classId, contactId } });
      if (duplicate) throw new BadRequestException("Este aluno já está matriculado neste plano.");
      return tx.musicEnrollment.create({
        data: {
          tenantId,
          classId,
          contactId,
          contractedSessions,
          purchasedSessions,
          status: "ACTIVE",
          billingAmountCents,
          billingCycle: "MONTHLY",
          billingStatus: "SCHEDULED",
          billingNextDueDate: due ? utcDate(due) : null,
          createdById: userId,
        },
      });
    });
    return {
      ...created,
      className: schoolClass.name,
      contactName: contact.name,
      billing: {
        status: created.billingStatus,
        nextDueDate: created.billingNextDueDate,
        amountCents: created.billingAmountCents,
        executed: false,
        confirmed: false,
      },
    };
  }

  async recordAttendance(body: Record<string, unknown>, tenantId: string, role: string, userId: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela empresa podem registrar presença.");
    const enrollmentId = body?.enrollmentId;
    if (!isUuid(enrollmentId)) throw new BadRequestException("Informe a matrícula.");
    const sessionDate = isoDate(body?.sessionDate);
    if (!sessionDate) throw new BadRequestException("Informe a data da aula no formato AAAA-MM-DD.");
    const outcome = text(body?.outcome, 32).toUpperCase() as Outcome;
    if (!OUTCOMES.includes(outcome)) throw new BadRequestException("Resultado de presença inválido.");
    const note = text(body?.note, 240) || null;
    const enrollment = await this.prisma.musicEnrollment.findFirst({
      where: { id: enrollmentId, tenantId },
      select: { id: true, classId: true, contactId: true },
    });
    if (!enrollment) throw new NotFoundException("Matrícula não encontrada nesta empresa.");
    const created = await this.prisma.$transaction(async (tx: any) => {
      await this.lockTenant(tx, tenantId);
      const duplicate = await tx.musicAttendance.findFirst({
        where: { tenantId, enrollmentId, sessionDate: utcDate(sessionDate) },
      });
      if (duplicate) throw new BadRequestException("Já existe presença registrada para esta aula.");
      return tx.musicAttendance.create({
        data: {
          tenantId,
          classId: enrollment.classId,
          enrollmentId,
          sessionDate: utcDate(sessionDate),
          outcome,
          note,
          recordedById: userId,
        },
      });
    });
    const balances = await this.read.listBalances(tenantId, enrollment.contactId);
    return { record: created, balance: balances[0] ?? null };
  }
}
