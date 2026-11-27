import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ATTENDANCE_STATUSES,
  MATERIAL_KINDS,
  NOTICE_CHANNELS,
  PERSON_KINDS,
  RECORD_KINDS,
  RELATIONSHIPS,
  SESSION_STATUSES,
  balanceOf,
  classTime,
  cleanRichText,
  httpsUrl,
  inList,
  integer,
  isManager,
  isUuid,
  isoDate,
  jsonList,
  optionalInteger,
  optionalText,
  text,
  utcDate,
  weekday,
  youtubeEmbed,
} from "./school-rules";

const YOUTUBE_IN_HTML = /https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,20}/g;

/** Escrita da gestão escolar. Toda mutação é tenant-scoped e serializada por tenant. */
@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  private async lockTenant(tx: any, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  private async find(tx: any, model: string, where: Record<string, unknown>, label: string): Promise<any> {
    const row = await tx[model].findFirst({ where });
    if (!row) throw new NotFoundException(`${label} não encontrado nesta empresa.`);
    return row;
  }

  private optionalUuid(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === "") return null;
    if (!isUuid(value)) throw new Error(`${label} inválido.`);
    return value;
  }

  private titleFromUrl(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "").slice(0, 80);
    } catch {
      return "Material";
    }
  }

  private youtubeUrlsFrom(html: string[], materials: string[]): string[] {
    const found = html.flatMap((value) => value.match(YOUTUBE_IN_HTML) ?? []);
    return [...new Set([...materials, ...found].filter((url) => Boolean(youtubeEmbed(url))))].slice(0, 50);
  }

  private rethrow(error: unknown): never {
    if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
    throw new BadRequestException(error instanceof Error ? error.message : "Dados inválidos.");
  }

  /** Cria qualquer entidade escolar do tenant. Nunca aceita estado de cobrança/enviado do cliente. */
  async createRecord(body: Record<string, unknown>, tenantId: string, role: string, userId: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela empresa podem gerenciar a escola.");
    try {
      const kind = inList(body?.kind, RECORD_KINDS, "Tipo de registro");
      return await this.prisma.$transaction(async (tx: any) => {
        await this.lockTenant(tx, tenantId);

        if (kind === "COURSE" || kind === "SUBJECT") {
          const name = text(body?.name, 80, "Nome");
          if (name.length < 2) throw new Error("Informe um nome com pelo menos 2 caracteres.");
          let parent: any = null;
          let parentId: string | null = null;
          if (kind === "SUBJECT") {
            const parentIdValue = this.optionalUuid(body?.parentId, "Curso");
            if (!parentIdValue) throw new Error("Informe o curso da matéria.");
            parent = await this.find(tx, "schoolCourse", { id: parentIdValue, tenantId, kind: "COURSE" }, "Curso");
            parentId = parent.id;
          }
          const row = await tx.schoolCourse.create({
            data: { tenantId, kind, name, parentId, active: body?.active !== false, createdById: userId },
          });
          return { ...row, parentName: parent?.name ?? null };
        }

        if (kind === "STUDENT" || kind === "TEACHER") {
          const name = text(body?.name, 120, "Nome");
          const email = optionalText(body?.email, 160, "E-mail");
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
          const phone = optionalText(body?.phone, 40, "Telefone");
          return tx.schoolPerson.create({
            data: { tenantId, kind, name, email, phone, active: body?.active !== false, createdById: userId },
          });
        }

        if (kind === "ROOM") {
          const name = text(body?.name, 80, "Nome da sala");
          const capacity = integer(body?.capacity, 1, 500, "Capacidade");
          return tx.schoolRoom.create({
            data: { tenantId, name, capacity, active: body?.active !== false, createdById: userId },
          });
        }

        if (kind === "CLASS") {
          const courseId = this.optionalUuid(body?.courseId, "Matéria/curso");
          if (!courseId) throw new Error("Informe a matéria ou curso da turma.");
          const course = await this.find(tx, "schoolCourse", { id: courseId, tenantId }, "Matéria/curso");
          const teacherId = this.optionalUuid(body?.teacherId, "Professor");
          if (!teacherId) throw new Error("Informe o professor da turma.");
          const teacher = await this.find(tx, "schoolPerson", { id: teacherId, tenantId, kind: "TEACHER", active: true }, "Professor");
          const roomId = this.optionalUuid(body?.roomId, "Sala");
          const room = roomId ? await this.find(tx, "schoolRoom", { id: roomId, tenantId, active: true }, "Sala") : null;
          const name = text(body?.name, 120, "Nome da turma");
          const weekdayValue = weekday(body?.weekday);
          const startTime = classTime(body?.startTime);
          const durationMinutes = integer(body?.durationMinutes ?? 60, 30, 240, "Duração");
          let courseName = course.name;
          if (course.kind === "SUBJECT" && course.parentId) {
            const parent = await tx.schoolCourse.findFirst({ where: { id: course.parentId, tenantId }, select: { name: true } });
            if (parent) courseName = `${parent.name} · ${course.name}`;
          }
          const row = await tx.schoolClass.create({
            data: {
              tenantId, courseId, teacherId, roomId: room?.id ?? null, name,
              weekday: weekdayValue, startTime, durationMinutes,
              active: body?.active !== false, createdById: userId,
            },
          });
          return { ...row, courseName, teacherName: teacher.name, roomName: room?.name ?? null };
        }

        if (kind === "ENROLLMENT") {
          const classId = this.optionalUuid(body?.classId, "Turma");
          if (!classId) throw new Error("Informe a turma da matrícula.");
          const schoolClass = await this.find(tx, "schoolClass", { id: classId, tenantId }, "Turma");
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          if (!studentId) throw new Error("Informe o aluno da matrícula.");
          const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT", active: true }, "Aluno");
          const contractedSessions = integer(body?.contractedSessions, 1, 1000, "Aulas contratadas");
          const purchasedSessions = integer(body?.purchasedSessions ?? 0, 0, 1000, "Aulas adicionais");
          const tuitionAmountCents = optionalInteger(body?.tuitionAmountCents, 0, 100_000_000, "Valor mensal");
          const due = isoDate(body?.tuitionNextDueDate);
          if (tuitionAmountCents !== null && !due) throw new Error("Informe o vencimento quando houver valor mensal.");
          if (due && tuitionAmountCents === null) throw new Error("Informe o valor mensal quando houver vencimento.");
          const duplicate = await tx.schoolEnrollment.findFirst({ where: { tenantId, classId, studentId } });
          if (duplicate) throw new Error("Este aluno já está matriculado nesta turma.");
          const row = await tx.schoolEnrollment.create({
            data: {
              tenantId, classId, studentId, contractedSessions, purchasedSessions,
              status: "ACTIVE", tuitionAmountCents, tuitionCycle: "MONTHLY",
              tuitionStatus: "SCHEDULED", tuitionNextDueDate: due ? utcDate(due) : null,
              createdById: userId,
            },
          });
          return {
            ...row,
            className: schoolClass.name,
            studentName: student.name,
            tuition: {
              status: row.tuitionStatus,
              amountCents: row.tuitionAmountCents,
              nextDueDate: row.tuitionNextDueDate,
              executed: false,
              confirmed: false,
            },
          };
        }

        if (kind === "SESSION") {
          const classId = this.optionalUuid(body?.classId, "Turma");
          if (!classId) throw new Error("Informe a turma da aula.");
          const schoolClass = await this.find(tx, "schoolClass", { id: classId, tenantId }, "Turma");
          const sessionDate = isoDate(body?.sessionDate);
          if (!sessionDate) throw new Error("Informe a data da aula no formato AAAA-MM-DD.");
          const status = body?.status === undefined ? "SCHEDULED" : inList(body.status, SESSION_STATUSES, "Status da aula");
          const duplicate = await tx.schoolSession.findFirst({ where: { tenantId, classId, sessionDate: utcDate(sessionDate) } });
          if (duplicate) throw new Error("Já existe aula nesta data para esta turma.");
          const row = await tx.schoolSession.create({
            data: { tenantId, classId, sessionDate: utcDate(sessionDate), status, createdById: userId },
          });
          return { ...row, className: schoolClass.name };
        }

        if (kind === "LESSON_PLAN") {
          const classId = this.optionalUuid(body?.classId, "Turma");
          if (!classId) throw new Error("Informe a turma do plano de aula.");
          const schoolClass = await this.find(tx, "schoolClass", { id: classId, tenantId }, "Turma");
          const title = text(body?.title, 120, "Título do plano");
          const objectiveHtml = cleanRichText(body?.objectiveHtml, "Objetivo");
          const contentHtml = cleanRichText(body?.contentHtml, "Conteúdo");
          const activitiesHtml = cleanRichText(body?.activitiesHtml, "Atividades");
          const observationsHtml = cleanRichText(body?.observationsHtml, "Observações");
          const materials = jsonList(body?.materials ?? [], "Materiais");
          const youtubeUrls = this.youtubeUrlsFrom([objectiveHtml, contentHtml, activitiesHtml, observationsHtml], materials);
          const latest = await tx.schoolLessonPlan.findFirst({
            where: { tenantId, classId }, orderBy: { version: "desc" }, select: { version: true },
          });
          const version = (latest?.version ?? 0) + 1;
          const row = await tx.schoolLessonPlan.create({
            data: {
              tenantId, classId, version, title,
              objectiveHtml, contentHtml, activitiesHtml, observationsHtml,
              materials, youtubeUrls, createdById: userId,
            },
          });
          for (const url of materials) {
            const embed = youtubeEmbed(url);
            await tx.schoolMaterial.create({
              data: {
                tenantId, lessonPlanId: row.id, courseId: schoolClass.courseId,
                title: this.titleFromUrl(url), url: embed ?? url,
                kind: embed ? "YOUTUBE" : "LINK", createdById: userId,
              },
            });
          }
          return { ...row, className: schoolClass.name, embeddedVideos: youtubeUrls.length };
        }

        if (kind === "GRADE") {
          const classId = this.optionalUuid(body?.classId, "Turma");
          if (!classId) throw new Error("Informe a turma da avaliação.");
          const schoolClass = await this.find(tx, "schoolClass", { id: classId, tenantId }, "Turma");
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          if (!studentId) throw new Error("Informe o aluno avaliado.");
          const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT" }, "Aluno");
          const enrollment = await tx.schoolEnrollment.findFirst({ where: { tenantId, classId, studentId } });
          if (!enrollment) throw new Error("Este aluno não está matriculado nesta turma.");
          const title = text(body?.title, 120, "Título da avaliação");
          const evaluationDate = isoDate(body?.evaluationDate);
          if (!evaluationDate) throw new Error("Informe a data da avaliação no formato AAAA-MM-DD.");
          const maxScore = integer(body?.maxScore, 1, 1000, "Nota máxima");
          const score = integer(body?.score, 0, maxScore, "Nota");
          const note = optionalText(body?.note, 240, "Observação");
          const duplicate = await tx.schoolGrade.findFirst({ where: { tenantId, classId, studentId, title } });
          if (duplicate) throw new Error("Já existe avaliação com este título para o aluno nesta turma.");
          const row = await tx.schoolGrade.create({
            data: {
              tenantId, classId, studentId, title, evaluationDate: utcDate(evaluationDate),
              maxScore, score, note, recordedById: userId,
            },
          });
          return { ...row, className: schoolClass.name, studentName: student.name };
        }

        if (kind === "GUARDIAN") {
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          if (!studentId) throw new Error("Informe o aluno responsabilizado.");
          const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT" }, "Aluno");
          const name = text(body?.name, 120, "Nome do responsável");
          const relationship = body?.relationship === undefined || body.relationship === ""
            ? null
            : inList(body.relationship, RELATIONSHIPS, "Parentesco");
          const phone = optionalText(body?.phone, 40, "Telefone");
          const email = optionalText(body?.email, 160, "E-mail");
          const row = await tx.schoolGuardian.create({
            data: { tenantId, studentId, name, relationship, phone, email, createdById: userId },
          });
          return { ...row, studentName: student.name };
        }

        if (kind === "NOTICE") {
          const title = text(body?.title, 120, "Título do aviso");
          const bodyHtml = cleanRichText(body?.bodyHtml, "Texto do aviso");
          const channel = body?.channel === undefined ? "WHATSAPP" : inList(body.channel, NOTICE_CHANNELS, "Canal");
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          const classId = this.optionalUuid(body?.classId, "Turma");
          if (studentId) await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT" }, "Aluno");
          if (classId) await this.find(tx, "schoolClass", { id: classId, tenantId }, "Turma");
          const scheduledAt = isoDate(body?.scheduledAt);
          const row = await tx.schoolNotice.create({
            data: {
              tenantId, studentId, classId, title, bodyHtml, channel,
              status: "SCHEDULED", scheduledAt: scheduledAt ? utcDate(scheduledAt) : null,
              createdById: userId,
            },
          });
          return { ...row, sent: false, executed: false, confirmed: false };
        }

        if (kind === "MATERIAL") {
          const title = text(body?.title, 120, "Título do material");
          let url = httpsUrl(body?.url, "URL do material");
          const requestedKind = body?.kind === undefined ? "LINK" : inList(body.kind, MATERIAL_KINDS, "Tipo de material");
          const embed = youtubeEmbed(url);
          if (requestedKind === "YOUTUBE") {
            if (!embed) throw new Error("Informe uma URL válida do YouTube.");
            url = embed;
          }
          const lessonPlanId = this.optionalUuid(body?.lessonPlanId, "Plano de aula");
          const courseId = this.optionalUuid(body?.courseId, "Curso");
          if (lessonPlanId) await this.find(tx, "schoolLessonPlan", { id: lessonPlanId, tenantId }, "Plano de aula");
          if (courseId) await this.find(tx, "schoolCourse", { id: courseId, tenantId }, "Curso");
          return tx.schoolMaterial.create({
            data: {
              tenantId, lessonPlanId, courseId, title, url,
              kind: embed && requestedKind !== "FILE" ? "YOUTUBE" : requestedKind,
              createdById: userId,
            },
          });
        }

        throw new Error("Tipo de registro não suportado.");
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async balanceFor(tx: any, tenantId: string, enrollmentId: string) {
    const enrollment = await tx.schoolEnrollment.findFirst({ where: { id: enrollmentId, tenantId } });
    if (!enrollment) return null;
    const sessions = await tx.schoolSession.findMany({
      where: { tenantId, classId: enrollment.classId }, select: { id: true }, take: 1000,
    });
    const sessionIds = sessions.map((session: any) => session.id as string);
    const studentRecords = await tx.schoolAttendance.findMany({
      where: { tenantId, personKind: "STUDENT", personId: enrollment.studentId, sessionId: { in: sessionIds } },
      select: { status: true }, take: 1000,
    });
    const teacherRecords = await tx.schoolAttendance.findMany({
      where: {
        tenantId, personKind: "TEACHER", status: { in: ["ABSENT", "CANCELLED"] },
        sessionId: { in: sessionIds },
      },
      select: { status: true }, take: 1000,
    });
    const balance = balanceOf(enrollment.contractedSessions, enrollment.purchasedSessions, [
      ...studentRecords.map((record: any) => String(record.status)),
      ...teacherRecords.map(() => "CANCELLED"),
    ]);
    return { enrollmentId: enrollment.id, ...balance };
  }

  /** Presença de aluno ou professor em uma aula do tenant, com trava por tenant. */
  async recordAttendance(body: Record<string, unknown>, tenantId: string, role: string, userId: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela empresa podem registrar presença.");
    try {
      const personKind = inList(body?.personKind, PERSON_KINDS, "Tipo de pessoa");
      const personId = this.optionalUuid(body?.personId, "Pessoa");
      if (!personId) throw new Error("Informe a pessoa da presença.");
      const status = inList(body?.status, ATTENDANCE_STATUSES, "Status de presença");
      const note = optionalText(body?.note, 240, "Observação");
      return await this.prisma.$transaction(async (tx: any) => {
        await this.lockTenant(tx, tenantId);
        let session: any;
        if (body?.sessionId !== undefined && body.sessionId !== "") {
          const sessionId = this.optionalUuid(body.sessionId, "Aula");
          session = await this.find(tx, "schoolSession", { id: sessionId, tenantId }, "Aula");
        } else {
          const classId = this.optionalUuid(body?.classId, "Turma");
          if (!classId) throw new Error("Informe a aula ou a turma com data.");
          await this.find(tx, "schoolClass", { id: classId, tenantId }, "Turma");
          const sessionDate = isoDate(body?.sessionDate);
          if (!sessionDate) throw new Error("Informe a data da aula no formato AAAA-MM-DD.");
          session = await tx.schoolSession.findFirst({ where: { tenantId, classId, sessionDate: utcDate(sessionDate) } });
          if (!session) {
            session = await tx.schoolSession.create({
              data: { tenantId, classId, sessionDate: utcDate(sessionDate), status: "SCHEDULED", createdById: userId },
            });
          }
        }
        const person = await this.find(tx, "schoolPerson", { id: personId, tenantId, kind: personKind, active: true }, "Pessoa");
        let enrollmentId: string | null = null;
        if (personKind === "STUDENT") {
          const enrollment = await tx.schoolEnrollment.findFirst({ where: { tenantId, classId: session.classId, studentId: personId } });
          if (!enrollment) throw new Error("Este aluno não está matriculado nesta turma.");
          enrollmentId = enrollment.id;
        } else {
          const schoolClass = await this.find(tx, "schoolClass", { id: session.classId, tenantId }, "Turma");
          if (schoolClass.teacherId !== personId) throw new Error("Este professor não leciona nesta turma.");
        }
        const duplicate = await tx.schoolAttendance.findFirst({
          where: { tenantId, sessionId: session.id, personKind, personId },
        });
        if (duplicate) throw new Error("Já existe presença registrada para esta pessoa nesta aula.");
        const record = await tx.schoolAttendance.create({
          data: {
            tenantId, sessionId: session.id, personId, personKind, status, note,
            recordedById: userId,
          },
        });
        if (session.status === "SCHEDULED" && status !== "CANCELLED") {
          await tx.schoolSession.update({ where: { id: session.id }, data: { status: "HELD" } });
        }
        return {
          record,
          sessionId: session.id,
          classId: session.classId,
          personName: person.name,
          balance: enrollmentId ? await this.balanceFor(tx, tenantId, enrollmentId) : null,
        };
      });
    } catch (error) {
      this.rethrow(error);
    }
  }
}
