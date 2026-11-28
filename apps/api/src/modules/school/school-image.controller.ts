import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import sharp from "sharp";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { isManager } from "./school-rules";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_STORED_BYTES = 2_500_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

type UploadedImage = { buffer: Buffer; size: number; mimetype: string; originalname: string };

/** Foto de curso enviada do computador, normalizada e guardada no tenant como data URL.
 * Nenhum arquivo é publicado em site, nenhuma URL de outra empresa é copiada.
 */
@Controller("school/images")
@UseGuards(AuthGuard)
export class SchoolImageController {
  constructor(private readonly prisma: PrismaService) {}

  private assertManager(req: AuthenticatedRequest) {
    if (!isManager(req.user.role)) throw new ForbiddenException("Somente responsáveis pela escola podem enviar fotos de cursos.");
  }

  @Post("course")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES, files: 1, fields: 1 } }))
  async uploadCourseImage(@Req() req: AuthenticatedRequest, @UploadedFile() file?: UploadedImage) {
    this.assertManager(req);
    if (!file || !IMAGE_TYPES.has(file.mimetype)) throw new BadRequestException("Escolha uma imagem JPEG, PNG, WebP ou AVIF.");
    let normalized: Buffer;
    try {
      normalized = await sharp(file.buffer, { failOn: "none", limitInputPixels: 20_000_000 })
        .rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException("Não foi possível ler esta imagem.");
    }
    if (!normalized.length || normalized.length > MAX_STORED_BYTES) {
      throw new BadRequestException("A imagem processada ficou grande demais. Escolha um arquivo menor.");
    }
    const imageUrl = `data:image/webp;base64,${normalized.toString("base64")}`;
    await this.prisma.auditLog.create({
      data: {
        tenantId: req.user.tenantId,
        userId: req.user.sub,
        action: "school.course.image.uploaded",
        entityType: "schoolCourse",
        entityId: null,
        details: { name: file.originalname.slice(0, 160), bytes: file.size, storedBytes: normalized.length },
      },
    });
    return { imageUrl };
  }
}
