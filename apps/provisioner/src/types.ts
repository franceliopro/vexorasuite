export type SiteType = "php-mysql" | "nextjs";

export interface ProvisionRequest {
  requestId: string;
  tenantId: string;
  slug: string;
  domain: string;
  type: SiteType;
  phpVersion?: string;
  quotaGb?: number;
  source?: string;
}

export interface ProvisionAction {
  kind: "folder" | "database" | "user" | "vhost" | "tls" | "healthcheck";
  target: string;
  detail: string;
}

export interface ProvisionPlan {
  requestId: string;
  slug: string;
  actions: ProvisionAction[];
  warnings: string[];
}

export type JobStatus = "planned" | "applied" | "failed" | "rolled-back";

export type ProvisionerMode = "simulation" | "real";

export type StepStatus = "executed" | "skipped" | "failed";

export interface ProvisionStepResult {
  kind: ProvisionAction["kind"] | "filebrowser";
  target: string;
  status: StepStatus;
  detail: string;
}

export interface HealthResult {
  url: string;
  verified: boolean;
  statusCode: number | null;
  checkedAt: string;
  detail: string;
}

export interface ApprovalRecord {
  approver: string;
  at: string;
  correlationId?: string;
}

export interface ApplyEvidence {
  executedAt: string;
  steps: ProvisionStepResult[];
  health: HealthResult;
}

export interface ProvisionJob {
  requestId: string;
  fingerprint: string;
  request: ProvisionRequest;
  plan: ProvisionPlan;
  status: JobStatus;
  createdAt: string;
  appliedAt?: string;
  rolledBackAt?: string;
  approval?: ApprovalRecord;
  evidence?: ApplyEvidence;
  lastError?: string;
}

export interface StatusReport {
  requestId: string;
  status: JobStatus;
  mode: ProvisionerMode;
  folder: string;
  database: string | null;
  dbUser: string | null;
  vhost: boolean;
  tls: "pending" | "configured";
  healthUrl: string;
  warnings: string[];
  approval: ApprovalRecord | null;
  health: HealthResult;
  /** Só é verdadeiro no modo real após health-check real no domínio final. */
  published: boolean;
}

export class ProvisionerError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_request"
      | "conflict"
      | "not_found"
      | "invalid_state"
      | "configuration"
      | "upstream"
      | "health_check",
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ProvisionerError";
  }
}
