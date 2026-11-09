import { Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Single-flight guard for periodic jobs.
 *
 * Each job claims a row in `scheduler_leases` before running. Only the first contender wins;
 * the others skip the tick and try again on the next interval. The lease expires on its own,
 * so a process that dies mid-tick cannot block the job forever.
 *
 * The downstream work already claims its own rows (message triage transaction, workflow runs
 * with SKIP LOCKED), so a lease failure is logged and the tick is skipped rather than duplicated.
 */
@Injectable()
export class JobLeaseService {
  private readonly logger = new Logger(JobLeaseService.name);
  private readonly owner = `${process.pid}-${randomUUID().slice(0, 8)}`;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async claim(name: string, ttlMs: number): Promise<boolean> {
    if (!this.prisma) return true;
    const deadline = new Date(Date.now() + Math.max(1000, ttlMs));
    try {
      const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
        INSERT INTO scheduler_leases (name, owner, lease_until)
        VALUES (${name}, ${this.owner}, ${deadline})
        ON CONFLICT (name) DO UPDATE
          SET owner = EXCLUDED.owner, lease_until = EXCLUDED.lease_until
          WHERE scheduler_leases.lease_until < NOW()
        RETURNING name
      `;
      return rows.length > 0;
    } catch (error) {
      this.logger.warn(
        `Não foi possível obter a trava de "${name}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
