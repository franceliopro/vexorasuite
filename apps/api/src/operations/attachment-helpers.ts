export const ATTACHMENT_SERVICES = ["INBOX", "IA", "CHATBOT", "SITE"] as const;
export type AttachmentService = (typeof ATTACHMENT_SERVICES)[number];
export function isAttachmentService(value: unknown): value is AttachmentService {
  return typeof value === "string" && (ATTACHMENT_SERVICES as readonly string[]).includes(value);
}
/** Cliente Prisma mínimo — aceita o client global e o client de transação (tx). */
export type AttachmentClient = {
  channelAttachment: {
    findMany: (args: { where?: any; select?: { channelConnectionId?: boolean; service?: boolean; attached?: boolean } }) => Promise<Array<{ channelConnectionId?: string; service: string; attached: boolean }>>;
    createMany: (args: { data: Array<{ channelConnectionId: string; service: string; attached: boolean }>; skipDuplicates?: boolean }) => Promise<unknown>;
  };
};
/** Lê os anexos de uma lista de canais e devolve mapa {channelId: {INBOX:true, ...}}. */
export async function attachmentsMap(prisma: AttachmentClient, tenantId: string, channelIds: string[]): Promise<Map<string, Record<string, boolean>>> {
  const result = new Map<string, Record<string, boolean>>();
  if (!channelIds.length) return result;
  const rows = await prisma.channelAttachment.findMany({ where: { channelConnectionId: { in: channelIds } }, select: { channelConnectionId: true, service: true, attached: true } });
  for (const id of channelIds) result.set(id, Object.fromEntries(ATTACHMENT_SERVICES.map(s => [s, false])));
  for (const row of rows) {
    const current = result.get(row.channelConnectionId!) || Object.fromEntries(ATTACHMENT_SERVICES.map(s => [s, false]));
    current[row.service] = row.attached;
    result.set(row.channelConnectionId!, current);
  }
  return result;
}
/** Cria os anexos padrão (todos desligados — instância ≠ atendimento) para uma nova conexão. */
export async function createDefaultAttachments(prisma: AttachmentClient, channelConnectionId: string) {
  await prisma.channelAttachment.createMany({
    data: ATTACHMENT_SERVICES.map(service => ({ channelConnectionId, service, attached: false })),
    skipDuplicates: true,
  });
}
