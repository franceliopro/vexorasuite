import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { buildPdf } from "../../operations/document-helpers";
import { WahaService } from "../../operations/waha.service";
import { isManager } from "../school/school-rules";
import { DocumensoClient } from "./documenso.client";
import {
  TEMPLATE_KINDS,
  WEEKDAYS,
  cpf,
  enrollmentValues,
  hhmm,
  inList,
  integer,
  isoDate,
  optionalInList,
  optionalInteger,
  optionalText,
  phone,
  renderVariables,
  stripHtml,
  text,
  variablesOf,
} from "./enrollment-rules";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[a-f0-9]{48}$/;
const attempts = new Map<string, number[]>();

/**
 * Matrícula externa da escola de música. Toda leitura/escrita começa pelo tenant
 * dono do link; o visitante nunca informa tenant, empresa ou credencial.
 */
@Injectable()
export class SchoolEnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documenso: DocumensoClient,
    private readonly waha: WahaService,
  ) {}

  private assertManager(role: string) {
    if (!isManager(role)) throw new ForbiddenException("Somente responsáveis pela escola podem configurar matrículas.");
  }

  private uuid(value: unknown, label: string): string | null {
    if (value === undefined || value === null || value === "") return null;
    const raw = typeof value === "string" ? value.trim() : "";
    if (!UUID_RE.test(raw)) throw new NotFoundException(`${label} inválido nesta empresa.`);
    return raw;
  }

  private publicBase(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/$/, "");
  }

  private async tenantCourse(tenantId: string, courseId: string | null) {
    if (!courseId) return null;
    const course = await this.prisma.schoolCourse.findFirst({ where: { id: courseId, tenantId } });
    if (!course) throw new NotFoundException("Curso não encontrado nesta empresa.");
    return course;
  }

  private async tenantClass(tenantId: string, classId: string | null) {
    if (!classId) return null;
    const row = await this.prisma.schoolClass.findFirst({ where: { id: classId, tenantId } });
    if (!row) throw new NotFoundException("Turma não encontrada nesta empresa.");
    return row;
  }

  private brandOf(integrations: unknown) {
    const root = integrations && typeof integrations === "object" && !Array.isArray(integrations)
      ? integrations as Record<string, any>
      : {};
    const brand = root.brand && typeof root.brand === "object" && !Array.isArray(root.brand) ? root.brand : {};
    return {
      primaryColor: typeof brand.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(brand.primaryColor) ? brand.primaryColor : "#4F46E5",
      schoolName: typeof brand.companyName === "string" ? brand.companyName.slice(0, 120) : "",
      logoUrl: typeof brand.logoLight === "string" && /^https:\/\//.test(brand.logoLight) ? brand.logoLight : "",
    };
  }

  private rateLimited(token: string, ip: string) {
    const key = `${token}:${ip}`;
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter((value) => now - value < 10 * 60_000);
    if (recent.length >= 5) {
      attempts.set(key, recent);
      return true;
    }
    recent.push(now);
    attempts.set(key, recent);
    return false;
  }

  private async findActiveLink(token: string) {
    if (!TOKEN_RE.test(token)) throw new NotFoundException("Link de matrícula inválido.");
    const link = await this.prisma.schoolEnrollmentLink.findUnique({ where: { token } });
    if (!link || link.status !== "ACTIVE" || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
      throw new NotFoundException("Link de matrícula indisponível.");
    }
    return link;
  }

  private pdfHeader(tenantName: string) {
    return { title: tenantName, subtitle: "Matrícula · Contrato e Ficha", line: "Documento gerado após confirmação de assinatura" };
  }

  async overview(tenantId: string) {
    const [courses, classes, templates, links, submissions] = await Promise.all([
      this.prisma.schoolCourse.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, take: 200 }),
      this.prisma.schoolClass.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" }, take: 200 }),
      this.prisma.schoolEnrollmentTemplate.findMany({ where: { tenantId }, orderBy: [{ kind: "asc" }, { name: "asc" }], take: 100 }),
      this.prisma.schoolEnrollmentLink.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 }),
      this.prisma.schoolEnrollmentSubmission.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          documents: { select: { id: true, kind: true, name: true, generatedAt: true } },
          deliveries: { select: { id: true, recipientRole: true, status: true, error: true, sentAt: true } },
          envelopes: { select: { envelopeId: true, status: true, signingUrl: true } },
        },
      }),
    ]);
    let whatsappConfigured = true;
    try { this.waha.assertConfigured(); } catch { whatsappConfigured = false; }
    return {
      courses: courses.map((course) => ({
        id: course.id,
        name: course.name,
        kind: course.kind,
        parentId: course.parentId,
        imageUrl: course.imageUrl,
        summary: course.summary,
        level: course.level,
        durationLabel: course.durationLabel,
        tuitionAmountCents: course.tuitionAmountCents,
      })),
      classes: classes.map((item) => ({ id: item.id, name: item.name, courseId: item.courseId, weekday: item.weekday, startTime: item.startTime })),
      templates: templates.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        source: item.source,
        driveFileId: item.driveFileId,
        variables: item.variables,
        configuredAt: item.configuredAt,
      })),
      links: links.map((item) => ({
        id: item.id,
        token: item.token,
        url: `${this.publicBase()}/m/${item.token}`,
        status: item.status,
        ownerName: item.ownerName,
        courseId: item.courseId,
        classId: item.classId,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
      })),
      submissions,
      readiness: {
        contractTemplate: templates.some((item) => item.kind === "CONTRACT" && item.configuredAt),
        formTemplate: templates.some((item) => item.kind === "ENROLLMENT_FORM" && item.configuredAt),
        documenso: this.documenso.isConfigured(),
        whatsapp: whatsappConfigured,
      },
    };
  }

  async saveTemplate(body: Record<string, unknown>, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const kind = inList(body?.kind, TEMPLATE_KINDS, "Tipo de modelo");
    const name = text(body?.name, 80, "Nome do modelo");
    const bodyHtml = text(body?.bodyHtml, 40_000, "Conteúdo do modelo");
    if (bodyHtml.length < 20) throw new NotFoundException("O modelo deve ter pelo menos 20 caracteres.");
    const driveFileId = optionalText(body?.driveFileId, 200, "ID do arquivo no Drive");
    const source = body?.driveFileId ? "DRIVE_MANUAL" : "DRIVE_MANUAL";
    const variables = variablesOf(bodyHtml);
    const row = await this.prisma.schoolEnrollmentTemplate.upsert({
      where: { tenantId_kind_name: { tenantId, kind, name } },
      create: {
        tenantId, kind, name, bodyHtml, variables, source,
        driveFileId, configuredAt: new Date(), createdById: userId,
      },
      update: { bodyHtml, variables, source, driveFileId, configuredAt: new Date() },
    });
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      variables,
      source: row.source,
      configured: true,
      importedFromDrive: false,
      message: "Modelo salvo para esta escola. A importação automática do Drive ainda não foi executada.",
    };
  }

  async createLink(body: Record<string, unknown>, tenantId: string, role: string, userId: string) {
    this.assertManager(role);
    const ownerName = text(body?.ownerName, 120, "Nome do professor responsável");
    const ownerPhone = phone(body?.ownerPhone, "WhatsApp do professor"); // opcional; usado apenas para entregas
    const ownerEmail = optionalText(body?.ownerEmail, 160, "E-mail do professor");
    const welcomeMessage = optionalText(body?.welcomeMessage, 2000, "Mensagem de boas-vindas");
    const courseId = this.uuid(body?.courseId, "Curso");
    const classId = this.uuid(body?.classId, "Turma");
    const course = await this.tenantCourse(tenantId, courseId);
    const schoolClass = await this.tenantClass(tenantId, classId);
    if (course && schoolClass && schoolClass.courseId !== course.id) {
      throw new NotFoundException("A turma escolhida não pertence ao curso informado.");
    }
    const expiresAt = isoDate(body?.expiresAt, "Validade do link");
    if (expiresAt && expiresAt.getTime() <= Date.now()) throw new NotFoundException("A validade do link deve ser futura.");
    const row = await this.prisma.schoolEnrollmentLink.create({
      data: {
        tenantId,
        token: randomBytes(24).toString("hex"),
        courseId: course?.id ?? null,
        classId: schoolClass?.id ?? null,
        ownerName,
        ownerPhone,
        ownerEmail,
        welcomeMessage,
        status: "ACTIVE",
        expiresAt,
        createdById: userId,
      },
    });
    return { ...row, url: `${this.publicBase()}/m/${row.token}` };
  }

  async rotateLink(id: string, tenantId: string, role: string) {
    this.assertManager(role);
    const link = await this.prisma.schoolEnrollmentLink.findFirst({ where: { id, tenantId } });
    if (!link) throw new NotFoundException("Link não encontrado nesta empresa.");
    const row = await this.prisma.schoolEnrollmentLink.update({
      where: { id: link.id },
      data: { token: randomBytes(24).toString("hex"), status: "ACTIVE" },
    });
    return { ...row, url: `${this.publicBase()}/m/${row.token}` };
  }

  async setLinkStatus(id: string, tenantId: string, role: string, body: Record<string, unknown>) {
    this.assertManager(role);
    const status = inList(body?.status, ["ACTIVE", "PAUSED"], "Status do link");
    const link = await this.prisma.schoolEnrollmentLink.findFirst({ where: { id, tenantId } });
    if (!link) throw new NotFoundException("Link não encontrado nesta empresa.");
    return this.prisma.schoolEnrollmentLink.update({ where: { id: link.id }, data: { status } });
  }

  async publicForm(token: string) {
    const link = await this.findActiveLink(token);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: link.tenantId }, select: { id: true, name: true, slug: true, status: true, integrations: true } });
    if (!tenant || tenant.status !== "ACTIVE") throw new NotFoundException("Link de matrícula indisponível.");
    const [course, schoolClass, templates] = await Promise.all([
      this.tenantCourse(link.tenantId, link.courseId),
      this.tenantClass(link.tenantId, link.classId),
      this.prisma.schoolEnrollmentTemplate.findMany({ where: { tenantId: link.tenantId }, select: { kind: true, configuredAt: true } }),
    ]);
    return {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      brand: this.brandOf(tenant.integrations),
      ownerName: link.ownerName,
      welcomeMessage: link.welcomeMessage || `Olá! Sou ${link.ownerName}, professor da ${tenant.name}. Preencha seus dados para receber o contrato e a ficha de matrícula.`,
      course: course ? {
        id: course.id,
        name: course.name,
        imageUrl: course.imageUrl,
        summary: course.summary,
        level: course.level,
        durationLabel: course.durationLabel,
        tuitionAmountCents: course.tuitionAmountCents,
      } : null,
      schoolClass: schoolClass ? {
        id: schoolClass.id,
        name: schoolClass.name,
        weekday: schoolClass.weekday,
        startTime: schoolClass.startTime,
        durationMinutes: schoolClass.durationMinutes,
      } : null,
      templateStatus: {
        contract: templates.some((item) => item.kind === "CONTRACT" && item.configuredAt),
        enrollmentForm: templates.some((item) => item.kind === "ENROLLMENT_FORM" && item.configuredAt),
      },
      /** Dados pessoais da aluna do PDF de referência NÃO são pré-preenchidos. */
      prefilled: {},
    };
  }

  async submit(token: string, body: Record<string, unknown>, ip: string) {
    const link = await this.findActiveLink(token);
    if (typeof body?.website === "string" && body.website.trim()) throw new BadRequestException("Submissão recusada.");
    if (this.rateLimited(token, ip)) throw new BadRequestException("Muitas tentativas neste link. Aguarde alguns minutos.");

    const studentName = text(body?.studentName, 120, "Nome da aluna ou aluno");
    const studentCpf = cpf(body?.studentCpf, "CPF");
    const studentEmail = optionalText(body?.studentEmail, 160, "E-mail");
    if (studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) throw new BadRequestException("E-mail inválido.");
    const studentPhone = phone(body?.studentPhone, "WhatsApp");
    const guardianName = optionalText(body?.guardianName, 120, "Responsável");
    const guardianRelationship = optionalInList(body?.guardianRelationship, ["MAE", "PAI", "RESPONSAVEL", "OUTRO"], "Parentesco");
    const guardianPhone = phone(body?.guardianPhone, "WhatsApp do responsável");
    const guardianEmail = optionalText(body?.guardianEmail, 160, "E-mail do responsável");
    const addressLine = optionalText(body?.addressLine, 300, "Endereço");
    const instrument = optionalText(body?.instrument, 80, "Instrumento");
    const level = optionalText(body?.level, 80, "Nível");
    const startDate = isoDate(body?.startDate, "Data de início");
    const startTime = hhmm(body?.startTime, "Horário");
    const weekday = optionalInteger(body?.weekday, 1, 7, "Dia da semana");
    const paymentMethod = optionalInList(body?.paymentMethod, ["BOLETO", "PIX", "CASH", "TRANSFER"], "Forma de pagamento");
    const observations = optionalText(body?.observations, 4000, "Observações");
    const courseId = this.uuid(body?.courseId, "Curso") ?? link.courseId;
    const classId = this.uuid(body?.classId, "Turma") ?? link.classId;
    const course = await this.tenantCourse(link.tenantId, courseId);
    const schoolClass = await this.tenantClass(link.tenantId, classId);
    if (course && schoolClass && schoolClass.courseId !== course.id) throw new BadRequestException("A turma não pertence ao curso deste link.");

    const tenant = await this.prisma.tenant.findUnique({ where: { id: link.tenantId }, select: { id: true, name: true, slug: true } });
    if (!tenant) throw new NotFoundException("Escola indisponível.");
    const template = await this.prisma.schoolEnrollmentTemplate.findFirst({
      where: { tenantId: link.tenantId, kind: "CONTRACT", configuredAt: { not: null } },
      orderBy: { updatedAt: "desc" },
    });

    const submission = await this.prisma.schoolEnrollmentSubmission.create({
      data: {
        tenantId: link.tenantId,
        linkId: link.id,
        studentName,
        studentCpf,
        studentEmail,
        studentPhone: studentPhone ?? guardianPhone,
        guardianName,
        guardianRelationship,
        guardianPhone,
        guardianEmail,
        addressLine,
        courseId: course?.id ?? null,
        classId: schoolClass?.id ?? null,
        instrument,
        level: level ?? course?.level ?? null,
        startDate,
        weekday: weekday ?? schoolClass?.weekday ?? null,

        startTime: startTime ?? schoolClass?.startTime ?? null,
        tuitionAmountCents: course?.tuitionAmountCents ?? null,
        paymentMethod,
        observations,
        payload: {
          source: "PUBLIC_MOBILE_FORM",
          schoolTenantId: null,
          submittedName: studentName,
          linkTokenPrefix: token.slice(0, 8),
        },
        status: "PREPARED",
      },
    });

    if (!template) {
      return {
        submissionId: submission.id,
        status: "PREPARED",
        signingUrl: null,
        signed: false,
        generated: false,
        sent: false,
        message: "Dados recebidos. O contrato ainda será preparado quando o modelo estiver configurado pela escola.",
      };
    }

    const values = enrollmentValues({
      tenantName: tenant.name,
      ownerName: link.ownerName,
      studentName,
      studentCpf,
      studentEmail,
      studentPhone: studentPhone ?? guardianPhone,
      guardianName,
      guardianPhone,
      guardianEmail,
      addressLine,
      courseName: course?.name ?? null,
      courseLevel: level ?? course?.level ?? null,
      className: schoolClass?.name ?? null,
      instrument,
      startDate: startDate?.toISOString().slice(0, 10) ?? null,
      weekdayLabel: (() => {
        const selected = weekday ?? schoolClass?.weekday;
        return selected === null || selected === undefined ? null : WEEKDAYS[selected - 1] ?? null;
      })(),
      startTime: startTime ?? schoolClass?.startTime ?? null,
      tuitionAmountCents: course?.tuitionAmountCents ?? null,
      paymentMethod,
      observations,
    });
    const signerEmail = studentEmail || guardianEmail || "";
    if (!signerEmail) {
      return {
        submissionId: submission.id,
        status: "PREPARED",
        signingUrl: null,
        signed: false,
        generated: false,
        sent: false,
        message: "Dados recebidos. Informe um e-mail para receber o link de assinatura.",
      };
    }

    try {
      const pdf = await buildPdf(`Contrato de matrícula · ${course?.name || tenant.name}`, stripHtml(renderVariables(template.bodyHtml, values)), this.pdfHeader(tenant.name));
      const created = await this.documenso.createEnvelope({
        title: `Matrícula ${studentName} · ${course?.name || tenant.name}`,
        externalId: submission.id,
        signerName: studentName,
        signerEmail,
        file: pdf,
        filename: "contrato-matricula.pdf",
        subject: `Assinatura de matrícula · ${tenant.name}`,
        message: link.welcomeMessage || `${link.ownerName} enviou o contrato de matrícula para assinatura.`,
      });
      const distributed = await this.documenso.distribute(created.envelopeId);
      await this.prisma.$transaction(async (tx: any) => {
        await tx.schoolEnrollmentSubmission.update({
          where: { id: submission.id },
          data: {
            status: "WAITING_SIGNATURE",
            envelopeId: created.envelopeId,
            documentId: created.envelopeId,
            signingUrl: distributed.signingUrl,
          },
        });
        await tx.schoolEnvelope.create({
          data: {
            tenantId: link.tenantId,
            submissionId: submission.id,
            envelopeId: created.envelopeId,
            documentId: created.envelopeId,
            status: distributed.signingUrl ? "WAITING_SIGNATURE" : "SENT",
            signingUrl: distributed.signingUrl,
            raw: { recipients: distributed.recipients },
          },
        });
      });
      return {
        submissionId: submission.id,
        status: "WAITING_SIGNATURE",
        signingUrl: distributed.signingUrl,
        signed: false,
        generated: false,
        sent: false,
        message: distributed.signingUrl
          ? "Contrato preparado para assinatura. A assinatura ainda não foi confirmada."
          : "Contrato enviado ao Documenso, mas nenhum link de assinatura foi devolvido.",
      };
    } catch (error) {
      await this.prisma.schoolEnrollmentSubmission.update({
        where: { id: submission.id },
        data: { status: "FAILED" },
      });
      throw error;
    }
  }

  private verifyWebhook(secretHeader: unknown) {
    const expected = process.env.DOCUMENSO_WEBHOOK_SECRET?.trim();
    if (!expected) throw new ServiceUnavailableException("Webhook do Documenso sem segredo configurado.");
    if (typeof secretHeader !== "string" || !secretHeader) throw new UnauthorizedException("Webhook não autorizado.");
    const a = createHmac("sha256", expected).update(expected).digest();
    const b = createHmac("sha256", expected).update(secretHeader).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException("Webhook não autorizado.");
  }

  async handleWebhook(body: Record<string, unknown>, secretHeader: unknown) {
    this.verifyWebhook(secretHeader);
    const event = typeof body?.event === "string" ? body.event : "";
    if (event !== "DOCUMENT_COMPLETED") return { received: true, ignored: true, event };
    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload as Record<string, any>
      : {};
    const externalId = typeof payload.externalId === "string" ? payload.externalId : "";
    const envelopeId = typeof payload.id === "string" ? payload.id : "";
    if (!UUID_RE.test(externalId)) return { received: true, ignored: true, reason: "external_id_missing" };
    const submission = await this.prisma.schoolEnrollmentSubmission.findUnique({
      where: { id: externalId },
      include: { link: true },
    });
    if (!submission) return { received: true, ignored: true, reason: "submission_not_found" };
    if (envelopeId && submission.envelopeId && submission.envelopeId !== envelopeId) {
      return { received: true, ignored: true, reason: "envelope_mismatch" };
    }
    if (["SIGNED_CONFIRMED", "GENERATED", "COMPLETED", "DELIVERY_FAILED"].includes(submission.status)) {
      return { received: true, duplicate: true, status: submission.status };
    }

    const tenantId = submission.tenantId;
    const [tenant, templates] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } }),
      this.prisma.schoolEnrollmentTemplate.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } }),
    ]);
    if (!tenant) return { received: true, ignored: true, reason: "tenant_not_found" };

    const course = submission.courseId ? await this.prisma.schoolCourse.findFirst({ where: { id: submission.courseId, tenantId } }) : null;
    const schoolClass = submission.classId ? await this.prisma.schoolClass.findFirst({ where: { id: submission.classId, tenantId } }) : null;
    const values = enrollmentValues({
      tenantName: tenant.name,
      ownerName: submission.link.ownerName,
      studentName: submission.studentName,
      studentCpf: submission.studentCpf,
      studentEmail: submission.studentEmail,
      studentPhone: submission.studentPhone,
      guardianName: submission.guardianName,
      guardianPhone: submission.guardianPhone,
      guardianEmail: submission.guardianEmail,
      addressLine: submission.addressLine,
      courseName: course?.name ?? null,
      courseLevel: submission.level ?? course?.level ?? null,
      className: schoolClass?.name ?? null,
      instrument: submission.instrument,
      startDate: submission.startDate?.toISOString().slice(0, 10) ?? null,
      weekdayLabel: submission.weekday === null ? null : WEEKDAYS[submission.weekday - 1] ?? null,
      startTime: submission.startTime ?? schoolClass?.startTime ?? null,
      tuitionAmountCents: submission.tuitionAmountCents ?? course?.tuitionAmountCents ?? null,
      paymentMethod: submission.paymentMethod,
      observations: submission.observations,
    });

    await this.prisma.$transaction(async (tx: any) => {
      await tx.schoolEnrollmentSubmission.update({
        where: { id: submission.id },
        data: { status: "SIGNED_CONFIRMED", signedAt: new Date() },
      });
      if (submission.envelopeId) {
        await tx.schoolEnvelope.updateMany({
          where: { tenantId, envelopeId: submission.envelopeId },
          data: { status: "COMPLETED", completedAt: new Date(), raw: payload },
        });
      }
    });

    const generated: string[] = [];
    const missingTemplates: string[] = [];
    const documents: Array<{ id: string; kind: string; name: string; buffer: Buffer }> = [];
    for (const kind of TEMPLATE_KINDS) {
      const template = templates.find((item) => item.kind === kind && item.configuredAt);
      if (!template) {
        missingTemplates.push(kind);
        continue;
      }
      const name = kind === "CONTRACT" ? `Contrato · ${submission.studentName}` : `Ficha de matrícula · ${submission.studentName}`;
      const buffer = await buildPdf(name, stripHtml(renderVariables(template.bodyHtml, values)), this.pdfHeader(tenant.name));
      const row = await this.prisma.schoolEnrollmentDocument.create({
        data: {
          tenantId,
          submissionId: submission.id,
          kind,
          name,
          body: renderVariables(template.bodyHtml, values),
          pdfPath: null,
        },
      });
      generated.push(row.id);
      documents.push({ id: row.id, kind, name, buffer });
    }

    const recipients = [
      {
        role: "CLIENT",
        phone: submission.studentPhone || submission.guardianPhone || "",
        email: submission.studentEmail || submission.guardianEmail || "",
      },
      {
        role: "OWNER",
        phone: submission.link.ownerPhone || "",
        email: submission.link.ownerEmail || "",
      },
    ];
    const welcome = submission.link.welcomeMessage || `Boas-vindas à ${tenant.name}! Segue o contrato e a ficha de matrícula de ${submission.studentName}.`;
    let failures = 0;
    let sends = 0;

    for (const recipient of recipients) {
      for (const document of documents) {
        const delivery = await this.prisma.schoolEnrollmentDelivery.create({
          data: {
            tenantId,
            submissionId: submission.id,
            documentId: document.id,
            recipientRole: recipient.role,
            recipientPhone: recipient.phone || null,
            recipientEmail: recipient.email || null,
            status: "PREPARED",
          },
        });
        const digits = recipient.phone.replace(/\D/g, "");
        let error: string | null = null;
        let messageId: string | null = null;
        if (!digits) error = "PHONE_NOT_CONFIGURED";
        else {
          try {
            this.waha.assertConfigured();
            const channel = await this.prisma.channelConnection.findFirst({
              where: { tenantId, isActive: true, status: "CONNECTED" },
              orderBy: { updatedAt: "desc" },
            });
            if (!channel) error = "WHATSAPP_SESSION_NOT_CONNECTED";
            else {
              const chatId = `${digits}@c.us`;
              const welcomeId = await this.waha.sendText(channel, chatId, welcome);
              messageId = welcomeId;
              const mediaId = await this.waha.sendMedia(channel, chatId, "file", {
                mimetype: "application/pdf",
                filename: `${document.kind.toLowerCase().replace("_", "-")}-matricula.pdf`,
                base64: document.buffer.toString("base64"),
                caption: document.name,
              });
              if (mediaId) {
                messageId = mediaId;
                sends += 1;
              } else {
                error = "WHATSAPP_SEND_ID_MISSING";
              }
            }
          } catch (deliveryError) {
            error = deliveryError instanceof Error ? deliveryError.message.slice(0, 240) : "WHATSAPP_DELIVERY_FAILED";
          }
        }
        await this.prisma.schoolEnrollmentDelivery.update({
          where: { id: delivery.id },
          data: { status: error ? "FAILED" : "SENT", error, messageId, sentAt: error ? null : new Date() },
        });
        if (error) failures += 1;
      }
    }

    const status = failures > 0 ? "DELIVERY_FAILED" : sends > 0 ? "COMPLETED" : "GENERATED";
    await this.prisma.schoolEnrollmentSubmission.update({
      where: { id: submission.id },
      data: { status },
    });
    return {
      received: true,
      signed: true,
      submissionId: submission.id,
      status,
      generated,
      missingTemplates,
      confirmedSends: sends,
      failedDeliveries: failures,
      message: sends > 0 ? "Assinatura confirmada e documentos enviados." : "Assinatura confirmada e documentos gerados. Nenhum envio foi confirmado.",
    };
  }
}
