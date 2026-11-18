import { createHash } from "node:crypto";

/**
 * Cliente mínimo da API oficial da Cloudflare para Cloudflare Pages (Direct Upload).
 *
 * Fluxo (o mesmo usado pelo Wrangler em `wrangler pages deploy`):
 *   1. GET  /accounts/{account}/pages/projects/{project}          (cria se não existir)
 *   2. POST /accounts/{account}/pages/projects/{project}/upload-token
 *   3. POST /pages/assets/check-missing                            (JWT de upload)
 *   4. POST /pages/assets/upload                                   (JWT de upload, base64)
 *   5. POST /pages/assets/upsert-hashes                            (JWT de upload)
 *   6. POST /accounts/{account}/pages/projects/{project}/deployments (manifest path → sha256)
 *
 * Domínio customizado:
 *   POST /accounts/{account}/pages/projects/{project}/domains { name }
 *   GET  /accounts/{account}/pages/projects/{project}/domains/{domain}
 * DNS (somente quando a zona está na mesma conta):
 *   GET  /zones?name=...   |   GET/POST /zones/{zone}/dns_records
 */
export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export type RenderFile = { content: Buffer; contentType: string };

export type PagesDeployment = {
  id: string;
  url?: string;
  environment?: string;
  aliases?: string[];
  latest_stage?: { name?: string; status?: string; ended_on?: string | null };
  deployment_trigger?: { metadata?: Record<string, unknown> };
  created_on?: string;
};

export type PagesDomain = {
  id?: string;
  name: string;
  status?: string;
  validation_data?: Record<string, unknown>;
  verification_data?: Record<string, unknown>;
  zone_tag?: string;
  certificate_status?: string;
};

export type CloudflareZone = { id: string; name: string; status?: string };

export type CloudflareDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class CloudflareApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    readonly messages: string[],
    readonly endpoint: string,
  ) {
    super(messages.join(" ") || `Cloudflare respondeu HTTP ${status}.`);
    this.name = "CloudflareApiError";
  }
}

type Envelope<T> = { success?: boolean; result?: T; errors?: Array<{ code?: number; message?: string }>; messages?: unknown[] };

type ClientOptions = {
  token: string;
  accountId: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  baseUrl?: string;
};

