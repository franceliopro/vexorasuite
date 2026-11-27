import fs from "node:fs";
import path from "node:path";
import { SchoolService } from "./school.service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const PARENT = "44444444-4444-4444-8444-444444444444";
const SUBJECT = "55555555-5555-4555-8555-555555555555";
const TEACHER = "66666666-6666-4666-8666-666666666666";
const OTHER_TEACHER = "66666666-6666-4666-8666-666666666667";
const STUDENT = "77777777-7777-4777-8777-777777777777";
const ROOM = "88888888-8888-4888-8888-888888888888";
const CLASS = "99999999-9999-4999-8999-999999999999";
const ENROLL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW_COURSE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NEW_PLAN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, value]) => {
    if (value instanceof Date) return new Date(row[key]).getTime() === value.getTime();
    if (value && typeof value === "object" && "in" in (value as any)) {
      return (value as any).in.includes(row[key]);
    }
    return row[key] === value;
  });
}

function fixture() {
  const state: any = {
    locks: [],
    courses: [
      { id: PARENT, tenantId: TENANT, kind: "COURSE", name: "Música", parentId: null, active: true },
      { id: SUBJECT, tenantId: TENANT, kind: "SUBJECT", name: "Piano", parentId: PARENT, active: true },
    ],
    people: [
      { id: TEACHER, tenantId: TENANT, kind: "TEACHER", name: "Ana", active: true },
      { id: OTHER_TEACHER, tenantId: TENANT, kind: "TEACHER", name: "Bia", active: true },
      { id: STUDENT, tenantId: TENANT, kind: "STUDENT", name: "João", active: true },
    ],
    rooms: [{ id: ROOM, tenantId: TENANT, name: "Sala 1", capacity: 20, active: true }],
    classes: [{ id: CLASS, tenantId: TENANT, courseId: SUBJECT, teacherId: TEACHER, roomId: ROOM, name: "Piano I", weekday: 3, startTime: "18:00", durationMinutes: 60, active: true }],
    enrollments: [],
    sessions: [],
    attendances: [],
    lessonPlans: [],
    materials: [],
  };
  const tx: any = {
    $queryRaw: jest.fn(async (_strings: unknown, ...values: unknown[]) => {
      state.locks.push(String(values[0]));
      return [];
    }),
    schoolCourse: {
      findFirst: jest.fn(async ({ where }: any) => state.courses.find((row: any) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: NEW_COURSE, ...data };
        state.courses.push(row);
        return row;
      }),
    },
    schoolPerson: {
      findFirst: jest.fn(async ({ where }: any) => state.people.find((row: any) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: NEW_COURSE, ...data })),
    },
    schoolRoom: {
      findFirst: jest.fn(async ({ where }: any) => state.rooms.find((row: any) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: ROOM, ...data })),
    },
    schoolClass: {
      findFirst: jest.fn(async ({ where }: any) => state.classes.find((row: any) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: CLASS, ...data })),
    },
    schoolEnrollment: {
      findFirst: jest.fn(async ({ where }: any) => state.enrollments.find((row: any) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: ENROLL, ...data };
        state.enrollments.push(row);
        return row;
      }),
    },
    schoolSession: {
      findFirst: jest.fn(async ({ where }: any) => state.sessions.find((row: any) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: SESSION, ...data };
        state.sessions.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = state.sessions.find((item: any) => item.id === where.id);
        if (row) Object.assign(row, data);
        return row ?? null;
      }),
    },
    schoolAttendance: {
      findFirst: jest.fn(async ({ where }: any) => state.attendances.find((row: any) => matches(row, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) => state.attendances.filter((row: any) =>
        matches(row, {
          tenantId: where.tenantId,
          personKind: where.personKind,
          personId: where.personId,
          ...(where.sessionId ? { sessionId: where.sessionId } : {}),
        }) && (!where.status?.in || where.status.in.includes(row.status)),
      )),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: NEW_PLAN, ...data };
        state.attendances.push(row);
        return row;
      }),
    },
    schoolLessonPlan: {
      findFirst: jest.fn(async ({ where }: any) =>
        state.lessonPlans.filter((row: any) => matches(row, where)).sort((a: any, b: any) => b.version - a.version)[0] ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: NEW_PLAN, ...data };
        state.lessonPlans.push(row);
        return row;
      }),
    },
    schoolMaterial: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: NEW_PLAN, ...data };
        state.materials.push(row);
        return row;
      }),
    },
    schoolGrade: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: NEW_COURSE, ...data })),
    },
    schoolGuardian: { create: jest.fn(async ({ data }: any) => ({ id: NEW_COURSE, ...data })) },
    schoolNotice: { create: jest.fn(async ({ data }: any) => ({ id: NEW_COURSE, ...data })) },
  };
  let queue: Promise<unknown> = Promise.resolve();
  const prisma: any = {
    $transaction: (fn: any) => {
      const running = queue.then(() => fn(tx));
      queue = running.then(() => undefined, () => undefined);
      return running;
    },
  };
  return { service: new SchoolService(prisma), tx, state };
}

