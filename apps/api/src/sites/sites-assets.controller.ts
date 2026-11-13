import { Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { FileInterceptor } from "@nestjs/platform-express";
import sharp from "sharp";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const assetUrl = (id: string) => "/api/backend/public/site-assets/" + id;

/** Upload e gestão de imagens públicas do site (visível para todos — cache imutável). */
@Controller("sites/assets")
@UseGuards(AuthGuard)
export class SitesAssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get() async list(@Req() req: AuthenticatedRequest) {
    const assets = await this.prisma.siteAsset.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, mimeType: true, width: true, height: true, createdAt: true },
    });
    return { assets: assets.map(a => ({ ...a, url: assetUrl(a.id) })) };
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES, files: 1, fields: 2 } }))
  async upload(@Req() req: AuthenticatedRequest, @UploadedFile() file?: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    if (!file) throw new BadRequestException("Envie uma imagem (JPG, PNG, WebP ou GIF).");
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) throw new BadRequestException("Formato aceito: JPG, PNG, WebP ou GIF.");
    const normalized = await sharp(file.buffer, { failOn: "none" }).rotate().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const asset = await this.prisma.siteAsset.create({
      data: { tenantId: req.user.tenantId, mimeType: "image/webp", width: normalized.info.width, height: normalized.info.height, bytes: normalized.data },
      select: { id: true, mimeType: true, width: true, height: true, createdAt: true },
    });
    return { ...asset, url: assetUrl(asset.id) };
  }

  @Delete(":id") async remove(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const result = await this.prisma.siteAsset.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    if (!result.count) throw new NotFoundException("Imagem não encontrada.");
    return { deleted: true };
  }
}
