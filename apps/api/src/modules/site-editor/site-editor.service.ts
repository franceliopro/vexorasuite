import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SiteEditorService {
  constructor(private readonly prisma: PrismaService) {}

  async load(siteId: string, tenantId: string) {
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  async save(siteId: string, tenantId: string, document: any, createdBy: string) {
    const existing = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (existing) {
      const nextVersion = existing.version + 1;
      await this.prisma.siteVersion.create({
        data: { siteDocumentId: existing.id, version: existing.version, document: existing.document as any, createdBy },
      });
      return this.prisma.siteDocument.update({
        where: { siteId },
        data: { document, version: nextVersion },
      });
    }
    return this.prisma.siteDocument.create({
      data: { siteId, document, version: 1 },
    });
  }

  async listVersions(siteId: string) {
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return this.prisma.siteVersion.findMany({
      where: { siteDocumentId: doc.id },
      orderBy: { version: 'desc' },
    });
  }

  async restore(siteId: string, version: number, createdBy: string) {
    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    const v = await this.prisma.siteVersion.findUnique({
      where: { siteDocumentId_version: { siteDocumentId: doc.id, version } },
    });
    if (!v) throw new NotFoundException('Versão não encontrada');
    return this.save(siteId, '', v.document, createdBy);
  }
}