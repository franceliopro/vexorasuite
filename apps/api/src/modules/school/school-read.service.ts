import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { attendanceStats, AttendanceLike, balanceOf } from "./school-rules";

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
    ]);

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
      return {
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        studentId: enrollment.studentId,
        status: enrollment.status,
        tuition: {
          status: enrollment.tuitionStatus,
          amountCents: enrollment.tuitionAmountCents,
          nextDueDate: enrollment.tuitionNextDueDate,
          executed: false,
          confirmed: false,
        },
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
      balances,
      stats: attendanceStats(attendances as AttendanceLike[]),
    };
  }
}
