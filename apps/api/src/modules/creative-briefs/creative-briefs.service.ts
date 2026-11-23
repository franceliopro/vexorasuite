import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Intake estruturado de briefing criativo.
 *
 * Este serviço apenas RECEBE e REGISTRA um briefing completo. Ele não gera arte,
 * não aprova peça, não publica e não entrega nada. A execução criativa continua
 * fora da Véxora e depende de insumos, aprovação e evidência do proprietário.
 * Nenhum campo é preenchido por padrão: um rascunho incompleto não é aceito.
 */

const TEXT_FIELDS = [
  { key: "title", label: "title", max: 120 },
  { key: "objective", label: "objective", max: 2000 },
  { key: "channelFormat", label: "channelFormat", max: 500 },
  { key: "identity", label: "identity", max: 2000 },
  { key: "approvedSource", label: "approvedSource", max: 4000 },
  { key: "approver", label: "approver", max: 160 },
  { key: "destination", label: "destination", max: 500 },
] as const;

const REQUIRED_FIELDS = [...TEXT_FIELDS.map((field) => field.key), "deadline"];

type Input = Record<string, unknown>;
type Values = Record<string, string>;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} é obrigatório.`);
  }
  const clean = value.trim();
  if (clean.length > max) throw new BadRequestException(`${field} excede ${max} caracteres.`);
  return clean;
}

/** Data limite é gravada como date (AAAA-MM-DD) para evitar ambiguidade de fuso. */
function deadline(value: unknown): Date {
  const raw = text(value, "deadline", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new BadRequestException("deadline deve usar o formato AAAA-MM-DD.");
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new BadRequestException("deadline não é uma data válida.");
  }
  return parsed;
}

@Injectable()
export class CreativeBriefsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertManager(role: string) {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(role)) {
      throw new ForbiddenException("Somente responsáveis pela empresa podem registrar briefings.");
    }
  }

  private async owned(tenantId: string, id: string) {
    const brief = await this.prisma.creativeBrief.findFirst({ where: { id, tenantId } });
    if (!brief) throw new NotFoundException("Briefing não encontrado.");
    return brief;
  }

  /** Aceita somente briefing completo; não cria, aprova nem publica qualquer peça. */
  async create(input: Input, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const values: Values = {};
    for (const field of TEXT_FIELDS) {
      values[field.key] = text(input[field.key], field.label, field.max);
    }
    const limit = deadline(input.deadline);

    const created = await this.prisma.$transaction(async (tx) => {
      const brief = await tx.creativeBrief.create({
        data: {
          tenantId,
          createdBy: userId,
          status: "RECEIVED",
          title: values.title!,
          objective: values.objective!,
          channelFormat: values.channelFormat!,
          identity: values.identity!,
          approvedSource: values.approvedSource!,
          approver: values.approver!,
          destination: values.destination!,
          deadline: limit,
        },
      });
      await tx.creativeBriefEvent.create({
        data: {
          briefId: brief.id,
          tenantId,
          actorId: userId,
          action: "BRIEF_RECEIVED",
          details: { fields: REQUIRED_FIELDS, delivered: false, approved: false, published: false } as any,
        },
      });
      return brief;
    });
    return created;
  }

  async list(tenantId: string) {
    return this.prisma.creativeBrief.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(tenantId: string, id: string) {
    const brief = await this.prisma.creativeBrief.findFirst({
      where: { id, tenantId },
      include: { events: { orderBy: { createdAt: "desc" }, take: 100 } },
    });
    if (!brief) throw new NotFoundException("Briefing não encontrado.");
    return brief;
  }
}
