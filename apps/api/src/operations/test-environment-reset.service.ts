import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../auth/auth.types";
import { WahaService } from "./waha.service";
import { EventsService } from "./events.service";

type ResetBody = {
  confirmation?: unknown;
  clientSlug?: unknown;
  resetPlatformConversations?: unknown;
  disconnectProviders?: unknown;
};

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

@Injectable()
export class TestEnvironmentResetService {
  constructor(private readonly prisma: PrismaService, private readonly waha: WahaService, private readonly events: EventsService) {}

  async reset(request: AuthenticatedRequest, body: ResetBody) {
    if (body.confirmation !== "REINICIAR AMBIENTE DE TESTE") {
      throw new BadRequestException("Digite REINICIAR AMBIENTE DE TESTE para confirmar.");
    }
    const clientSlug = typeof body.clientSlug === "string" ? body.clientSlug.trim().toLowerCase() : "";
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(clientSlug)) {
      throw new BadRequestException("Informe o identificador exato da empresa cliente.");
    }
    if (body.resetPlatformConversations !== true) {
      throw new BadRequestException("Confirme também a limpeza das conversas da Matriz.");
    }
    const rawProviders = body.disconnectProviders === undefined ? ["WAHA", "ZERNIO"] : body.disconnectProviders;
    if (!Array.isArray(rawProviders)) throw new BadRequestException("Selecione as integrações a desconectar.");
    const providers = [...new Set(rawProviders.map(value => String(value).toUpperCase()))];
    if (providers.some(value => !["WAHA", "ZERNIO"].includes(value))) {
      throw new BadRequestException("Integração de reset inválida.");
    }

    if (!request.user.isPlatformAdmin) throw new BadRequestException("O reset só pode ser executado pela administração da plataforma.");
    const platform = await this.prisma.tenant.findFirst({
      where: {
        kind: "PLATFORM",
        status: "ACTIVE",
        OR: [
          { id: request.user.tenantId },
          { memberships: { some: { userId: request.user.sub, role: { in: ["OWNER", "ADMIN"] } } } },
        ],
      },
      select: { id: true, integrations: true },
    });
    if (!platform) throw new BadRequestException("Nenhum ambiente de plataforma ativo foi encontrado para este administrador.");
    const client = await this.prisma.tenant.findFirst({
      where: { slug: clientSlug, kind: "COMPANY", status: "ACTIVE" },
      select: { id: true, name: true, slug: true },
    });
    if (!client) throw new NotFoundException("Empresa cliente não encontrada ou já removida.");

    const channels = await this.prisma.channelConnection.findMany({
      where: { tenantId: { in: [platform.id, client.id] }, provider: { in: providers }, isActive: true },
      select: { id: true, tenantId: true, provider: true, sessionName: true },
    });
    const wahaChannels = channels.filter(row => row.provider === "WAHA");

    // Primeiro concluímos a limpeza transacional do banco. Desconectar o provedor
    // antes disso deixava o reset pela metade quando o gateway estava indisponível.
    const result = await this.prisma.$transaction(async tx => {
      const platformConversations = await tx.conversation.findMany({ where: { tenantId: platform.id }, select: { id: true } });
      const conversationIds = platformConversations.map(row => row.id);
      if (conversationIds.length) {
        await tx.internalMention.deleteMany({ where: { tenantId: platform.id, conversationId: { in: conversationIds } } });
        await tx.workflowRun.deleteMany({ where: { tenantId: platform.id, conversationId: { in: conversationIds } } });
        await tx.payment.deleteMany({ where: { tenantId: platform.id, conversationId: { in: conversationIds } } });
        await tx.serviceProtocol.deleteMany({ where: { tenantId: platform.id, conversationId: { in: conversationIds } } });
        await tx.message.deleteMany({ where: { tenantId: platform.id, conversationId: { in: conversationIds } } });
        await tx.conversationParticipant.deleteMany({ where: { tenantId: platform.id, conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { tenantId: platform.id, id: { in: conversationIds } } });
      }
      await tx.channelConnection.updateMany({
        where: { tenantId: platform.id, provider: { in: providers }, isActive: true },
        data: { isActive: false, status: "DISCONNECTED", lastError: "TEST_ENVIRONMENT_RESET" },
      });
      const integrationRoot = object(platform.integrations);
      delete integrationRoot.intelligencePublished;
      delete integrationRoot.intelligencePublications;
      if (integrationRoot.assistant && typeof integrationRoot.assistant === "object" && !Array.isArray(integrationRoot.assistant)) {
        integrationRoot.assistant = { ...(integrationRoot.assistant as JsonObject), enabled: false };
      }
      await tx.tenant.update({ where: { id: platform.id }, data: { integrations: integrationRoot as Prisma.InputJsonValue } });
      await tx.tenant.delete({ where: { id: client.id } });
      await tx.auditLog.create({
        data: {
          tenantId: platform.id,
          userId: request.user.sub,
          action: "test.environment.reset",
          entityType: "tenant",
          entityId: client.id,
          details: {
            removedClient: { id: client.id, name: client.name, slug: client.slug },
            platformConversationsDeleted: conversationIds.length,
            providers,
            hiddenAutomationDisabled: true,
          },
        },
      });
      return { conversationsDeleted: conversationIds.length };
    }, { timeout: 120000 });

    const providerResults: { id: string; status: "DISCONNECTED" | "PENDING"; error?: string }[] = [];
    for (const channel of wahaChannels) {
      try {
        await this.waha.deleteSession(channel as any);
        providerResults.push({ id: channel.id, status: "DISCONNECTED" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gateway WAHA indisponível.";
        await this.prisma.channelConnection.update({
          where: { id: channel.id },
          data: { isActive: false, status: "DISCONNECTED", lastError: "WAHA_RESET_PENDING" },
        }).catch(() => undefined);
        providerResults.push({ id: channel.id, status: "PENDING", error: message });
      }
    }

    this.events.publish(platform.id, "test.environment.reset", { clientSlug: client.slug, providers, conversationsDeleted: result.conversationsDeleted, providerResults });
    return { ok: true, removedClient: { name: client.name, slug: client.slug }, ...result, providers, providerResults, hiddenAutomationDisabled: true };
  }
}