export class CloudflarePagesClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(private readonly options: ClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.baseUrl = (options.baseUrl ?? CLOUDFLARE_API_BASE).replace(/\/$/, "");
  }

  private async request<T>(endpoint: string, init: RequestInit = {}, bearer = this.options.token, timeoutMs = this.timeoutMs): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.baseUrl + endpoint, {
        ...init,
        headers: {
          ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...(init.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${bearer}`,
        },
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new CloudflareApiError(0, undefined, [`Falha de rede ao falar com a Cloudflare: ${error instanceof Error ? error.message : String(error)}`], endpoint);
    }
    const text = await response.text();
    let body: Envelope<T> = {};
    try { body = text ? JSON.parse(text) as Envelope<T> : {}; } catch { body = {}; }
    if (!response.ok || body.success === false) {
      const messages = Array.isArray(body.errors) && body.errors.length
        ? body.errors.map((entry) => String(entry?.message || "Erro na Cloudflare")).slice(0, 5)
        : [`Cloudflare respondeu HTTP ${response.status}.`];
      throw new CloudflareApiError(response.status, body.errors?.[0]?.code, messages, endpoint);
    }
    return body.result as T;
  }

  async verifyToken(): Promise<{ id?: string; status?: string }> {
    return this.request(`/user/tokens/verify`);
  }

  async getProject(name: string): Promise<{ name: string; subdomain?: string; production_branch?: string } | null> {
    try {
      return await this.request(`/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(name)}`);
    } catch (error) {
      if (error instanceof CloudflareApiError && error.status === 404) return null;
      throw error;
    }
  }

  async ensureProject(name: string): Promise<{ name: string; subdomain?: string }> {
    const existing = await this.getProject(name);
    if (existing) return existing;
    return this.request(`/accounts/${this.options.accountId}/pages/projects`, {
      method: "POST",
      body: JSON.stringify({ name, production_branch: "main" }),
    });
  }

  async listZones(name?: string): Promise<CloudflareZone[]> {
    const query = new URLSearchParams({ per_page: "50" });
    if (name) query.set("name", name);
    const result = await this.request<CloudflareZone[]>(`/zones?${query.toString()}`);
    return Array.isArray(result) ? result : [];
  }

  /** Acha a zona mais específica que cobre o hostname (ex.: site.cliente.com.br → cliente.com.br). */
  async findZoneForHostname(hostname: string): Promise<CloudflareZone | null> {
    const labels = hostname.toLowerCase().split(".").filter(Boolean);
    for (let index = 0; index <= labels.length - 2; index++) {
      const candidate = labels.slice(index).join(".");
      const zones = await this.listZones(candidate);
      const exact = zones.find((zone) => zone.name.toLowerCase() === candidate);
      if (exact) return exact;
    }
    return null;
  }

  async listDnsRecords(zoneId: string, name: string): Promise<CloudflareDnsRecord[]> {
    const query = new URLSearchParams({ name, per_page: "50" });
    const result = await this.request<CloudflareDnsRecord[]>(`/zones/${zoneId}/dns_records?${query.toString()}`);
    return Array.isArray(result) ? result : [];
  }

  async createCname(zoneId: string, name: string, target: string): Promise<CloudflareDnsRecord> {
    return this.request(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify({ type: "CNAME", name, content: target, proxied: true, ttl: 1 }),
    });
  }

  async createDeployment(input: {
    projectName: string;
    files: Map<string, RenderFile>;
    branch?: string;
    commitMessage?: string;
  }): Promise<PagesDeployment> {
    const { projectName, files } = input;
    if (files.size === 0) throw new Error("Nenhum arquivo para publicar.");
    if (files.size > 20_000) throw new Error("O site tem mais de 20.000 arquivos, limite do Cloudflare Pages.");

    await this.ensureProject(projectName);

    const hashed = [...files.entries()].map(([path, file]) => ({
      path,
      file,
      hash: createHash("sha256").update(file.content).digest("hex"),
    }));

    const tokenResponse = await this.request<{ jwt: string }>(
      `/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(projectName)}/upload-token`,
      { method: "POST" },
    );
    const jwt = tokenResponse?.jwt;
    if (!jwt) throw new CloudflareApiError(502, undefined, ["A Cloudflare não devolveu o token de upload."], "upload-token");

    const missing = await this.request<string[]>(`/pages/assets/check-missing`, {
      method: "POST",
      body: JSON.stringify({ hashes: hashed.map((entry) => entry.hash) }),
    }, jwt);
    const missingSet = new Set(Array.isArray(missing) ? missing : []);
    const pending = hashed.filter((entry) => missingSet.has(entry.hash));

    const MAX_FILES_PER_BUCKET = 500;
    const MAX_BYTES_PER_BUCKET = 40 * 1024 * 1024;
    let bucket: typeof pending = [];
    let bucketBytes = 0;
    const flush = async () => {
      if (bucket.length === 0) return;
      const payload = bucket.map((entry) => ({
        key: entry.hash,
        value: entry.file.content.toString("base64"),
        metadata: { contentType: entry.file.contentType || "application/octet-stream" },
        base64: true,
      }));
      await this.request(`/pages/assets/upload`, { method: "POST", body: JSON.stringify(payload) }, jwt, 180_000);
      bucket = [];
      bucketBytes = 0;
    };
    for (const entry of pending) {
      if (bucket.length >= MAX_FILES_PER_BUCKET || bucketBytes + entry.file.content.byteLength > MAX_BYTES_PER_BUCKET) await flush();
      bucket.push(entry);
      bucketBytes += entry.file.content.byteLength;
    }
    await flush();

    await this.request(`/pages/assets/upsert-hashes`, {
      method: "POST",
      body: JSON.stringify({ hashes: hashed.map((entry) => entry.hash) }),
    }, jwt);

    // O manifesto usa caminhos absolutos ("/index.html") → hash do arquivo.
    const manifest: Record<string, string> = {};
    for (const entry of hashed) manifest["/" + entry.path.replace(/^\/+/, "")] = entry.hash;

    const form = new FormData();
    form.append("manifest", JSON.stringify(manifest));
    form.append("branch", input.branch || "main");
    if (input.commitMessage) form.append("commit_message", input.commitMessage.slice(0, 300));
    return this.request<PagesDeployment>(
      `/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
      { method: "POST", body: form },
      this.options.token,
      180_000,
    );
  }

  async getDeployment(projectName: string, deploymentId: string): Promise<PagesDeployment> {
    return this.request(`/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments/${encodeURIComponent(deploymentId)}`);
  }

  async createDomain(projectName: string, domain: string): Promise<PagesDomain> {
    return this.request(`/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    });
  }

  async getDomain(projectName: string, domain: string): Promise<PagesDomain | null> {
    try {
      return await this.request(`/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domain)}`);
    } catch (error) {
      if (error instanceof CloudflareApiError && error.status === 404) return null;
      throw error;
    }
  }

  async deleteDomain(projectName: string, domain: string): Promise<void> {
    await this.request(`/accounts/${this.options.accountId}/pages/projects/${encodeURIComponent(projectName)}/domains/${encodeURIComponent(domain)}`, { method: "DELETE" });
  }
}
