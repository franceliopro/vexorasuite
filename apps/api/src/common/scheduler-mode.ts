/**
 * Decides which process runs the periodic jobs.
 *
 * - `in-process` (default): the API starts the timers. Safe on several replicas because each
 *   tick takes a database lease, but the work shares the request process.
 * - `worker`: the API keeps the timers off; the dedicated scheduler-worker process runs them.
 * - `off`: no periodic jobs at all (useful for a read-only or migration-only container).
 */
export function schedulersEnabled(): boolean {
  const mode = (process.env.SCHEDULER_MODE || "in-process").toLowerCase();
  if (mode === "off") return false;
  if (mode === "worker") return (process.env.SCHEDULER_ROLE || "").toLowerCase() === "worker";
  return true;
}
