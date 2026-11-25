import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { SubmissionDecision, SubmissionRecord, SubmissionsClient } from "./submissions-client";

/**
 * Cliente legado da coleção `submission` do Directus, mantido como fallback.
 *
 * A configuração é global mas vinculada a UM tenant (DIRECTUS_TENANT_ID): uma
 * empresa nunca pode usar as credenciais de outra. O token é service account
 * API-only e fica no cofre do servidor; o navegador nunca o recebe.
 */
export type DirectusSubmission = SubmissionRecord;

const FIELDS = "id,submission_key,name,email,phone,payload,status,rejection_reason,property_id,date_created,date_updated";

@Injectable()
export class DirectusSubmissionsService implements SubmissionsClient {
  private readonly logger = new Logger(DirectusSubmissionsService.name);
  private readonly baseUrl = (process.env.DIRECTUS_URL ?? "").trim().replace(/\/$/, "");
  private readonly token = (process.env.DIRECTUS_TOKEN ?? "").trim();
  private readonly tenantId = (process.env.DIRECTUS_TENANT_ID ?? "").trim();
  private readonly timeoutMs = 15_000;

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token && this.tenantId);
  }

  private endpoint(): string {
    let parsed: URL;
    try {
      parsed = new URL(this.baseUrl);
    } catch {
      throw new ServiceUnavailableException("DIRECTUS_URL não é uma URL válida.");
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new ServiceUnavailableException("DIRECTUS_URL não é uma URL segura.");
    }
    if (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new ServiceUnavailableException("DIRECTUS_URL precisa usar HTTPS fora de localhost.");
    }
    return parsed.toString().replace(/\/$/, "");
  }

  /** Configuração ausente e tenant divergente recebem a mesma resposta, sem vazar qual tenant está configurado. */
  assertConfigured(tenantId: string): void {
    if (!this.isConfigured() || tenantId !== this.tenantId) {
      throw new ServiceUnavailableException("A integração com o Directus não está configurada para esta empresa.");
    }
    this.endpoint();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

    let response: Response;
    try {
      response = await fetch(`${this.endpoint()}${path}`, {
        ...init,
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn("Falha de transporte ao acessar o Directus.");
      throw new BadGatewayException("Não foi possível acessar o Directus.");
    }

    const json: any = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof json?.errors?.[0]?.message === "string" ? json.errors[0].message : response.statusText;
      throw new BadGatewayException(`Directus respondeu ${response.status}: ${detail}`);
    }
    return (json?.data ?? null) as T;
  }

  async listPending(_tenantId: string): Promise<SubmissionRecord[]> {
    const params = new URLSearchParams({
      fields: FIELDS,
      "filter[status][_eq]": "pending",
      sort: "-date_created",
      limit: "100",
    });
    const rows = await this.request<Array<Omit<SubmissionRecord, "tenantId">> | null>(`/items/submission?${params.toString()}`);
    return Array.isArray(rows) ? rows.map((row) => ({ ...row, tenantId: this.tenantId })) : [];
  }

  async findByKey(_tenantId: string, submissionKey: string): Promise<SubmissionRecord | null> {
    const params = new URLSearchParams({
      fields: FIELDS,
      "filter[submission_key][_eq]": submissionKey,
      limit: "1",
    });
    const rows = await this.request<Array<Omit<SubmissionRecord, "tenantId">> | null>(`/items/submission?${params.toString()}`);
    const row = (Array.isArray(rows) ? rows[0] : undefined) ?? null;
    return row ? { ...row, tenantId: this.tenantId } : null;
  }

  /** O Flow do Directus cria o imóvel e notifica o anunciante; este cliente apenas muda o status. */
  async decide(_tenantId: string, id: string, decision: SubmissionDecision, reason: string | null): Promise<void> {
    const body = decision === "REJECTED"
      ? { status: "rejected", rejection_reason: reason }
      : { status: "approved" };
    await this.request(`/items/submission/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }
}
