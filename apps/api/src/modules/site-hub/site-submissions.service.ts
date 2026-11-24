import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DirectusSubmissionsService } from "./directus-submissions.service";

const DECISIONS = ["APPROVED", "REJECTED"];
type Input = Record<string, unknown>;

type DecisionRow = {
  id: string;
  tenantId: string;
  submissionKey: string;
  directusId: string | null;
  decision: string;
  reason: string | null;
  actorId: string;
  status: string;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const NOTIFICATION = Object.freeze({
  status: "NOT_CONFIRMED",
  message: "O envio por e-mail/WhatsApp é executado pelo Directus e só é considerado enviado após confirmação do provedor.",
});

function text(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${field} é obrigatório.`);
  const clean = value.trim();
  if (clean.length > max) throw new BadRequestException(`${field} excede ${max} caracteres.`);
  return clean;
}

function optionalText(value: unknown, field: string, max = 1000): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new BadRequestException(`${field} deve ser texto.`);
  const clean = value.trim();
  if (clean.length > max) throw new BadRequestException(`${field} excede ${max} caracteres.`);
  return clean || null;
}

function iso(value: unknown): string | null {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Submissões de anunciantes no HUB de Sites.
 *
 * O Directus é a fonte dos dados; a Véxora registra a decisão humana, quem a
 * tomou e quando. O envio ao anunciante é um Flow externo: enquanto não há
 * confirmação do provedor, o status de notificação permanece NOT_CONFIRMED.
 */
@Injectable()
export class SiteSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directus: DirectusSubmissionsService,
  ) {}

  private assertManager(role: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(role)) {
      throw new ForbiddenException("Somente responsáveis pela empresa podem decidir sobre anúncios.");
    }
  }

  private view(row: DecisionRow | null | undefined) {
    if (!row) return null;
    return {
      decision: row.decision,
      reason: row.reason,
      actorId: row.actorId,
      status: row.status,
      lastError: row.lastError,
      decidedAt: iso(row.updatedAt),
    };
  }

  async list(tenantId: string, role: string) {
    this.assertManager(role);
    this.directus.assertConfigured(tenantId);

    const [submissions, decisions] = await Promise.all([
      this.directus.listPending(),
      this.prisma.siteHubSubmissionDecision.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    ]);
    const byKey = new Map((decisions as DecisionRow[]).map((row) => [row.submissionKey, row]));

    return {
      configured: true,
      notification: NOTIFICATION,
      submissions: submissions.map((submission) => ({
        ...submission,
        decision: this.view(byKey.get(submission.submission_key)),
      })),
    };
  }

  async decide(submissionKey: string, input: Input, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    this.directus.assertConfigured(tenantId);

    const key = text(submissionKey, "submissionKey", 200);
    if (!/^[A-Za-z0-9._:-]+$/.test(key)) throw new BadRequestException("submissionKey contém caracteres inválidos.");
    const decision = text(input.decision, "decision", 20).toUpperCase();
    if (!DECISIONS.includes(decision)) throw new BadRequestException("decision deve ser APPROVED ou REJECTED.");
    const reason = optionalText(input.reason, "reason", 1000);
    if (decision === "REJECTED" && !reason) throw new BadRequestException("O motivo é obrigatório ao rejeitar um anúncio.");

    const where = { tenantId_submissionKey: { tenantId, submissionKey: key } };
    const prior = await this.prisma.siteHubSubmissionDecision.findUnique({ where }) as DecisionRow | null;

    if (prior?.status === "DECIDED") {
      if (prior.decision !== decision) {
        throw new BadRequestException("Esta submissão já recebeu uma decisão diferente. A decisão não pode ser alterada.");
      }
      return { ...this.view(prior), submissionKey: key, idempotent: true, notification: NOTIFICATION };
    }
    if (prior?.status === "PROCESSING") {
      throw new BadRequestException("Já existe uma decisão em andamento para esta submissão. Aguarde e tente novamente.");
    }

    let claim: DecisionRow;
    if (prior?.status === "FAILED") {
      claim = await this.prisma.siteHubSubmissionDecision.update({
        where: { id: prior.id },
        data: { decision, reason, actorId: userId, status: "PROCESSING", lastError: null },
      }) as DecisionRow;
    } else {
      try {
        claim = await this.prisma.siteHubSubmissionDecision.create({
          data: { tenantId, submissionKey: key, decision, reason, actorId: userId, status: "PROCESSING" },
        }) as DecisionRow;
      } catch {
        // Concorrência: outra requisição reivindicou a mesma submissão.
        const existing = await this.prisma.siteHubSubmissionDecision.findUnique({ where }) as DecisionRow | null;
        if (existing?.status === "DECIDED" && existing.decision === decision) {
          return { ...this.view(existing), submissionKey: key, idempotent: true, notification: NOTIFICATION };
        }
        throw new BadRequestException("Esta submissão já recebeu uma decisão; recarregue a lista.");
      }
    }

    try {
      const found = await this.directus.findByKey(key);
      if (!found) throw new NotFoundException("Submissão não encontrada no Directus.");
      if (found.status !== "pending") throw new BadRequestException("Esta submissão não está mais pendente no Directus.");
      await this.directus.decide(found.id, decision as "APPROVED" | "REJECTED", reason);

      const saved = await this.prisma.siteHubSubmissionDecision.update({
        where: { id: claim.id },
        data: { status: "DECIDED", directusId: found.id },
      }) as DecisionRow;
      return { ...this.view(saved), submissionKey: key, idempotent: false, notification: NOTIFICATION };
    } catch (error) {
      await this.prisma.siteHubSubmissionDecision.update({
        where: { id: claim.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message.slice(0, 300) : "Falha desconhecida",
        },
      });
      throw error;
    }
  }
}
