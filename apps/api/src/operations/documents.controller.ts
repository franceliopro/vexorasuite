import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { MailService } from "../mail/mail.service";

const KINDS = new Set(["QUOTE", "CONTRACT", "WORK_ORDER", "RECEIPT"]);
const VARIABLE_TYPES = new Set(["text", "longtext", "date", "money"]);
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_BODY = 40_000;

const trim = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function parseVariables(input: unknown) {
  if (!Array.isArray(input)) throw new BadRequestException("As variáveis devem ser uma lista.");
  if (input.length > 40) throw new BadRequestException("No máximo 40 variáveis por modelo.");
  return input.map((raw: any) => {
    const key = typeof raw?.key === "string" ? raw.key.trim().toLowerCase() : "";
    const label = trim(raw?.label, 80);
    const type = typeof raw?.type === "string" && VARIABLE_TYPES.has(raw.type) ? raw.type : "text";
    const required = raw?.required === true;
    if (!KEY_RE.test(key)) throw new BadRequestException(`Variável inválida: "${String(raw?.key ?? "")}". Use minúsculas, números e underscore (ex.: nome_cliente).`);
    if (!label) throw new BadRequestException(`A variável "${key}" precisa de um rótulo.`);
    return { key, label, type, required };
  });
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{([a-z0-9_]{1,40})\}\}/gi, (_, key: string) => {
    const value = values[String(key).toLowerCase()];
    return value === undefined ? `{{${key}}}` : value;
  });
}

function missingKeys(body: string, values: Record<string, string>) {
  const missing = new Set<string>();
  const matches = body.matchAll(/\{\{([a-z0-9_]{1,40})\}\}/gi);
  for (const match of matches) {
    const key = String(match[1]).toLowerCase();
    if (!values[key]?.trim()) missing.add(key);
  }
  return [...missing];
}

function contactAutofill(contact: any): Record<string, string> {
  const meta = object(contact?.metadata);
  const digits = (value: unknown) => (typeof value === "string" ? value.replace(/\D/g, "") : "");
  const out: Record<string, string> = {};
  if (contact?.name) out.nome_cliente = String(contact.name);
  if (contact?.phone) out.telefone = String(contact.phone);
  if (contact?.email) out.email = String(contact.email);
  const asaas = object(meta.asaas);
  const document = digits(meta.document) || digits(asaas.cpfCnpj) || digits(asaas.document);
  if (document) out.cpf_cnpj = document;
  const company = trim(asaas.companyName, 160) || trim(asaas.company, 160) || trim(meta.company, 160) || trim(meta.razaoSocial, 160);
  if (company) out.empresa = company;
  const address = trim(asaas.address, 240) || trim(meta.endereco, 240) || trim(meta.address, 240) || trim(asaas.addressLine1, 240);
  if (address) out.endereco = address;
  return out;
}

async function buildPdf(name: string, content: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 52, right: 52 }, info: { Title: name } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.fillColor("#2456a7").fontSize(10).text("VÉXORA SUITE", { align: "left" });
    doc.moveDown(0.4);
    doc.fillColor("#16243a").fontSize(20).text(name, { lineGap: 4 });
    doc.moveDown(0.4);
    doc.strokeColor("#204f9c").lineWidth(1.2).moveTo(52, doc.y).lineTo(543, doc.y).stroke();
    doc.moveDown(0.6);
    doc.fillColor("#1f2a44").fontSize(11);
    for (const paragraph of content.split(/\n{2,}/)) {
      doc.text(paragraph.replace(/\n/g, " "), { lineGap: 3.5, paragraphGap: 4 });
    }
    doc.moveDown(1);
    doc.fontSize(9).fillColor("#5a6b86").text("Gerado pela Véxora Suite em " + new Date().toLocaleDateString("pt-BR"), { align: "left" });
    doc.end();
  });
}

