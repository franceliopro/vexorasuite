import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { SubmissionDecision, SubmissionRecord, SubmissionsClient } from "./submissions-client";

/**
 * Cliente da coleção `submission` em uma instância única do Payload CMS.
 *
 * Uma instância atende vários sites: `tenantId` é gravado em cada documento e
 * filtrado em toda leitura e escrita. O token é service account e fica no
 * cofre do servidor; o navegador nunca o recebe. Nenhum dado é confiado ao
 * cliente: o tenant sempre vem da sessão da Véxora.
 */
type PayloadDoc = Record<string, any>;
type PayloadList = { docs?: unknown[] };

@Injectable()
export class PayloadSubmissionsService implements SubmissionsClient {
  private readonly logger = new Logger(PayloadSubmissionsService.name);
  private readonly baseUrl = (process.env.PAYLOAD_URL ?? "").trim().replace(/\/$/, "");
  private readonly token = (process.env.PAYLOAD_TOKEN ?? "").trim();
  private readonly timeoutMs = 15_000;

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  private endpoint(): string {
    let parsed: URL;
    try {
      parsed = new URL(this.baseUrl);
    } catch {
      throw new ServiceUnavailableException("PAYLOAD_URL não é uma URL válida.");
    }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new ServiceUnavailableException("PAYLOAD_URL não é uma URL segura.");
    }
    if (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new ServiceUnavailableException("PAYLOAD_URL precisa usar HTTPS fora de localhost.");
    }
    return parsed.toString().replace(/\/$/, "");
  }

  /** Configuração ausente recebe sempre a mesma resposta, sem revelar estado da integração. */
  assertConfigured(_tenantId: string): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("A integração com o CMS não está configurada para esta empresa.");
    }
    this.endpoint();
  }

  private authorization(): string {
    // Aceita token bruto (API key de collection) ou cabeçalho completo já montado.
    if (this.token.startsWith("users API-Key ") || this.token.startsWith("Bearer ")) return this.token;
    return `users API-Key ${this.token}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("authorization", this.authorization());
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
      this.logger.warn("Falha de transporte ao acessar o Payload CMS.");
      throw new BadGatewayException("Não foi possível acessar o CMS.");
    }

    const json: any = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof json?.errors?.[0]?.message === "string" ? json.errors[0].message : response.statusText;
      throw new BadGatewayException(`CMS respondeu ${response.status}: ${detail}`);
    }
    return json as T;
  }

  /** Nunca devolve um documento de outro tenant, mesmo se o servidor o trouxer. */
  private normalize(doc: unknown, tenantId: string): SubmissionRecord | null {
    if (!doc || typeof doc !== "object") return null;
    const row = doc as PayloadDoc;
    const owner = typeof row.tenantId === "string" ? row.tenantId : row.tenantId?.id;
    if (typeof owner !== "string" || owner !== tenantId) return null;

    return {
      id: String(row.id ?? ""),
      tenantId: owner,
      submission_key: String(row.submission_key ?? ""),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
      phone: row.phone == null ? null : String(row.phone),
      payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
      status: String(row.status ?? ""),
      rejection_reason: row.rejection_reason == null ? null : String(row.rejection_reason),
      property_id: row.property_id == null ? null : String(row.property_id),
      date_created: String(row.createdAt ?? ""),
      date_updated: row.updatedAt == null ? null : String(row.updatedAt),
    };
  }

  private async findById(tenantId: string, id: string): Promise<SubmissionRecord | null> {
    const params = new URLSearchParams({
      "where[id][equals]": id,
      "where[tenantId][equals]": tenantId,
      limit: "1",
      depth: "0",
    });
    const json = await this.request<PayloadList>(`/api/submission?${params.toString()}`);
    return this.normalize(Array.isArray(json?.docs) ? json.docs[0] : null, tenantId);
  }

  async listPending(tenantId: string): Promise<SubmissionRecord[]> {
    const params = new URLSearchParams({
      "where[status][equals]": "pending",
      "where[tenantId][equals]": tenantId,
      sort: "-createdAt",
      limit: "100",
      depth: "0",
    });
    const json = await this.request<PayloadList>(`/api/submission?${params.toString()}`);
    const docs = Array.isArray(json?.docs) ? json.docs : [];
    return docs.map((doc) => this.normalize(doc, tenantId)).filter((row): row is SubmissionRecord => row !== null);
  }

  async findByKey(tenantId: string, submissionKey: string): Promise<SubmissionRecord | null> {
    const params = new URLSearchParams({
      "where[submission_key][equals]": submissionKey,
      "where[tenantId][equals]": tenantId,
      limit: "1",
      depth: "0",
    });
    const json = await this.request<PayloadList>(`/api/submission?${params.toString()}`);
    return this.normalize(Array.isArray(json?.docs) ? json.docs[0] : null, tenantId);
  }

  /** O hook do Payload cria o imóvel e notifica; este cliente apenas muda o status. */
  async decide(tenantId: string, id: string, decision: SubmissionDecision, reason: string | null): Promise<void> {
    const current = await this.findById(tenantId, id);
    if (!current) throw new NotFoundException("Submissão não encontrada no CMS.");
    if (current.status !== "pending") throw new BadRequestException("Esta submissão não está mais pendente no CMS.");

    const body = decision === "REJECTED"
      ? { status: "rejected", rejection_reason: reason }
      : { status: "approved" };
    await this.request(`/api/submission/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }
}
