import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";

@Injectable()
export class ServiceProtocolsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  async getOrCreate(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException("Atendimento não encontrado nesta empresa.");
    const existing = await this.prisma.serviceProtocol.findUnique({ where: { conversationId } });
    if (existing) return existing;
    // Random, non-sequential code avoids exposing volumes and remains stable across retries.
    const code = `AT-${new Date().getUTCFullYear()}-${randomBytes(6).toString("hex").toUpperCase()}`;
    const protocol = await this.prisma.serviceProtocol.upsert({
      where: { conversationId },
      create: { id: randomUUID(), tenantId, conversationId, code },
      update: {},
    });
    if (protocol.code === code) {
      this.events.publish(tenantId, "protocol.created", {
        protocolId: protocol.id, protocol: protocol.code, conversationId,
      });
    }
    return protocol;
  }

  async find(tenantId: string, code: string) {
    const protocol = await this.prisma.serviceProtocol.findUnique({
      where: { tenantId_code: { tenantId, code } },
      include: { conversation: { select: { id: true, contactId: true, status: true, departmentId: true } } },
    });
    if (!protocol) throw new NotFoundException("Protocolo não encontrado.");
    return protocol;
  }
}
