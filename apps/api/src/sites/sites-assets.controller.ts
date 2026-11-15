import { Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, Body, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { FileInterceptor } from "@nestjs/platform-express";
import sharp from "sharp";
import { normalizeFolder, folderChainOf, folderParent, directChildrenOf, folderName } from "./folder-path";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const assetUrl = (id: string) => "/api/backend/public/site-assets/" + id;
const safeName = (name: string): string => {
  const base = String(name || "arquivo").trim().slice(0, 120) || "arquivo";
  return base.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ");
};
const extFor = (mimeType: string): string => {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("pdf")) return ".pdf";
  return ".bin";
};

/** Upload e gestão de arquivos dos sites: criar/navegar/renomear/mover/excluir pastas, ler, editar. */
@Controller("sites/assets")
@UseGuards(AuthGuard)
export class SitesAssetsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Caminho atuais conhecidos (pastas explícitas + pastas implícitas a partir dos assets). */
  private async knownFolders(tenantId: string): Promise<string[]> {
    const [rows, distinctAssetFolders] = await Promise.all([
      this.prisma.siteFolder.findMany({ where: { tenantId }, select: { path: true } }),
      this.prisma.siteAsset.findMany({ where: { tenantId }, select: { folder: true }, distinct: ["folder"] }),
    ]);
    const set = new Set<string>(["/"]);
    for (const row of rows) set.add(row.path);
    for (const row of distinctAssetFolders) for (const chain of folderChainOf(row.folder)) set.add(chain);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  @Get() async list(@Req() req: AuthenticatedRequest, @Query("folder") folderRaw?: string) {
    const tenantId = req.user.tenantId;
    const folder = normalizeFolder(folderRaw);
    const [assets, known] = await Promise.all([
      this.prisma.siteAsset.findMany({
        where: { tenantId, folder },
        orderBy: [{ createdAt: "desc" }],
        take: 300,
        select: { id: true, name: true, kind: true, folder: true, mimeType: true, width: true, height: true, createdAt: true },
      }),
      this.knownFolders(tenantId),
    ]);
    const folders = directChildrenOf(folder, known).map(path => ({ path, name: folderName(path) }));
    const parent = folderParent(folder);
    return { folder, parent, folders, assets: assets.map(a => ({ ...a, url: assetUrl(a.id) })) };
  }

  @Get("all-folders") async allFolders(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user.tenantId;
    const folders = await this.knownFolders(tenantId);
    return { folders: folders.map(path => ({ path, name: folderName(path) })) };
  }

  /** Garante que as pastas da cadeia existem (criação implícita das pastas-pai). */
  private async ensureFolderChain(tenantId: string, path: string) {
    if (path === "/") return;
    for (const current of folderChainOf(path)) {
      await this.prisma.siteFolder.upsert({
        where: { tenantId_path: { tenantId, path: current } },
        create: { tenantId, path: current },
        update: {},
      });
    }
  }

  @Post("folders") async createFolder(@Req() req: AuthenticatedRequest, @Body() body: { path?: string }) {
    const tenantId = req.user.tenantId;
    const path = normalizeFolder(body?.path);
    if (path === "/") throw new BadRequestException("A pasta raiz já existe.");
    await this.ensureFolderChain(tenantId, path);
    return { created: path };
  }

  @Patch("folders/rename") async renameFolder(@Req() req: AuthenticatedRequest, @Body() body: { path?: string; newPath?: string }) {
    const tenantId = req.user.tenantId;
    const path = normalizeFolder(body?.path);
    const newPath = normalizeFolder(body?.newPath);
    if (path === "/") throw new BadRequestException("A pasta raiz não pode ser renomeada.");
    if (path === newPath) return { renamed: newPath };
    if (newPath.startsWith(path + "/")) throw new BadRequestException("Não é possível mover uma pasta para dentro dela mesma.");
    await this.ensureFolderChain(tenantId, newPath);
    const rows = await this.prisma.siteFolder.findMany({ where: { tenantId, OR: [{ path }, { path: { startsWith: path + "/" } }] }, select: { id: true, path: true } });
    const assets = await this.prisma.siteAsset.findMany({ where: { tenantId, OR: [{ folder: path }, { folder: { startsWith: path + "/" } }] }, select: { id: true, folder: true } });
    const renameTo = (current: string) => newPath + current.slice(path.length);
    await this.prisma.$transaction(async tx => {
      for (const row of rows) await tx.siteFolder.update({ where: { id: row.id }, data: { path: renameTo(row.path) } });
      for (const asset of assets) await tx.siteAsset.update({ where: { id: asset.id }, data: { folder: renameTo(asset.folder) } });
    });
    return { renamed: newPath };
  }

  @Delete("folders") async deleteFolder(@Req() req: AuthenticatedRequest, @Body() body: { path?: string }) {
    const tenantId = req.user.tenantId;
    const path = normalizeFolder(body?.path);
    if (path === "/") throw new BadRequestException("A pasta raiz não pode ser excluída.");
    const result = await this.prisma.$transaction(async tx => {
      const assets = await tx.siteAsset.deleteMany({ where: { tenantId, OR: [{ folder: path }, { folder: { startsWith: path + "/" } }] } });
      await tx.siteFolder.deleteMany({ where: { tenantId, OR: [{ path }, { path: { startsWith: path + "/" } }] } });
      return assets.count;
    });
    return { deleted: true, assetsDeleted: result };
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES, files: 1, fields: 2 } }))
  async upload(@Req() req: AuthenticatedRequest, @UploadedFile() file?: { buffer: Buffer; size: number; mimetype: string; originalname: string }, @Body() body?: { folder?: string }) {
    if (!file) throw new BadRequestException("Envie um arquivo (JPG, PNG, WebP, GIF ou PDF).");
    const tenantId = req.user.tenantId;
    const folder = normalizeFolder(body?.folder);
    await this.ensureFolderChain(tenantId, folder);
    const mime = String(file.mimetype || "").toLowerCase();
    const isImage = /^image\/(jpeg|png|webp|gif)$/.test(mime);
    const isPdf = mime === "application/pdf";
    if (!isImage && !isPdf) throw new BadRequestException("Formato aceito: JPG, PNG, WebP, GIF ou PDF.");
    const originalName = safeName(file.originalname || "arquivo");
    if (isPdf) {
      const asset = await this.prisma.siteAsset.create({
        data: { tenantId, name: withExtLocal(originalName, ".pdf"), kind: "file", folder, mimeType: "application/pdf", width: 0, height: 0, bytes: new Uint8Array(file.buffer) },
        select: { id: true, name: true, kind: true, folder: true, mimeType: true, width: true, height: true, createdAt: true },
      });
      return { ...asset, url: assetUrl(asset.id) };
    }
    const normalized = await sharp(file.buffer, { failOn: "none" }).rotate().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const asset = await this.prisma.siteAsset.create({
      data: { tenantId, name: withExtLocal(originalName.replace(/\.[a-z0-9]{2,6}$/i, ""), ".webp"), kind: "image", folder, mimeType: "image/webp", width: normalized.info.width, height: normalized.info.height, bytes: new Uint8Array(normalized.data) },
      select: { id: true, name: true, kind: true, folder: true, mimeType: true, width: true, height: true, createdAt: true },
    });
    return { ...asset, url: assetUrl(asset.id) };
  }

  @Patch(":id") async rename(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: { name?: string }) {
    const tenantId = req.user.tenantId;
    const name = safeName(body?.name || "");
    if (name.length < 1) throw new BadRequestException("Informe o nome do arquivo.");
    const current = await this.prisma.siteAsset.findFirst({ where: { id, tenantId }, select: { mimeType: true, name: true } });
    if (!current) throw new NotFoundException("Arquivo não encontrado.");
    const finalName = /\.[a-z0-9]{2,6}$/i.test(name) ? name : name + extFor(current.mimeType);
    await this.prisma.siteAsset.update({ where: { id }, data: { name: finalName.slice(0, 120) } });
    return { renamed: finalName };
  }

  @Post(":id/move") async move(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: { folder?: string }) {
    const tenantId = req.user.tenantId;
    const folder = normalizeFolder(body?.folder);
    await this.ensureFolderChain(tenantId, folder);
    const result = await this.prisma.siteAsset.updateMany({ where: { id, tenantId }, data: { folder } });
    if (!result.count) throw new NotFoundException("Arquivo não encontrado.");
    return { moved: folder };
  }

  @Delete(":id") async remove(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const result = await this.prisma.siteAsset.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    if (!result.count) throw new NotFoundException("Arquivo não encontrado.");
    return { deleted: true };
  }
}

const withExtLocal = (name: string, fallback: string): string => {
  const clean = safeName(name);
  return /\.[a-z0-9]{2,6}$/i.test(clean) ? clean : clean + fallback;
};
