/**
 * Formulários de sites publicados.
 *
 * A identidade do formulário é derivada de siteId + id do bloco no SiteDocument,
 * então não depende de um cadastro prévio nem de configurações do cliente. Nada é aceito
 * de um site que não esteja publicado, e os campos aceitos vêm do documento salvo.
 */
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

type AnyRecord = Record<string, unknown>;
type FormNode = { id?: unknown; type?: unknown; props?: unknown; children?: unknown };

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

type SubmitInput = {
  values?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

const MAX_VALUES_CHARS = 8_000;
const MAX_FIELD_LENGTH = 2_000;
const SUBMIT_LIMIT = 8;
const SUBMIT_WINDOW_MS = 10 * 60_000;
const MIN_FILL_MS = 800;

const rateWindows = new Map<string, number[]>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const hits = (rateWindows.get(key) ?? []).filter((stamp) => now - stamp < SUBMIT_WINDOW_MS);
  if (hits.length >= SUBMIT_LIMIT) return false;
  hits.push(now);
  if (rateWindows.size > 5_000) rateWindows.clear();
  rateWindows.set(key, hits);
  return true;
}

/** UUIDv5 estável: o mesmo bloco sempre resolve para o mesmo SiteForm, sem corrida. */
function formUuid(seed: string): string {
  const bytes = Buffer.from(createHash("sha1").update(`vexora-site-form:v1:${seed}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeField(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function findFormBlock(node: unknown, blockId: string, depth = 0): FormNode | null {
  if (!node || typeof node !== "object" || depth > 24) return null;
  const item = node as FormNode;
  if (item.type === "form" && String(item.id ?? "") === blockId) return item;
  for (const child of Array.isArray(item.children) ? item.children : []) {
    const found = findFormBlock(child, blockId, depth + 1);
    if (found) return found;
  }
  return null;
}

function allowedFields(block: FormNode): string[] {
  const props = block.props && typeof block.props === "object" ? (block.props as AnyRecord) : {};
  const raw = Array.isArray(props.fields) ? props.fields : ["nome", "email", "mensagem"];
  return [...new Set(raw.map(normalizeField).filter(Boolean))].slice(0, 20);
}

function cleanValues(input: unknown, allowed: string[]): AnyRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestException("Preencha os campos do formulário.");
  }
  if (JSON.stringify(input).length > MAX_VALUES_CHARS) {
    throw new BadRequestException("Formulário muito grande. Envie uma mensagem mais curta.");
  }
  const permitted = new Set(allowed);
  const result: AnyRecord = {};
  for (const [key, raw] of Object.entries(input as AnyRecord)) {
    const field = normalizeField(key);
    if (!permitted.has(field)) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") continue;
    const value = String(raw).trim().slice(0, MAX_FIELD_LENGTH);
    if (value) result[field] = value;
  }
  if (!Object.keys(result).length) throw new BadRequestException("Preencha ao menos um campo.");
  for (const [field, value] of Object.entries(result)) {
    if (field.replace(/_/g, "").includes("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value))) {
      throw new BadRequestException("Informe um e-mail válido.");
    }
  }
  return result;
}

function leadOf(values: AnyRecord): { name: string; email: string | null; phone: string | null } {
  const pick = (fragments: string[]): string | null => {
    const key = Object.keys(values).find((field) => fragments.some((part) => field.includes(part)));
    return key ? String(values[key]) : null;
  };
  return {
    name: pick(["nome", "name"])?.slice(0, 120) || "Contato via site",
    email: pick(["email", "e_mail"])?.slice(0, 160) ?? null,
    phone: pick(["telefone", "celular", "phone"])?.slice(0, 30) ?? null,
  };
}

@Injectable()
export class SiteFormsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(siteId: string, blockId: string, input: SubmitInput, ip: string) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(blockId)) throw new BadRequestException("Formulário inválido.");
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, tenantId: true, name: true, published: true },
    });
    if (!site || !site.published) throw new NotFoundException("Site não encontrado ou ainda não publicado.");

    const doc = await this.prisma.siteDocument.findUnique({ where: { siteId }, select: { document: true } });
    // O SiteDocument salvo tem a forma { version, root, meta }; o formulário vive dentro de root.
    const stored = doc?.document;
    const root = isRecord(stored) && "root" in stored ? stored.root : stored;
    const block = findFormBlock(root, blockId);
    if (!block) throw new NotFoundException("Formulário não encontrado neste site.");

    // Honeypot: responde sucesso sem gravar, para não educar bots.
    if (String(input?.website ?? "").trim()) return { ok: true, message: "Mensagem enviada. Obrigado pelo contato!" };
    if (!rateLimit(`${siteId}:${ip}`)) {
      throw new HttpException("Muitos envios em sequência. Aguarde alguns minutos.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const startedAt = Number(input?.startedAt);
    if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < MIN_FILL_MS) {
      throw new HttpException("Envio muito rápido. Tente novamente em instantes.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const fields = allowedFields(block);
    const values = cleanValues(input?.values, fields);
    const formId = formUuid(`${siteId}:${blockId}`);
    const lead = leadOf(values);

    const submission = await this.prisma.$transaction(async (tx) => {
      await tx.siteForm.upsert({
        where: { id: formId },
        create: {
          id: formId,
          siteId,
          name: `form:${blockId}`,
          fields: fields as Prisma.InputJsonValue,
          targets: [] as Prisma.InputJsonValue,
        },
        update: { fields: fields as Prisma.InputJsonValue, isActive: true },
      });
      const row = await tx.siteFormSubmission.create({
        data: { formId, siteId, pageSlug: "index", values: values as Prisma.InputJsonValue },
      });
      await tx.contact.create({
        data: {
          tenantId: site.tenantId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: `Site: ${site.name}`.slice(0, 120),
          externalId: `site-form:${row.id}`,
          metadata: { siteId, formId, blockId } as Prisma.InputJsonValue,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: site.tenantId,
          action: "site.form.submitted",
          entityType: "site_form",
          entityId: formId,
          details: { siteId, blockId, fieldCount: Object.keys(values).length } as Prisma.InputJsonValue,
        },
      });
      return row;
    });

    return { ok: true, id: submission.id, message: "Mensagem enviada. Obrigado pelo contato!" };
  }

  async list(siteId: string, tenantId: string, limit: number) {
    const site = await this.prisma.site.findFirst({ where: { id: siteId, tenantId }, select: { id: true } });
    if (!site) throw new NotFoundException("Site não encontrado");
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const [total, rows] = await Promise.all([
      this.prisma.siteFormSubmission.count({ where: { siteId } }),
      this.prisma.siteFormSubmission.findMany({
        where: { siteId },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, createdAt: true, values: true, form: { select: { name: true } } },
      }),
    ]);
    return {
      total,
      submissions: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        formName: row.form.name,
        values: row.values,
      })),
    };
  }
}

export { formUuid, findFormBlock, allowedFields, cleanValues };
