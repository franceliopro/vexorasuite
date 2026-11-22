import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  createPlan,
  fingerprintOf,
  healthUrlFor,
  validateRequest,
} from "./plan.js";
import {
  ProvisionerError,
  type ApplyEvidence,
  type ApprovalRecord,
  type HealthResult,
  type JobStatus,
  type ProvisionerMode,
  type ProvisionJob,
  type ProvisionPlan,
  type ProvisionRequest,
  type StatusReport,
} from "./types.js";

export interface JobStoreOptions {
  mode?: ProvisionerMode;
  stateFile?: string | null;
}

export interface PlanResult {
  plan: ProvisionPlan;
  created: boolean;
}

export interface ApplyOptions {
  requireApproval?: boolean;
  requireHealth?: boolean;
  evidence?: ApplyEvidence;
}

interface PersistedState {
  version: 1;
  jobs: ProvisionJob[];
}

const REQUIRED_JOB_FIELDS = [
  "requestId",
  "fingerprint",
  "request",
  "plan",
  "status",
  "createdAt",
] as const;

export class JobStore {
  private readonly jobs = new Map<string, ProvisionJob>();
  private readonly mode: ProvisionerMode;
  private readonly stateFile: string | null;

  constructor(options: JobStoreOptions = {}) {
    this.mode = options.mode ?? "simulation";
    this.stateFile = options.stateFile ?? null;
    if (this.stateFile !== null) this.load();
  }

  private load(): void {
    if (this.stateFile === null || !existsSync(this.stateFile)) return;
    try {
      const state = JSON.parse(
        readFileSync(this.stateFile, "utf8"),
      ) as PersistedState;
      if (state.version !== 1 || !Array.isArray(state.jobs)) {
        throw new Error("formato de estado inválido");
      }
      for (const job of state.jobs) {
        if (
          typeof job !== "object" ||
          job === null ||
          REQUIRED_JOB_FIELDS.some((field) => job[field] === undefined)
        ) {
          throw new Error("job persistido inválido");
        }
        this.jobs.set(job.requestId, job);
      }
    } catch {
      throw new ProvisionerError(
        "Não foi possível carregar o estado persistido",
        "configuration",
        500,
      );
    }
  }

  private persist(): void {
    if (this.stateFile === null) return;
    const state: PersistedState = { version: 1, jobs: [...this.jobs.values()] };
    mkdirSync(dirname(this.stateFile), { recursive: true });
    const temporary = `${this.stateFile}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2), "utf8");
    renameSync(temporary, this.stateFile);
  }

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
    this.persist();
    return { plan: job.plan, created: true };
  }

  approve(
    requestId: string,
    approver: string,
    correlationId?: string,
  ): ApprovalRecord {
    const job = this.require(requestId);
    if (typeof approver !== "string" || approver.trim().length === 0) {
      throw new ProvisionerError(
        "approver é obrigatório",
        "invalid_request",
        400,
      );
    }
    if (job.approval && job.approval.approver !== approver.trim()) {
      throw new ProvisionerError(
        "requestId já aprovado por outra pessoa",
        "conflict",
        409,
      );
    }
    if (job.approval) return job.approval;
    if (job.status !== "planned") {
      throw new ProvisionerError(
        `Não é possível aprovar um job no estado ${job.status}`,
        "invalid_state",
        409,
      );
    }
    const approval: ApprovalRecord = {
      approver: approver.trim(),
      at: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {}),
    };
    job.approval = approval;
    this.persist();
    return approval;
  }

  apply(requestId: string, options: ApplyOptions = {}): ProvisionJob {
    const job = this.require(requestId);
    if (job.status === "applied") return job;
    if (job.status !== "planned") {
      throw new ProvisionerError(
        `Não é possível aplicar um job no estado ${job.status}`,
        "invalid_state",
        409,
      );
    }
    if (options.requireApproval && !job.approval) {
      throw new ProvisionerError(
        "Aprovação humana registrada é obrigatória antes do apply",
        "invalid_state",
        409,
      );
    }
    if (options.requireHealth && options.evidence?.health.verified !== true) {
      throw new ProvisionerError(
        "Health-check real não confirmado",
        "health_check",
        409,
      );
    }
    job.status = "applied";
    job.appliedAt = new Date().toISOString();
    job.lastError = undefined;
    if (options.evidence) job.evidence = options.evidence;
    this.persist();
    return job;
  }

  status(requestId: string): StatusReport {
    const job = this.require(requestId);
    const isPhp = job.request.type === "php-mysql";
    const health: HealthResult = job.evidence?.health ?? {
      url: healthUrlFor(job.request.domain),
      verified: false,
      statusCode: null,
      checkedAt: "",
      detail: "health-check não executado",
    };
    const published =
      this.mode === "real" && job.status === "applied" && health.verified;
    return {
      requestId: job.requestId,
      status: job.status,
      mode: this.mode,
      folder: `/sites/${job.request.slug}`,
      database: isPhp ? `site_${job.request.slug.replaceAll("-", "_")}` : null,
      dbUser: isPhp ? `site_${job.request.slug.replaceAll("-", "_")}` : null,
      vhost: job.status === "applied",
      tls: published ? "configured" : "pending",
      healthUrl: healthUrlFor(job.request.domain),
      warnings: [...job.plan.warnings],
      approval: job.approval ?? null,
      health,
      published,
    };
  }

  rollback(requestId: string): ProvisionJob {
    const job = this.require(requestId);
    if (job.status === "rolled-back") return job;
    if (job.status !== "applied" && job.status !== "failed") {
      throw new ProvisionerError(
        `Não é possível reverter um job no estado ${job.status}`,
        "invalid_state",
        409,
      );
    }
    job.status = "rolled-back";
    job.rolledBackAt = new Date().toISOString();
    this.persist();
    return job;
  }

  markFailed(requestId: string, detail?: string): ProvisionJob {
    const job = this.require(requestId);
    job.status = "failed";
    if (detail) job.lastError = detail;
    this.persist();
    return job;
  }

  get(requestId: string): ProvisionJob {
    return this.require(requestId);
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
