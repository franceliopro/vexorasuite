import { BadRequestException, Body, ConflictException, Controller, Get, Header, NotFoundException, Param, Post } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

export function offerTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function offerText(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(label + " é obrigatório e deve ter até " + max + " caracteres.");
  }
  return value.trim();
}

export function offerAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100_000_000) {
    throw new BadRequestException("Informe um valor válido em centavos.");
  }
  return value;
}

const publicFields = {
  sellerName: true, title: true, scope: true, platform: true, setupCents: true,
  monthlyCents: true, requiresContract: true, depositCents: true, expiresAt: true, state: true, acceptedAt: true,
} as const;

@Controller("public/service-offers")
export class PublicServiceOffersController {
  constructor(private readonly prisma: PrismaService) {}

  private tokenHash(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NotFoundException("Proposta indisponível.");
    return offerTokenHash(token);
  }

  @Get(":token")
  @Header("Cache-Control", "no-store")
  async read(@Param("token") token: string) {
    const offer = await this.prisma.serviceOffer.findUnique({
      where: { publicTokenHash: this.tokenHash(token) },
      select: publicFields,
    });
    if (!offer || offer.state === "REVOKED") throw new NotFoundException("Proposta indisponível.");
    return { ...offer, state: offer.state === "OPEN" && offer.expiresAt <= new Date() ? "EXPIRED" : offer.state };
  }

  @Post(":token/respond")
  @Header("Cache-Control", "no-store")
  async respond(@Param("token") token: string, @Body() input: { decision?: unknown; name?: unknown; reason?: unknown }) {
    const publicTokenHash = this.tokenHash(token);
    const decision = input?.decision;
    if (decision !== "accept" && decision !== "changes") throw new BadRequestException("Escolha uma resposta válida.");
    const name = decision === "accept" ? offerText(input.name, "Nome", 120) : null;
    const reason = decision === "changes" ? offerText(input.reason, "Alteração solicitada", 1000) : null;
    const state = decision === "accept" ? "ACCEPTED" : "CHANGES_REQUESTED";
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      const result = await tx.serviceOffer.updateMany({
        where: { publicTokenHash, state: "OPEN", expiresAt: { gt: now } },
        data: { state, customerReply: reason, acceptedBy: name, acceptedAt: name ? now : null },
      });
      const offer = await tx.serviceOffer.findUnique({ where: { publicTokenHash }, select: { id: true, tenantId: true, state: true } });
      if (!offer || offer.state === "REVOKED") throw new NotFoundException("Proposta indisponível.");
      if (!result.count) {
        if (offer.state === state) return;
        throw new ConflictException("Esta proposta já foi respondida ou expirou.");
      }
      if (state === "ACCEPTED") await tx.serviceOrder.create({ data: { offerId: offer.id } });
      await tx.auditLog.create({
        data: { tenantId: offer.tenantId, entityType: "service_offer", entityId: offer.id, action: "service_offer." + state.toLowerCase() },
      });
    });
    return this.read(token);
  }
}
