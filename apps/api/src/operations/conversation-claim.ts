import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

type ConversationClaim = {
  assigneeId: string | null;
  claimedById: string | null;
  handlingMode: string;
  status: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
};

export function assertConversationClaim(conversation: ConversationClaim, userId: string) {
  if (conversation.handlingMode !== "HUMAN" || conversation.assigneeId !== userId ||
      conversation.claimedById !== userId || !["OPEN", "PENDING"].includes(conversation.status) ||
      conversation.archivedAt || conversation.deletedAt) {
    throw new ForbiddenException("Clique em Assumir conversa antes de enviar ao cliente.");
  }
}

export async function lockConversationClaim(tx: Prisma.TransactionClient, tenantId: string, id: string, userId: string) {
  const rows = await tx.$queryRaw<ConversationClaim[]>`
    SELECT assignee_id AS "assigneeId", claimed_by_id AS "claimedById", handling_mode AS "handlingMode",
           status, archived_at AS "archivedAt", deleted_at AS "deletedAt"
    FROM conversations WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE
  `;
  const [conversation] = rows;
  if (!conversation) throw new ForbiddenException("A conversa não está disponível para envio.");
  assertConversationClaim(conversation, userId);
}
