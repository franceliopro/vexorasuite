import fs from "node:fs";
import path from "node:path";
import { MusicSchoolService } from "./music-school.service";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const DEPT = "44444444-4444-4444-8444-444444444444";
const CLASS = "55555555-5555-4555-8555-555555555555";
const CONTACT = "66666666-6666-4666-8666-666666666666";
const ENROLL = "77777777-7777-4777-8777-777777777777";
const ATTEND = "88888888-8888-4888-8888-888888888888";

function fixture() {
  const state: { enrollments: any[]; attendances: any[]; locks: string[] } = {
    enrollments: [],
    attendances: [],
    locks: [],
  };
  const tx: any = {
    $queryRaw: jest.fn(async (_strings: unknown, ...values: unknown[]) => {
      state.locks.push(String(values[0]));
      return [];
    }),
    musicEnrollment: {
      findFirst: jest.fn(async ({ where }: any) =>
        state.enrollments.find((row) =>
          row.tenantId === where.tenantId && row.classId === where.classId && row.contactId === where.contactId,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: ENROLL, ...data };
        state.enrollments.push(row);
        return row;
      }),
    },
    musicAttendance: {
      findFirst: jest.fn(async ({ where }: any) =>
        state.attendances.find((row) =>
          row.tenantId === where.tenantId && row.enrollmentId === where.enrollmentId &&
          row.sessionDate.getTime() === where.sessionDate.getTime(),
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: ATTEND, ...data };
        state.attendances.push(row);
        return row;
      }),
    },
  };
  // O banco serializa as transações com SELECT ... FOR UPDATE; o mock precisa
  // fazer o mesmo, ou duas matrículas concorrentes passariam pela checagem.
  let transactions: Promise<unknown> = Promise.resolve();
  const prisma: any = {
    $transaction: (fn: any) => {
      const running: Promise<unknown> = transactions.then(() => fn(tx));
      transactions = running.then(() => undefined, () => undefined);
      return running;
    },
    department: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.tenantId === TENANT && where.id === DEPT ? { id: DEPT, name: "Piano" } : null,
      ),
    },
    musicClass: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.tenantId === TENANT && where.id === CLASS ? { id: CLASS, name: "Piano I" } : null,
      ),
      create: jest.fn(async ({ data }: any) => ({ id: CLASS, ...data })),
    },
    contact: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.tenantId === TENANT && where.id === CONTACT ? { id: CONTACT, name: "Ana" } : null,
      ),
    },
    musicEnrollment: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.tenantId === TENANT && where.id === ENROLL ? { id: ENROLL, classId: CLASS, contactId: CONTACT } : null,
      ),
    },
  };
  const read: any = {
    listBalances: jest.fn(async () => [{ enrollmentId: ENROLL, contactId: CONTACT, balance: 8, pendingMakeups: 0 }]),
  };
  return { service: new MusicSchoolService(prisma, read), prisma, read, tx, state };
}

const classBody = { name: "Piano I", departmentId: DEPT, weekday: 3, startTime: "18:30", durationMinutes: 60 };
const enrollBody = { contactId: CONTACT, contractedSessions: 8, purchasedSessions: 2 };

