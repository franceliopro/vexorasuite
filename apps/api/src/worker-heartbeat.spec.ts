import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isWorkerHeartbeatFresh, touchWorkerHeartbeat } from "./worker-heartbeat";

describe("worker heartbeat", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "vexora-worker-heartbeat-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("writes a heartbeat that is immediately fresh", async () => {
    const filePath = join(directory, "nested", "heartbeat");
    await touchWorkerHeartbeat(filePath);
    expect(isWorkerHeartbeatFresh(filePath)).toBe(true);
  });

  it("returns false when the heartbeat is missing", () => {
    expect(isWorkerHeartbeatFresh(join(directory, "missing"))).toBe(false);
  });

  it("returns false after the configured freshness window", async () => {
    const filePath = join(directory, "heartbeat");
    await touchWorkerHeartbeat(filePath);
    const now = Date.now();
    expect(isWorkerHeartbeatFresh(filePath, 1_000, now + 1_001)).toBe(false);
  });
});
