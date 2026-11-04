import { formatWorkerCycleLog as formatWebhookWorkerCycleLog } from "./webhook-worker";
import { formatWorkerCycleLog as formatSchedulerWorkerCycleLog } from "./scheduler-worker";

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
