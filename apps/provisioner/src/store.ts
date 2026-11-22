import { createPlan, fingerprintOf, validateRequest } from "./plan.js";
import {
  ProvisionerError,
  type JobStatus,
  type ProvisionJob,
  type ProvisionPlan,
  type ProvisionRequest,
  type StatusReport,
} from "./types.js";

export interface PlanResult {
  plan: ProvisionPlan;
  created: boolean;
}

export class JobStore {
  private readonly jobs = new Map<string, ProvisionJob>();

  plan(input: unknown): PlanResult {
    const request = validateRequest(input);
    const existing = this.jobs.get(request.requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprintOf(request)) {
        throw new ProvisionerError(
          "requestId já usado com dados diferentes",
          "conflict",
          409,
        );
      }
      return { plan: existing.plan, created: false };
    }

    const job: ProvisionJob = {
      requestId: request.requestId,
      fingerprint: fingerprintOf(request),
      request,
      plan: createPlan(request),
      status: "planned",
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(request.requestId, job);
    return { plan: job.plan, created: true };
  }

  apply(requestId: string): ProvisionJob {
    const job = this.require(requestId);
    if (job.status === "applied") {
      return job;
    }
    if (job.status !== "planned") {
      throw new ProvisionerError(
        `Não é possível aplicar um job no estado ${job.status}`,
        "invalid_state",
        409,
      );
    }
    job.status = "applied";
    job.appliedAt = new Date().toISOString();
    return job;
  }

  status(requestId: string): StatusReport {
    const job = this.require(requestId);
    const isPhp = job.request.type === "php-mysql";
    return {
      requestId: job.requestId,
      status: job.status,
      mode: "simulation",
      folder: `/sites/${job.request.slug}`,
      database: isPhp ? `site_${job.request.slug.replaceAll("-", "_")}` : null,
      dbUser: isPhp ? `site_${job.request.slug.replaceAll("-", "_")}` : null,
      vhost: job.status === "applied",
      tls: "pending",
      healthUrl: `https://${job.request.domain}/health`,
      warnings: job.plan.warnings,
    };
  }

  rollback(requestId: string): ProvisionJob {
    const job = this.require(requestId);
    if (job.status === "rolled-back") {
      return job;
    }
    if (job.status !== "applied" && job.status !== "failed") {
      throw new ProvisionerError(
        `Não é possível reverter um job no estado ${job.status}`,
        "invalid_state",
        409,
      );
    }
    job.status = "rolled-back";
    job.rolledBackAt = new Date().toISOString();
    return job;
  }

  markFailed(requestId: string): ProvisionJob {
    const job = this.require(requestId);
    job.status = "failed";
    return job;
  }

  count(): number {
    return this.jobs.size;
  }

  private require(requestId: string): ProvisionJob {
    const job = this.jobs.get(requestId);
    if (!job) {
      throw new ProvisionerError("Job não encontrado", "not_found", 404);
    }
    return job;
  }
}

export function statusOf(job: ProvisionJob): JobStatus {
  return job.status;
}

export function requestOf(job: ProvisionJob): ProvisionRequest {
  return job.request;
}
