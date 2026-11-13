import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";

const FICTITIOUS_NAMES = ["Amanda Souza","Bruno Oliveira","Carla Ferreira","Diego Martins","Eduarda Lima","Felipe Rodrigues","Gabriela Almeida","Henrique Costa","Isabela Ribeiro","João Pedro Santos","Larissa Nascimento","Lucas Carvalho","Mariana Pereira","Matheus Barbosa","Natália Gomes","Nicolas Teixeira","Patricia Moraes","Pedro Duarte","Rafaela Antunes","Ricardo Fonseca","Sabrina Cavalcante","Samuel Lopes","Tatiane Ramos","Thomas Cardoso","Vanessa Duarte","Vinícius Moura","Beatriz Nunes","Caio Fernandes","Débora Teixeira","Gustavo Pinto"];
const AMOUNTS = [197, 297, 497];
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
const rnd = (max: number) => Math.floor(Math.random() * max);

/** Modo demo: gera (e apaga) uma massa fictícia rica para demonstrações no ambiente sandbox. */
@Controller("operations/demo")
@UseGuards(AuthGuard)
export class DemoController {
  constructor(private readonly prisma: PrismaService) {}

  private admin(req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Somente administradores podem gerar ou apagar dados de demonstração.");
  }

  private fakeCpf(i: number) { return "90000" + String(i).padStart(4, "0") + "-00"; }
  private monthAgo(months: number, dayJitter = 0): Date { const d = new Date(); d.setMonth(d.getMonth() - months); d.setDate(Math.min(28, Math.max(1, rnd(27) + 1 + dayJitter))); d.setHours(rnd(9) + 9, rnd(60), 0, 0); return d; }

