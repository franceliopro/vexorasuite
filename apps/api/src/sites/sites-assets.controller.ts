import { Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { FileInterceptor } from "@nestjs/platform-express";
import sharp from "sharp";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const assetUrl = (id: string) => "/api/backend/public/site-assets/" + id;
const safeName = (name: string): string => {
  const base = String(name || "arquivo").trim().slice(0, 120) || "arquivo";
  return base.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ");
};
const withExt = (name: string, fallback: string): string => {
  const clean = safeName(name);
  if (/\.[a-z0-9]{2,6}$/i.test(clean)) return clean;
  return clean + fallback;
};

/** Upload e gestão de arquivos públicos do site (imagens e PDFs — servidos com cache imutável). */
@Controller("sites/assets")
@UseGuards(AuthGuard)
export class SitesAssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() async list(@Req() req: AuthenticatedRequest) {
    const assets = await this.prisma.siteAsset.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true, kind: true, mimeType: true, width: true, height: true, createdAt: true },
    });
    return { assets: assets.map(a => ({ ...a, url: assetUrl(a.id) })) };
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES, files: 1, fields: 2 } }))
  async upload(@Req() req: AuthenticatedRequest, @UploadedFile() file?: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    if (!file) throw new BadRequestException("Envie um arquivo (JPG, PNG, WebP, GIF ou PDF).");
    const mime = String(file.mimetype || "").toLowerCase();
    const isImage = /^image\/(jpeg|png|webp|gif)$/.test(mime);
    const isPdf = mime === "application/pdf";
    if (!isImage && !isPdf) throw new BadRequestException("Formato aceito: JPG, PNG, WebP, GIF ou PDF.");
    const originalName = safeName(file.originalname || "arquivo");
    if (isPdf) {
      const asset = await this.prisma.siteAsset.create({
        data: { tenantId: req.user.tenantId, name: withExt(originalName, ".pdf"), kind: "file", mimeType: "application/pdf", width: 0, height: 0, bytes: new Uint8Array(file.buffer) },
        select: { id: true, name: true, kind: true, mimeType: true, width: true, height: true, createdAt: true },
      });
      return { ...asset, url: assetUrl(asset.id) };
    }
    const normalized = await sharp(file.buffer, { failOn: "none" }).rotate().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const asset = await this.prisma.siteAsset.create({
      data: { tenantId: req.user.tenantId, name: withExt(originalName.replace(/\.[a-z0-9]{2,6}$/i, ""), ".webp"), kind: "image", mimeType: "image/webp", width: normalized.info.width, height: normalized.info.height, bytes: new Uint8Array(normalized.data) },
      select: { id: true, name: true, kind: true, mimeType: true, width: true, height: true, createdAt: true },
    });
    return { ...asset, url: assetUrl(asset.id) };
  }

  @Delete(":id") async remove(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const result = await this.prisma.siteAsset.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    if (!result.count) throw new NotFoundException("Arquivo não encontrado.");
    return { deleted: true };
  }
}
