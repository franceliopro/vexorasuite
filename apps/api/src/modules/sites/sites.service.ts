import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveEntitlements } from "../../auth/entitlements";
import { landingDocument } from "./landing-template";
import { promptDocument } from "./prompt-template";
import { buildSiteIllustrations } from "./site-images";
import { parseLayoutImage } from "./layout-image";
import { SiteLayoutVisionService } from "./site-layout-vision.service";

/**
 * Sites: registros raiz do criador de sites.
 *
 * O documento visual (SiteDocument) é criado junto com o site para que o editor abra
 * imediatamente; páginas/blocos legados (SitePage/SiteBlock) continuam disponíveis para
 * conteúdo dinâmico (posts, produtos, imóveis) em etapas seguintes.
 */
export const SITE_KINDS = ["STATIC", "LANDING", "BLOG", "REAL_ESTATE", "ECOMMERCE"] as const;
export type SiteKindValue = (typeof SITE_KINDS)[number];

type CreateSiteInput = {
  name?: unknown;
  kind?: unknown;
  businessArea?: unknown;
  primaryColor?: unknown;
  accentColor?: unknown;
  prompt?: unknown;
  logoUrl?: unknown;
  layoutImage?: unknown;
};

type UpdateSiteInput = Partial<CreateSiteInput>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new BadRequestException(`${field} deve ser texto.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new BadRequestException(`${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return trimmed;
}

function kind(value: unknown): SiteKindValue {
  if (value === undefined || value === null || value === "") return "STATIC";
  if (typeof value !== "string") throw new BadRequestException("kind inválido.");
  const normalized = value.trim().toUpperCase().replace(/-/g, "_");
  if (!SITE_KINDS.includes(normalized as SiteKindValue)) {
    throw new BadRequestException(`kind deve ser um de: ${SITE_KINDS.join(", ")}.`);
  }
  return normalized as SiteKindValue;
}

function color(value: unknown, field: string, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !HEX_COLOR.test(value.trim())) {
    throw new BadRequestException(`${field} deve ser uma cor hexadecimal (#RRGGBB).`);
  }
  return value.trim().toLowerCase();
}