  @Get("status")
  async status(@Req() req: AuthenticatedRequest) {
    this.admin(req);
    const tenantId = req.user.tenantId;
    const [contacts, payments, conversations, users] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, source: "DEMO" } }),
      this.prisma.payment.count({ where: { tenantId, provider: "ASAAS", environment: "SANDBOX", externalId: { startsWith: "demo_" } } }),
      this.prisma.conversation.count({ where: { tenantId, contact: { source: "DEMO" } } }),
      this.prisma.user.count({ where: { email: { endsWith: "@demo.vexorasuite.com.br" } } }),
    ]);
    return { contacts, payments, conversations, attendants: users, seeded: contacts > 0 };
  }

  @Post("seed")
  @HttpCode(HttpStatus.OK)
  async seed(@Req() req: AuthenticatedRequest, @Body() body: { confirmation?: unknown }) {
    this.admin(req);
    if (body?.confirmation !== "GERAR-DEMO") throw new BadRequestException("Digite GERAR-DEMO para confirmar a geração dos dados fictícios.");
    const tenantId = req.user.tenantId;
    const already = await this.prisma.contact.count({ where: { tenantId, source: "DEMO" } });
    if (already > 0) throw new BadRequestException("Dados de demonstração já existem. Apague antes de gerar novos (botão “Excluir dados fictícios”).");
    const departments = await this.prisma.department.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, take: 12 });
    if (!departments.length) throw new BadRequestException("Crie ao menos um setor (Atendentes → Setores) antes de gerar o modo demo.");

    const result = { contacts: 0, conversations: 0, messages: 0, payments: 0, attendants: 0 };
    await this.prisma.$transaction(async tx => {
      // 1) Atendentes demo (usuários reais com papel AGENT, membros de 2-3 setores)
      const demoUsers: { id: string; name: string }[] = [];
      for (let i = 1; i <= 6; i += 1) {
        const name = pick(FICTITIOUS_NAMES);
        const user = await tx.user.create({ data: { name, email: `demo-agente${i}-${randomUUID().slice(0, 8)}@demo.vexorasuite.com.br`, passwordHash: await hash(randomBytes(48).toString("hex"), 10), isActive: true, mustChangePassword: false } });
        const deptCount = Math.min(departments.length, 2 + rnd(2));
        const shuffled = [...departments].sort(() => Math.random() - 0.5).slice(0, deptCount);
        for (const dept of shuffled) await tx.departmentMember.create({ data: { tenantId, departmentId: dept.id, userId: user.id } });
        demoUsers.push({ id: user.id, name });
        result.attendants += 1;
      }
      // 2) Contatos fictícios (nomes, CPFs e e-mails fictícios)
      const demoContacts: { id: string; name: string }[] = [];
      for (let i = 0; i < 30; i += 1) {
        const name = FICTITIOUS_NAMES[i % FICTITIOUS_NAMES.length]!;
        const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
        const contact = await tx.contact.create({ data: { tenantId, name, email: `${slug}${i || ""}@demo.vexorasuite.com.br`, phone: "55" + String(60000000000 + rnd(39999999999)), source: "DEMO", externalId: `demo_${i}_${randomUUID().slice(0, 8)}`, metadata: { demo: true, cpf: this.fakeCpf(i) } as any } });
        demoContacts.push({ id: contact.id, name });
        result.contacts += 1;
      }
      // 3) Atendimentos em várias fases + mensagens
      const statusPool = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];
      const modePool = ["HUMAN", "BOT"];
      for (const [index, contact] of demoContacts.entries()) {
        const convCount = index % 5 === 4 ? 2 : 1;
        for (let c = 0; c < convCount; c += 1) {
          const status = statusPool[(index + c) % statusPool.length]!;
          const assignee = status === "CLOSED" || status === "RESOLVED" ? pick(demoUsers).id : (rnd(100) < 65 ? pick(demoUsers).id : null);
          const dept = pick(departments);
          const conv = await tx.conversation.create({ data: { tenantId, contactId: contact.id, departmentId: dept.id, assigneeId: assignee, handlingMode: (c === 2 ? "BOT" : pick(modePool)) as any, status: status as any, channel: "WHATSAPP", botState: {} } });
          const openers = ["Olá, preciso de ajuda com meu plano.", "Quero saber sobre a fatura deste mês.", "Meu acesso está com problema, podem verificar?", "Preciso de uma segunda via da cobrança."];
          await tx.message.create({ data: { tenantId, conversationId: conv.id, direction: "INBOUND", status: "READ", content: pick(openers), contentType: "text", senderName: contact.name, occurredAt: this.monthAgo(1, 0) } });
          await tx.message.create({ data: { tenantId, conversationId: conv.id, direction: "OUTBOUND", status: "READ", content: "Olá! Já estou verificando para você. Em instantes te retorno com a solução.", contentType: "text", senderName: assignee ? "Atendente" : "Véxora", occurredAt: this.monthAgo(1, 0) } });
          if (status === "RESOLVED" || status === "CLOSED") await tx.message.create({ data: { tenantId, conversationId: conv.id, direction: "OUTBOUND", status: "READ", content: "Prontinho! Qualquer outra necessidade, é só chamar. 😊", contentType: "text", senderName: "Atendente", occurredAt: this.monthAgo(1, 1) } });
          result.conversations += 1;
          result.messages += 2;
        }
      }
      // 4) Cobranças fictícias — histórico de 6 meses com perfis variados
      const profile = demoContacts.map((_, i) => i < 18 ? "up-to-date" : i < 21 ? "late-last" : i < 24 ? "delinquent" : i < 27 ? "due-soon" : "up-to-date");
      for (const [i, contact] of demoContacts.entries()) {
        const amountOf = (k: number) => AMOUNTS[(k + i) % AMOUNTS.length]!;
        for (let m = 6; m >= 1; m -= 1) {
          const kind = profile[i];
          let status = "RECEIVED";
          if (kind === "delinquent" && m <= 4) status = "OVERDUE";
          else if (kind === "late-last" && m === 1) status = "OVERDUE";
          else if (kind === "due-soon" && m === 1) status = "PENDING";
          else if (m === 1 && i % 3 === 0) status = "PENDING";
          if (m === 1 && status === "RECEIVED" && i % 4 === 0) status = "CONFIRMED";
          const createdAt = this.monthAgo(m, 0);
          await tx.payment.create({ data: { tenantId, conversationId: (await tx.conversation.findFirst({ where: { tenantId, contactId: contact.id }, select: { id: true }, orderBy: { createdAt: "desc" } }))!.id, contactId: contact.id, provider: "ASAAS", externalId: `demo_${randomUUID()}`, amount: amountOf(m), status, billingType: "BOLETO", environment: "SANDBOX", createdAt, updatedAt: createdAt } });
          result.payments += 1;
        }
      }
      await tx.auditLog.create({ data: { tenantId, userId: req.user.sub, action: "demo.seed", entityType: "tenant", entityId: tenantId, details: { ...result, note: "Criado via modo demo — pode ser removido com EXCLUIR-DEMO" } } });
    }, { timeout: 120000 });
    return { ok: true, ...result };
  }

  @Post("purge")
  @HttpCode(HttpStatus.OK)
  async purge(@Req() req: AuthenticatedRequest, @Body() body: { confirmation?: unknown }) {
    this.admin(req);
    if (body?.confirmation !== "EXCLUIR-DEMO") throw new BadRequestException("Digite EXCLUIR-DEMO para apagar os dados fictícios.");
    const tenantId = req.user.tenantId;
    const demoContacts = await this.prisma.contact.findMany({ where: { tenantId, source: "DEMO" }, select: { id: true } });
    if (!demoContacts.length) return { ok: true, deleted: 0, note: "Nenhum dado de demonstração encontrado." };
    const contactIds = demoContacts.map(c => c.id);
    const demoUsers = await this.prisma.user.findMany({ where: { email: { endsWith: "@demo.vexorasuite.com.br" }, memberships: { some: { tenantId } } }, select: { id: true } });
    const userIds = demoUsers.map(u => u.id);
    const counts = { messages: 0, payments: 0, conversations: 0, contacts: 0, attendants: 0 };
    await this.prisma.$transaction(async tx => {
      counts.messages = (await tx.message.deleteMany({ where: { tenantId, conversation: { contactId: { in: contactIds } } } })).count;
      counts.payments = (await tx.payment.deleteMany({ where: { tenantId, externalId: { startsWith: "demo_" }, contactId: { in: contactIds } } })).count;
      counts.conversations = (await tx.conversation.deleteMany({ where: { tenantId, contactId: { in: contactIds } } })).count;
      counts.contacts = (await tx.contact.deleteMany({ where: { tenantId, id: { in: contactIds } } })).count;
      if (userIds.length) {
        await tx.departmentMember.deleteMany({ where: { tenantId, userId: { in: userIds } } });
        await tx.membership.deleteMany({ where: { tenantId, userId: { in: userIds } } });
        counts.attendants = (await tx.user.deleteMany({ where: { id: { in: userIds } } })).count;
      }
      await tx.auditLog.deleteMany({ where: { tenantId, action: "demo.seed" } });
      await tx.auditLog.create({ data: { tenantId, userId: req.user.sub, action: "demo.purged", entityType: "tenant", entityId: tenantId, details: counts } });
    }, { timeout: 120000 });
    return { ok: true, ...counts };
  }
}
