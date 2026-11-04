import { promises as fs, statSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_WORKER_HEARTBEAT_FILE = "/tmp/vexora-worker-heartbeat";
export const DEFAULT_WORKER_HEARTBEAT_MAX_AGE_MS = 60_000;

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
    const ageMs = now - statSync(filePath).mtimeMs;
    return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs;
  } catch {
    return false;
  }
}
