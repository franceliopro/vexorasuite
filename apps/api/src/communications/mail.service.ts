import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedRequest } from "../auth/auth.types";
import {
  cleanEmail,
  emailAddress,
  emailTemplates,
  escapeHtml,
  occasion,
  personalize,
  text,
} from "./content";
import { mailHost, seal, unseal } from "./security";
import { mutateContactMetadata } from "../prisma/contact-metadata";
type Config = {
  smtpHost: string;
  smtpPort: number;
  imapHost?: string;
  imapPort?: number;
  user: string;
  password: string;
};
export function mailAdmin(req: AuthenticatedRequest) {
  if (!["OWNER", "ADMIN"].includes(req.user.role))
    throw new ForbiddenException(
      "Somente a administração pode gerenciar e-mails e campanhas.",
    );
}
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.tick(), 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async list(req: AuthenticatedRequest) {
    mailAdmin(req);
    const [accounts, templates, campaigns] = await Promise.all([
      this.prisma.mailAccount.findMany({
        where: { tenantId: req.user.tenantId },
        select: {
          id: true,
          email: true,
          name: true,
          active: true,
          lastSyncAt: true,
          lastError: true,
        },
      }),
      this.prisma.mailTemplate.findMany({
        where: { tenantId: req.user.tenantId },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      this.prisma.mailCampaign.findMany({
        where: { tenantId: req.user.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          scheduledAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return { accounts, templates, presets: emailTemplates, campaigns };
  }
  private async account(tenantId: string, id: string) {
    const a = await this.prisma.mailAccount.findFirst({
      where: { id, tenantId, active: true },
    });
    if (!a)
      throw new NotFoundException(
        "Conta de e-mail não encontrada ou desconectada.",
      );
    return {
      ...a,
      config: unseal(tenantId, a.id, a.configEncrypted) as Config,
    };
  }
  async saveAccount(req: AuthenticatedRequest, input: any) {
    mailAdmin(req);
    const email = emailAddress(input.email),
      name = text(input.name),
      smtpHost = text(input.smtpHost, 253),
      user = text(input.user, 254);
    if (![465, 587].includes(Number(input.smtpPort)))
      throw new BadRequestException("SMTP deve usar 465 ou 587 com TLS.");
    if (
      typeof input.password !== "string" ||
      !input.password ||
      input.password.length > 4000
    )
      throw new BadRequestException("Informe a senha de aplicativo.");
    await mailHost(smtpHost);
    if (input.imapHost) await mailHost(text(input.imapHost, 253));
    const existing = await this.prisma.mailAccount.findUnique({
      where: { tenantId_email: { tenantId: req.user.tenantId, email } },
    });
    const id = existing?.id || randomUUID(),
      config: Config = {
        smtpHost,
        smtpPort: Number(input.smtpPort),
        user,
        password: input.password,
        ...(input.imapHost ? { imapHost: input.imapHost, imapPort: 993 } : {}),
      };
    const configEncrypted = seal(req.user.tenantId, id, config);
    await this.prisma.mailAccount.upsert({
      where: { tenantId_email: { tenantId: req.user.tenantId, email } },
      create: { id, tenantId: req.user.tenantId, email, name, configEncrypted },
      update: { name, configEncrypted, active: true, lastError: null },
    });
    return { id, email, name, active: true };
  }
  async disconnect(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    await this.account(req.user.tenantId, id);
    await this.prisma.mailAccount.update({
      where: { id },
      data: { active: false },
    });
    return { active: false };
  }
  private async transport(config: Config) {
    const host = await mailHost(config.smtpHost);
    return nodemailer.createTransport({
      host,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      requireTLS: true,
      tls: {
        servername: config.smtpHost,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
      auth: { user: config.user, pass: config.password },
      logger: false,
      debug: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  async verify(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    const a = await this.account(req.user.tenantId, id),
      transport = await this.transport(a.config);
    try {
      await transport.verify();
      return {
        connected: true,
        smtp: true,
        imapConfigured: !!a.config.imapHost,
      };
    } catch {
      throw new BadRequestException(
        "Não foi possível autenticar no SMTP. Confira servidor e senha de aplicativo.",
      );
    } finally {
      transport.close();
    }
  }
  async sync(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    const a = await this.account(req.user.tenantId, id);
    if (!a.config.imapHost)
      throw new BadRequestException("Configure o servidor IMAP desta conta.");
    const client = new ImapFlow({
      host: await mailHost(a.config.imapHost),
      port: 993,
      secure: true,
      tls: {
        servername: a.config.imapHost,
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
      auth: { user: a.config.user, pass: a.config.password },
      logger: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      let imported = 0;
      try {
        const box = client.mailbox;
        if (!box) return { imported };
        const validity = String(box.uidValidity);
        const envelopes = await client.fetchAll(
          Math.max(1, box.exists - 19) + ":*",
          { uid: true, envelope: true, size: true, internalDate: true },
        );
        for (const item of envelopes) {
          if (!item.size || item.size > 2 * 1024 * 1024) continue;
          const externalId = validity + ":" + item.uid;
          const prior = await this.prisma.mailItem.findUnique({
            where: {
              tenantId_accountId_externalId: {
                tenantId: a.tenantId,
                accountId: a.id,
                externalId,
              },
            },
          });
          if (prior) continue;
          const raw = await client.fetchOne(
            String(item.uid),
            { source: true },
            { uid: true },
          );
          if (!raw || !raw.source || raw.source.length > 2 * 1024 * 1024)
            continue;
          const parsed = await simpleParser(raw.source, {
            skipHtmlToText: true,
            skipTextToHtml: true,
            skipImageLinks: true,
          });
          let html =
            "<p>" + escapeHtml((parsed.text || "").slice(0, 100000)) + "</p>";
          if (parsed.html) {
            try {
              html = cleanEmail(parsed.html.slice(0, 150000));
            } catch {
              /* Plain text remains readable when imported HTML is empty. */
            }
          }
          await this.prisma.mailItem.upsert({
            where: {
              tenantId_accountId_externalId: {
                tenantId: a.tenantId,
                accountId: a.id,
                externalId,
              },
            },
            create: {
              tenantId: a.tenantId,
              accountId: a.id,
              externalId,
              subject: (parsed.subject || "Sem assunto").slice(0, 500),
              fromAddress: (parsed.from?.value?.[0]?.address || "").slice(
                0,
                500,
              ),
              messageId: (parsed.messageId || "").slice(0, 500),
              toAddress: a.email,
              text: (parsed.text || "").slice(0, 100000),
              html,
              receivedAt:
                parsed.date && Number.isFinite(parsed.date.getTime())
                  ? parsed.date
                  : new Date(),
            },
            update: {},
          });
          imported++;
        }
      } finally {
        lock.release();
      }
      await this.prisma.mailAccount.update({
        where: { id: a.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });
      return { imported };
    } catch {
      await this.prisma.mailAccount.update({
        where: { id: a.id },
        data: {
          lastError: "Não foi possível sincronizar o IMAP. Confira a conexão.",
        },
      });
      throw new BadRequestException(
        "Não foi possível sincronizar o IMAP. Confira servidor e senha de aplicativo.",
      );
    } finally {
      await client.logout().catch(() => {});
      client.close();
    }
  }
  async inbox(req: AuthenticatedRequest, accountId: string) {
    mailAdmin(req);
    await this.account(req.user.tenantId, accountId);
    return this.prisma.mailItem.findMany({
      where: { tenantId: req.user.tenantId, accountId },
      select: { id: true, subject: true, fromAddress: true, receivedAt: true },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
  }
  async read(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    const item = await this.prisma.mailItem.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!item) throw new NotFoundException("E-mail não encontrado.");
    return item;
  }
  async reply(req: AuthenticatedRequest, id: string, input: any) {
    mailAdmin(req);
    const item = await this.read(req, id);
    await this.account(req.user.tenantId, item.accountId);
    const email = emailAddress(item.fromAddress),
      html = cleanEmail(input.html);
    const subject = text(
      "Re: " + item.subject.replace(/^Re:\s*/i, "").slice(0, 230),
      240,
    );
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.mailCampaign.create({
        data: {
          tenantId: req.user.tenantId,
          accountId: item.accountId,
          userId: req.user.sub,
          kind: "REPLY",
          inReplyTo: item.messageId,
          name: "Resposta: " + item.subject.slice(0, 150),
          subject,
          html,
          status: "DRAFT",
        },
      });
      await tx.mailDelivery.create({
        data: {
          tenantId: req.user.tenantId,
          campaignId: c.id,
          email,
          name: email,
        },
      });
      return { id: c.id, status: "DRAFT" };
    });
  }
  async saveTemplate(req: AuthenticatedRequest, input: any) {
    mailAdmin(req);
    const data = {
      name: text(input.name),
      subject: text(input.subject, 240),
      html: cleanEmail(input.html),
    };
    if (input.id) {
      const row = await this.prisma.mailTemplate.findFirst({
        where: { id: input.id, tenantId: req.user.tenantId },
      });
      if (!row) throw new NotFoundException("Modelo não encontrado.");
      return this.prisma.mailTemplate.update({ where: { id: row.id }, data });
    }
    if (
      (await this.prisma.mailTemplate.count({
        where: { tenantId: req.user.tenantId },
      })) >= 100
    )
      throw new BadRequestException("Limite de 100 modelos.");
    return this.prisma.mailTemplate.create({
      data: { tenantId: req.user.tenantId, ...data },
    });
  }
  async audience(req: AuthenticatedRequest, kind = "all", month = 0) {
    mailAdmin(req);
    if (
      !["all", "birthday", "partnership"].includes(kind) ||
      !Number.isInteger(month) ||
      month < 0 ||
      month > 12 ||
      (kind !== "all" && !month)
    )
      throw new BadRequestException("Selecione público e mês.");
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId: req.user.tenantId, email: { not: null } },
      select: { id: true, name: true, email: true, metadata: true },
      orderBy: { name: "asc" },
      take: 5001,
    });
    const seen = new Set<string>();
    const rows = contacts
      .filter((c) => {
        try {
          const email = emailAddress(c.email);
          if (
            (c.metadata as any)?.communications?.emailOptOut ||
            seen.has(email) ||
            !occasion(c.metadata, kind, month)
          )
            return false;
          seen.add(email);
          return true;
        } catch {
          return false;
        }
      })
      .map((c) => ({ id: c.id, name: c.name, email: c.email }));
    return {
      contacts: rows.slice(0, 500),
      truncated: contacts.length > 5000 || rows.length > 500,
    };
  }
  async campaign(req: AuthenticatedRequest, input: any) {
    mailAdmin(req);
    const account = await this.account(req.user.tenantId, input.accountId);
    if (
      !Array.isArray(input.contactIds) ||
      !input.contactIds.length ||
      input.contactIds.length > 500 ||
      input.contactIds.some((x: any) => typeof x !== "string")
    )
      throw new BadRequestException("Selecione até 500 contatos.");
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId: req.user.tenantId, id: { in: input.contactIds } },
      select: { name: true, email: true, metadata: true },
    });
    const recipients = new Map<string, string>();
    for (const c of contacts) {
      if ((c.metadata as any)?.communications?.emailOptOut) continue;
      try {
        recipients.set(
          emailAddress(c.email),
          String((c.metadata as any)?.novo_nome || c.name).slice(0, 180),
        );
      } catch {}
    }
    if (!recipients.size)
      throw new BadRequestException("Nenhum destinatário válido selecionado.");
    const subject = text(input.subject, 240),
      html = cleanEmail(input.html),
      name = text(input.name),
      scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (
      scheduledAt &&
      (!Number.isFinite(scheduledAt.getTime()) ||
        scheduledAt.getTime() < Date.now() - 60000)
    )
      throw new BadRequestException("Agendamento inválido.");
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.mailCampaign.create({
        data: {
          tenantId: req.user.tenantId,
          accountId: account.id,
          userId: req.user.sub,
          name,
          subject,
          html,
          scheduledAt,
          status: "DRAFT",
        },
      });
      await tx.mailDelivery.createMany({
        data: [...recipients].map(([email, name]) => ({
          tenantId: req.user.tenantId,
          campaignId: campaign.id,
          email,
          name,
        })),
      });
      return { id: campaign.id, recipients: recipients.size, status: "DRAFT" };
    });
  }
  async campaignStatus(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    const campaign = await this.prisma.mailCampaign.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!campaign) throw new NotFoundException("Campanha não encontrada.");
    const deliveries = await this.prisma.mailDelivery.groupBy({
      by: ["status"],
      where: { tenantId: req.user.tenantId, campaignId: id },
      _count: true,
    });
    return {
      ...campaign,
      counts: deliveries.map((x) => ({ status: x.status, count: x._count })),
    };
  }
  async activate(req: AuthenticatedRequest, id: string, input: any) {
    mailAdmin(req);
    const row = await this.campaignStatus(req, id);
    await this.account(req.user.tenantId, row.accountId);
    if (!["DRAFT", "PAUSED"].includes(row.status) || input.confirm !== true)
      throw new BadRequestException(
        "Revise e confirme os destinatários para enviar.",
      );
    const origin =
      process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    let validOrigin = false;
    try {
      const url = new URL(origin || "");
      validOrigin = url.protocol === "https:" && !url.username && !url.password;
    } catch {}
    if (!validOrigin)
      throw new BadRequestException(
        "Configure o endereço HTTPS público para o descadastro.",
      );
    return this.prisma.mailCampaign.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  }
  async pause(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    const row = await this.campaignStatus(req, id);
    if (["DRAFT", "ACTIVE", "PAUSED"].includes(row.status))
      await this.prisma.mailCampaign.update({
        where: { id },
        data: { status: "PAUSED" },
      });
    return {
      status: "PAUSED",
      message:
        "Envios ainda não iniciados foram pausados. Envios em andamento podem concluir.",
    };
  }
  private token(id: string) {
    return createHmac("sha256", process.env.JWT_ACCESS_SECRET || "")
      .update("email-unsubscribe:" + id)
      .digest("base64url");
  }
  unsubscribeLink(id: string) {
    return (
      (
        process.env.PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        ""
      ).replace(/\/$/, "") +
      "/api/backend/mail/unsubscribe/" +
      id +
      "/" +
      this.token(id)
    );
  }
  validToken(id: string, token: string) {
    const expected = Buffer.from(this.token(id)),
      provided = Buffer.from(token);
    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  }
  async unsubscribe(id: string, token: string) {
    if (!this.validToken(id, token))
      throw new BadRequestException("Link inválido.");
    const delivery = await this.prisma.mailDelivery.findUnique({
      where: { id },
    });
    if (!delivery) throw new NotFoundException("Destinatário não encontrado.");
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId: delivery.tenantId,
        email: { equals: delivery.email, mode: "insensitive" },
      },
      select: { id: true },
    });
    for (const c of contacts)
      await mutateContactMetadata(
        this.prisma,
        delivery.tenantId,
        c.id,
        (m) => ({
          ...m,
          communications: {
            ...((m.communications as any) || {}),
            emailOptOut: true,
          },
        }),
      );
    await this.prisma.mailDelivery.updateMany({
      where: {
        tenantId: delivery.tenantId,
        email: delivery.email,
        status: "QUEUED",
      },
      data: { status: "SUPPRESSED" },
    });
    return { unsubscribed: true };
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.mailDelivery.updateMany({
        where: {
          status: "SENDING",
          updatedAt: { lt: new Date(Date.now() - 120000) },
        },
        data: {
          status: "REVIEW",
          error:
            "Envio sem confirmação; confira a caixa de enviados antes de repetir.",
        },
      });
      for (let i = 0; i < 5; i++) {
        const delivery = await this.prisma.$transaction(async (tx) => {
          const candidates = await tx.$queryRaw<
            any[]
          >`SELECT d.* FROM mail_deliveries d JOIN mail_campaigns c ON c.id=d.campaign_id WHERE d.status='QUEUED' AND c.status='ACTIVE' AND (c.scheduled_at IS NULL OR c.scheduled_at<=now()) ORDER BY c.created_at FOR UPDATE OF d SKIP LOCKED LIMIT 1`;
          if (!candidates[0]) return null;
          return tx.mailDelivery.update({
            where: { id: candidates[0].id },
            data: { status: "SENDING" },
          });
        });
        if (!delivery) break;
        let transport:
          Awaited<ReturnType<MailService["transport"]>> | undefined;
        try {
          const campaign = await this.prisma.mailCampaign.findUniqueOrThrow({
            where: { id: delivery.campaignId },
          });
          if (campaign.status !== "ACTIVE") {
            await this.prisma.mailDelivery.update({
              where: { id: delivery.id },
              data: { status: "QUEUED" },
            });
            continue;
          }
          const owner = await this.prisma.membership.findFirst({
            where: {
              tenantId: delivery.tenantId,
              userId: campaign.userId,
              role: { in: ["OWNER", "ADMIN"] },
              user: { isActive: true },
            },
          });
          if (!owner) throw Error("permission");
          const contacts = await this.prisma.contact.findMany({
            where: {
              tenantId: delivery.tenantId,
              email: { equals: delivery.email, mode: "insensitive" },
            },
            select: { metadata: true },
          });
          if (
            campaign.kind !== "REPLY" &&
            (!contacts.length ||
              contacts.some(
                (c) => (c.metadata as any)?.communications?.emailOptOut,
              ))
          ) {
            await this.prisma.mailDelivery.update({
              where: { id: delivery.id },
              data: { status: "SUPPRESSED" },
            });
            continue;
          }
          const account = await this.account(
            delivery.tenantId,
            campaign.accountId,
          );
          transport = await this.transport(account.config);
          const link = this.unsubscribeLink(delivery.id);
          const html =
            personalize(campaign.html, delivery.name) +
            (campaign.kind === "REPLY"
              ? ""
              : '<p style="font-size:12px"><a href="' +
                escapeHtml(link) +
                '">Não quero receber estes e-mails</a></p>');
          const result = await transport.sendMail({
            from: { name: account.name, address: account.email },
            to: delivery.email,
            subject: campaign.subject.replace(
              /{{(?:nome|novo_nome)}}/g,
              delivery.name.replace(/[\r\n]/g, " "),
            ),
            html,
            ...(campaign.kind === "REPLY" && campaign.inReplyTo
              ? { inReplyTo: campaign.inReplyTo }
              : {}),
            headers: {
              ...(campaign.kind === "REPLY"
                ? {}
                : { "List-Unsubscribe": "<" + link + ">" }),
              "X-Vexora-Delivery": delivery.id,
            },
            messageId:
              "<" + delivery.id + "@" + account.email.split("@")[1] + ">",
          });
          await this.prisma.mailDelivery.update({
            where: { id: delivery.id },
            data: { status: "SENT", providerId: result.messageId },
          });
        } catch {
          await this.prisma.mailDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "REVIEW",
              error:
                "Não foi possível confirmar o envio. Confira a conexão e os enviados antes de repetir.",
            },
          });
        } finally {
          transport?.close();
        }
      }
      const active = await this.prisma.mailCampaign.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 100,
      });
      for (const c of active) {
        if (
          !(await this.prisma.mailDelivery.count({
            where: { campaignId: c.id, status: { in: ["QUEUED", "SENDING"] } },
          }))
        )
          await this.prisma.mailCampaign.updateMany({
            where: { id: c.id, status: "ACTIVE" },
            data: {
              status: (await this.prisma.mailDelivery.count({
                where: { campaignId: c.id, status: "REVIEW" },
              }))
                ? "REVIEW"
                : "COMPLETED",
            },
          });
      }
    } catch {
    } finally {
      this.running = false;
    }
  }
}