const enrollmentBody = () => ({
  kind: "ENROLLMENT",
  classId: CLASS,
  studentId: STUDENT,
  contractedSessions: 8,
  purchasedSessions: 2,
  tuitionAmountCents: 9900,
  tuitionNextDueDate: "2026-12-05",
});

describe("Gestão escolar — escrita tenant-scoped", () => {
  it("recusa atendente em toda mutação", async () => {
    const { service } = fixture();
    await expect(service.createRecord({ kind: "COURSE", name: "Violão" }, TENANT, "AGENT", USER)).rejects.toThrow("responsáveis");
    await expect(service.recordAttendance({ sessionId: SESSION, personKind: "STUDENT", personId: STUDENT, status: "PRESENT" }, TENANT, "AGENT", USER)).rejects.toThrow("responsáveis");
  });

  it("cadastra matéria apenas com curso do mesmo tenant", async () => {
    const { service } = fixture();
    const created = await service.createRecord({ kind: "SUBJECT", name: "Violão", parentId: PARENT }, TENANT, "OWNER", USER);
    expect(created).toMatchObject({ tenantId: TENANT, kind: "SUBJECT", parentId: PARENT, parentName: "Música", createdById: USER });
    await expect(service.createRecord({ kind: "SUBJECT", name: "Erro", parentId: PARENT }, OTHER, "OWNER", USER)).rejects.toThrow("Curso não encontrado");
    await expect(service.createRecord({ kind: "SUBJECT", name: "Erro", parentId: SUBJECT }, TENANT, "OWNER", USER)).rejects.toThrow("Curso não encontrado");
  });

  it("matricula aluno do tenant e mantém mensalidade apenas agendada", async () => {
    const { service } = fixture();
    await expect(service.createRecord(enrollmentBody(), OTHER, "OWNER", USER)).rejects.toThrow("Turma não encontrada");
    await expect(service.createRecord({ ...enrollmentBody(), tuitionNextDueDate: undefined }, TENANT, "OWNER", USER)).rejects.toThrow("vencimento");
    await expect(service.createRecord({ ...enrollmentBody(), tuitionAmountCents: undefined }, TENANT, "OWNER", USER)).rejects.toThrow("valor mensal");
    const row = await service.createRecord(enrollmentBody(), TENANT, "MANAGER", USER);
    expect(row).toMatchObject({
      tenantId: TENANT,
      classId: CLASS,
      studentId: STUDENT,
      studentName: "João",
      tuition: { status: "SCHEDULED", amountCents: 9900, executed: false, confirmed: false },
    });
  });

  it("trava o tenant e rejeita matrícula duplicada em requisições concorrentes", async () => {
    const { service, state } = fixture();
    const results = await Promise.allSettled([
      service.createRecord(enrollmentBody(), TENANT, "OWNER", USER),
      service.createRecord(enrollmentBody(), TENANT, "OWNER", USER),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toMatch(/já está matriculado/);
    expect(state.enrollments).toHaveLength(1);
    expect(state.locks).toEqual([TENANT, TENANT]);
  });

  it("versiona plano de aula, sanitiza richtext e aceita somente embed do YouTube", async () => {
    const { service, state, tx } = fixture();
    const body = {
      kind: "LESSON_PLAN",
      classId: CLASS,
      title: "Escala maior",
      objectiveHtml: '<p>Objetivo</p><iframe src="https://www.youtube.com/embed/abc123DEF"></iframe><iframe src="https://evil.example.com"></iframe><script>alert(1)</script>',
      contentHtml: "<p>Conteúdo</p>",
      activitiesHtml: "<p>Prática</p>",
      observationsHtml: "",
      materials: ["https://example.com/material.pdf", "https://youtu.be/abc123DEF"],
    };
    const first = await service.createRecord(body, TENANT, "OWNER", USER);
    expect(first).toMatchObject({ tenantId: TENANT, classId: CLASS, version: 1, embeddedVideos: 1 });
    expect(first.objectiveHtml).toContain("youtube-nocookie.com/embed/abc123DEF");
    expect(first.objectiveHtml).not.toContain("evil.example.com");
    expect(first.objectiveHtml).not.toContain("<script");
    expect(state.materials).toHaveLength(2);
    expect(state.materials.some((row: any) => row.kind === "YOUTUBE")).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalled();
    const second = await service.createRecord({ ...body, title: "Versão revisada" }, TENANT, "OWNER", USER);
    expect(second.version).toBe(2);
  });

  it("registra presença de aluno e professor na mesma aula e recalcula saldo", async () => {
    const { service, state, tx } = fixture();
    await service.createRecord(enrollmentBody(), TENANT, "OWNER", USER);
    const student = await service.recordAttendance({
      classId: CLASS, sessionDate: "2026-11-27", personKind: "STUDENT", personId: STUDENT, status: "PRESENT", note: "Compareceu",
    }, TENANT, "OWNER", USER);
    expect(student.record).toMatchObject({ tenantId: TENANT, sessionId: SESSION, personKind: "STUDENT", personId: STUDENT, status: "PRESENT", recordedById: USER });
    expect(student.balance).toMatchObject({ contracted: 10, consumed: 1, balance: 9 });
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].status).toBe("HELD");
    const teacher = await service.recordAttendance({ sessionId: SESSION, personKind: "TEACHER", personId: TEACHER, status: "PRESENT" }, TENANT, "OWNER", USER);
    expect(teacher.record).toMatchObject({ personKind: "TEACHER", personId: TEACHER, status: "PRESENT", balance: null });
    await expect(service.recordAttendance({ sessionId: SESSION, personKind: "STUDENT", personId: STUDENT, status: "ABSENT" }, TENANT, "OWNER", USER)).rejects.toThrow("Já existe presença");
    await expect(service.recordAttendance({ sessionId: SESSION, personKind: "TEACHER", personId: OTHER_TEACHER, status: "PRESENT" }, TENANT, "OWNER", USER)).rejects.toThrow("não leciona");
    await expect(service.recordAttendance({ sessionId: SESSION, personKind: "STUDENT", personId: STUDENT, status: "PRESENT" }, OTHER, "OWNER", USER)).rejects.toThrow("Aula não encontrado");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
  });
});

