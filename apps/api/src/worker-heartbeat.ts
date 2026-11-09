import { promises as fs, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_WORKER_HEARTBEAT_FILE = "/tmp/vexora-worker-heartbeat";
export const DEFAULT_WORKER_HEARTBEAT_MAX_AGE_MS = 60_000;
const MAX_HEARTBEAT_CLOCK_SKEW_MS = 1_000;

export async function touchWorkerHeartbeat(
  filePath = process.env.WORKER_HEARTBEAT_FILE || DEFAULT_WORKER_HEARTBEAT_FILE,
): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${Date.now()}\n`, "utf8");
}

export function isWorkerHeartbeatFresh(
  filePath = process.env.WORKER_HEARTBEAT_FILE || DEFAULT_WORKER_HEARTBEAT_FILE,
  maxAgeMs = DEFAULT_WORKER_HEARTBEAT_MAX_AGE_MS,
  now = Date.now(),
): boolean {
  try {
    const stat = statSync(filePath);
    const recordedAt = Number.parseInt(readFileSync(filePath, "utf8").trim(), 10);
    const heartbeatAt = Number.isFinite(recordedAt) ? recordedAt : stat.mtimeMs;
    const ageMs = now - heartbeatAt;
    // Prefer the timestamp written by the heartbeat itself. Filesystem mtimes
    // can be rounded on Windows and incorrectly keep an expired heartbeat alive.
    return Number.isFinite(ageMs) && ageMs >= -MAX_HEARTBEAT_CLOCK_SKEW_MS && ageMs < maxAgeMs;
  } catch {
    return false;
  }
}
