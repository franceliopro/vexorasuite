import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { contactMetadata, lockedContact } from "../prisma/contact-metadata";

/** Uma posição por cartão dentro de (empresa, pipeline, etapa). */
export type CrmCardScope = { tenantId: string; pipelineId: string | null; stage: string };
type CardRow = { id: string; crmPosition: number | null };

/** `position` é opcional: ausência significa acrescentar ao fim da etapa. */
export function parseCardPosition(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException("Posição do cartão inválida.");
  }
  return value;
}

function stageWhere(scope: CrmCardScope): Prisma.ContactWhereInput {
  return {
    tenantId: scope.tenantId,
    pipelineId: scope.pipelineId,
    metadata: { path: ["crmStage"], equals: scope.stage },
  };
}

const stageOrder: Prisma.ContactOrderByWithRelationInput[] = [
  { crmPosition: { sort: "asc", nulls: "last" } },
  { updatedAt: "desc" },
  { id: "asc" },
];

function sameScope(a: CrmCardScope | null, b: CrmCardScope): boolean {
  return !!a && a.tenantId === b.tenantId && a.pipelineId === b.pipelineId && a.stage === b.stage;
}

/**
 * Trava as etapas em ordem determinística antes de travar o cartão. Duas
 * movimentações cruzadas não intercalam posições nem formam ciclo de espera.
 */
async function lockStage(tx: Prisma.TransactionClient, tenantId: string, stage: string) {
  await tx.$queryRaw`SELECT id FROM contacts WHERE tenant_id = ${tenantId}::uuid AND metadata->>'crmStage' = ${stage} ORDER BY id FOR UPDATE`;
}

async function lockStages(tx: Prisma.TransactionClient, tenantId: string, stages: Array<string | null>) {
  const unique = [...new Set(stages.filter((stage): stage is string => !!stage))].sort();
  for (const stage of unique) await lockStage(tx, tenantId, stage);
}

async function readStage(tx: Prisma.TransactionClient, scope: CrmCardScope, excludeId: string): Promise<CardRow[]> {
  return tx.contact.findMany({
    where: { ...stageWhere(scope), id: { not: excludeId } },
    select: { id: true, crmPosition: true },
    orderBy: stageOrder,
  });
}

async function writePosition(tx: Prisma.TransactionClient, tenantId: string, rows: CardRow[], startAt: number, gapAt = -1) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const position = startAt + index + (gapAt >= 0 && index >= gapAt ? 1 : 0);
    if (row.crmPosition !== position) {
      await tx.contact.updateMany({ where: { id: row.id, tenantId }, data: { crmPosition: position } });
    }
  }
}

/**
 * Calcula, escreve e normaliza as posições dentro de uma transação já iniciada.
 * O chamador continua responsável por alterar os metadados e auditar na mesma transação.
 */
export async function placeCrmCard(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; contactId: string; pipelineId?: string | null; stage: string; position?: number | null },
) {
  const initial = await tx.contact.findFirst({
    where: { id: input.contactId, tenantId: input.tenantId },
    select: { id: true, metadata: true, pipelineId: true },
  });
  if (!initial) throw new BadRequestException("Contato não encontrado nesta empresa.");
  const initialStage = contactMetadata(initial.metadata).crmStage;
  await lockStages(tx, input.tenantId, [typeof initialStage === "string" ? initialStage : null, input.stage]);

  const contact = await lockedContact(tx, input.tenantId, input.contactId);
  const metadata = contactMetadata(contact.metadata);
  const previousStage = typeof metadata.crmStage === "string" ? metadata.crmStage : null;
  const previousPosition = contact.crmPosition ?? null;
  /* A leitura inicial e a leitura travada devem convergir para a mesma etapa. */
  if (previousStage) await lockStages(tx, input.tenantId, [previousStage]);

  /* Sem pipeline informado, a etapa é reordenada no pipeline atual do contato. */
  const target: CrmCardScope = {
    tenantId: input.tenantId,
    pipelineId: input.pipelineId === undefined ? contact.pipelineId ?? null : input.pipelineId ?? null,
    stage: input.stage,
  };
  const source: CrmCardScope | null = previousStage
    ? { tenantId: input.tenantId, pipelineId: contact.pipelineId ?? null, stage: previousStage }
    : null;

  const targetRows = await readStage(tx, target, input.contactId);
  const requested = parseCardPosition(input.position);
  const position = requested === null ? targetRows.length : Math.min(requested, targetRows.length);

  if (source && !sameScope(source, target)) {
    await writePosition(tx, input.tenantId, await readStage(tx, source, input.contactId), 0);
  }
  await writePosition(tx, input.tenantId, targetRows, 0, position);
  await tx.contact.updateMany({ where: { id: input.contactId, tenantId: input.tenantId }, data: { crmPosition: position } });

  return { contact, metadata, previousStage, previousPosition, position, pipelineId: target.pipelineId, targetCount: targetRows.length };
}

/** Novos cartões entram no fim da etapa inicial. */
export async function nextCardPosition(
  reader: Pick<Prisma.TransactionClient, "contact">,
  scope: CrmCardScope,
): Promise<number> {
  const last = await reader.contact.findFirst({
    where: stageWhere(scope),
    orderBy: { crmPosition: "desc" },
    select: { crmPosition: true },
  });
  return last?.crmPosition == null ? 0 : last.crmPosition + 1;
}
