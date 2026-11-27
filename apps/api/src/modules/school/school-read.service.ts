import { Injectable } from "@nestjs/common";
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

/** Leituras da gestão escolar: toda consulta começa pelo tenant da sessão. */
@Injectable()
export class SchoolReadService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(tenantId: string) {
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
      this.prisma.schoolCourse.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }),
      this.prisma.schoolPerson.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }),
      this.prisma.schoolRoom.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 200 }),
      this.prisma.schoolClass.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }),
      this.prisma.schoolEnrollment.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.schoolSession.findMany({ where: { tenantId }, orderBy: { sessionDate: "desc" }, take: 500 }),
      this.prisma.schoolAttendance.findMany({ where: { tenantId }, orderBy: { recordedAt: "desc" }, take: 1000 }),
      this.prisma.schoolLessonPlan.findMany({ where: { tenantId }, orderBy: [{ classId: "asc" }, { version: "desc" }], take: 500 }),
      this.prisma.schoolGrade.findMany({ where: { tenantId }, orderBy: { evaluationDate: "desc" }, take: 500 }),
      this.prisma.schoolGuardian.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 500 }),
      this.prisma.schoolNotice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.schoolMaterial.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.schoolBillingPolicy.findMany({ where: { tenantId }, take: 5 }),
      this.prisma.schoolPaymentReceipt.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 500 }),
    ]);

    const storedPolicy = billingPolicies[0] ?? null;
    const policy = storedPolicy
      ? { ...DEFAULT_BILLING_POLICY, ...storedPolicy, channels: Array.isArray(storedPolicy.channels) ? storedPolicy.channels : DEFAULT_BILLING_POLICY.channels }
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

    return {
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
      billingPolicy: policy,
      paymentReceipts,
      balances,
      stats: attendanceStats(attendances as AttendanceLike[]),
    };
  }
}
