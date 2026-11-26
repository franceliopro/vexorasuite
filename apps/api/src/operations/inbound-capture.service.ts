import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { resolveContactIdentity } from "./contact-identity";
import { CaptureInboundDto } from "./dto/capture-inbound.dto";

const HUMAN_REQUEST = /^(atendente|humano|falar com atendente|falar com humano)$/i;
const OPT_OUT = /^(sair|parar|cancelar|opt[- ]?out|descadastrar|não quero receber)$/i;

export type InboundRoute = {
  handlingMode: "HUMAN";
  routedToHuman: true;
  reason: "explicit_human_request" | "opt_out_requested" | "deterministic_default";
  optOut: boolean;
};

/** Regras determinísticas: rodam antes de qualquer modelo e mantêm a conversa com humano. */
export function routeInbound(content: string): InboundRoute {
  const value = content.trim().toLowerCase();
  if (HUMAN_REQUEST.test(value)) {
    return { handlingMode: "HUMAN", routedToHuman: true, reason: "explicit_human_request", optOut: false };
  }
  if (OPT_OUT.test(value)) {
    return { handlingMode: "HUMAN", routedToHuman: true, reason: "opt_out_requested", optOut: true };
  }
  return { handlingMode: "HUMAN", routedToHuman: true, reason: "deterministic_default", optOut: false };
}

export type InboundCaptureResult = {
  ok: true;
  duplicate: boolean;
  contactId?: string;
  conversationId?: string;
  messageId?: string;
  handlingMode?: "HUMAN";
  reason?: InboundRoute["reason"];
};

@Injectable()
export class InboundCaptureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async capture(tenantId: string, userId: string, dto: CaptureInboundDto): Promise<InboundCaptureResult> {
    const provider = dto.provider.trim().toUpperCase();
    const externalEventId = dto.externalEventId.trim();
    const externalContactId = dto.externalContactId.trim();
    const channelConnectionId = dto.channelConnectionId ?? null;
    const channel = dto.channel?.trim().toUpperCase() || "API";
    const content = (dto.content ?? "").trim().slice(0, 20000);
    const providerMessageId = `inbound:${provider}:${externalEventId}`;
    const route = routeInbound(content);

    if (channelConnectionId) {
      const connection = await this.prisma.channelConnection.findFirst({
        where: { id: channelConnectionId, tenantId },
        select: { id: true },
      });
      if (!connection) throw new BadRequestException("Canal não encontrado nesta empresa.");
    }

    let saved: InboundCaptureResult;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        // Serializa a criação da conversa por contato/canal e bloqueia reprocessamento concorrente.
        const lockKey = `${tenantId}:inbound:${provider}:${externalContactId}:${channelConnectionId ?? "api"}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

        const duplicate = await tx.message.findFirst({
          where: { tenantId, providerMessageId },
          select: { id: true },
        });
        if (duplicate) return { ok: true as const, duplicate: true as const };

        let contact = await resolveContactIdentity(tx, {
          tenantId,
          provider,
          externalId: externalContactId,
          phone: dto.phone?.trim() || null,
          displayName: dto.name?.trim() || null,
          createContact: { name: dto.name?.trim() || externalContactId, source: dto.source?.trim() || provider },
        });
        if (!contact) throw new BadRequestException("Não foi possível resolver a identidade do contato.");

        const update: Prisma.ContactUpdateInput = {};
        if (dto.email?.trim() && !contact.email) update.email = dto.email.trim();
        if (dto.name?.trim() && (!contact.name || contact.name === contact.externalId || contact.name === contact.phone)) {
          update.name = dto.name.trim();
        }
        if (Object.keys(update).length) contact = await tx.contact.update({ where: { id: contact.id }, data: update });

        let conversation = await tx.conversation.findFirst({
          where: {
            tenantId,
            contactId: contact.id,
            channelConnectionId,
            status: { in: ["OPEN", "PENDING"] },
            archivedAt: null,
            deletedAt: null,
          },
          orderBy: { updatedAt: "desc" },
        });
        if (!conversation) {
          const general = route.routedToHuman
            ? await tx.department.findFirst({ where: { tenantId, key: "GENERAL", isActive: true }, select: { id: true } })
            : null;
          conversation = await tx.conversation.create({
            data: {
              tenantId,
              contactId: contact.id,
              channelConnectionId,
              channel,
              status: "OPEN",
              handlingMode: route.handlingMode,
              ...(general ? { departmentId: general.id } : {}),
            },
          });
        }

        const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
        const message = await tx.message.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            providerMessageId,
            direction: "INBOUND",
            status: "RECEIVED",
            content,
            contentType: "text",
            senderName: dto.name?.trim() || null,
            metadata: {
              provider,
              externalEventId,
              externalContactId,
              channel,
              ...(dto.source ? { source: dto.source.trim() } : {}),
              ...(dto.campaignId ? { campaignId: dto.campaignId.trim() } : {}),
              ...(route.optOut ? { optOut: true } : {}),
            } satisfies Prisma.InputJsonValue,
            occurredAt,
          },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: occurredAt } });
        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: "inbound.captured",
            entityType: "message",
            entityId: message.id,
            details: {
              provider,
              externalEventId,
              contactId: contact.id,
              conversationId: conversation.id,
              reason: route.reason,
            },
          },
        });
        return {
          ok: true as const,
          duplicate: false as const,
          contactId: contact.id,
          conversationId: conversation.id,
          messageId: message.id,
          handlingMode: route.handlingMode,
          reason: route.reason,
        };
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
        return { ok: true, duplicate: true };
      }
      throw error;
    }

    if (!saved.duplicate) {
      // Eventos apenas sinalizam o que já foi gravado; workflows e IA continuam sob as regras existentes.
      this.events.publish(tenantId, "inbound.captured", {
        contactId: saved.contactId,
        conversationId: saved.conversationId,
        messageId: saved.messageId,
        reason: saved.reason,
      });
      this.events.publish(tenantId, "message.received", {
        conversationId: saved.conversationId,
        contactId: saved.contactId,
        message: { id: saved.messageId, direction: "INBOUND", status: "RECEIVED" },
      });
      this.events.publish(tenantId, "conversation.updated", { id: saved.conversationId });
    }
    return saved;
  }
}
