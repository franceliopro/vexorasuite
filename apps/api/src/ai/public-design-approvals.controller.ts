import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ZernioService } from "../operations/zernio.service";
import { parseCarousel, slideSvg, type Carousel } from "./assistant-automation.service";

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? v as any : {});
const APP_BASE = () => (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.vexorasuite.com.br").replace(/\/$/, "");
const slidePublicUrl = (token: string, index: number) => `${APP_BASE()}/api/backend/public/design-approvals/${token}/slide/${index}.png`;

/** Aprovação pública (sem login) de designs recriados — o link é a credencial. */
@Controller("public/design-approvals")
export class PublicDesignApprovalsController {
  constructor(private readonly prisma: PrismaService, private readonly zernio: ZernioService) {}

  private async findByToken(token: string) {
    const row = await this.prisma.auditLog.findFirst({
      where: { action: "marketing.design-approval", details: { path: ["approvalToken"], equals: token } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new NotFoundException("Este link de aprovação expirou ou não existe.");
    return row;
  }

  private async connectedChannels(tenantId: string) {
    const rows = await this.prisma.channelConnection.findMany({
      where: { tenantId, provider: "ZERNIO", isActive: true },
      select: { id: true, name: true, settings: true },
      take: 12,
    });
    return rows
      .map(row => {
        const settings = obj(row.settings);
        const platform = typeof settings.platform === "string" ? settings.platform : "";
        const accountId = typeof settings.accountId === "string" ? settings.accountId : "";
        const username = typeof settings.username === "string" ? settings.username : (typeof settings.profileName === "string" ? settings.profileName : "");
        return { id: row.id, name: row.name || platform || "Conta", platform, accountId, username };
      })
      .filter(c => c.platform && c.accountId);
  }

  @Get(":token")
  async view(@Param("token") token: string) {
    const row = await this.findByToken(token);
    const details = obj(row.details);
    const carousel = obj(details.carousel) as unknown as Carousel;
    const channels = await this.connectedChannels(row.tenantId);
    return {
      title: String(carousel.title || "Design"),
      caption: String(carousel.caption || ""),
      slides: Array.isArray(carousel.slides) ? carousel.slides.length : 0,
      format: String(details.format || "CAROUSEL"),
      brand: String(details.brand || "#2E7CF6"),
      company: String(details.company || ""),
      status: String(details.status || "DRAFT"),
      channels,
    };
  }

  @Get(":token/slide/:index")
  async slide(@Param("token") token: string, @Param("index") rawIndex: string, @Res() res: Response) {
    const index = Number(String(rawIndex || "").replace(/\.png$/i, ""));
    const row = await this.findByToken(token);
    const details = obj(row.details);
    const carousel = obj(details.carousel) as unknown as Carousel;
    if (!Array.isArray(carousel?.slides) || !Number.isInteger(index) || index < 0 || index >= carousel.slides.length) throw new NotFoundException();
    const svg = slideSvg(carousel, index, String(details.brand || "#5865da"), String(details.company || "Véxora"), Array.isArray(details.referencePalette) ? details.referencePalette : [], String(details.format || "CAROUSEL") as any);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(png);
  }

  @Post(":token/approve")
  async approve(@Param("token") token: string, @Body() body: { decision?: string; publish?: boolean; channelIds?: string[] }) {
    const row = await this.findByToken(token);
    const details = obj(row.details);
    const status = String(details.status || "DRAFT");
    if (status === "PUBLISHED" || status === "APPROVED") return { ok: true, status, note: "Este design já foi aprovado." };
    const decision = body?.decision === "reject" ? "reject" : "approve";
    const nextDetails = { ...details, status: decision === "reject" ? "REJECTED" : "APPROVED", reviewedAt: new Date().toISOString() };

    if (decision === "approve" && body?.publish === true) {
      const channelIds = Array.isArray(body.channelIds) ? body.channelIds.filter((v): v is string => typeof v === "string").slice(0, 12) : [];
      if (!channelIds.length) throw new BadRequestException("Escolha ao menos uma conta para publicar.");
      const channels = await this.prisma.channelConnection.findMany({ where: { tenantId: row.tenantId, id: { in: channelIds }, provider: "ZERNIO", isActive: true }, select: { id: true, settings: true } });
      const platforms = channels.map(c => { const s = obj(c.settings); return { platform: typeof s.platform === "string" ? s.platform : "", accountId: typeof s.accountId === "string" ? s.accountId : "" }; }).filter(p => p.platform && p.accountId);
      if (!platforms.length) throw new BadRequestException("As contas escolhidas não estão prontas para publicar. Reconecte as redes.");
      const carouselSlides = Array.isArray(obj(details.carousel).slides) ? (obj(details.carousel).slides as any[]).length : 0;
      const mediaItems = Array.from({ length: Math.max(carouselSlides, 1) }, (_, i) => ({ type: "image" as const, url: slidePublicUrl(token, i) }));
      const carousel = obj(details.carousel) as unknown as Carousel;
      const payload = { content: String(carousel.caption || carousel.title || ""), platforms, mediaItems, publishNow: true };
      const response = await this.zernio.request<any>("/posts", { method: "POST", body: payload, idempotencyKey: "design-approval-" + row.entityId });
      const publication = { requestedAt: new Date().toISOString(), publishNow: true, response: response?.post || response };
      await this.prisma.auditLog.update({ where: { id: row.id }, data: { details: { ...nextDetails, status: "PUBLISHED", channels: platformSummary(platforms), publication } as Prisma.InputJsonValue } });
      return { ok: true, status: "PUBLISHED" };
    }
    await this.prisma.auditLog.update({ where: { id: row.id }, data: { details: nextDetails as Prisma.InputJsonValue } });
    return { ok: true, status: nextDetails.status };
  }
}

function platformSummary(platforms: { platform: string }[]): string[] {
  return platforms.map(p => p.platform);
}
