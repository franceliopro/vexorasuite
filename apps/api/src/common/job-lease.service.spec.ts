import { JobLeaseService } from "./job-lease.service";
import { schedulersEnabled } from "./scheduler-mode";

describe("JobLeaseService", () => {
  const prismaWith = (result: unknown) => ({ $queryRaw: jest.fn().mockResolvedValue(result) }) as any;

  it("wins the lease when no other process holds it", async () => {
    const service = new JobLeaseService(prismaWith([{ name: "audio-triage" }]));
    await expect(service.claim("audio-triage", 14_000)).resolves.toBe(true);
  });

  it("skips the tick when another process owns the lease", async () => {
    const service = new JobLeaseService(prismaWith([]));
    await expect(service.claim("audio-triage", 14_000)).resolves.toBe(false);
  });

  it("skips the tick instead of throwing when the lease table is unreachable", async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error("relation does not exist")) } as any;
    const service = new JobLeaseService(prisma);
    await expect(service.claim("workflow-cadence", 14_000)).resolves.toBe(false);
  });

  it("keeps working in unit tests without a database", async () => {
    await expect(new JobLeaseService().claim("audio-triage", 14_000)).resolves.toBe(true);
  });

  it("sends an expiry timestamp derived from the ttl", async () => {
    const prisma = prismaWith([{ name: "x" }]);
    const service = new JobLeaseService(prisma);
    const before = Date.now();
    await service.claim("x", 5_000);
    const values = prisma.$queryRaw.mock.calls[0].slice(1);
    const deadline = values.find((value: unknown) => value instanceof Date) as Date;
    expect(deadline.getTime()).toBeGreaterThanOrEqual(before + 5_000);
  });
});

describe("schedulersEnabled", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("runs in the API process by default", () => {
    delete process.env.SCHEDULER_MODE;
    expect(schedulersEnabled()).toBe(true);
  });

  it("only lets the dedicated worker run when mode is worker", () => {
    process.env.SCHEDULER_MODE = "worker";
    delete process.env.SCHEDULER_ROLE;
    expect(schedulersEnabled()).toBe(false);
    process.env.SCHEDULER_ROLE = "worker";
    expect(schedulersEnabled()).toBe(true);
  });

  it("can be turned off entirely", () => {
    process.env.SCHEDULER_MODE = "off";
    process.env.SCHEDULER_ROLE = "worker";
    expect(schedulersEnabled()).toBe(false);
  });
});
