import { Injectable, Logger } from '@nestjs/common';
// Config via process.env (sem @nestjs/config)

/**
 * Cliente fino para a API REST da Cloudflare (Pages + DNS).
 * Credenciais via env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
 * Nenhuma credencial é hardcoded.
 */
@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly token: string;
  private readonly accountId: string;
  private readonly baseUrl = 'https://api.cloudflare.com/client/v4';
  private readonly requestTimeoutMs = 20_000;

  constructor() {
    this.token = process.env.CLOUDFLARE_API_TOKEN ?? '';
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
    if (!this.token || !this.accountId) {
      this.logger.warn('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID não configurados; chamadas falharão.');
    }
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.accountId);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error("Cloudflare não configurado. Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID.");
    }
  }

  private async request<T>(method: string, path: string, body?: any, isForm = false): Promise<T> {
    this.assertConfigured();
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = { method, headers: this.headers(isForm ? {} : { 'Content-Type': 'application/json' }) };
    if (body) {
      init.body = isForm ? body : JSON.stringify(body);
    }
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(this.requestTimeoutMs) });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      const msg = json?.errors?.map((e: any) => e.message).join('; ') || res.statusText;
      throw new Error(`Cloudflare ${method} ${path} falhou: ${msg}`);
    }
    return json.result as T;
  }

  // --- Pages projects ---

  async createProject(name: string, productionBranch = 'main'): Promise<{ name: string; subdomain: string }> {
    return this.request('POST', `/accounts/${this.accountId}/pages/projects`, {
      name,
      production_branch: productionBranch,
    });
  }

  async getProject(name: string): Promise<any> {
    return this.request('GET', `/accounts/${this.accountId}/pages/projects/${name}`);
  }

  // --- Pages deployments (Direct Upload) ---

  /**
   * Cria um deployment via Direct Upload.
   * files: lista de { path, content (Buffer) }.
   * Fluxo: calcula sha256 de cada arquivo, monta manifest {path: hash},
   * envia os arquivos como partes multipart keyed pelo hash.
   * Cloudflare retorna deployment com url.
   */
  async createDeployment(projectName: string, files: { path: string; content: Buffer }[], branch = 'main'): Promise<any> {
    this.assertConfigured();
    const crypto = await import('node:crypto');
    const manifest: Record<string, string> = {};
    const form = new FormData();
    for (const f of files) {
      const hash = crypto.createHash('sha256').update(f.content).digest('hex');
      manifest[f.path.replace(/^\/+/, '')] = hash;
      // envia o arquivo sob o nome do hash (Cloudflare espera parte nomeada pelo hash)
      form.append(hash, new Blob([f.content as any]), f.path.replace(/^\/+/, ''));
    }
    form.append('manifest', JSON.stringify(manifest));
    form.append('branch', branch);
    form.append('commit_message', `deploy ${new Date().toISOString()}`);

    const url = `${this.baseUrl}/accounts/${this.accountId}/pages/projects/${projectName}/deployments`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      const msg = json?.errors?.map((e: any) => e.message).join('; ') || res.statusText;
      throw new Error(`Cloudflare deploy falhou: ${msg}`);
    }
    return json.result;
  }

  // --- Custom domains (Pages) ---

  async addCustomDomain(projectName: string, domain: string): Promise<any> {
    return this.request('POST', `/accounts/${this.accountId}/pages/projects/${projectName}/domains`, { name: domain });
  }

  async listDomains(projectName: string): Promise<any[]> {
    return this.request('GET', `/accounts/${this.accountId}/pages/projects/${projectName}/domains`);
  }

  // --- DNS records (zona do usuário no Cloudflare, opcional) ---

  async createDnsCname(zoneId: string, name: string, target: string, proxied = false): Promise<any> {
    return this.request('POST', `/zones/${zoneId}/dns_records`, {
      type: 'CNAME',
      name,
      content: target,
      proxied,
      ttl: 1, // auto
    });
  }

  async getZoneId(domain: string): Promise<string | null> {
    try {
      const zones: any[] = await this.request('GET', `/zones?name=${encodeURIComponent(domain)}`);
      return zones?.[0]?.id ?? null;
    } catch {
      return null;
    }
  }
}