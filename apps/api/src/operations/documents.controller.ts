import { assertConversationClaim, lockConversationClaim } from "./conversation-claim";
import {
  BadGatewayException,
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

import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { MailService } from "../mail/mail.service";
import { WahaService } from "./waha.service";
import { EventsService } from "./events.service";

import {
  KINDS,

  MAX_BODY,
  parseVariables,
  object,
  trim,
  renderTemplate,
  missingKeys,
  contactAutofill,
  companyAutofill,
  companyHeader,
  buildPdf,
} from "./document-helpers";

@Controller("documents")
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService, private readonly waha: WahaService, private readonly events: EventsService) {}

  private adminOnly(req: AuthenticatedRequest) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores gerenciam modelos de documentos.");
  }

  private async companyHeaderFor(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, integrations: true } });
    return tenant ? companyHeader(tenant.integrations, tenant.name) : null;
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
    const tenantInfo = await this.prisma.tenant.findUnique({ where: { id: req.user.tenantId }, select: { name: true, integrations: true } });
    const merged: Record<string, string> = { ...contactAutofill(contact), ...companyAutofill(tenantInfo?.integrations, tenantInfo?.name || "") };
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
    const pdf = await buildPdf(document.name, document.content, await this.companyHeaderFor(req.user.tenantId));
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="${document.name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80)}.pdf"`);
    res.send(pdf);
  }

  @Post(":id/send-whatsapp")
  async sendWhatsapp(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() input: any) {
    const conversationId = typeof input?.conversationId === "string" ? input.conversationId.trim() : "";
    if (!conversationId) throw new BadRequestException("Informe a conversa para enviar o documento.");
    const document = await this.prisma.generatedDocument.findFirst({ where: { id, tenantId: req.user.tenantId } });
    if (!document) throw new NotFoundException("Documento não encontrado.");
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId: req.user.tenantId, deletedAt: null, archivedAt: null },
      select: {
        id: true,
        assigneeId: true, claimedById: true, handlingMode: true, status: true,
        contact: { select: { externalId: true, phone: true, name: true } },
        channelConnection: { select: { id: true, provider: true, isActive: true } },
      },
    });
    if (!conversation) throw new NotFoundException("Conversa não encontrada nesta empresa.");
    assertConversationClaim(conversation, req.user.sub);
    if (!conversation.channelConnection || conversation.channelConnection.provider !== "WAHA" || !conversation.channelConnection.isActive) {
      throw new BadRequestException("O envio pelo WhatsApp exige um canal WAHA ativo para esta conversa.");
    }
    const externalId = conversation.contact.externalId ?? "";
    const chatId = externalId.includes("@") ? externalId : conversation.contact.phone ? `${conversation.contact.phone.replace(/\D/g, "")}@c.us` : null;
    if (!chatId) throw new BadRequestException("O contato não possui um identificador WhatsApp válido.");
    const pdf = await buildPdf(document.name, document.content, await this.companyHeaderFor(req.user.tenantId));
    const base64 = pdf.toString("base64");
    const filename = document.name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80) + ".pdf";
    const member = await this.prisma.membership.findFirst({ where: { tenantId: req.user.tenantId, userId: req.user.sub }, select: { knownBy: true } });
    const senderName = (typeof member?.knownBy === "string" && member.knownBy.trim()) || "Atendimento";
    const queued = await this.prisma.$transaction(async tx => {
      await lockConversationClaim(tx, req.user.tenantId, conversation.id, req.user.sub);
      return tx.message.create({
        data: {
        tenantId: req.user.tenantId,
        conversationId: conversation.id,
        direction: "OUTBOUND",
        status: "QUEUED",
        contentType: "file",
        content: document.name,
        senderName,
        metadata: { provider: "WAHA", documentId: document.id, filename, mimetype: "application/pdf" },
      },
        select: { id: true, conversationId: true, direction: true, status: true, content: true },
      });
    });
    this.events.publish(req.user.tenantId, "message.queued", { conversationId: queued.conversationId, message: queued });
    try {
      const providerMessageId = await this.waha.sendMedia(conversation.channelConnection as any, chatId, "file", { mimetype: "application/pdf", filename, base64, caption: document.name });
      const sent = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId }, select: { id: true, status: true, providerMessageId: true } });
      await this.prisma.generatedDocument.update({ where: { id: document.id }, data: { sentAt: new Date(), sentTo: chatId.startsWith("@g") ? "whatsapp:grupo" : `whatsapp:${chatId}` } });
      this.events.publish(req.user.tenantId, "message.sent", { conversationId: queued.conversationId, messageId: sent.id });
      return { sent: true, providerMessageId };
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 300) : "";
      const failed = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: "WAHA", documentId: document.id, filename, errorCode: "SEND_FAILED", providerDetail: detail || null } }, select: { id: true, status: true } });
      this.events.publish(req.user.tenantId, "message.failed", { conversationId: queued.conversationId, messageId: failed.id });
      throw new BadGatewayException("A mensagem não foi enviada." + (detail ? " " + detail : ""));
    }
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
    const pdf = await buildPdf(document.name, document.content, await this.companyHeaderFor(req.user.tenantId));
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
