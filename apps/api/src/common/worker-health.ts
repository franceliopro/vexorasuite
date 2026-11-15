import { schedulersEnabled } from "./scheduler-mode";

export const INTELLIGENCE_LEASE = "intelligence-runtime";

type LeaseRow = { lease_until?: Date | string | null };
type QueryRaw = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<LeaseRow[] | unknown>;

/**
 * Verdadeiro quando o trabalho periódico está sendo executado de verdade:
 * - este processo está em modo `in-process` (a API mesma roda os timers), ou
 * - o `scheduler-worker` está vivo, comprovado pelo lease que ele renova a cada tick
 *   (`lease_until` fresco) na tabela `scheduler_leases`.
 *
 * Se o worker morrer, o lease fica velho e a API assume a fila (fallback), em vez
 * de deixar as mensagens do chatbot na fila para sempre.
 */
export async function isSchedulerWorkerAlive(prisma: { $queryRaw: QueryRaw }): Promise<boolean> {
  if (schedulersEnabled()) return true;
  try {
    const raw = await prisma.$queryRaw`SELECT lease_until FROM scheduler_leases WHERE name = ${INTELLIGENCE_LEASE}`;
    const rows = Array.isArray(raw) ? (raw as LeaseRow[]) : [];
    const until = rows.length && rows[0]?.lease_until ? new Date(rows[0].lease_until as unknown as string).getTime() : 0;
    return Number.isFinite(until) && until > Date.now();
  } catch {
    // Se a tabela não existir (migração ainda não rodou), não derruba o diagnóstico.
    return true;
  }
}
