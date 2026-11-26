import {
  BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Post, Req, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import sharp from "sharp";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { PrismaService } from "../prisma/prisma.service";
import { DriveManagerService } from "./drive-manager.service";

const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const driveId = (value: unknown): string => {
  const id = typeof value === "string" ? value.trim() : "";
  if (!/^[\w-]{1,255}$/.test(id)) throw new BadRequestException("Arquivo do Drive inválido.");
  return id;
};
const assetUrl = (id: string) => "/api/backend/catalog-images/" + id + "/content";

type UploadedImage = { buffer: Buffer; size: number; mimetype: string; originalname: string };
type NormalizedImage = { data: Buffer; info: { width: number; height: number } };

/** Imagens do catálogo pertencem à empresa: bytes gravados no tenant, servidos por esta rota autenticada. */
@Controller("catalog-images")
@UseGuards(AuthGuard)
export class CatalogImageController {
  constructor(private readonly prisma: PrismaService, private readonly drive: DriveManagerService) {}

  private adminOnly(req: AuthenticatedRequest) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores gerenciam imagens do catálogo.");
  }

  private async normalize(bytes: Buffer): Promise<NormalizedImage> {
    if (!bytes.length || bytes.length > MAX_BYTES) throw new BadRequestException("Envie uma imagem de até 8 MB.");
    try {
      const result = await sharp(bytes, { failOn: "none", limitInputPixels: 40_000_000 })
        .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      return { data: result.data, info: { width: result.info.width || 1, height: result.info.height || 1 } };
    } catch {
      throw new BadRequestException("Não foi possível ler esta imagem.");
    }
  }

  private async save(req: AuthenticatedRequest, name: string, normalized: NormalizedImage) {
    const asset = await this.prisma.siteAsset.create({
      data: {
        tenantId: req.user.tenantId,
        name: String(name || "capa").slice(0, 160) + ".webp",
        kind: "image",
        folder: "/catalogo",
        mimeType: "image/webp",
        width: normalized.info.width,
        height: normalized.info.height,
        bytes: new Uint8Array(normalized.data),
      },
      select: { id: true },
    });
    return assetUrl(asset.id);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const rows = await this.prisma.siteAsset.findMany({
      where: { tenantId: req.user.tenantId, kind: "image" },
      select: { id: true, name: true, mimeType: true, width: true, height: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return { assets: rows.map((row) => ({ id: row.id, name: row.name, kind: "image", url: assetUrl(row.id), width: row.width, height: row.height })) };
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES, files: 1, fields: 1 } }))
  async upload(@Req() req: AuthenticatedRequest, @UploadedFile() file?: UploadedImage) {
    this.adminOnly(req);
    if (!file || !IMAGE_TYPES.has(file.mimetype)) throw new BadRequestException("Escolha uma imagem JPEG, PNG, WebP, GIF ou AVIF.");
    const normalized = await this.normalize(file.buffer);
    const url = await this.save(req, file.originalname.replace(/\.[^.]+$/, ""), normalized);
    await this.prisma.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "catalog.image.uploaded", entityType: "siteAsset", entityId: url.split("/").pop() || null, details: { name: file.originalname.slice(0, 160), bytes: file.size } } });
    return { url };
  }

  @Post("from-drive")
  async fromDrive(@Req() req: AuthenticatedRequest, @Body() input: { accountId?: unknown; fileId?: unknown }) {
    this.adminOnly(req);
    const accountId = typeof input?.accountId === "string" ? input.accountId : "";
    const fileId = driveId(input?.fileId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) throw new BadRequestException("Conta do Drive inválida.");
    // O download usa o token real da conta conectada e o escopo do tenant; nada é simulado.
    const file = await this.drive.download(req, accountId, fileId);
    if (!IMAGE_TYPES.has(file.type)) throw new BadRequestException("Escolha uma imagem JPEG, PNG, WebP, GIF ou AVIF no Drive.");
    const normalized = await this.normalize(file.buffer);
    const url = await this.save(req, file.name.replace(/\.[^.]+$/, ""), normalized);
    await this.prisma.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: "catalog.image.imported_drive", entityType: "siteAsset", entityId: url.split("/").pop() || null, details: { accountId, fileId, name: file.name.slice(0, 160) } } });
    return { url };
  }

  @Get(":id/content")
  async content(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const asset = await this.prisma.siteAsset.findFirst({ where: { id, tenantId: req.user.tenantId, kind: "image" }, select: { mimeType: true, bytes: true } });
    if (!asset) throw new NotFoundException("Imagem não encontrada.");
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(asset.bytes));
  }
}