@Controller("documents")
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService) {}

  private adminOnly(req: AuthenticatedRequest) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores gerenciam modelos de documentos.");
  }

  private cleanBody(value: unknown) {
    const body = trim(value, MAX_BODY);
    if (body.length < 20) throw new BadRequestException("O conteúdo do modelo é muito curto.");
    if (/<script\b/i.test(body)) throw new BadRequestException("O modelo não pode conter scripts.");
    return body;
  }

  @Get("templates")
  async listTemplates(@Req() req: AuthenticatedRequest, @Query("kind") kind?: string) {
    const where: any = { tenantId: req.user.tenantId };
    if (kind && KINDS.has(kind)) where.kind = kind;
    const templates = await this.prisma.documentTemplate.findMany({ where, orderBy: [{ kind: "asc" }, { name: "asc" }] });
    return { templates };
  }

  @Post("templates")
  async createTemplate(@Req() req: AuthenticatedRequest, @Body() input: any) {
    this.adminOnly(req);
    const kind = typeof input?.kind === "string" && KINDS.has(input.kind) ? input.kind : "QUOTE";
    const name = trim(input?.name, 120);
    if (name.length < 3) throw new BadRequestException("Dê um nome ao modelo.");
    const description = trim(input?.description, 240);
    const variables = parseVariables(input?.variables ?? []);
    const body = this.cleanBody(input?.body);
    const template = await this.prisma.documentTemplate.create({
      data: { tenantId: req.user.tenantId, kind, name, description, variables, body },
      select: { id: true, kind: true, name: true, description: true, variables: true },
    });
    return { template };
  }

  @Get("templates/:id")
  async templateDetail(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id, tenantId: req.user.tenantId },
      select: { id: true, kind: true, name: true, description: true, variables: true, body: true, createdAt: true, updatedAt: true },
    });
    if (!template) throw new NotFoundException("Modelo não encontrado.");
    return { template };
  }

  @Put("templates/:id")
  async updateTemplate(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: any) {
    this.adminOnly(req);
    const existing = await this.prisma.documentTemplate.findFirst({ where: { id, tenantId: req.user.tenantId }, select: { id: true } });
    if (!existing) throw new NotFoundException("Modelo não encontrado.");
    const data: any = {};
    if (input?.kind !== undefined) {
      if (!KINDS.has(String(input.kind))) throw new BadRequestException("Tipo inválido.");
      data.kind = input.kind;
    }
    if (input?.name !== undefined) {
      const name = trim(input.name, 120);
      if (name.length < 3) throw new BadRequestException("Dê um nome ao modelo.");
      data.name = name;
    }
    if (input?.description !== undefined) data.description = trim(input.description, 240);
    if (input?.variables !== undefined) data.variables = parseVariables(input.variables);
    if (input?.body !== undefined) data.body = this.cleanBody(input.body);
    const template = await this.prisma.documentTemplate.update({ where: { id }, data, select: { id: true, kind: true, name: true, description: true, variables: true } });
    return { template };
  }

  @Delete("templates/:id")
  async deleteTemplate(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.adminOnly(req);
    const used = await this.prisma.generatedDocument.count({ where: { tenantId: req.user.tenantId, templateId: id } });
    if (used > 0) throw new BadRequestException("Não é possível excluir: há documentos já gerados com este modelo.");
    await this.prisma.documentTemplate.deleteMany({ where: { id, tenantId: req.user.tenantId } });
    return { deleted: true };
  }

  @Post("templates/seed")
  async seedTemplates(@Req() req: AuthenticatedRequest) {
    this.adminOnly(req);
    const seeds: Array<{ kind: string; name: string; description: string; variables: any[]; body: string }> = [
      {
        kind: "QUOTE",
        name: "Orçamento de prestação de serviços",
        description: "Modelo inicial: proposta comercial completa com validade e condições.",
        variables: [
          { key: "nome_cliente", label: "Nome do cliente", type: "text", required: true },
          { key: "telefone", label: "Telefone", type: "text", required: false },
          { key: "email", label: "E-mail", type: "text", required: false },
          { key: "empresa", label: "Empresa", type: "text", required: false },
          { key: "cpf_cnpj", label: "CPF/CNPJ", type: "text", required: false },
          { key: "objetivo", label: "Objetivo", type: "longtext", required: true },
          { key: "escopo", label: "Escopo dos serviços", type: "longtext", required: true },
          { key: "prazo", label: "Prazo de execução", type: "text", required: true },
          { key: "valor", label: "Valor", type: "money", required: true },
          { key: "forma_pagamento", label: "Forma de pagamento", type: "text", required: true },
          { key: "validade", label: "Validade da proposta", type: "text", required: false },
        ],
        body: "ORÇAMENTO N.º {{documento}}\n\nProposta para {{nome_cliente}}\n\nTelefone: {{telefone}}\nE-mail: {{email}}\nCPF/CNPJ: {{cpf_cnpj}}\n\nOBJETIVO\n{{objetivo}}\n\nESCOPO DOS SERVIÇOS\n{{escopo}}\n\nPRAZO DE EXECUÇÃO\n{{prazo}}\n\nINVESTIMENTO\n{{valor}}\nForma de pagamento: {{forma_pagamento}}\n\nValidade desta proposta: {{validade}}\n\nEste orçamento segue a política comercial da empresa. Após a confirmação, a equipe entra em contato para agendar a execução.",
      },
      {
        kind: "CONTRACT",
        name: "Contrato de prestação de serviços",
        description: "Modelo inicial de contrato simples com cláusulas essenciais.",
        variables: [
          { key: "nome_cliente", label: "Nome do cliente", type: "text", required: true },
          { key: "cpf_cnpj", label: "CPF/CNPJ", type: "text", required: true },
          { key: "endereco", label: "Endereço", type: "longtext", required: false },
          { key: "objetivo", label: "Objeto do contrato", type: "longtext", required: true },
          { key: "escopo", label: "Escopo/entregas", type: "longtext", required: true },
          { key: "valor", label: "Valor", type: "money", required: true },
          { key: "forma_pagamento", label: "Forma de pagamento", type: "text", required: true },
          { key: "prazo", label: "Vigência", type: "text", required: true },
        ],
        body: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS\n\nCONTRATANTE: {{nome_cliente}}, CPF/CNPJ {{cpf_cnpj}}, com sede/residência em {{endereco}}.\n\nCONTRATADA: empresa prestadora dos serviços.\n\n1. OBJETO\n{{objetivo}}\n\n2. ESCOPO E ENTREGAS\n{{escopo}}\n\n3. VIGÊNCIA\nEste contrato vigora pelo prazo de {{prazo}}, a partir da assinatura.\n\n4. VALOR E PAGAMENTO\nO valor acordado é de {{valor}}, pago da seguinte forma: {{forma_pagamento}}.\n\n5. OBRIGAÇÕES DAS PARTES\nA CONTRATADA executa os serviços com diligência e emite os relatórios combinados. A CONTRATANTE fornece as informações e acessos necessários.\n\n6. RESCISÃO\nQualquer das partes pode rescindir mediante aviso prévio de 15 dias, quitadas as obrigações proporcionais.\n\nLocal de assinatura e data: ____, ____ de ________________ de 20____.\n\nCONTRATANTE: ______________________________\n\nCONTRATADA: ______________________________",
      },
      {
        kind: "WORK_ORDER",
        name: "Ordem de serviço",
        description: "Modelo inicial de OS para execução em campo ou na empresa.",
        variables: [
          { key: "nome_cliente", label: "Nome do cliente", type: "text", required: true },
          { key: "telefone", label: "Telefone", type: "text", required: false },
          { key: "endereco", label: "Endereço de execução", type: "longtext", required: false },
          { key: "objetivo", label: "Problema/OS número", type: "text", required: true },
          { key: "escopo", label: "Serviços a executar", type: "longtext", required: true },
          { key: "prazo", label: "Data/hora agendada", type: "text", required: true },
          { key: "observacoes", label: "Observações", type: "longtext", required: false },
        ],
        body: "ORDEM DE SERVIÇO N.º {{documento}}\n\nCliente: {{nome_cliente}}\nTelefone: {{telefone}}\nLocal: {{endereco}}\n\nPROBLEMA / SOLICITAÇÃO\n{{objetivo}}\n\nSERVIÇOS A EXECUTAR\n{{escopo}}\n\nAGENDAMENTO\n{{prazo}}\n\nOBSERVAÇÕES\n{{observacoes}}\n\nA equipe executará o serviço conforme descrição acima. Ao final, o responsável assina o aceite.\n\nCliente: ________________________\n\nResponsável: ________________________",
      },
    ];
    const created: any[] = [];
    for (const seed of seeds) {
      const exists = await this.prisma.documentTemplate.findFirst({ where: { tenantId: req.user.tenantId, kind: seed.kind, name: seed.name }, select: { id: true } });
      if (exists) {
        created.push({ kind: seed.kind, name: seed.name, skipped: true });
        continue;
      }
      const template = await this.prisma.documentTemplate.create({
        data: { tenantId: req.user.tenantId, ...seed },
        select: { id: true, kind: true, name: true },
      });
      created.push({ ...template, skipped: false });
    }
    return { created };
  }

  @Get("recent")
  async listRecent(@Req() req: AuthenticatedRequest, @Query("kind") kind?: string, @Query("limit") limitRaw?: string) {
    const limit = Math.max(1, Math.min(50, Number.parseInt(limitRaw || "20", 10) || 20));
    const where: any = { tenantId: req.user.tenantId };
    if (kind && KINDS.has(kind)) where.kind = kind;
    const documents = await this.prisma.generatedDocument.findMany({
      where,
      select: { id: true, name: true, kind: true, contactName: true, sentAt: true, sentTo: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { documents };
  }

  @Post("generate")
  async generate(@Req() req: AuthenticatedRequest, @Body() input: any) {
    const templateId = typeof input?.templateId === "string" ? input.templateId : "";
    if (!templateId) throw new BadRequestException("Selecione um modelo.");
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, tenantId: req.user.tenantId },
      include: { tenant: { select: { name: true } } },
    });
    if (!template) throw new NotFoundException("Modelo não encontrado.");
    const contactId = typeof input?.contactId === "string" ? input.contactId : "";
    let contact: any = null;
    if (contactId) {
      contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId: req.user.tenantId }, select: { id: true, name: true, phone: true, email: true, metadata: true } });
      if (!contact) throw new NotFoundException("Contato não encontrado nesta empresa.");
    }
    const variables = Array.isArray(template.variables) ? (template.variables as Array<{ key: string; required?: boolean; label?: string }>) : [];
    const manual = object(input?.values);
    const merged: Record<string, string> = { ...contactAutofill(contact) };
    for (const key of Object.keys(manual)) {
      const value = trim(manual[key], 4000);
      if (value) merged[key.toLowerCase()] = value;
    }
    const today = new Date().toLocaleDateString("pt-BR");
    if (!merged.data) merged.data = today;
    if (!merged.documento && !merged.protocolo) merged.documento = String(Math.floor(Math.random() * 900000) + 100000);
    if (contact?.name && !merged.nome_cliente) merged.nome_cliente = String(contact.name);
    const missing = missingKeys(template.body, merged);
    if (missing.length) {
      const required = variables.filter((v) => v.required && missing.includes(v.key));
      if (required.length) throw new BadRequestException("Preencha: " + required.map((v) => v.label || v.key).join(", "));
    }
    const content = renderTemplate(template.body, merged);
    const document = await this.prisma.generatedDocument.create({
      data: {
        tenantId: req.user.tenantId,
        templateId: template.id,
        name: template.name,
        kind: template.kind,
        contactId: contact?.id ?? null,
        contactName: contact?.name ? String(contact.name).slice(0, 160) : null,
        values: merged as any,
        content,
      },
      select: { id: true, name: true, kind: true, contactName: true, createdAt: true },
    });
    return { document: { ...document, content, values: merged } };
  }

  @Get(":id")
  async detail(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, tenantId: req.user.tenantId },
      select: { id: true, name: true, kind: true, contactName: true, values: true, content: true, sentAt: true, sentTo: true, createdAt: true },
    });
    if (!document) throw new NotFoundException("Documento não encontrado.");
    return { document };
  }

  @Get(":id/pdf")
  async pdf(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, tenantId: req.user.tenantId },
      select: { name: true, content: true },
    });
    if (!document) throw new NotFoundException("Documento não encontrado.");
    const pdf = await buildPdf(document.name, document.content);
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="${document.name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80)}.pdf"`);
    res.send(pdf);
  }

  @Post(":id/send")
  async send(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: any) {
    const to = typeof input?.email === "string" ? input.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new BadRequestException("Informe um e-mail de destino válido.");
    const document = await this.prisma.generatedDocument.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!document) throw new NotFoundException("Documento não encontrado.");
    if (!this.mail.configured) {
      throw new BadRequestException("O envio por e-mail está indisponível nesta instalação. Use o botão Baixar PDF e envie manualmente.");
    }
    const pdf = await buildPdf(document.name, document.content);
    const result = await this.mail.send({
      to,
      subject: document.name,
      text: document.content,
      html: `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#16243a;background:#f1f4f8;margin:0"><div style="max-width:640px;margin:24px auto;background:#fff;border-radius:12px;padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${document.name}</h1><pre style="white-space:pre-wrap;font-family:inherit;line-height:1.5;margin:0">${document.content.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre></div></body></html>`,
      attachments: [{ filename: document.name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80) + ".pdf", content: pdf, contentType: "application/pdf" }],
    });
    if (!result.delivered) {
      return { sent: false, reason: result.reason ?? "O servidor de e-mail não aceitou a mensagem.", sentTo: to };
    }
    const updated = await this.prisma.generatedDocument.update({ where: { id: document.id }, data: { sentAt: new Date(), sentTo: to }, select: { id: true, sentAt: true, sentTo: true } });
    return { sent: true, ...updated };
  }
}
