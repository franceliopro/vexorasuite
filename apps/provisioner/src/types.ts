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

export interface ProvisionJob {
  requestId: string;
  fingerprint: string;
  request: ProvisionRequest;
  plan: ProvisionPlan;
  status: JobStatus;
  createdAt: string;
  appliedAt?: string;
  rolledBackAt?: string;
}

export interface StatusReport {
  requestId: string;
  status: JobStatus;
  mode: "simulation";
  folder: string;
  database: string | null;
  dbUser: string | null;
  vhost: boolean;
  tls: "pending" | "configured";
  healthUrl: string;
  warnings: string[];
}

export class ProvisionerError extends Error {
  constructor(
    message: string,
    readonly code:
      "invalid_request" | "conflict" | "not_found" | "invalid_state",
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ProvisionerError";
  }
}