describe("Gestão escolar — contrato da migração", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261127110000_school_management/migration.sql"),
    "utf8",
  );

  it("isolas as doze tabelas por tenant com chave estrangeira cascata", () => {
    for (const table of [
      "school_courses", "school_people", "school_rooms", "school_classes", "school_enrollments", "school_sessions",
      "school_attendances", "school_lesson_plans", "school_grades", "school_guardians", "school_notices", "school_materials",
    ]) {
      const block = sql.match(new RegExp(`CREATE TABLE "${table}"[\\s\\S]*?\\);`))?.[0] ?? "";
      expect(block).toMatch(/"tenant_id" UUID NOT NULL REFERENCES "tenants"\("id"\) ON DELETE CASCADE/);
    }
  });

  it("garante unicidade no banco e mantém estados honestos", () => {
    expect(sql).toMatch(/UNIQUE \("tenant_id", "class_id", "student_id"\)/);
    expect(sql).toMatch(/UNIQUE \("tenant_id", "session_id", "person_kind", "person_id"\)/);
    expect(sql).toMatch(/UNIQUE \("tenant_id", "class_id", "version"\)/);
    expect(sql).toMatch(/tuition_status" TEXT NOT NULL DEFAULT 'SCHEDULED'/);
    expect(sql).toMatch(/status" TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK \("status" IN \('SCHEDULED'\)\)/);
    expect(sql).toMatch(/Nenhum envio é executado/);
  });
});
