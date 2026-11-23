import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { PrismaService } from "../../prisma/prisma.service";
import { isPrivateAddress } from "../sites-import/safe-fetch";

const KINDS = ["STATIC", "LANDING", "BLOG", "REAL_ESTATE", "ECOMMERCE", "PORTAL"];
const DECISIONS = ["APPROVED", "REJECTED"];
const MAX_REDIRECTS = 3;

type Input = Record<string, unknown>;

function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} é obrigatório.`);
  const clean = value.trim();
  if (clean.length > max) throw new BadRequestException(`${field} excede ${max} caracteres.`);
  return clean;
}

function optionalText(value: unknown, field: string, max = 500): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BadRequestException(`${field} deve ser texto.`);
  const clean = value.trim();
  if (clean.length > max) throw new BadRequestException(`${field} excede ${max} caracteres.`);
  return clean || null;
}

/** URL de preview é registrada como evidência, não como publicação. */
function previewUrl(value: unknown): string {
  const raw = text(value, "previewUrl", 2000);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BadRequestException("previewUrl deve ser uma URL válida.");
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname.startsWith("127.")))) {
    throw new BadRequestException("previewUrl deve usar HTTPS (ou localhost para testes locais).");
  }
  return raw;
}

/** O domínio de publicação precisa resolver apenas para endereços públicos (anti-SSRF). */
async function assertPublicDomain(domain: string): Promise<void> {
  const host = domain.toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    throw new BadRequestException("targetDomain não parece um domínio válido.");
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new BadRequestException("Não foi possível resolver o domínio de destino.");
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new BadRequestException("O domínio de destino aponta para uma rede interna.");
  }
}

@Injectable()
export class SiteHubService {
  constructor(private readonly prisma: PrismaService) {}

  private assertManager(role: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(role)) {
      throw new ForbiddenException("Somente responsáveis pela empresa podem gerenciar pedidos de sites.");
    }
  }

  private async owned(tenantId: string, id: string) {
    const request = await this.prisma.siteHubRequest.findFirst({ where: { id, tenantId } });
    if (!request) throw new NotFoundException("Pedido de site não encontrado.");
    return request;
  }

  async create(input: Input, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const name = text(input.name, "name", 120);
    const slug = text(input.slug, "slug", 80).toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) {
      throw new BadRequestException("slug deve conter letras minúsculas, números e hífens.");
    }
    const kind = input.kind === undefined ? "STATIC" : text(input.kind, "kind", 30).toUpperCase();
    if (!KINDS.includes(kind)) throw new BadRequestException("Tipo de site não suportado.");
    const brief = input.brief && typeof input.brief === "object" && !Array.isArray(input.brief) ? input.brief : {};
    const repository = optionalText(input.repository, "repository", 500);
    const targetDomain = optionalText(input.targetDomain, "targetDomain", 250);
    if (targetDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(targetDomain)) {
      throw new BadRequestException("targetDomain não parece um domínio válido.");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.siteHubRequest.create({
        data: {
          tenantId, slug, name, kind, brief: brief as any, repository, targetDomain, createdBy: userId,
        },
      });
      await tx.siteHubEvent.create({
        data: { requestId: request.id, tenantId, action: "REQUEST_CREATED", actorId: userId, details: { slug, kind } as any },
      });
      return request;
    });
    return created;
  }

  async list(tenantId: string) {
    return this.prisma.siteHubRequest.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 }, approvals: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(tenantId: string, id: string) {
    const request = await this.owned(tenantId, id);
    const [versions, approvals, events] = await Promise.all([
      this.prisma.siteHubVersion.findMany({ where: { requestId: id }, orderBy: { version: "desc" } }),
      this.prisma.siteHubApproval.findMany({ where: { requestId: id }, orderBy: { createdAt: "desc" } }),
      this.prisma.siteHubEvent.findMany({ where: { requestId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return { ...request, versions, approvals, events };
  }

  async registerPreview(id: string, input: Input, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const request = await this.owned(tenantId, id);
    if (request.status === "PUBLISHED" || request.status === "PUBLISH_REQUESTED") {
      throw new BadRequestException("Pedido já encaminhado para publicação; abra um novo pedido para nova versão.");
    }
    const url = previewUrl(input.previewUrl);
    const sha = optionalText(input.commitSha, "commitSha", 100);
    const notes = optionalText(input.notes, "notes", 1000);
    const version = request.status === "DRAFT" ? 1 : (await this.prisma.siteHubVersion.aggregate({ where: { requestId: id }, _max: { version: true } }))._max.version! + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.siteHubVersion.create({
        data: { requestId: id, version, previewUrl: url, commitSha: sha, notes, createdBy: userId },
      });
      const updated = await tx.siteHubRequest.update({
        where: { id },
        data: { status: "PREVIEW_READY", previewUrl: url, previewSha: sha },
      });
      await tx.siteHubEvent.create({
        data: { requestId: id, tenantId, action: "PREVIEW_RECORDED", actorId: userId, details: { version, previewUrl: url, commitSha: sha } as any },
      });
      return updated;
    });
  }

  async decide(id: string, input: Input, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const request = await this.owned(tenantId, id);
    if (request.status !== "PREVIEW_READY" && request.status !== "APPROVED" && request.status !== "REJECTED") {
      throw new BadRequestException("É preciso registrar um preview antes de decidir sobre o pedido.");
    }
    const decision = text(input.decision, "decision", 20).toUpperCase();
    if (!DECISIONS.includes(decision)) throw new BadRequestException("decision deve ser APPROVED ou REJECTED.");
    const note = optionalText(input.note, "note", 1000);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.siteHubRequest.update({
        where: { id },
        data: { status: decision as any, decidedBy: userId, decisionNote: note },
      });
      await tx.siteHubApproval.create({ data: { requestId: id, decision, note, decidedBy: userId } });
      await tx.siteHubEvent.create({
        data: { requestId: id, tenantId, action: decision === "APPROVED" ? "APPROVED" : "REJECTED", actorId: userId, details: { note } as any },
      });
      return updated;
    });
  }

  /** Registra a solicitação de publicação. Nunca afirma que a publicação aconteceu. */
  async requestPublish(id: string, input: Input, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const request = await this.owned(tenantId, id);
    if (request.status !== "APPROVED") throw new BadRequestException("Somente pedido aprovado pode ser encaminhado para publicação.");
    const targetDomain = optionalText(input.targetDomain, "targetDomain", 250) ?? request.targetDomain;
    if (!targetDomain) throw new BadRequestException("Informe o domínio de destino antes de solicitar a publicação.");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(targetDomain)) throw new BadRequestException("targetDomain não parece um domínio válido.");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.siteHubRequest.update({
        where: { id },
        data: { status: "PUBLISH_REQUESTED", targetDomain },
      });
      await tx.siteHubEvent.create({
        data: { requestId: id, tenantId, action: "PUBLISH_REQUESTED", actorId: userId, details: { targetDomain, verified: false } as any },
      });
      return updated;
    });
  }

  /** Só marca PUBLISHED após health-check 2xx no domínio final. Nunca confirma por configuração. */
  async confirmPublished(id: string, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const request = await this.owned(tenantId, id);
    if (request.status !== "PUBLISH_REQUESTED" || !request.targetDomain) {
      throw new BadRequestException("Não há solicitação de publicação pendente para este pedido.");
    }
    await assertPublicDomain(request.targetDomain);

    let current = new URL(`https://${request.targetDomain}/`);
    let status = 0;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      try {
        const response = await fetch(current, {
          redirect: "manual",
          signal: AbortSignal.timeout(20_000),
          headers: { "user-agent": "VexoraHub/1.0 (+publication-check)" },
        });
        status = response.status;
        await response.arrayBuffer();
        if (status >= 300 && status < 400) {
          const location = response.headers.get("location");
          if (!location || hop === MAX_REDIRECTS) break;
          const next = new URL(location, current);
          if (next.protocol !== "https:") throw new BadRequestException("O redirecionamento de publicação saiu de HTTPS.");
          await assertPublicDomain(next.hostname.replace(/^\[|\]$/g, ""));
          current = next;
          continue;
        }
        break;
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        status = 0;
        break;
      }
    }
    if (status < 200 || status >= 300) {
      throw new BadRequestException(`O domínio ${request.targetDomain} não respondeu 2xx (status ${status || "sem resposta"}). Publicação não confirmada.`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.siteHubRequest.update({ where: { id }, data: { status: "PUBLISHED" } });
      await tx.siteHubEvent.create({
        data: { requestId: id, tenantId, action: "PUBLISHED_CONFIRMED", actorId: userId, details: { url: current.toString(), status, verified: true } as any },
      });
      return updated;
    });
  }
}
