import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  ATTENDANCE_PERSON_KINDS,
  ATTENDANCE_STATUSES,
  BILLING_MODES,
  CANCELLATION_DECISIONS,
  CLASS_PERIODS,
  CONTRACT_PERIODS,
  DEFAULT_BILLING_POLICY,
  MATERIAL_KINDS,
  NOTICE_CHANNELS,
  PAYMENT_RECEIPT_SOURCES,
  PERSON_KINDS,
  RECORD_KINDS,
  RELATIONSHIPS,
  SESSION_STATUSES,
  TUITION_CYCLES,
  balanceOf,
  billingPeriodKey,
  classTime,
  cleanRichText,
  courseImageUrl,
  httpsUrl,
  inList,
  integer,
  isManager,
  isUuid,
  isoDate,
  jsonList,
  optionalInteger,
  optionalText,
  penaltyForBreach,
  text,
  utcDate,
  weekday,
  youtubeEmbed,
} from "./school-rules";
import { musicSchoolDefaultCourses } from "./music-school-defaults";

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
    if (!row) throw new NotFoundException(`Registro não encontrado nesta empresa: ${label}.`);
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

  /** Plano individual do aluno: serviço interno, nunca exposto como "turma" na interface.
   * Reaproveita o modelo SchoolClass para manter matrícula, sessão e presença tenant-scoped.
   */
  private async individualClass(tx: any, tenantId: string, body: Record<string, unknown>, userId: string): Promise<any> {
    const explicit = this.optionalUuid(body?.classId, "Plano do aluno");
    if (explicit) return this.find(tx, "schoolClass", { id: explicit, tenantId }, "Plano do aluno");
    const studentId = this.optionalUuid(body?.studentId, "Aluno");
    const courseId = this.optionalUuid(body?.courseId, "Matéria/curso");
    const teacherId = this.optionalUuid(body?.teacherId, "Professor");
    if (!studentId || !courseId || !teacherId) throw new Error("Informe aluno, matéria/curso e professor da aula.");
    const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT", active: true }, "Aluno");
    const course = await this.find(tx, "schoolCourse", { id: courseId, tenantId, kind: "COURSE", active: true }, "Matéria/curso");
    await this.find(tx, "schoolPerson", { id: teacherId, tenantId, kind: "TEACHER", active: true }, "Professor");
    const schedule: Record<string, unknown> = {};
    if (body?.weekday !== undefined && body.weekday !== "") schedule.weekday = weekday(body.weekday);
    if (typeof body?.startTime === "string" && body.startTime) schedule.startTime = classTime(body.startTime);
    if (body?.durationMinutes !== undefined && body.durationMinutes !== "") {
      schedule.durationMinutes = integer(body.durationMinutes, 30, 240, "Duração da aula");
    }
    if (body?.period !== undefined && body.period !== "") schedule.period = inList(body.period, CLASS_PERIODS, "Período do curso");
    const name = `${student.name} · ${course.name}`.slice(0, 120);
    const existing = await tx.schoolClass.findFirst({ where: { tenantId, courseId, teacherId, name } });
    if (existing) {
      return Object.keys(schedule).length
        ? tx.schoolClass.update({ where: { id: existing.id }, data: schedule })
        : existing;
    }
    return tx.schoolClass.create({
      data: {
        tenantId, courseId, teacherId, name,
        weekday: (schedule.weekday as number | undefined) ?? 1,
        startTime: (schedule.startTime as string | undefined) ?? "19:00",
        durationMinutes: (schedule.durationMinutes as number | undefined) ?? 50,
        period: (schedule.period as string | undefined) ?? null,
        active: true, createdById: userId,
      },
    });
  }

  private async resolveSession(tx: any, tenantId: string, body: Record<string, unknown>, userId: string): Promise<any> {
    if (body?.sessionId !== undefined && body.sessionId !== "") {
      const sessionId = this.optionalUuid(body.sessionId, "Aula");
      return this.find(tx, "schoolSession", { id: sessionId, tenantId }, "Aula");
    }
    const schoolClass = await this.individualClass(tx, tenantId, body, userId);
    const sessionDate = isoDate(body?.sessionDate);
    if (!sessionDate) throw new Error("Informe a data da aula no formato AAAA-MM-DD.");
    const existing = await tx.schoolSession.findFirst({ where: { tenantId, classId: schoolClass.id, sessionDate: utcDate(sessionDate) } });
    return existing ?? tx.schoolSession.create({
      data: { tenantId, classId: schoolClass.id, sessionDate: utcDate(sessionDate), status: "SCHEDULED", createdById: userId },
    });
  }

  private async policyFor(tx: any, tenantId: string, userId: string): Promise<any> {
    const existing = await tx.schoolBillingPolicy.findFirst({ where: { tenantId } });
    if (existing) return existing;
    return tx.schoolBillingPolicy.create({
      data: {
        tenantId,
        paymentReminderDaysBefore: DEFAULT_BILLING_POLICY.paymentReminderDaysBefore,
        remindOnDueDate: DEFAULT_BILLING_POLICY.remindOnDueDate,
        remindDailyWhenOverdue: DEFAULT_BILLING_POLICY.remindDailyWhenOverdue,
        channels: DEFAULT_BILLING_POLICY.channels,
        consentRequired: DEFAULT_BILLING_POLICY.consentRequired,
        teacherReminderMinutesBefore: DEFAULT_BILLING_POLICY.teacherReminderMinutesBefore,
        cancellationApprovalRequired: DEFAULT_BILLING_POLICY.cancellationApprovalRequired,
        overdueInstallmentsForCancellation: DEFAULT_BILLING_POLICY.overdueInstallmentsForCancellation,
        breachPenaltyPercent: DEFAULT_BILLING_POLICY.breachPenaltyPercent,
        paymentNoticeToManager: DEFAULT_BILLING_POLICY.paymentNoticeToManager,
        paymentNoticeToTeacher: DEFAULT_BILLING_POLICY.paymentNoticeToTeacher,
        paymentNoticeToAdmins: DEFAULT_BILLING_POLICY.paymentNoticeToAdmins,
        updatedById: userId,
      },
    });
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
          const imageUrlRaw = optionalText(body?.imageUrl, 3_000_000, "Foto do curso");
          const imageUrl = imageUrlRaw ? courseImageUrl(imageUrlRaw, "Foto do curso") : null;
          const summary = optionalText(body?.summary, 2000, "Descrição do curso");
          // Cadastro enxuto: somente nome, foto e descrição. Valores padrão entram só no seed do segmento.
          const row = await tx.schoolCourse.create({
            data: {
              tenantId, kind, name, parentId,
              active: body?.active !== false,
              imageUrl, summary, level: null, durationLabel: null, tuitionAmountCents: null,
              createdById: userId,
            },
          });
          return { ...row, parentName: parent?.name ?? null };
        }

        if (kind === "STUDENT" || kind === "TEACHER" || kind === "RESPONSIBLE") {
          const name = text(body?.name, 120, "Nome");
          const email = optionalText(body?.email, 160, "E-mail");
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
          const phone = optionalText(body?.phone, 40, "Telefone");
          const cpf = optionalText(body?.cpf, 20, "CPF");
          const addressLine = optionalText(body?.addressLine, 300, "Endereço");
          const formation = kind === "TEACHER" ? optionalText(body?.formation, 240, "Formação") : null;
          const metadata = {
            source: typeof body?.source === "string" && body.source.trim() ? body.source.trim().slice(0, 40) : "MANUAL",
            submissionId: this.optionalUuid(body?.submissionId, "Matrícula"),
            instrument: optionalText(body?.instrument, 80, "Instrumento"),
            level: optionalText(body?.level, 80, "Nível"),
            startDate: isoDate(body?.startDate),
            weekday: optionalInteger(body?.weekday, 1, 7, "Dia da semana"),
            startTime: typeof body?.startTime === "string" && body.startTime ? classTime(body.startTime) : null,
            paymentMethod: optionalText(body?.paymentMethod, 40, "Forma de pagamento"),
          };
          return tx.schoolPerson.create({
            data: {
              tenantId, kind, name, email, phone, cpf, addressLine, formation, metadata,
              active: body?.active !== false, createdById: userId,
            },
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
          if (!courseId) throw new Error("Informe o curso do plano individual.");
          const course = await this.find(tx, "schoolCourse", { id: courseId, tenantId }, "Matéria/curso");
          const teacherId = this.optionalUuid(body?.teacherId, "Professor");
          if (!teacherId) throw new Error("Informe o professor do plano individual.");
          const teacher = await this.find(tx, "schoolPerson", { id: teacherId, tenantId, kind: "TEACHER", active: true }, "Professor");
          const roomId = this.optionalUuid(body?.roomId, "Sala");
          const room = roomId ? await this.find(tx, "schoolRoom", { id: roomId, tenantId, active: true }, "Sala") : null;
          const name = text(body?.name, 120, "Nome do plano individual");
          const weekdayValue = weekday(body?.weekday);
          const startTime = classTime(body?.startTime);
          const durationMinutes = integer(body?.durationMinutes ?? 60, 30, 240, "Duração");
          const period = body?.period === undefined || body.period === ""
            ? null
            : inList(body.period, CLASS_PERIODS, "Período do curso");
          let courseName = course.name;
          if (course.kind === "SUBJECT" && course.parentId) {
            const parent = await tx.schoolCourse.findFirst({ where: { id: course.parentId, tenantId }, select: { name: true } });
            if (parent) courseName = `${parent.name} · ${course.name}`;
          }
          const row = await tx.schoolClass.create({
            data: {
              tenantId, courseId, teacherId, roomId: room?.id ?? null, name,
              weekday: weekdayValue, startTime, durationMinutes, period,
              active: body?.active !== false, createdById: userId,
            },
          });
          return { ...row, courseName, teacherName: teacher.name, roomName: room?.name ?? null };
        }

        if (kind === "ENROLLMENT") {
          const schoolClass = await this.individualClass(tx, tenantId, body, userId);
          const classId = schoolClass.id;
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          if (!studentId) throw new Error("Informe o aluno da matrícula.");
          const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT", active: true }, "Aluno");
          const contractedSessions = integer(body?.contractedSessions, 1, 1000, "Aulas contratadas");
          const purchasedSessions = integer(body?.purchasedSessions ?? 0, 0, 1000, "Aulas adicionais");
          const tuitionAmountCents = optionalInteger(body?.tuitionAmountCents, 0, 100_000_000, "Valor mensal");
          const due = isoDate(body?.tuitionNextDueDate);
          if (tuitionAmountCents !== null && !due) throw new Error("Informe o vencimento quando houver valor mensal.");
          if (due && tuitionAmountCents === null) throw new Error("Informe o valor mensal quando houver vencimento.");
          const contractTotalCents = integer(body?.contractTotalCents, 0, 100_000_000, "Valor total do contrato");
          const tuitionCycle = body?.tuitionCycle === undefined || body.tuitionCycle === ""
            ? "MONTHLY"
            : inList(body.tuitionCycle, TUITION_CYCLES, "Ciclo de mensalidade");
          const contractPeriod = body?.contractPeriod === undefined || body.contractPeriod === ""
            ? null
            : inList(body.contractPeriod, CONTRACT_PERIODS, "Período contratual");
          const billingMode = body?.billingMode === undefined || body.billingMode === ""
            ? "STUDENT"
            : inList(body.billingMode, BILLING_MODES, "Cliente da mensalidade");
          let billingPersonId = studentId;
          if (billingMode === "GUARDIAN") {
            const requested = this.optionalUuid(body?.guardianPersonId, "Responsável pelo aluno");
            if (!requested) throw new Error("Selecione o responsável que será cliente no Asaas.");
            const guardian = await this.find(tx, "schoolPerson", { id: requested, tenantId, active: true }, "Responsável pelo aluno");
            billingPersonId = guardian.id;
          }
          const duplicate = await tx.schoolEnrollment.findFirst({ where: { tenantId, classId, studentId } });
          if (duplicate) throw new Error("Este aluno já está matriculado neste curso.");
          const row = await tx.schoolEnrollment.create({
            data: {
              tenantId, classId, studentId, contractedSessions, purchasedSessions,
              status: "ACTIVE", tuitionAmountCents, tuitionCycle,
              tuitionStatus: "SCHEDULED", tuitionNextDueDate: due ? utcDate(due) : null,
              contractTotalCents, contractPeriod, billingMode, billingPersonId,
              asaasCustomerId: null, asaasSyncStatus: "PENDING", createdById: userId,
            },
          });
          await tx.schoolGuardian.updateMany({
            where: { tenantId, studentId },
            data: { isBillingClient: billingMode === "GUARDIAN" },
          });
          if (billingMode === "GUARDIAN") {
            await tx.schoolGuardian.updateMany({
              where: { tenantId, studentId, personId: billingPersonId },
              data: { isBillingClient: true },
            });
          }
          return {
            ...row,
            className: schoolClass.name,
            studentName: student.name,
            billing: {
              mode: row.billingMode,
              personId: row.billingPersonId,
              asaasSyncStatus: row.asaasSyncStatus,
              asaasCustomerId: null,
              executed: false,
              confirmed: false,
            },
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
          const schoolClass = await this.individualClass(tx, tenantId, body, userId);
          const classId = schoolClass.id;
          const sessionDate = isoDate(body?.sessionDate);
          if (!sessionDate) throw new Error("Informe a data da aula no formato AAAA-MM-DD.");
          const status = body?.status === undefined ? "SCHEDULED" : inList(body.status, SESSION_STATUSES, "Status da aula");
          const duplicate = await tx.schoolSession.findFirst({ where: { tenantId, classId, sessionDate: utcDate(sessionDate) } });
          if (duplicate) throw new Error("Já existe aula nesta data para este aluno.");
          const row = await tx.schoolSession.create({
            data: { tenantId, classId, sessionDate: utcDate(sessionDate), status, createdById: userId },
          });
          return { ...row, className: schoolClass.name };
        }

        if (kind === "LESSON_PLAN") {
          const schoolClass = await this.individualClass(tx, tenantId, body, userId);
          const classId = schoolClass.id;
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
          const schoolClass = await this.individualClass(tx, tenantId, body, userId);
          const classId = schoolClass.id;
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          if (!studentId) throw new Error("Informe o aluno avaliado.");
          const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT" }, "Aluno");
          const enrollment = await tx.schoolEnrollment.findFirst({ where: { tenantId, classId, studentId } });
          if (!enrollment) throw new Error("Este aluno ainda não possui matrícula neste curso.");
          const title = text(body?.title, 120, "Título da avaliação");
          const evaluationDate = isoDate(body?.evaluationDate);
          if (!evaluationDate) throw new Error("Informe a data da avaliação no formato AAAA-MM-DD.");
          const maxScore = integer(body?.maxScore, 1, 1000, "Nota máxima");
          const score = integer(body?.score, 0, maxScore, "Nota");
          const note = optionalText(body?.note, 240, "Observação");
          const duplicate = await tx.schoolGrade.findFirst({ where: { tenantId, classId, studentId, title } });
          if (duplicate) throw new Error("Já existe avaliação com este título para o aluno neste plano.");
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
          const personId = this.optionalUuid(body?.personId, "Responsável cadastrado");
          let guardianPerson: any = null;
          if (personId) guardianPerson = await this.find(tx, "schoolPerson", { id: personId, tenantId, active: true }, "Responsável cadastrado");
          const name = guardianPerson?.name ?? text(body?.name, 120, "Nome do responsável");
          const relationship = body?.relationship === undefined || body.relationship === ""
            ? null
            : inList(body.relationship, RELATIONSHIPS, "Parentesco");
          const phone = guardianPerson?.phone ?? optionalText(body?.phone, 40, "Telefone");
          const email = guardianPerson?.email ?? optionalText(body?.email, 160, "E-mail");
          const isBillingClient = body?.isBillingClient === true;
          if (isBillingClient) {
            await tx.schoolGuardian.updateMany({ where: { tenantId, studentId }, data: { isBillingClient: false } });
          }
          const row = await tx.schoolGuardian.create({
            data: {
              tenantId, studentId, personId: guardianPerson?.id ?? null, name, relationship,
              phone, email, isBillingClient, createdById: userId,
            },
          });
          return { ...row, studentName: student.name, personName: guardianPerson?.name ?? null };
        }

        if (kind === "NOTICE") {
          const title = text(body?.title, 120, "Título do aviso");
          const bodyHtml = cleanRichText(body?.bodyHtml, "Texto do aviso");
          const channel = body?.channel === undefined ? "WHATSAPP" : inList(body.channel, NOTICE_CHANNELS, "Canal");
          const studentId = this.optionalUuid(body?.studentId, "Aluno");
          const classId = this.optionalUuid(body?.classId, "Plano do aluno");
          if (studentId) await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT" }, "Aluno");
          if (classId) await this.find(tx, "schoolClass", { id: classId, tenantId }, "Plano do aluno");
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
          const requestedKind = inList(body?.materialKind ?? body?.type ?? "LINK", MATERIAL_KINDS, "Tipo de material");
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

        if (kind === "LESSON_SUMMARY") {
          const session = await this.resolveSession(tx, tenantId, body, userId);
          const summaryHtml = cleanRichText(body?.summaryHtml ?? body?.bodyHtml, "Resumo da aula");
          if (!summaryHtml.trim()) throw new Error("Informe o resumo do que foi estudado na aula.");
          await tx.schoolSession.update({
            where: { id: session.id },
            data: { summaryHtml, summaryRecordedAt: new Date() },
          });
          const classRow = await this.find(tx, "schoolClass", { id: session.classId, tenantId }, "Plano do aluno");
          return {
            sessionId: session.id,
            classId: session.classId,
            className: classRow.name,
            sessionDate: session.sessionDate,
            summaryHtml,
            delivered: false,
            executed: false,
            confirmed: false,
          };
        }

        if (kind === "BILLING_POLICY") {
          const policy = await this.policyFor(tx, tenantId, userId);
          const channels = Array.isArray(body?.channels)
            ? body.channels.map((channel: unknown) => inList(channel, NOTICE_CHANNELS, "Canal"))
            : policy.channels;
          const uniqueChannels = [...new Set(channels as string[])];
          if (uniqueChannels.length === 0) throw new Error("Selecione ao menos um canal consentido.");
          const row = await tx.schoolBillingPolicy.update({
            where: { id: policy.id },
            data: {
              paymentReminderDaysBefore: body?.paymentReminderDaysBefore === undefined
                ? policy.paymentReminderDaysBefore
                : integer(body.paymentReminderDaysBefore, 0, 30, "Dias antes do vencimento"),
              remindOnDueDate: body?.remindOnDueDate === undefined ? policy.remindOnDueDate : body.remindOnDueDate === true,
              remindDailyWhenOverdue: body?.remindDailyWhenOverdue === undefined
                ? policy.remindDailyWhenOverdue
                : body.remindDailyWhenOverdue === true,
              channels: uniqueChannels,
              consentRequired: body?.consentRequired === undefined ? policy.consentRequired : body.consentRequired !== false,
              teacherReminderMinutesBefore: body?.teacherReminderMinutesBefore === undefined
                ? policy.teacherReminderMinutesBefore
                : integer(body.teacherReminderMinutesBefore, 5, 120, "Minutos antes da aula"),
              cancellationApprovalRequired: body?.cancellationApprovalRequired === undefined
                ? policy.cancellationApprovalRequired
                : body.cancellationApprovalRequired !== false,
              overdueInstallmentsForCancellation: body?.overdueInstallmentsForCancellation === undefined
                ? policy.overdueInstallmentsForCancellation
                : integer(body.overdueInstallmentsForCancellation, 1, 12, "Mensalidades em atraso"),
              breachPenaltyPercent: body?.breachPenaltyPercent === undefined
                ? policy.breachPenaltyPercent
                : integer(body.breachPenaltyPercent, 0, 100, "Percentual da multa"),
              paymentNoticeToManager: body?.paymentNoticeToManager === undefined
                ? policy.paymentNoticeToManager
                : body.paymentNoticeToManager !== false,
              paymentNoticeToTeacher: body?.paymentNoticeToTeacher === undefined
                ? policy.paymentNoticeToTeacher
                : body.paymentNoticeToTeacher !== false,
              paymentNoticeToAdmins: body?.paymentNoticeToAdmins === undefined
                ? policy.paymentNoticeToAdmins
                : body.paymentNoticeToAdmins !== false,
              updatedById: userId,
            },
          });
          return { ...row, executed: false, confirmed: false, dispatched: false };
        }

        if (kind === "PAYMENT_RECEIPT") {
          const enrollmentId = this.optionalUuid(body?.enrollmentId, "Matrícula");
          if (!enrollmentId) throw new Error("Informe a matrícula.");
          const enrollment = await this.find(tx, "schoolEnrollment", { id: enrollmentId, tenantId }, "Matrícula");
          const amountCents = integer(body?.amountCents, 1, 100_000_000, "Valor recebido");
          const paidAt = isoDate(body?.paidAt);
          if (!paidAt) throw new Error("Informe a data do recebimento no formato AAAA-MM-DD.");
          const source = body?.source === undefined ? "CASH" : inList(body.source, PAYMENT_RECEIPT_SOURCES, "Origem");
          const externalReference = optionalText(body?.externalReference, 160, "Referência externa");
          if (source === "PROVIDER_CONFIRMED" && !externalReference) {
            throw new Error("Confirmacao de provedor exige referencia externa.");
          }
          const periodKey = billingPeriodKey(paidAt, enrollment.tuitionCycle ?? "MONTHLY");
          if (!periodKey) throw new Error("Ciclo de mensalidade inválido.");
          const duplicate = await tx.schoolPaymentReceipt.findFirst({
            where: { tenantId, enrollmentId, periodKey, source, amountCents },
          });
          if (duplicate) throw new Error("Este recebimento já foi registrado para o período.");
          const row = await tx.schoolPaymentReceipt.create({
            data: {
              tenantId, enrollmentId, amountCents, paidAt: utcDate(paidAt), periodKey, source,
              externalReference, notes: optionalText(body?.notes, 240, "Observação"), recordedById: userId,
            },
          });
          const receipts = await tx.schoolPaymentReceipt.findMany({
            where: { tenantId, enrollmentId }, select: { amountCents: true }, take: 1000,
          });
          const paidCents = receipts.reduce((sum: number, item: any) => sum + Number(item.amountCents), 0);
          const policy = await this.policyFor(tx, tenantId, userId);
          const penaltyCents = penaltyForBreach(enrollment.contractTotalCents, paidCents, policy.breachPenaltyPercent);
          const suppressedOverdue = Math.max(0, Number(enrollment.overdueInstallments) - 1);
          await tx.schoolEnrollment.update({
            where: { id: enrollment.id },
            data: { overdueInstallments: suppressedOverdue, penaltyCents: penaltyCents ?? 0 },
          });
          return {
            ...row,
            paidCents,
            penaltyCents,
            suppressesChargeForPeriod: true,
            providerConfirmed: source === "PROVIDER_CONFIRMED",
            notified: false,
            executed: false,
            confirmed: source === "PROVIDER_CONFIRMED",
          };
        }

        if (kind === "MARK_OVERDUE") {
          const enrollmentId = this.optionalUuid(body?.enrollmentId, "Matrícula");
          if (!enrollmentId) throw new Error("Informe a matrícula.");
          const enrollment = await this.find(tx, "schoolEnrollment", { id: enrollmentId, tenantId }, "Matrícula");
          const policy = await this.policyFor(tx, tenantId, userId);
          const overdueInstallments = Math.min(100, Number(enrollment.overdueInstallments) + 1);
          const reachedLimit = overdueInstallments >= policy.overdueInstallmentsForCancellation;
          const alreadyApproved = enrollment.cancellationStatus === "APPROVED";
          const autoCancel = reachedLimit && !policy.cancellationApprovalRequired;
          let status = enrollment.cancellationStatus;
          let enrollmentStatus = enrollment.status;
          let penaltyCents = Number(enrollment.penaltyCents);
          if (alreadyApproved) {
            status = "APPROVED";
            enrollmentStatus = "SUSPENDED";
          } else if (autoCancel) {
            status = "APPROVED";
            enrollmentStatus = "SUSPENDED";
            const receipts = await tx.schoolPaymentReceipt.findMany({
              where: { tenantId, enrollmentId }, select: { amountCents: true }, take: 1000,
            });
            const paidCents = receipts.reduce((sum: number, item: any) => sum + Number(item.amountCents), 0);
            const penalty = penaltyForBreach(enrollment.contractTotalCents, paidCents, policy.breachPenaltyPercent);
            penaltyCents = penalty ?? 0;
          } else if (reachedLimit && policy.cancellationApprovalRequired) {
            status = "SUGGESTED";
          }
          await tx.schoolEnrollment.update({
            where: { id: enrollment.id },
            data: { overdueInstallments, cancellationStatus: status, status: enrollmentStatus, penaltyCents },
          });
          return {
            enrollmentId: enrollment.id,
            overdueInstallments,
            cancellationStatus: status,
            status: enrollmentStatus,
            automaticCancel: autoCancel,
            approvedByManagerRequired: policy.cancellationApprovalRequired,
            cancelled: autoCancel || alreadyApproved,
            executed: false,
            penaltyCents,
          };
        }

        if (kind === "CANCELLATION_DECISION") {
          const enrollmentId = this.optionalUuid(body?.enrollmentId, "Matrícula");
          if (!enrollmentId) throw new Error("Informe a matrícula.");
          const enrollment = await this.find(tx, "schoolEnrollment", { id: enrollmentId, tenantId }, "Matrícula");
          const decision = inList(body?.decision, CANCELLATION_DECISIONS, "Decisão");
          if (enrollment.cancellationStatus !== "SUGGESTED") {
            throw new Error("Só é possível decidir sobre um cancelamento sugerido.");
          }
          const policy = await this.policyFor(tx, tenantId, userId);
          if (policy.cancellationApprovalRequired && decision === "APPROVE" && !isManager(role)) {
            throw new ForbiddenException("Somente responsáveis pela empresa podem aprovar o cancelamento.");
          }
          const receipts = await tx.schoolPaymentReceipt.findMany({
            where: { tenantId, enrollmentId }, select: { amountCents: true }, take: 1000,
          });
          const paidCents = receipts.reduce((sum: number, item: any) => sum + Number(item.amountCents), 0);
          const penaltyCents = penaltyForBreach(enrollment.contractTotalCents, paidCents, policy.breachPenaltyPercent);
          const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
          await tx.schoolEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: decision === "APPROVE" ? "SUSPENDED" : "ACTIVE",
              cancellationStatus: nextStatus,
              penaltyCents: penaltyCents ?? enrollment.penaltyCents,
            },
          });
          return {
            enrollmentId: enrollment.id,
            decision,
            cancellationStatus: nextStatus,
            penaltyCents,
            inadimplente: decision === "APPROVE",
            confirmedByManager: isManager(role),
            executed: false,
          };
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
    if (body?.paired === true) return this.recordPairedAttendance(body, tenantId, userId);
    try {
      const personKind = inList(body?.personKind, ATTENDANCE_PERSON_KINDS, "Tipo de pessoa");
      const personId = this.optionalUuid(body?.personId, "Pessoa");
      if (!personId) throw new Error("Informe a pessoa da presença.");
      const status = inList(body?.status, ATTENDANCE_STATUSES, "Status de presença");
      const note = optionalText(body?.note, 240, "Observação");
      return await this.prisma.$transaction(async (tx: any) => {
        await this.lockTenant(tx, tenantId);
        const session = await this.resolveSession(tx, tenantId, body, userId);
        const person = await this.find(tx, "schoolPerson", { id: personId, tenantId, kind: personKind, active: true }, "Pessoa");
        let enrollmentId: string | null = null;
        if (personKind === "STUDENT") {
          const enrollment = await tx.schoolEnrollment.findFirst({ where: { tenantId, classId: session.classId, studentId: personId } });
          if (!enrollment) throw new Error("Este aluno ainda não possui matrícula neste curso.");
          enrollmentId = enrollment.id;
        } else {
          const schoolClass = await this.find(tx, "schoolClass", { id: session.classId, tenantId }, "Plano do aluno");
          if (schoolClass.teacherId !== personId) throw new Error("Este professor não leciona neste plano.");
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

  /** Registra aluno e professor da mesma aula em uma única transação tenant-scoped. */
  async recordPairedAttendance(body: Record<string, unknown>, tenantId: string, userId: string) {
    try {
      const studentId = this.optionalUuid(body?.studentId, "Aluno");
      const teacherId = this.optionalUuid(body?.teacherId, "Professor");
      if (!studentId || !teacherId) throw new Error("Informe aluno e professor da aula.");
      const studentStatus = inList(body?.studentStatus ?? body?.status, ATTENDANCE_STATUSES, "Status do aluno");
      const teacherStatus = inList(body?.teacherStatus ?? body?.status, ATTENDANCE_STATUSES, "Status do professor");
      return await this.prisma.$transaction(async (tx: any) => {
        await this.lockTenant(tx, tenantId);
        const session = await this.resolveSession(tx, tenantId, body, userId);
        const student = await this.find(tx, "schoolPerson", { id: studentId, tenantId, kind: "STUDENT", active: true }, "Aluno");
        const teacher = await this.find(tx, "schoolPerson", { id: teacherId, tenantId, kind: "TEACHER", active: true }, "Professor");
        const schoolClass = await this.find(tx, "schoolClass", { id: session.classId, tenantId }, "Plano do aluno");
        if (schoolClass.teacherId !== teacherId) throw new Error("Este professor não leciona neste plano.");
        const enrollment = await this.find(tx, "schoolEnrollment", { tenantId, classId: session.classId, studentId }, "Matrícula");
        const records: any[] = [];
        for (const entry of [
          { personKind: "STUDENT", personId: studentId, status: studentStatus },
          { personKind: "TEACHER", personId: teacherId, status: teacherStatus },
        ]) {
          const duplicate = await tx.schoolAttendance.findFirst({
            where: { tenantId, sessionId: session.id, personKind: entry.personKind, personId: entry.personId },
          });
          if (duplicate) throw new Error("Já existe presença registrada para esta pessoa nesta aula.");
          records.push(await tx.schoolAttendance.create({
            data: {
              tenantId, sessionId: session.id, personId: entry.personId,
              personKind: entry.personKind, status: entry.status,
              note: optionalText(body?.note, 240, "Observação"), recordedById: userId,
            },
          }));
        }
        if (session.status === "SCHEDULED" && studentStatus !== "CANCELLED" && teacherStatus !== "CANCELLED") {
          await tx.schoolSession.update({ where: { id: session.id }, data: { status: "HELD" } });
        }
        return {
          records,
          sessionId: session.id,
          classId: session.classId,
          studentName: student.name,
          teacherName: teacher.name,
          balance: await this.balanceFor(tx, tenantId, enrollment.id),
        };
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  /** Cadastra no tenant os cursos iniciais do segmento, sem sobrescrever o catálogo existente.
   * Idempotente: cursos com o mesmo nome permanecem como estão. Nenhuma ação externa é executada.
   */
  async seedDefaultCourses(tenantId: string, role: string, userId: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela empresa podem gerenciar a escola.");
    const defaults = musicSchoolDefaultCourses();
    return this.prisma.$transaction(async (tx: any) => {
      await this.lockTenant(tx, tenantId);
      let created = 0;
      for (const item of defaults) {
        const existing = await tx.schoolCourse.findFirst({
          where: { tenantId, kind: item.kind, name: item.name },
        });
        if (existing) continue;
        await tx.schoolCourse.create({
          data: {
            tenantId,
            kind: item.kind,
            name: item.name,
            active: true,
            level: item.level,
            durationLabel: item.durationLabel,
            tuitionAmountCents: item.tuitionAmountCents,
            imageUrl: item.imageUrl,
            summary: item.summary,
            createdById: userId,
          },
        });
        created += 1;
      }
      const stored = await tx.schoolCourse.findMany({
        where: { tenantId, kind: "COURSE" },
        orderBy: { name: "asc" },
        take: 100,
      });
      const ordered = defaults
        .map((item) => stored.find((course) => course.name === item.name))
        .filter((course): course is (typeof stored)[number] => Boolean(course));
      return { created, total: defaults.length, courses: ordered.length ? ordered : stored };
    });
  }
}
