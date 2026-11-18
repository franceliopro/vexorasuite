import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { JobLeaseService } from "../common/job-lease.service";
import { schedulersEnabled } from "../common/scheduler-mode";
import { CloudflareApiError, CloudflarePagesClient, type PagesDeployment } from "./cloudflare-pages.client";
import {
  cloudflareConnectionStatus,
  cloudflareCredential,
  encryptCloudflareToken,
  withCloudflareCredential,
  withoutCloudflareCredential,
  type CloudflareCredential,
} from "./cloudflare-credentials";
import { renderSite } from "./site-renderer";

const HOSTNAME = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;
const ACCOUNT_ID = /^[a-f0-9]{32}$/i;
const PROJECT_PREFIX = (process.env.SITE_PAGES_PROJECT_PREFIX || "vexora-site").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "vexora-site";

type DeploymentRow = {
  id: string; tenantId: string; siteId: string; projectName: string; status: string;
  sourceHash: string; branch: string; providerDeploymentId: string | null; url: string | null;
  pageCount: number; fileCount: number; totalBytes: number; error: string | null;
  startedAt: Date; finishedAt: Date | null; createdAt: Date;
};

@Injectable()
export class SitesDeployService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SitesDeployService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly leases?: JobLeaseService) {}

  onModuleInit() {
    if (!schedulersEnabled()) return;
    this.timer = setInterval(() => void this.reconcile(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Fábrica isolada para os testes injetarem um fetch falso. */
  protected clientFor(credential: CloudflareCredential): CloudflarePagesClient {
    return new CloudflarePagesClient({ token: credential.token, accountId: credential.accountId });
  }

  // ------------------------------------------------------------------ credenciais

  async connection(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    return { ...cloudflareConnectionStatus(tenant.integrations, tenantId), projectPrefix: PROJECT_PREFIX };
  }

  async saveConnection(tenantId: string, userId: string, body: { apiToken?: unknown; accountId?: unknown }) {
    const apiToken = typeof body.apiToken === "string" ? body.apiToken.trim() : "";
    const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
    if (apiToken.length < 20 || apiToken.length > 200 || /\s/.test(apiToken)) throw new BadRequestException("Informe um API Token válido da Cloudflare.");
    if (!ACCOUNT_ID.test(accountId)) throw new BadRequestException("O Account ID da Cloudflare tem 32 caracteres hexadecimais.");
    const client = this.clientFor({ token: apiToken, accountId, source: "tenant" });
    let verified: { status?: string };
    try {
      verified = await client.verifyToken();
    } catch (error) {
      throw this.translate(error, "Não foi possível validar o token na Cloudflare. Confira o token e as permissões (Pages Edit, DNS Edit e Zone Read).");
    }
    if (verified?.status && verified.status !== "active") throw new BadRequestException("O token da Cloudflare não está ativo.");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    const integrations = withCloudflareCredential(tenant.integrations, encryptCloudflareToken(tenantId, apiToken), accountId, new Date().toISOString());
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { integrations } });
    await this.audit(tenantId, userId, "site.cloudflare.configure", tenantId, { accountId, source: "tenant" });
    return { ...cloudflareConnectionStatus(integrations, tenantId), projectPrefix: PROJECT_PREFIX };
  }

  async removeConnection(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    const integrations = withoutCloudflareCredential(tenant.integrations);
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { integrations } });
    await this.audit(tenantId, userId, "site.cloudflare.remove", tenantId, {});
    return { ...cloudflareConnectionStatus(integrations, tenantId), projectPrefix: PROJECT_PREFIX };
  }

  private async credentialFor(tenantId: string): Promise<CloudflareCredential> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { integrations: true } });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    const credential = cloudflareCredential(tenant.integrations, tenantId);
    if (!credential) {
      throw new ServiceUnavailableException("Configure o API Token e o Account ID da Cloudflare desta empresa antes de publicar.");
    }
    return credential;
  }

  // ------------------------------------------------------------------ deploy

  projectNameFor(site: { slug: string }) {
    const slug = site.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 52);
    return `${PROJECT_PREFIX}-${slug || "site"}`;
  }

  private async loadSite(tenantId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      include: {
        pages: { include: { blocks: true }, orderBy: { sortOrder: "asc" } },
        items: { where: { published: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
    return site;
  }

  private async assetsFor(tenantId: string, site: Awaited<ReturnType<SitesDeployService["loadSite"]>>) {
    const haystack = JSON.stringify({
      pages: site.pages.map((page) => page.blocks.map((block) => block.content)),
      items: site.items.map((item) => [item.coverUrl, item.data]),
      logo: site.logoUrl,
    });
    const ids = [...new Set([...haystack.matchAll(/site-assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)].map((match) => match[1]!))].slice(0, 500);
    const assets = new Map<string, { mimeType: string; bytes: Buffer }>();
    if (!ids.length) return assets;
    const rows = await this.prisma.siteAsset.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, mimeType: true, bytes: true } });
    for (const row of rows) assets.set(row.id, { mimeType: row.mimeType, bytes: Buffer.from(row.bytes) });
    return assets;
  }

  async deploy(tenantId: string, userId: string, siteId: string, body: { branch?: unknown; commitMessage?: unknown; force?: unknown }) {
    const site = await this.loadSite(tenantId, siteId);
    const credential = await this.credentialFor(tenantId);
    const projectName = this.projectNameFor(site);
    const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim().slice(0, 80) : "main";
    const assets = await this.assetsFor(tenantId, site);
    let rendered: ReturnType<typeof renderSite>;
    try {
      rendered = renderSite({
        name: site.name,
        slug: site.slug,
        primaryColor: site.primaryColor,
        accentColor: site.accentColor,
        logoUrl: site.logoUrl,
        businessArea: site.businessArea,
        pages: site.pages.map((page) => ({
          id: page.id,
          kind: page.kind,
          slug: page.slug,
          title: page.title,
          sortOrder: page.sortOrder,
          hidden: page.hidden,
          blocks: page.blocks.map((block) => ({ id: block.id, type: block.type, content: block.content, sortOrder: block.sortOrder, hidden: block.hidden })),
        })),
        items: site.items.map((item) => ({ kind: item.kind, slug: item.slug, title: item.title, excerpt: item.excerpt, coverUrl: item.coverUrl, data: item.data, sortOrder: item.sortOrder })),
        assets,
      });
    } catch (error) {
      throw new BadRequestException(`Não foi possível gerar os arquivos do site: ${this.errorMessage(error)}`);
    }

    const sourceHash = createHash("sha256")
      .update([...rendered.files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, file]) => `${path}:${createHash("sha256").update(file.content).digest("hex")}`).join("\n"))
      .digest("hex");

    if (body.force !== true) {
      const previous = await this.prisma.siteDeployment.findFirst({
        where: { tenantId, siteId, projectName, sourceHash, status: "READY" },
        orderBy: { createdAt: "desc" },
      });
      if (previous) return { deployment: this.present(previous), reused: true, files: rendered.files.size, bytes: rendered.totalBytes };
    }

    const deployment = await this.prisma.siteDeployment.create({
      data: {
        tenantId, siteId, projectName, sourceHash, branch,
        status: "UPLOADING", pageCount: rendered.pageCount,
        fileCount: rendered.files.size, totalBytes: rendered.totalBytes,
      },
    });

    try {
      const client = this.clientFor(credential);
      const result = await client.createDeployment({
        projectName,
        files: rendered.files,
        branch,
        commitMessage: typeof body.commitMessage === "string" ? body.commitMessage : `Véxora: ${site.name}`,
      });
      const status = this.deploymentStatus(result);
      const updated = await this.prisma.siteDeployment.update({
        where: { id: deployment.id },
        data: {
          status,
          providerDeploymentId: result.id,
          url: result.url ?? null,
          error: status === "ERROR" ? "A Cloudflare recusou a publicação." : null,
          finishedAt: status === "READY" ? new Date() : null,
        },
      });
      await this.audit(tenantId, userId, "site.deploy", siteId, {
        deploymentId: updated.id, providerDeploymentId: result.id, projectName, url: result.url ?? null,
        files: rendered.files.size, bytes: rendered.totalBytes, pages: rendered.pageCount, status,
      });
      return { deployment: this.present(updated), reused: false, files: rendered.files.size, bytes: rendered.totalBytes };
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.siteDeployment.update({
        where: { id: deployment.id },
        data: { status: "ERROR", error: message.slice(0, 1000), finishedAt: new Date() },
      }).catch(() => undefined);
      this.logger.warn(`Falha ao publicar o site ${siteId}: ${message}`);
      throw this.translate(error, "Não foi possível publicar o site na Cloudflare.");
    }
  }

  async listDeployments(tenantId: string, siteId: string, limit = 20) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId }, select: { id: true } });
    if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
    const rows = await this.prisma.siteDeployment.findMany({
      where: { tenantId, siteId },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(50, Number(limit) || 20)),
    });
    return rows.map((row) => this.present(row));
  }

  async getDeployment(tenantId: string, deploymentId: string) {
    const row = await this.prisma.siteDeployment.findFirst({ where: { id: deploymentId, tenantId } });
    if (!row) throw new NotFoundException("Publicação não encontrada.");
    return this.present(row);
  }

  async refreshDeployment(tenantId: string, deploymentId: string) {
    const row = await this.prisma.siteDeployment.findFirst({ where: { id: deploymentId, tenantId } });
    if (!row) throw new NotFoundException("Publicação não encontrada.");
    if (!row.providerDeploymentId || row.status === "READY" || row.status === "ERROR") return this.present(row);
    const credential = await this.credentialFor(tenantId);
    try {
      const result = await this.clientFor(credential).getDeployment(row.projectName, row.providerDeploymentId);
      const status = this.deploymentStatus(result);
      const updated = await this.prisma.siteDeployment.update({
        where: { id: row.id },
        data: { status, url: result.url ?? row.url, finishedAt: status === "READY" || status === "ERROR" ? new Date() : null },
      });
      return this.present(updated);
    } catch (error) {
      throw this.translate(error, "Não foi possível consultar a publicação na Cloudflare.");
    }
  }

  private deploymentStatus(result: PagesDeployment): "READY" | "ERROR" | "UPLOADING" {
    const stage = (result.latest_stage?.status || "").toLowerCase();
    if (stage === "success") return "READY";
    if (stage === "failure" || stage === "canceled") return "ERROR";
    return "UPLOADING";
  }

  // ------------------------------------------------------------------ domínio

  async attachDomain(tenantId: string, userId: string, siteId: string, body: { hostname?: unknown }) {
    const site = await this.loadSite(tenantId, siteId);
    const credential = await this.credentialFor(tenantId);
    const hostname = this.normalizeHostname(body.hostname);
    const [domainClash, siteClash] = await Promise.all([
      this.prisma.siteDomain.findFirst({ where: { hostname, siteId: { not: siteId } }, select: { siteId: true } }),
      this.prisma.site.findFirst({ where: { domain: hostname, id: { not: siteId } }, select: { id: true } }),
    ]);
    if (domainClash || siteClash) throw new ConflictException("Este domínio já está vinculado a outro site.");
    const previous = await this.prisma.siteDomain.findUnique({ where: { siteId }, select: { hostname: true } });
    const projectName = this.projectNameFor(site);
    const client = this.clientFor(credential);
    const target = `${projectName}.pages.dev`;

    let providerStatus = "PENDING";
    let validation: Record<string, unknown> = {};
    try {
      await client.ensureProject(projectName);
      let domain = null as Awaited<ReturnType<CloudflarePagesClient["createDomain"]>> | null;
      try {
        domain = await client.createDomain(projectName, hostname);
      } catch (error) {
        if (error instanceof CloudflareApiError && (error.status === 409 || /already|exist/i.test(error.message))) {
          domain = await client.getDomain(projectName, hostname);
        } else {
          throw error;
        }
      }
      providerStatus = (domain?.status || "PENDING").toUpperCase();
      validation = { validationData: domain?.validation_data ?? {}, verificationData: domain?.verification_data ?? {} };
    } catch (error) {
      throw this.translate(error, "Não foi possível adicionar o domínio no Cloudflare Pages.");
    }

    let dns: Record<string, unknown> = { target, action: "MANUAL" };
    try {
      const zone = await client.findZoneForHostname(hostname);
      if (zone) {
        dns = { zoneId: zone.id, zoneName: zone.name, target, action: "AUTO" };
        const apex = hostname === zone.name.toLowerCase();
        const existing = await client.listDnsRecords(zone.id, hostname);
        const cname = existing.find((record) => record.type === "CNAME");
        if (!apex && !cname) {
          const created = await client.createCname(zone.id, hostname, target);
          dns = { ...dns, recordId: created.id, type: "CNAME", name: created.name, content: created.content, proxied: created.proxied ?? true };
        } else if (cname) {
          dns = { ...dns, recordId: cname.id, type: "CNAME", name: cname.name, content: cname.content, proxied: cname.proxied ?? true };
          if (cname.content !== target) dns = { ...dns, action: "CONFLICT", expected: target };
        } else {
          // Apex dentro da própria zona: o Pages cria/gerencia o registro.
          dns = { ...dns, action: "PAGES_MANAGED", type: "CNAME", name: "@", content: target };
        }
        dns = { ...dns, zoneId: zone.id };
      }
    } catch (error) {
      // Domínio pode ser gerenciado fora da Cloudflare: não falha o vínculo.
      this.logger.warn(`DNS automático indisponível para ${hostname}: ${this.errorMessage(error)}`);
      dns = { target, action: "MANUAL", warning: "Não foi possível ajustar o DNS automaticamente. Crie um CNAME para " + target + "." };
    }

    const zoneId = typeof dns.zoneId === "string" ? dns.zoneId : null;
    const domainStatus = this.domainStatus(providerStatus);
    const binding = await this.prisma.siteDomain.upsert({
      where: { siteId },
      create: { tenantId, siteId, hostname, zoneId, providerStatus, validation: validation as any, dnsRecord: dns as any, lastCheckedAt: new Date() },
      update: { hostname, zoneId, providerStatus, validation: validation as any, dnsRecord: dns as any, lastCheckedAt: new Date() },
    });
    await this.prisma.site.update({ where: { id: siteId }, data: { domain: hostname, domainStatus, domainToken: null } });
    if (previous?.hostname && previous.hostname !== hostname) {
      // Troca de domínio: remove o vínculo antigo no Pages (melhor esforço).
      try { await client.deleteDomain(projectName, previous.hostname); } catch (error) {
        this.logger.warn(`Não foi possível remover o domínio antigo ${previous.hostname}: ${this.errorMessage(error)}`);
      }
    }
    await this.audit(tenantId, userId, "site.domain.attach", siteId, { hostname, providerStatus, projectName, dnsAction: dns.action });

    return {
      domain: hostname,
      domainStatus,
      providerStatus,
      projectName,
      target,
      dns,
      validation: validation.validationData ?? {},
      instructions: this.instructions(hostname, target, providerStatus, dns),
      binding: this.presentDomain(binding),
    };
  }

  async verifyDomain(tenantId: string, userId: string, siteId: string) {
    const site = await this.loadSite(tenantId, siteId);
    const binding = await this.prisma.siteDomain.findUnique({ where: { siteId } });
    if (!binding) throw new BadRequestException("Nenhum domínio foi configurado para este site.");
    const credential = await this.credentialFor(tenantId);
    const projectName = this.projectNameFor(site);
    try {
      const domain = await this.clientFor(credential).getDomain(projectName, binding.hostname);
      if (!domain) throw new BadRequestException("O domínio não está mais vinculado ao projeto na Cloudflare.");
      const providerStatus = (domain.status || "PENDING").toUpperCase();
      const domainStatus = this.domainStatus(providerStatus);
      const updated = await this.prisma.siteDomain.update({
        where: { siteId },
        data: {
          providerStatus,
          validation: { validationData: domain.validation_data ?? {}, verificationData: domain.verification_data ?? {} } as any,
          lastCheckedAt: new Date(),
        },
      });
      await this.prisma.site.update({ where: { id: siteId }, data: { domainStatus } });
      if (domainStatus === "ACTIVE") await this.audit(tenantId, userId, "site.domain.active", siteId, { hostname: binding.hostname });
      return {
        domain: binding.hostname,
        domainStatus,
        providerStatus,
        active: domainStatus === "ACTIVE",
        validation: domain.validation_data ?? {},
        binding: this.presentDomain(updated),
        instructions: domainStatus === "ACTIVE" ? [] : this.instructions(binding.hostname, `${projectName}.pages.dev`, providerStatus, this.object(binding.dnsRecord)),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw this.translate(error, "Não foi possível verificar o domínio na Cloudflare.");
    }
  }

  async removeDomain(tenantId: string, userId: string, siteId: string) {
    const site = await this.loadSite(tenantId, siteId);
    const binding = await this.prisma.siteDomain.findUnique({ where: { siteId } });
    if (binding) {
      const credential = await this.credentialFor(tenantId);
      try {
        await this.clientFor(credential).deleteDomain(this.projectNameFor(site), binding.hostname);
      } catch (error) {
        if (!(error instanceof CloudflareApiError && error.status === 404)) throw this.translate(error, "Não foi possível remover o domínio na Cloudflare.");
      }
      await this.prisma.siteDomain.delete({ where: { siteId } }).catch(() => undefined);
    }
    await this.prisma.site.update({ where: { id: siteId }, data: { domain: null, domainStatus: "NONE", domainToken: null } });
    await this.audit(tenantId, userId, "site.domain.remove", siteId, { hostname: binding?.hostname ?? null });
    return { domain: null, domainStatus: "NONE" };
  }

  async domainStatusFor(tenantId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId }, select: { id: true, domain: true, domainStatus: true } });
    if (!site) throw new NotFoundException("Site não encontrado nesta empresa.");
    const binding = await this.prisma.siteDomain.findUnique({ where: { siteId } });
    return { domain: site.domain, domainStatus: site.domainStatus, binding: binding ? this.presentDomain(binding) : null };
  }

  // ------------------------------------------------------------------ reconciliação

  async reconcile() {
    if (this.running) return;
    this.running = true;
    try {
      if (this.leases && !(await this.leases.claim("site-deploy-reconcile", 55_000))) return;
      const pending = await this.prisma.siteDeployment.findMany({
        where: { status: "UPLOADING", providerDeploymentId: { not: null }, updatedAt: { lt: new Date(Date.now() - 45_000) } },
        orderBy: { updatedAt: "asc" },
        take: 10,
      });
      for (const row of pending) {
        try {
          const credential = await this.credentialFor(row.tenantId);
          const result = await this.clientFor(credential).getDeployment(row.projectName, row.providerDeploymentId!);
          const status = this.deploymentStatus(result);
          await this.prisma.siteDeployment.update({
            where: { id: row.id },
            data: { status, url: result.url ?? row.url, finishedAt: status === "READY" || status === "ERROR" ? new Date() : null },
          });
        } catch (error) {
          this.logger.warn(`Reconciliação da publicação ${row.id} falhou: ${this.errorMessage(error)}`);
        }
      }
      const domains = await this.prisma.siteDomain.findMany({
        where: { providerStatus: { notIn: ["ACTIVE", "ERROR", "BLOCKED", "DEACTIVATED"] }, lastCheckedAt: { lt: new Date(Date.now() - 120_000) } },
        take: 10,
      });
      for (const row of domains) {
        try {
          const credential = await this.credentialFor(row.tenantId);
          const site = await this.prisma.site.findUnique({ where: { id: row.siteId }, select: { slug: true } });
          if (!site) continue;
          const domain = await this.clientFor(credential).getDomain(this.projectNameFor(site), row.hostname);
          const providerStatus = (domain?.status || "PENDING").toUpperCase();
          await this.prisma.siteDomain.update({ where: { id: row.id }, data: { providerStatus, lastCheckedAt: new Date() } });
          await this.prisma.site.update({ where: { id: row.siteId }, data: { domainStatus: this.domainStatus(providerStatus) } });
        } catch (error) {
          this.logger.warn(`Reconciliação do domínio ${row.hostname} falhou: ${this.errorMessage(error)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  // ------------------------------------------------------------------ utilidades

  private normalizeHostname(value: unknown): string {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!raw || raw.length > 253) throw new BadRequestException("Informe o domínio que será usado pelo site (ex.: www.suaempresa.com.br).");
    let hostname: string;
    try {
      hostname = new URL(`http://${raw}`).hostname.replace(/\.$/, "");
    } catch {
      throw new BadRequestException("Domínio inválido.");
    }
    if (!HOSTNAME.test(hostname)) throw new BadRequestException("Domínio inválido. Use o formato site.suaempresa.com.br.");
    if (hostname.endsWith(".pages.dev") || hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      throw new BadRequestException("Use o domínio próprio da empresa, não um endereço do Cloudflare Pages.");
    }
    return hostname;
  }

  private domainStatus(providerStatus: string): string {
    if (providerStatus === "ACTIVE") return "ACTIVE";
    if (["ERROR", "BLOCKED", "DEACTIVATED"].includes(providerStatus)) return "ERROR";
    return "PENDING_DNS";
  }

  private instructions(hostname: string, target: string, providerStatus: string, dns: Record<string, unknown>) {
    if (this.domainStatus(providerStatus) === "ACTIVE") return [];
    if (dns.action === "CONFLICT") {
      return [`Existe um registro CNAME em ${hostname} apontando para outro destino. Ajuste para ${target}.`];
    }
    if (dns.action === "MANUAL") {
      return [`Crie um registro CNAME de ${hostname} para ${target} no seu provedor de DNS.`, "Depois clique em Verificar domínio. O SSL é emitido automaticamente pelo Cloudflare Pages."];
    }
    return [`A Cloudflare está validando ${hostname}. Isso costuma levar de alguns minutos a algumas horas.`];
  }

  private present(row: DeploymentRow) {
    return {
      id: row.id,
      siteId: row.siteId,
      status: row.status,
      projectName: row.projectName,
      url: row.url,
      branch: row.branch,
      sourceHash: row.sourceHash,
      providerDeploymentId: row.providerDeploymentId,
      pageCount: row.pageCount,
      fileCount: row.fileCount,
      totalBytes: row.totalBytes,
      error: row.error,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
    };
  }

  private presentDomain(row: {
    id: string; siteId: string; hostname: string; providerStatus: string;
    validation: unknown; dnsRecord: unknown; lastCheckedAt: Date | null; createdAt: Date;
  }) {
    return {
      id: row.id,
      siteId: row.siteId,
      hostname: row.hostname,
      providerStatus: row.providerStatus,
      validation: row.validation,
      dns: row.dnsRecord,
      lastCheckedAt: row.lastCheckedAt,
      createdAt: row.createdAt,
    };
  }

  private object(value: unknown): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private translate(error: unknown, fallback: string): Error {
    if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof ServiceUnavailableException) return error;
    if (error instanceof CloudflareApiError) {
      const detail = error.messages.join(" ").slice(0, 400);
      const hint = error.status === 401 || error.status === 403
        ? " O token precisa das permissões Pages Edit, DNS Edit e Zone Read na conta correta."
        : "";
      return new BadGatewayException(`${fallback} ${detail}${hint}`.trim());
    }
    return new BadGatewayException(`${fallback} ${this.redact(this.errorMessage(error))}`.slice(0, 500));
  }

  /** Nunca devolve segredo/token em mensagem de erro para o cliente. */
  private redact(message: string): string {
    return message.replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]");
  }

  private async audit(tenantId: string, userId: string, action: string, siteId: string, details: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { tenantId, userId, action, entityType: "Site", entityId: siteId, details: details as any },
    }).catch((error: unknown) => this.logger.warn(`Auditoria de ${action} falhou: ${this.errorMessage(error)}`));
  }
}
