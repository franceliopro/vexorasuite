import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;
jest.mock("sanitize-html", () => ({ __esModule: true, default: (value: string) => value }));

let formatWebhookWorkerCycleLog: typeof import("./webhook-worker").formatWorkerCycleLog;
let formatSchedulerWorkerCycleLog: typeof import("./scheduler-worker").formatWorkerCycleLog;
beforeAll(async () => {
  ({ formatWorkerCycleLog: formatWebhookWorkerCycleLog } = await import("./webhook-worker"));
  ({ formatWorkerCycleLog: formatSchedulerWorkerCycleLog } = await import("./scheduler-worker"));
});

describe("structured worker cycle logs", () => {
  const metrics = {
    workerId: "worker-test-1",
    cycle: 7,
    durationMs: 42,
    itemsProcessed: 12,
    consecutiveFailures: 2,
  };

  it("serializes the webhook worker cycle fields as JSON", () => {
    expect(JSON.parse(formatWebhookWorkerCycleLog(metrics))).toEqual({
      event: "worker_cycle",
      ...metrics,
    });
  });

  it("serializes the scheduler worker cycle fields as JSON", () => {
    expect(JSON.parse(formatSchedulerWorkerCycleLog(metrics))).toEqual({
      event: "worker_cycle",
      ...metrics,
    });
  });
});