describe("Escola de Música — escrita tenant-scoped", () => {
  it("cadastra plano individual apenas para professor ativo do mesmo tenant e com horário válido", async () => {
    const { service, prisma } = fixture();
    await expect(service.createClass(classBody, OTHER, "OWNER", USER)).rejects.toThrow("não encontrado");
    await expect(service.createClass({ ...classBody, weekday: 0 }, TENANT, "OWNER", USER)).rejects.toThrow("1 e 7");
    await expect(service.createClass({ ...classBody, startTime: "25:00" }, TENANT, "OWNER", USER)).rejects.toThrow("HH:mm");
    await expect(service.createClass({ ...classBody, durationMinutes: 15 }, TENANT, "OWNER", USER)).rejects.toThrow("30 e 180");
    const created = await service.createClass(classBody, TENANT, "MANAGER", USER);
    expect(created).toMatchObject({ id: CLASS, tenantId: TENANT, departmentName: "Piano", createdById: USER });
    expect(prisma.musicClass.create.mock.calls[0][0].data.tenantId).toBe(TENANT);
  });

  it("recusa atendente em toda mutação", async () => {
    const { service } = fixture();
    await expect(service.createClass(classBody, TENANT, "AGENT", USER)).rejects.toThrow("responsáveis");
    await expect(service.enroll(enrollBody, CLASS, TENANT, "AGENT", USER)).rejects.toThrow("responsáveis");
    await expect(service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-11-27", outcome: "ATTENDED" }, TENANT, "AGENT", USER)).rejects.toThrow("responsáveis");
  });

  it("matricula aluno do CRM do mesmo tenant e mantém cobrança apenas agendada", async () => {
    const { service } = fixture();
    await expect(service.enroll(enrollBody, CLASS, OTHER, "OWNER", USER)).rejects.toThrow("Plano do aluno não encontrado");
    await expect(service.enroll({ ...enrollBody, contactId: CLASS }, CLASS, TENANT, "OWNER", USER)).rejects.toThrow("Aluno não encontrado");
    await expect(service.enroll({ ...enrollBody, billingAmountCents: 9900 }, CLASS, TENANT, "OWNER", USER)).rejects.toThrow("vencimento");
    await expect(service.enroll({ ...enrollBody, billingNextDueDate: "2026-12-05" }, CLASS, TENANT, "OWNER", USER)).rejects.toThrow("valor mensal");
    const result = await service.enroll({ ...enrollBody, billingAmountCents: 9900, billingNextDueDate: "2026-12-05" }, CLASS, TENANT, "OWNER", USER);
    expect(result).toMatchObject({
      tenantId: TENANT,
      className: "Piano I",
      contactName: "Ana",
      billing: { status: "SCHEDULED", amountCents: 9900, executed: false, confirmed: false },
    });
  });

  it("trava o tenant e rejeita matrícula duplicada mesmo em requisições concorrentes", async () => {
    const { service, tx, state } = fixture();
    const results = await Promise.allSettled([
      service.enroll(enrollBody, CLASS, TENANT, "OWNER", USER),
      service.enroll(enrollBody, CLASS, TENANT, "OWNER", USER),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason.message).toMatch(/já está matriculado/);
    expect(state.enrollments).toHaveLength(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(state.locks).toEqual([TENANT, TENANT]);
  });

  it("registra presença uma vez por data e devolve saldo recalculado", async () => {
    const { service, tx, read, state } = fixture();
    await expect(service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-02-30", outcome: "ATTENDED" }, TENANT, "OWNER", USER)).rejects.toThrow("AAAA-MM-DD");
    await expect(service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-11-27", outcome: "PAID" }, TENANT, "OWNER", USER)).rejects.toThrow("inválido");
    const first = await service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-11-27", outcome: "TEACHER_ABSENT" }, TENANT, "OWNER", USER);
    expect(first.record).toMatchObject({ tenantId: TENANT, classId: CLASS, enrollmentId: ENROLL, outcome: "TEACHER_ABSENT", recordedById: USER });
    expect(first.balance).toMatchObject({ balance: 8, pendingMakeups: 0 });
    expect(read.listBalances).toHaveBeenCalledWith(TENANT, CONTACT);
    await expect(service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-11-27", outcome: "ATTENDED" }, TENANT, "OWNER", USER)).rejects.toThrow("Já existe presença");
    await service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-11-28", outcome: "MAKEUP" }, TENANT, "OWNER", USER);
    expect(state.attendances).toHaveLength(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it("não aceita matrícula de outro tenant para registro de presença", async () => {
    const { service } = fixture();
    await expect(service.recordAttendance({ enrollmentId: ENROLL, sessionDate: "2026-11-27", outcome: "ATTENDED" }, OTHER, "OWNER", USER)).rejects.toThrow("não encontrada");
  });
});

describe("Escola de Música — contrato da migração", () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261127100000_music_school/migration.sql"),
    "utf8",
  );

  it("isola as três tabelas por tenant e mantém chaves estrangeiras", () => {
    for (const table of ["music_classes", "music_enrollments", "music_attendances"]) {
      const block = sql.match(new RegExp(`CREATE TABLE "${table}"[\\s\\S]*?\\);`))?.[0] ?? "";
      expect(block).toMatch(/"tenant_id" UUID NOT NULL REFERENCES "tenants"\("id"\) ON DELETE CASCADE/);
    }
  });

  it("garante unicidade de matrícula e de presença no banco, não apenas na aplicação", () => {
    expect(sql).toMatch(/UNIQUE \("tenant_id", "class_id", "contact_id"\)/);
    expect(sql).toMatch(/UNIQUE \("tenant_id", "enrollment_id", "session_date"\)/);
  });

  it("registra explicitamente que SCHEDULED não confirma cobrança", () => {
    expect(sql).toMatch(/billing_status" TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK \(billing_status IN \('SCHEDULED','SENT','CONFIRMED','FAILED'\)\)/);
    expect(sql).toMatch(/SCHEDULED não confirma cobrança/);
    expect(sql).toMatch(/ATTENDED e STUDENT_ABSENT consomem aula/);
  });
});