function logo(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BadRequestException("logoUrl deve ser texto.");
  const candidate = value.trim();
  if (candidate.length > 500) throw new BadRequestException("logoUrl é longa demais.");
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") throw new Error("protocolo");
    return url.toString();
  } catch {
    throw new BadRequestException("logoUrl deve ser uma URL https válida.");
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function defaultDocument(name: string, siteKind: SiteKindValue, primary: string, accent: string) {
  return {
    version: 1,
    root: { id: "root", type: "section", props: {}, styles: {}, children: [] },
    meta: {
      title: name,
      type: siteKind.toLowerCase().replace(/_/g, "-"),
      theme: {
        primary,
        secondary: accent,
        background: "#ffffff",
        text: "#101d33",
        fontHeading: "Inter",
        fontBody: "Inter",
      },
    },
  };
}

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly layoutVision?: SiteLayoutVisionService,
  ) {}

  private async ownedSite(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId } });
    if (!site) throw new NotFoundException("Site não encontrado.");
    return site;
  }

  private assertManager(role: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(role)) {
      throw new ForbiddenException("Somente responsáveis pela empresa podem gerenciar sites.");
    }
  }

  private async assertQuota(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { kind: true, entitlements: true },
    });
    if (!tenant) throw new NotFoundException("Empresa não encontrada.");
    const limit = resolveEntitlements(tenant.entitlements).sites;
    // 0 significa "sem limite materializado" (empresas legadas). Planos com cota explícita
    // enviam o número de sites contratados.
    if (limit <= 0) return;
    const used = await this.prisma.site.count({ where: { tenantId } });
    if (used >= limit) {
      throw new BadRequestException(`O plano permite ${limit} site(s). Fale com a administração para ampliar.`);
    }
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = base || "site";
    let candidate = root;
    for (let attempt = 2; attempt < 1000; attempt += 1) {
      const exists = await this.prisma.site.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!exists) return candidate;
      candidate = `${root}-${attempt}`;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  async list(tenantId: string) {
    return this.prisma.site.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        domain: true,
        domainStatus: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { pages: true, siteDeployments: true } },
      },
    });
  }

  async get(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        kind: true,
        businessArea: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        domain: true,
        domainStatus: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        pages: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, slug: true, title: true, kind: true, hidden: true, sortOrder: true },
        },
        siteDeployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, cfDeploymentUrl: true, startedAt: true, finishedAt: true, errorMessage: true },
        },
      },
    });
    if (!site) throw new NotFoundException("Site não encontrado.");
    return site;
  }

  async create(tenantId: string, role: string, input: CreateSiteInput, userId?: string) {
    // Sem descrição e sem imagem, o comportamento permanece o de sempre: template de
    // landing ou documento vazio conforme o tipo. Com imagem, a IA pode sugerir apenas
    // a estrutura; o conteúdo e as regras determinísticas continuam no template.
    const hasPrompt = input.prompt !== undefined && input.prompt !== null && input.prompt !== "";
    const hasLayout = input.layoutImage !== undefined && input.layoutImage !== null && input.layoutImage !== "";
    if (!hasPrompt && !hasLayout) {
      return this.createWithDocument(tenantId, role, input);
    }
    const name = text(input.name, "name", 2, 100);
    const siteKind = kind(input.kind);
    const primary = color(input.primaryColor, "primaryColor", "#0E7A5C");
    const accent = color(input.accentColor, "accentColor", "#6258DF");
    const prompt = hasPrompt ? text(input.prompt, "prompt", 3, 2000) : "";
    const image = hasLayout ? await parseLayoutImage(input.layoutImage) : undefined;
    const warnings: string[] = [];
    let layoutBrief;

    if (image) {
      if (!this.layoutVision) {
        warnings.push("A imagem foi recebida, mas a análise com IA não está disponível neste ambiente; usamos o template padrão.");
      } else {
        try {
          const analyzed = await this.layoutVision.analyze({ tenantId, userId, siteName: name, prompt, image });
          if (analyzed.brief) layoutBrief = analyzed.brief;
          if (analyzed.warning) warnings.push(analyzed.warning);
        } catch {
          warnings.push("A imagem foi recebida, mas a IA não pôde analisá-la; criamos o rascunho com o template padrão.");
        }
      }
    }

    const images = await buildSiteIllustrations({ name, primary, accent });
    const document = promptDocument({
      prompt,
      name,
      kind: siteKind,
      primary,
      accent,
      logoUrl: logo(input.logoUrl),
      images,
      layoutBrief: layoutBrief ?? null,
    });
    const site = await this.createWithDocument(tenantId, role, input, document);
    return warnings.length ? { ...site, warnings } : site;
  }

  /**
   * Criação usada pelos adapters de importação e pelo rascunho a partir de prompt.
   * O documento já vem convertido e validado por quem chama; o endpoint público sem
   * prompt continua gerando o documento padrão.
   */
  async createWithDocument(tenantId: string, role: string, input: CreateSiteInput, importedDocument?: unknown) {
    this.assertManager(role);
    await this.assertQuota(tenantId);

    const name = text(input.name, "name", 2, 100);
    const siteKind = kind(input.kind);
    const primary = color(input.primaryColor, "primaryColor", "#0E7A5C");
    const accent = color(input.accentColor, "accentColor", "#6258DF");
    const businessArea = input.businessArea === undefined || input.businessArea === null
      ? ""
      : text(input.businessArea, "businessArea", 0, 80);
    const logoUrl = logo(input.logoUrl);
    const slug = await this.uniqueSlug(slugify(name));

    return this.prisma.$transaction(async (tx) => {
      const site = await tx.site.create({
        data: { tenantId, name, slug, kind: siteKind, businessArea, primaryColor: primary, accentColor: accent, logoUrl },
        select: { id: true, name: true, slug: true, kind: true, domain: true, domainStatus: true, published: true, createdAt: true },
      });
      // Uma landing page já nasce com o funil completo: oferta, benefícios e formulário.
      // Importações continuam usando o documento convertido pelo adaptador.
      const document = importedDocument
        ?? (siteKind === "LANDING" ? landingDocument(name, primary, accent, logoUrl) : defaultDocument(name, siteKind, primary, accent));
      await tx.siteDocument.create({
        data: { siteId: site.id, document: document as Prisma.InputJsonValue, version: 1 },
      });
      return site;
    });
  }

  async update(siteId: string, tenantId: string, role: string, input: UpdateSiteInput) {
    this.assertManager(role);
    await this.ownedSite(siteId, tenantId);

    const data: { name?: string; kind?: string; businessArea?: string; primaryColor?: string; accentColor?: string; logoUrl?: string | null } = {};
    if (input.name !== undefined) data.name = text(input.name, "name", 2, 100);
    if (input.kind !== undefined) data.kind = kind(input.kind);
    if (input.businessArea !== undefined) data.businessArea = text(input.businessArea, "businessArea", 0, 80);
    if (input.primaryColor !== undefined) data.primaryColor = color(input.primaryColor, "primaryColor", "#0E7A5C");
    if (input.accentColor !== undefined) data.accentColor = color(input.accentColor, "accentColor", "#6258DF");
    if (input.logoUrl !== undefined) data.logoUrl = logo(input.logoUrl);
    if (!Object.keys(data).length) throw new BadRequestException("Informe ao menos um campo para atualizar.");

    return this.prisma.site.update({
      where: { id: siteId },
      data,
      select: { id: true, name: true, slug: true, kind: true, businessArea: true, primaryColor: true, accentColor: true, domain: true, domainStatus: true, published: true, updatedAt: true },
    });
  }

  async remove(siteId: string, tenantId: string, role: string) {
    if (!["OWNER", "ADMIN"].includes(role)) {
      throw new ForbiddenException("Somente administradores podem excluir um site.");
    }
    await this.ownedSite(siteId, tenantId);
    await this.prisma.site.delete({ where: { id: siteId } });
    return { deleted: true, siteId };
  }
}
