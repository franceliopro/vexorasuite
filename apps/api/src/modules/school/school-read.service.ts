import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  DEFAULT_BILLING_POLICY,
  attendanceStats,
  AttendanceLike,
  balanceOf,
  paymentReminderOccurrences,
  penaltyForBreach,
  teacherReminderAt,
} from "./school-rules";
import { musicSchoolDefaultCourses } from "./music-school-defaults";

/** Leituras da gestão escolar: toda consulta começa pelo tenant da sessão. */
@Injectable()
export class SchoolReadService {
  private readonly logger = new Logger(SchoolReadService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Uma tabela pendente de migration não pode derrubar o snapshot inteiro.
   * A falha é registrada e devolvida como aviso explícito, nunca como sucesso silencioso.
   */
  private async safe<T>(label: string, query: () => Promise<T>, fallback: T, warnings: string[]): Promise<T> {
    try {
      return await query();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "erro desconhecido";
      this.logger.warn(`school/snapshot: ${label} indisponível (${detail}).`);
      warnings.push(`${label} indisponível nesta instalação.`);
      return fallback;
    }
  }

  async snapshot(tenantId: string) {
    const warnings: string[] = [];
    const [
      courses,
      people,
      rooms,
      classes,
      enrollments,
      sessions,
      attendances,
      lessonPlans,
      grades,
      guardians,
      notices,
      materials,
      billingPolicies,
      paymentReceipts,
    ] = await Promise.all([
      this.safe("Cursos", () => this.prisma.schoolCourse.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }), [], warnings),
      this.safe("Pessoas", () => this.prisma.schoolPerson.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }), [], warnings),
      this.safe("Salas", () => this.prisma.schoolRoom.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 200 }), [], warnings),
      this.safe("Planos individuais", () => this.prisma.schoolClass.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }), [], warnings),
      this.safe("Matrículas", () => this.prisma.schoolEnrollment.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }), [], warnings),
      this.safe("Aulas", () => this.prisma.schoolSession.findMany({ where: { tenantId }, orderBy: { sessionDate: "desc" }, take: 500 }), [], warnings),
      this.safe("Presenças", () => this.prisma.schoolAttendance.findMany({ where: { tenantId }, orderBy: { recordedAt: "desc" }, take: 1000 }), [], warnings),
      this.safe("Resumos", () => this.prisma.schoolLessonPlan.findMany({ where: { tenantId }, orderBy: [{ classId: "asc" }, { version: "desc" }], take: 500 }), [], warnings),
      this.safe("Avaliações", () => this.prisma.schoolGrade.findMany({ where: { tenantId }, orderBy: { evaluationDate: "desc" }, take: 500 }), [], warnings),
      this.safe("Responsáveis", () => this.prisma.schoolGuardian.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }), [], warnings),
      this.safe("Avisos", () => this.prisma.schoolNotice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }), [], warnings),
      this.safe("Materiais", () => this.prisma.schoolMaterial.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }), [], warnings),
      this.safe("Política de cobrança", () => this.prisma.schoolBillingPolicy.findMany({ where: { tenantId }, take: 5 }), [], warnings),
      this.safe("Recebimentos", () => this.prisma.schoolPaymentReceipt.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }), [], warnings),
    ]);

    const storedPolicy = billingPolicies[0] ?? null;
    const policy = storedPolicy
      ? {
          ...DEFAULT_BILLING_POLICY,
          ...storedPolicy,
          channels: Array.isArray(storedPolicy.channels)
            ? storedPolicy.channels.filter((channel): channel is string => typeof channel === "string")
            : DEFAULT_BILLING_POLICY.channels,
        }
      : DEFAULT_BILLING_POLICY;
    const heldDates = new Set(
      sessions.filter((session) => session.status === "HELD").map((session) => `${session.classId}:${session.sessionDate.toISOString().slice(0, 10)}`),
    );
    const sessionClass = new Map(sessions.map((session) => [session.id, session.classId]));
    const balances = enrollments.map((enrollment) => {
      const own = attendances.filter((record) =>
        record.personKind === "STUDENT" &&
        record.personId === enrollment.studentId &&
        sessionClass.get(record.sessionId) === enrollment.classId,
      );
      const teacherEvents = attendances
        .filter((record) =>
          record.personKind === "TEACHER" &&
          sessionClass.get(record.sessionId) === enrollment.classId &&
          (record.status === "ABSENT" || record.status === "CANCELLED"),
        )
        .map(() => "CANCELLED");
      const balance = balanceOf(enrollment.contractedSessions, enrollment.purchasedSessions, [
        ...own.map((record) => record.status),
        ...teacherEvents,
      ]);
      const ownReceipts = paymentReceipts.filter((receipt) => receipt.enrollmentId === enrollment.id);
      const paidCents = ownReceipts.reduce((sum, receipt) => sum + Number(receipt.amountCents), 0);
      const dueDate = enrollment.tuitionNextDueDate?.toISOString().slice(0, 10) ?? null;
      const reminderDates = dueDate
        ? paymentReminderOccurrences(dueDate, policy).slice(0, 30)
        : [];
      const classSessions = sessions.filter((session) => session.classId === enrollment.classId);
      const teacherReminders = classSessions
        .filter((session) => session.status === "SCHEDULED")
        .slice(0, 20)
        .map((session) => ({
          sessionId: session.id,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          remindAt: teacherReminderAt(
            session.sessionDate.toISOString().slice(0, 10),
            classes.find((item) => item.id === session.classId)?.startTime ?? "00:00",
            policy.teacherReminderMinutesBefore,
          ),
          sent: false,
        }));
      return {
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        studentId: enrollment.studentId,
        status: enrollment.status,
        period: enrollment.contractPeriod ?? classes.find((item) => item.id === enrollment.classId)?.period ?? null,
        contractPeriod: enrollment.contractPeriod,
        billing: {
          mode: enrollment.billingMode,
          personId: enrollment.billingPersonId,
          asaasCustomerId: enrollment.asaasCustomerId,
          asaasSyncStatus: enrollment.asaasSyncStatus,
          executed: false,
          confirmed: false,
        },
        tuition: {
          status: enrollment.tuitionStatus,
          cycle: enrollment.tuitionCycle,
          amountCents: enrollment.tuitionAmountCents,
          nextDueDate: enrollment.tuitionNextDueDate,
          executed: false,
          confirmed: false,
        },
        contractTotalCents: enrollment.contractTotalCents,
        paidCents,
        countedDays: [...heldDates].filter((key) => key.startsWith(`${enrollment.classId}:`)).length,
        overdueInstallments: enrollment.overdueInstallments,
        cancellationStatus: enrollment.cancellationStatus,
        penaltyCents: penaltyForBreach(enrollment.contractTotalCents, paidCents, policy.breachPenaltyPercent),
        reminders: {
          payment: reminderDates,
          teacher: teacherReminders,
          consentRequired: policy.consentRequired,
          channels: policy.channels,
          executed: false,
          confirmed: false,
        },
        paymentNotifications: {
          toStudent: ownReceipts.length > 0,
          toManager: ownReceipts.length > 0 && policy.paymentNoticeToManager,
          toAdmins: ownReceipts.length > 0 && policy.paymentNoticeToAdmins,
          sent: false,
        },
        receipts: ownReceipts,
        ...balance,
      };
    });

    const defaults = musicSchoolDefaultCourses();
    const order = new Map<string, number>(defaults.map((course, index) => [course.name, index]));
    const orderedCourses = [...courses].sort((left, right) => {
      const a = order.get(left.name) ?? Number.MAX_SAFE_INTEGER;
      const b = order.get(right.name) ?? Number.MAX_SAFE_INTEGER;
      return a === b ? left.name.localeCompare(right.name, "pt-BR") : a - b;
    });

    return {
      courses: orderedCourses,
      defaultCourses: defaults,
      people,
      rooms,
      classes,
      enrollments,
      sessions,
      attendances,
      lessonPlans,
      grades,
      guardians,
      notices,
      materials,
      billingPolicy: policy,
      paymentReceipts,
      balances,
      stats: attendanceStats(attendances as AttendanceLike[]),
      warnings,
    };
  }

  /** Cursos padrão de referência para o segmento Escola de Música e Instrumentos.
   * O dono da escola cadastra os cursos que realmente oferece; esta lista é apenas sugestão inicial.
   */
  defaultCourses() {
    return musicSchoolDefaultCourses();
  }
}
