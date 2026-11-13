import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";

/** GET público (sem autenticação) de imagens de site — ids são UUIDs não adivinháveis, cache imutável. */
@Controller("public")
export class PublicAssetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("site-assets/:id")
  async asset(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const asset = await this.prisma.siteAsset.findUnique({ where: { id }, select: { mimeType: true, bytes: true } });
    if (!asset) throw new NotFoundException();
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(asset.bytes));
  }
}
