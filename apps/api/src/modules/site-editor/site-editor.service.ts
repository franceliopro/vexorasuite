import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma.service';

const MAX_DOCUMENT_CHARS = 1_000_000;

/** Aceita apenas a forma mínima do SiteDocument publicado no contrato compartilhado. */
function assertDocument(document: unknown): void {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new BadRequestException('Documento inválido.');
  }
  const doc = document as { root?: unknown; meta?: unknown; version?: unknown };
  const root = doc.root as { type?: unknown; children?: unknown } | undefined;
  const meta = doc.meta as { title?: unknown } | undefined;
  if (!root || typeof root !== 'object' || typeof root.type !== 'string' || !Array.isArray(root.children)) {
    throw new BadRequestException('Documento inválido: árvore de blocos ausente.');
  }
  if (!meta || typeof meta !== 'object' || typeof meta.title !== 'string') {
    throw new BadRequestException('Documento inválido: metadados ausentes.');
  }
  if (typeof doc.version !== 'number' || !Number.isFinite(doc.version)) {
    throw new BadRequestException('Documento inválido: versão ausente.');
  }
  const pages = (doc as { pages?: unknown }).pages;
  if (pages !== undefined) {
    if (!Array.isArray(pages) || pages.length > 30) {
      throw new BadRequestException('Documento inválido: lista de páginas inválida.');
    }
    const slugs = new Set<string>();
    for (const page of pages) {
      const item = page as { slug?: unknown; title?: unknown; root?: unknown };
      const pageRoot = item?.root as { type?: unknown; children?: unknown } | undefined;
      if (
        !item ||
        typeof item.slug !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{0,60}$/.test(item.slug) ||
        typeof item.title !== 'string' ||
        !item.title.trim() ||
        !pageRoot ||
        typeof pageRoot.type !== 'string' ||
        !Array.isArray(pageRoot.children)
      ) {
        throw new BadRequestException('Documento inválido: página incompleta.');
      }
      if (slugs.has(item.slug)) {
        throw new BadRequestException('Documento inválido: slug de página repetido.');
      }
      slugs.add(item.slug);
    }
  }
  if (JSON.stringify(document).length > MAX_DOCUMENT_CHARS) {
    throw new BadRequestException('Documento muito grande. Reduza imagens embutidas e blocos.');
  }
}

@Injectable()
export class SiteEditorService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedSite(siteId: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId }, select: { id: true } });
    if (!site) throw new NotFoundException('Site não encontrado');
    return site;
  }

  async load(siteId: string, tenantId: string) {
    await this.ownedSite(siteId, tenantId);
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  async save(siteId: string, tenantId: string, document: unknown, createdBy: string) {
    assertDocument(document);
    await this.ownedSite(siteId, tenantId);
    const existing = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (existing) {
      const nextVersion = existing.version + 1;
      await this.prisma.siteVersion.create({
        data: { siteDocumentId: existing.id, version: existing.version, document: existing.document as any, createdBy },
      });
      return this.prisma.siteDocument.update({
        where: { siteId },
        data: { document: document as Prisma.InputJsonValue, version: nextVersion },
      });
    }
    return this.prisma.siteDocument.create({
      data: { siteId, document: document as Prisma.InputJsonValue, version: 1 },
    });
  }

  async listVersions(siteId: string, tenantId: string) {
    await this.ownedSite(siteId, tenantId);
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return this.prisma.siteVersion.findMany({
      where: { siteDocumentId: doc.id },
      orderBy: { version: 'desc' },
    });
  }

  async restore(siteId: string, version: number, tenantId: string, createdBy: string) {
    await this.ownedSite(siteId, tenantId);
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    const v = await this.prisma.siteVersion.findUnique({
      where: { siteDocumentId_version: { siteDocumentId: doc.id, version } },
    });
    if (!v) throw new NotFoundException('Versão não encontrada');
    return this.save(siteId, tenantId, v.document, createdBy);
  }
}
