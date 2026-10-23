import { Body, Controller, ForbiddenException, Logger, NotFoundException, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { ChannelConnection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "./events.service";
import { WahaService } from "./waha.service";
import { AsaasService } from "./asaas.service";

@Controller("webhooks/waha")
export class WahaWebhookController {
  private readonly logger = new Logger(WahaWebhookController.name);

  constructor(private readonly prisma: PrismaService, private readonly waha: WahaService, private readonly events: EventsService, private readonly asaas: AsaasService) {}

  @Post(":channelId/:token")
  async receive(@Param("channelId", ParseUUIDPipe) channelId: string, @Param("token") token: string, @Body() body: unknown) {
    if (!this.waha.verifyWebhookToken(channelId, token)) {
      this.logger.warn(`Webhook rejeitado: token inválido para canal ${channelId}`);
      throw new ForbiddenException("Assinatura do webhook inválida.");
    }
    const channel = await this.prisma.channelConnection.findFirst({ where: { id: channelId, provider: "WAHA", isActive: true } });
    if (!channel) throw new NotFoundException("Canal não encontrado.");

    const envelope = body && typeof body === "object" ? body as Record<string, any> : {};
    this.logger.log(`Webhook recebido: canal=${channelId} evento=${String(envelope.event || "desconhecido")} sessão=${String(envelope.session || "ausente")}`);
    if (envelope.session && envelope.session !== channel.sessionName) return { ok: true, ignored: true };
    const payload = envelope.payload && typeof envelope.payload === "object" ? envelope.payload as Record<string, any> : {};

    if (envelope.event === "message.ack") {
      if (payload.fromMe === false) return { ok: true, ignored: true };
      const providerMessageId = this.providerMessageId(payload.id);
      const ack = Number(payload.ack);
      const status = ack >= 3 ? "READ" : ack === 2 ? "DELIVERED" : ack === 1 ? "SENT" : null;
      if (!providerMessageId || !status) return { ok: true, ignored: true };
      const message = await this.prisma.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, include: { conversation: { select: { id: true, channelConnectionId: true } } } });
      if (!message || message.conversation.channelConnectionId !== channel.id) return { ok: true, ignored: true };
      const updated = await this.prisma.message.update({ where: { id: message.id }, data: { status } });
      this.events.publish(channel.tenantId, "message.status", { conversationId: message.conversationId, messageId: updated.id, status: updated.status });
      return { ok: true };
    }

    if (envelope.event !== "message" || payload.fromMe === true) return { ok: true, ignored: true };
    const rawFrom = typeof payload.from === "string" ? payload.from.trim() : "";
    if (!rawFrom || rawFrom === "status@broadcast") return { ok: true, ignored: true };
    const isGroup = rawFrom.endsWith("@g.us");
    if (isGroup) {
      const settings = channel.settings && typeof channel.settings === "object" && !Array.isArray(channel.settings)
        ? channel.settings as Record<string, unknown> : {};
      const allowedGroupIds = Array.isArray(settings.allowedGroupIds)
        ? settings.allowedGroupIds.filter((value): value is string => typeof value === "string") : [];
      // Group traffic is opt-in and allowlist-only. Enabling groups without selecting IDs still receives none.
      if (settings.groupsEnabled !== true || !allowedGroupIds.includes(rawFrom)) {
        return { ok: true, ignored: true, reason: "GROUP_NOT_ALLOWED" };
      }
    }
    const chatId = rawFrom.includes("@") ? rawFrom : `${rawFrom}@c.us`;
    const providerMessageId = this.providerMessageId(payload.id);
    if (!providerMessageId) return { ok: true, ignored: true };

    const phone = !isGroup && chatId.endsWith("@c.us") ? chatId.slice(0, -5).replace(/\D/g, "") || null : null;
    const notifyName = String((isGroup ? payload._data?.chat?.name || payload._data?.groupMetadata?.subject : null) || payload._data?.notifyName || payload.pushName || "").trim().slice(0, 160);
    const content = typeof payload.body === "string" ? payload.body.slice(0, 20000) : "";
    const mimeType = String(payload.media?.mimetype || "");
    const contentType = payload.hasMedia ? mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : mimeType.startsWith("video/") ? "video" : "file" : "text";
    const timestamp = Number(payload.timestamp);
    const occurredAt = Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp < 1000000000000 ? timestamp * 1000 : timestamp) : new Date();

    let saved: { contactId: string; conversationId: string; isNewConversation: boolean; handlingMode: "BOT" | "HUMAN"; message: { id: string; content: string; contentType: string; status: string; direction: string; occurredAt: Date } } | null;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        const lockKey = `${channel.tenantId}:inbound:${chatId}`;
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const duplicate = await tx.message.findFirst({ where: { tenantId: channel.tenantId, providerMessageId }, select: { id: true } });
        if (duplicate) return null;

        let contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, externalId: chatId } });
        if (!contact && phone) contact = await tx.contact.findFirst({ where: { tenantId: channel.tenantId, phone } });
        if (!contact) {
          contact = await tx.contact.create({
            data: { tenantId: channel.tenantId, name: notifyName || (isGroup ? `Grupo ${chatId}` : phone || chatId), phone, externalId: chatId, source: "WhatsApp", metadata: { provider: "WAHA", channelConnectionId: channel.id, isGroup } },
          });
        } else {
          const update: { name?: string; phone?: string; externalId?: string } = {};
          if (notifyName && (!contact.name || contact.name === contact.phone || contact.name === contact.externalId)) update.name = notifyName;
          if (phone && !contact.phone) update.phone = phone;
          if (!contact.externalId) update.externalId = chatId;
          if (Object.keys(update).length) contact = await tx.contact.update({ where: { id: contact.id }, data: update });
        }

        let isNewConversation = false;
        let conversation = await tx.conversation.findFirst({
          where: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, status: { in: ["OPEN", "PENDING"] } },
          orderBy: { updatedAt: "desc" },
        });
        if (!conversation) {
          conversation = await tx.conversation.create({ data: { tenantId: channel.tenantId, contactId: contact.id, channelConnectionId: channel.id, channel: "WHATSAPP", status: "OPEN" } });
          isNewConversation = true;
        }

        const metadata = { provider: "WAHA", session: channel.sessionName, chatId, isGroup, hasMedia: Boolean(payload.hasMedia), mimeType: mimeType || null, filename: payload.media?.filename ? String(payload.media.filename).slice(0, 255) : null };
        const message = await tx.message.create({
          data: { tenantId: channel.tenantId, conversationId: conversation.id, providerMessageId, direction: "INBOUND", status: "RECEIVED", content, contentType, senderName: notifyName || null, metadata, occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: message.occurredAt } });
        return { contactId: contact.id, conversationId: conversation.id, isNewConversation, handlingMode: conversation.handlingMode, message: { id: message.id, content: message.content, contentType: message.contentType, status: message.status, direction: message.direction, occurredAt: message.occurredAt } };
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
      throw error;
    }

    if (!saved) return { ok: true, duplicate: true };
    this.logger.log(`Mensagem recebida e gravada: canal=${channelId} conversa=${saved.conversationId} tipo=${contentType}`);
    this.events.publish(channel.tenantId, "message.received", { conversationId: saved.conversationId, contactId: saved.contactId, message: saved.message });
    this.events.publish(channel.tenantId, "conversation.updated", { id: saved.conversationId, lastMessageAt: saved.message.occurredAt.toISOString() });
    if (saved.handlingMode === "BOT") void this.runMenuBot(channel, chatId, saved.conversationId, saved.isNewConversation, content);
    return { ok: true };
  }


  private async runMenuBot(channel: ChannelConnection, chatId: string, conversationId: string, isNewConversation: boolean, inboundText: string): Promise<void> {
    if (await this.runAsaasFlow(channel, chatId, conversationId, inboundText)) return;
    const defaults = [
      { key: "FINANCEIRO", name: "Financeiro", keywords: ["boleto", "pagamento", "fatura", "nota fiscal", "reembolso", "cobrança", "cobranca", "financeiro"] },
      { key: "COMERCIAL", name: "Comercial (Vendas)", keywords: ["preço", "preco", "orçamento", "orcamento", "comprar", "venda", "vendas", "plano", "comercial"] },
      { key: "SUPORTE", name: "Suporte", keywords: ["problema", "erro", "ajuda", "suporte", "não funciona", "nao funciona", "suporte técnico", "suporte tecnico"] },
      { key: "ADMINISTRATIVO", name: "Administrativo", keywords: ["documento", "contrato", "cadastro", "administrativo"] },
    ];
    try {
      for (const department of defaults) {
        await this.prisma.department.upsert({
          where: { tenantId_key: { tenantId: channel.tenantId, key: department.key } },
          create: { tenantId: channel.tenantId, ...department },
          update: {},
        });
      }
      const departments = await this.prisma.department.findMany({ where: { tenantId: channel.tenantId, isActive: true } });
      const normalized = inboundText.trim().toLocaleLowerCase("pt-BR");
      if (!departments.length) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { handlingMode: "HUMAN", departmentId: null, assigneeId: null, status: "OPEN" } });
        this.events.publish(channel.tenantId, "conversation.updated", { id: conversationId, handlingMode: "HUMAN", departmentId: null, assigneeId: null, status: "OPEN" });
        await this.sendBotReply(channel, chatId, conversationId, "Obrigado pela mensagem! Vou encaminhar você para a fila geral de atendimento. Um atendente continuará por aqui. 🙌");
        return;
      }
      departments.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const options = departments.map((department, index) => `${index + 1}️⃣ ${department.name}`).join("\n");
      const numericChoice = /^\d+$/.test(normalized) ? Number(normalized) : 0;
      const chosen = (numericChoice > 0 ? departments[numericChoice - 1] : undefined)
        || departments.find((department) => normalized.length >= 3 && (
          normalized.includes(department.name.toLocaleLowerCase("pt-BR"))
          || department.key.toLocaleLowerCase("pt-BR") === normalized
          || department.keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase("pt-BR")))
        ));
      const menu = `Olá! Sou o assistente virtual. 😊\n\nPara encaminhar você à equipe certa, escolha uma opção:\n${options}\n\nVocê também pode escrever brevemente o que precisa, e eu tentarei identificar a área.`;
      if (chosen) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { handlingMode: "HUMAN", departmentId: chosen.id, status: "OPEN" } });
        this.events.publish(channel.tenantId, "conversation.updated", { id: conversationId, handlingMode: "HUMAN", departmentId: chosen.id, status: "OPEN" });
        await this.sendBotReply(channel, chatId, conversationId, `Certo! Estou encaminhando sua conversa para **${chosen.name}**. Um atendente continuará o atendimento por aqui. 🙌`);
      } else if (isNewConversation || /\b(menu|ajuda|atendente|humano|opções|opcoes)\b/.test(normalized)) {
        await this.sendBotReply(channel, chatId, conversationId, menu);
      } else {
        await this.sendBotReply(channel, chatId, conversationId, `Ainda não consegui identificar a área. Escolha uma opção:\n${options}`);
      }
    } catch (error) {
      this.logger.warn(`Bot inicial não conseguiu processar a conversa ${conversationId}: ${error instanceof Error ? error.message : "falha desconhecida"}`);
    }
  }

  private async runAsaasFlow(channel: ChannelConnection, chatId: string, conversationId: string, inboundText: string): Promise<boolean> {
    // Never expose billing information in a WhatsApp group, even if group traffic was explicitly enabled.
    if (chatId.endsWith("@g.us")) return false;
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId: channel.tenantId }, select: { botState: true } });
    const rawState = conversation?.botState && typeof conversation.botState === "object" && !Array.isArray(conversation.botState)
      ? conversation.botState as Record<string, unknown> : {};
    const state = rawState.flow === "ASAAS" ? rawState : null;
    const text = inboundText.trim();
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const cancel = /^(cancelar|sair|menu)$/i.test(normalized);
    if (!state) {
      const departments = await this.prisma.department.findMany({ where: { tenantId: channel.tenantId, isActive: true } });
      departments.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const numericChoice = /^\d+$/.test(normalized) ? Number(normalized) : 0;
      const chosenDepartment = numericChoice > 0 ? departments[numericChoice - 1] : undefined;
      const financeChoice = Boolean(chosenDepartment && (chosenDepartment.key.toLocaleLowerCase("pt-BR") === "financeiro" || chosenDepartment.name.toLocaleLowerCase("pt-BR").includes("finance")));
      if (!financeChoice && !/(financeiro|boleto|pix|pagar|pagamento|quitar|fatura|debito|débito|cobranca|cobrança|segunda via)/i.test(normalized)) return false;
      const settings = await this.asaas.publicSettings(channel.tenantId);
      if (!settings.enabled || !settings.configured) return false;
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: { flow: "ASAAS", step: "DOCUMENT" } } });
      await this.sendBotReply(channel, chatId, conversationId, "Claro! Posso consultar cobranças no Asaas e enviar boleto, linha digitável, Pix copia e cola ou a fatura disponível.\n\nPara proteger seus dados, envie o CPF ou CNPJ do titular (somente números). Digite *cancelar* para sair.");
      return true;
    }
    if (cancel) {
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: {} } });
      await this.sendBotReply(channel, chatId, conversationId, "Consulta financeira cancelada. Se precisar, escreva *financeiro* para começar novamente.");
      return true;
    }
    const step = String(state.step || "");
    if (step === "DOCUMENT") {
      let result: Awaited<ReturnType<AsaasService["openDebts"]>>;
      try { result = await this.asaas.openDebts(channel.tenantId, text, chatId.split("@")[0]); }
      catch (error) {
        const message = error instanceof Error ? error.message : "";
        const invalid = message.toLocaleLowerCase("pt-BR").includes("cpf/cnpj inválido");
        if (message.toLocaleLowerCase("pt-BR").includes("confirmar o telefone")) {
          const finance = await this.prisma.department.findFirst({ where: { tenantId: channel.tenantId, isActive: true, OR: [{ key: "FINANCEIRO" }, { name: { contains: "finance", mode: "insensitive" } }] } });
          await this.prisma.conversation.update({ where: { id: conversationId }, data: { handlingMode: "HUMAN", departmentId: finance?.id ?? null, assigneeId: null, status: "OPEN", botState: {} } });
          this.events.publish(channel.tenantId, "conversation.updated", { id: conversationId, handlingMode: "HUMAN", departmentId: finance?.id ?? null, status: "OPEN" });
          await this.sendBotReply(channel, chatId, conversationId, "Por segurança, não consegui confirmar que este WhatsApp corresponde ao cadastro financeiro. Não vou exibir cobranças por aqui. Encaminhei a conversa para o Financeiro verificar sua identidade. 🙌");
          return true;
        }
        await this.sendBotReply(channel, chatId, conversationId, invalid ? "O CPF/CNPJ não passou na validação. Confira os números e tente novamente, ou digite *cancelar*." : "Não consegui consultar o Asaas neste momento. Confira o documento e tente novamente mais tarde, ou digite *cancelar*.");
        return true;
      }
      const environmentNote = result.environment === "SANDBOX" ? "🧪 TESTE · ambiente Sandbox; nenhuma cobrança real será feita.\n\n" : "";
      if (!result.debts.length) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: { flow: "ASAAS", step: "NO_DEBTS" } } });
        await this.sendBotReply(channel, chatId, conversationId, environmentNote + "Não encontrei cobranças em aberto para esse documento.\n\n1. Falar com o Financeiro\n2. Consultar outro documento\n\nDigite *cancelar* para sair.");
        return true;
      }
      const debts = result.debts.slice(0, 10).map((debt) => ({ id: debt.id, value: Number(debt.value), dueDate: debt.dueDate, status: debt.status, description: debt.description || "Cobrança" }));
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: { flow: "ASAAS", step: "PICK_DEBT", debts } } });
      const lines = debts.map((debt, index) => `${index + 1}. ${debt.description} — ${debt.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — venc. ${debt.dueDate || "não informado"}${debt.status === "OVERDUE" ? " (vencida)" : ""}`);
      await this.sendBotReply(channel, chatId, conversationId, environmentNote + `Encontrei estas cobranças em aberto:\n\n${lines.join("\n")}\n\nResponda com o número da cobrança desejada.`);
      return true;
    }
    if (step === "NO_DEBTS") {
      if (/^2$/.test(normalized)) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: { flow: "ASAAS", step: "DOCUMENT" } } });
        await this.sendBotReply(channel, chatId, conversationId, "Envie o CPF ou CNPJ do titular (somente números).");
      } else if (/^1$/.test(normalized)) {
        const finance = await this.prisma.department.findFirst({ where: { tenantId: channel.tenantId, isActive: true, OR: [{ key: "FINANCEIRO" }, { name: { contains: "finance", mode: "insensitive" } }] } });
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { handlingMode: "HUMAN", departmentId: finance?.id ?? null, assigneeId: null, status: "OPEN", botState: {} } });
        this.events.publish(channel.tenantId, "conversation.updated", { id: conversationId, handlingMode: "HUMAN", departmentId: finance?.id ?? null, status: "OPEN" });
        await this.sendBotReply(channel, chatId, conversationId, "Certo! Vou encaminhar sua conversa para o Financeiro. Um atendente continuará por aqui. 🙌");
      } else await this.sendBotReply(channel, chatId, conversationId, "Responda 1 para falar com o Financeiro ou 2 para consultar outro documento.");
      return true;
    }
    if (step === "PICK_DEBT") {
      const debts = Array.isArray(state.debts) ? state.debts as Array<{ id: string; value: number; dueDate: string; description: string; status: string }> : [];
      const choice = /^\d+$/.test(normalized) ? Number(normalized) : 0;
      if (choice < 1 || choice > debts.length) {
        await this.sendBotReply(channel, chatId, conversationId, "Número inválido. Responda com um dos números da lista, ou digite *cancelar*.");
        return true;
      }
      const debt = debts[choice - 1];
      if (!debt) {
        await this.sendBotReply(channel, chatId, conversationId, "Não consegui localizar essa cobrança. Envie o número novamente.");
        return true;
      }
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: { ...state, step: "PAYMENT_METHOD", selectedDebt: debt } as any } });
      await this.sendBotReply(channel, chatId, conversationId, `Cobrança selecionada: ${debt.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — venc. ${debt.dueDate || "não informado"}.\n\nEscolha a forma de pagamento:\n1. Boleto / PDF\n2. Linha digitável\n3. Pix copia e cola\n4. Fatura completa (outras formas disponíveis no Asaas)`);
      return true;
    }
    if (step === "PAYMENT_METHOD") {
      const choice = Number(normalized);
      if (![1, 2, 3, 4].includes(choice)) {
        await this.sendBotReply(channel, chatId, conversationId, "Escolha 1 para boleto, 2 para linha digitável, 3 para Pix ou 4 para fatura completa.");
        return true;
      }
      const selected = state.selectedDebt && typeof state.selectedDebt === "object" ? state.selectedDebt as { id: string; value: number; dueDate: string } : null;
      if (!selected) {
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: {} } });
        await this.sendBotReply(channel, chatId, conversationId, "A seleção expirou. Escreva *financeiro* para iniciar novamente.");
        return true;
      }
      try {
        const detail = await this.asaas.paymentDetails(channel.tenantId, selected.id);
        const conversationRecord = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId: channel.tenantId }, select: { contactId: true } });
        if (conversationRecord) {
          await this.prisma.payment.upsert({
            where: { tenantId_provider_externalId: { tenantId: channel.tenantId, provider: "ASAAS", externalId: detail.id } },
            create: { tenantId: channel.tenantId, conversationId, contactId: conversationRecord.contactId, provider: "ASAAS", externalId: detail.id, amount: detail.value, status: detail.status || "PENDING", billingType: ({ 1: "BOLETO", 2: "BOLETO_LINE", 3: "PIX", 4: "INVOICE" } as Record<number, string>)[choice], invoiceUrl: detail.invoiceUrl, bankSlipUrl: detail.bankSlipUrl, pixPayload: detail.pixPayload, environment: detail.environment },
            update: { amount: detail.value, status: detail.status || "PENDING", billingType: ({ 1: "BOLETO", 2: "BOLETO_LINE", 3: "PIX", 4: "INVOICE" } as Record<number, string>)[choice], invoiceUrl: detail.invoiceUrl, bankSlipUrl: detail.bankSlipUrl, pixPayload: detail.pixPayload, environment: detail.environment },
          });
        }
        const heading = (detail.environment === "SANDBOX" ? "🧪 TESTE · Sandbox, sem pagamento real\n" : "") + `Cobrança de ${detail.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} — venc. ${detail.dueDate || selected.dueDate || "não informado"}`;
        let response = heading;
        if (choice === 1) response += "\n\nBoleto / PDF: " + (detail.bankSlipUrl || detail.invoiceUrl || "O boleto não está disponível nesta cobrança.");
        else if (choice === 2) response += "\n\nLinha digitável: " + (detail.identificationField || "Não disponibilizada pelo Asaas. Use a fatura: " + (detail.invoiceUrl || "indisponível"));
        else if (choice === 3) response += "\n\nPix copia e cola:\n" + (detail.pixPayload || "Pix não está disponível para esta cobrança. Fatura: " + (detail.invoiceUrl || "indisponível"));
        else response += "\n\nFatura completa: " + (detail.invoiceUrl || "Não disponibilizada pelo Asaas.");
        if (detail.invoiceUrl && choice !== 4) response += "\n\nOutras formas de pagamento: " + detail.invoiceUrl;
        await this.sendBotReply(channel, chatId, conversationId, response);
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: {} } });
      } catch {
        const finance = await this.prisma.department.findFirst({ where: { tenantId: channel.tenantId, isActive: true, OR: [{ key: "FINANCEIRO" }, { name: { contains: "finance", mode: "insensitive" } }] } });
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { handlingMode: "HUMAN", departmentId: finance?.id ?? null, assigneeId: null, status: "OPEN", botState: {} } });
        this.events.publish(channel.tenantId, "conversation.updated", { id: conversationId, handlingMode: "HUMAN", departmentId: finance?.id ?? null, status: "OPEN" });
        await this.sendBotReply(channel, chatId, conversationId, "Não consegui obter os dados de pagamento agora. Encaminhei sua conversa para o Financeiro verificar. Um atendente continuará por aqui.");
      }
      return true;
    }
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { botState: {} } });
    return false;
  }

  private async sendBotReply(channel: { id: string; tenantId: string; sessionName: string } & Parameters<WahaService["sendText"]>[0], chatId: string, conversationId: string, content: string): Promise<void> {
    const queued = await this.prisma.message.create({
      data: { tenantId: channel.tenantId, conversationId, direction: "OUTBOUND", status: "QUEUED", content, contentType: "text", senderName: "Assistente virtual", metadata: { provider: "WAHA", bot: true } },
    });
    this.events.publish(channel.tenantId, "message.queued", { conversationId, message: { id: queued.id, direction: queued.direction, status: queued.status, content: queued.content } });
    try {
      const providerMessageId = await this.waha.sendText(channel, chatId, content);
      const sent = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "SENT", providerMessageId } });
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: sent.occurredAt } });
      this.events.publish(channel.tenantId, "message.sent", { conversationId, message: { id: sent.id, direction: sent.direction, status: sent.status, content: sent.content, occurredAt: sent.occurredAt.toISOString() } });
    } catch {
      const failed = await this.prisma.message.update({ where: { id: queued.id }, data: { status: "FAILED", metadata: { provider: "WAHA", bot: true, errorCode: "BOT_SEND_FAILED" } } });
      this.events.publish(channel.tenantId, "message.failed", { conversationId, message: { id: failed.id, status: failed.status, content: failed.content } });
    }
  }

  private providerMessageId(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "_serialized" in value) {
      const serialized = (value as { _serialized?: unknown })._serialized;
      return typeof serialized === "string" ? serialized : null;
    }
    return null;
  }
}
