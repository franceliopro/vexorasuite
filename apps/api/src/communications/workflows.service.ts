import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { isUUID } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedRequest } from "../auth/auth.types";
import { mailAdmin } from "./access";
import { localInstant, repeatInstant, workflowSteps } from "./workflow-time";
import { WahaService } from "../operations/waha.service";
import { contactMetadata, lockedContact } from "../prisma/contact-metadata";
import { text } from "./content";
@Injectable()
export class WorkflowsService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waha: WahaService,
  ) {}
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
    return {
      workflows: await this.prisma.internalWorkflow.findMany({
        where: { tenantId: req.user.tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      runs: await this.prisma.workflowRun.findMany({
        where: { tenantId: req.user.tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  async save(req: AuthenticatedRequest, input: any) {
    mailAdmin(req);
    const name = text(input.name),
      timezone = text(input.timezone, 100);
    const nextRunAt = localInstant(String(input.localStart || ""), timezone),
      steps = workflowSteps(input.steps);
    if (!["SCHEDULE", "INBOX", "MESSAGE", "CONTACT", "PAYMENT", "QUEUE", "STAGE"].includes(input.trigger))
      throw new BadRequestException("Gatilho inválido.");
    const repeatDays = Number(input.repeatDays || 0);
    if (!Number.isInteger(repeatDays) || repeatDays < 0 || repeatDays > 365)
      throw new BadRequestException("Repetição inválida.");
    const f = input.filters || {};
    if (
      f.channelId &&
      (!isUUID(f.channelId) ||
        !(await this.prisma.channelConnection.findFirst({
          where: {
            tenantId: req.user.tenantId,
            id: f.channelId,
            isActive: true,
          },
        })))
    )
      throw new BadRequestException("Canal inválido.");
    if (
      f.departmentId &&
      (!isUUID(f.departmentId) ||
        !(await this.prisma.department.findFirst({
          where: {
            tenantId: req.user.tenantId,
            id: f.departmentId,
            isActive: true,
          },
        })))
    )
      throw new BadRequestException("Fila inválida.");
    if (
      input.trigger === "STAGE" &&
      !["new", "qualification", "proposal", "finalization"].includes(f.stage)
    )
      throw new BadRequestException("Etapa do CRM inválida.");
    if (
      input.trigger === "SCHEDULE" &&
      steps.some((s) => s.type !== "TASK" && s.type !== "WAIT")
    )
      throw new BadRequestException(
        "Rotinas por horário permitem esperas e tarefas internas. Para mensagens, use um gatilho de conversa.",
      );
    if (input.enabled !== undefined && typeof input.enabled !== "boolean")
      throw new BadRequestException("Estado inválido.");
    if(f.assigneeId){
      if(!isUUID(f.assigneeId)||!await this.prisma.membership.findFirst({where:{tenantId:req.user.tenantId,userId:f.assigneeId,user:{isActive:true}},select:{id:true}}))throw new BadRequestException("Atendente não disponível nesta empresa.");
      if(f.departmentId&&!await this.prisma.departmentMember.findFirst({where:{tenantId:req.user.tenantId,userId:f.assigneeId,departmentId:f.departmentId},select:{id:true}}))throw new BadRequestException("Atendente não pertence ao departamento.");
      if(input.trigger==="QUEUE")throw new BadRequestException("Rotinas de fila sem atendente não aceitam um atendente específico.");
    }
    const data = {
      name,
      timezone,
      nextRunAt,
      steps,
      trigger: input.trigger,
      repeatDays,
      enabled: input.enabled === true,
      filters: {
        channelId: f.channelId || null,
        departmentId: f.departmentId || null,
        assigneeId: f.assigneeId || null,
        stage: f.stage || null,
        stopOnReply: f.stopOnReply !== false,
        cancelClosed: f.cancelClosed !== false,
        maxAttempts: Number.isInteger(Number(f.maxAttempts)) ? Math.max(1, Math.min(10, Number(f.maxAttempts))) : 3,
        retryFailed: f.retryFailed !== false,
        reviewUnsafe: f.reviewUnsafe !== false,
      },
    };
    if (input.id) {
      const row = await this.owned(req, input.id);
      if (row.enabled)
        throw new BadRequestException("Pause antes de editar a rotina.");
      if (
        await this.prisma.workflowRun.count({
          where: {
            workflowId: row.id,
            status: { in: ["WAITING", "PAUSED", "RUNNING"] },
          },
        })
      )
        throw new BadRequestException(
          "Cancele as sequências existentes antes de editar.",
        );
      return this.prisma.internalWorkflow.update({
        where: { id: row.id },
        data,
      });
    }
    return this.prisma.internalWorkflow.create({
      data: { tenantId: req.user.tenantId, userId: req.user.sub, ...data },
    });
  }
  private async owned(req: AuthenticatedRequest, id: string) {
    const row = await this.prisma.internalWorkflow.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!row) throw new NotFoundException("Rotina não encontrada.");
    return row;
  }
  async toggle(req: AuthenticatedRequest, id: string, input: any) {
    mailAdmin(req);
    const row = await this.owned(req, id);
    if (typeof input.enabled !== "boolean")
      throw new BadRequestException("Estado inválido.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM internal_workflows WHERE id=${row.id}::uuid FOR UPDATE`;
      const result = await tx.internalWorkflow.update({
        where: { id: row.id },
        data: { enabled: input.enabled },
      });
      await tx.workflowRun.updateMany({
        where: {
          workflowId: row.id,
          status: input.enabled ? "PAUSED" : "WAITING",
        },
        data: { status: input.enabled ? "WAITING" : "PAUSED" },
      });
      return result;
    });
  }
  async cancel(req: AuthenticatedRequest, id: string) {
    mailAdmin(req);
    const run = await this.prisma.workflowRun.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!run) throw new NotFoundException("Sequência não encontrada.");
    await this.prisma.workflowRun.updateMany({
      where: { id, status: { in: ["WAITING", "PAUSED"] } },
      data: { status: "CANCELLED" },
    });
    return { cancelled: true };
  }
  private async enroll() {
    const rules = await this.prisma.internalWorkflow.findMany({
      where: { enabled: true, nextRunAt: { lte: new Date() } },
      take: 100,
    });
    for (const rule of rules) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM internal_workflows WHERE id=${rule.id}::uuid FOR UPDATE`;
        const current = await tx.internalWorkflow.findUniqueOrThrow({
          where: { id: rule.id },
        });
        if (!current.enabled || current.nextRunAt > new Date()) return;
        const permission = await tx.membership.findFirst({
          where: {
            tenantId: rule.tenantId,
            userId: rule.userId,
            role: { in: ["OWNER", "ADMIN"] },
            user: { isActive: true },
          },
        });
        if (!permission) {
          await tx.internalWorkflow.update({
            where: { id: rule.id },
            data: { enabled: false },
          });
          return;
        }
        if (rule.trigger === "SCHEDULE") {
          await tx.workflowRun.upsert({
            where: {
              workflowId_eventKey: {
                workflowId: rule.id,
                eventKey: current.nextRunAt.toISOString(),
              },
            },
            create: {
              tenantId: rule.tenantId,
              workflowId: rule.id,
              eventKey: current.nextRunAt.toISOString(),
              nextRunAt: new Date(),
            },
            update: {},
          });
          if (!rule.repeatDays) {
            await tx.internalWorkflow.update({
              where: { id: rule.id },
              data: { nextRunAt: new Date("9999-01-01") },
            });
            return;
          }
          let next = repeatInstant(
            current.nextRunAt,
            rule.repeatDays,
            rule.timezone,
          );
          for (let i = 0; i < 4000 && next <= new Date(); i++)
            next = repeatInstant(next, rule.repeatDays, rule.timezone);
          await tx.internalWorkflow.update({
            where: { id: rule.id },
            data: { nextRunAt: next },
          });
          return;
        }
        const f = rule.filters as any;
        const enrolled = await tx.workflowRun.findMany({
          where: { workflowId: rule.id, conversationId: { not: null } },
          select: { conversationId: true },
        });
        const conversations = await tx.conversation.findMany({
          where: {
            id: { notIn: enrolled.map((r) => r.conversationId!) },
            tenantId: rule.tenantId,
            status: { in: ["OPEN", "PENDING"] },
            archivedAt: null,
            deletedAt: null,
            ...(f.channelId ? { channelConnectionId: f.channelId } : {}),
            ...(f.departmentId ? {departmentId:f.departmentId,department:{isActive:true}} : {}),
            ...(f.assigneeId ? {assigneeId:f.assigneeId,assignee:{isActive:true}} : {}),
            ...(rule.trigger === "QUEUE"
              ? {
                  assigneeId: null,
                  ...(f.departmentId ? { departmentId: f.departmentId } : {}),
                }
              : {}),
            ...(rule.trigger === "INBOX"
              ? { createdAt: { gte: rule.createdAt } }
              : {}),
            ...(rule.trigger === "MESSAGE"
              ? { messages: { some: { direction: "INBOUND", occurredAt: { gte: rule.createdAt } } } }
              : {}),
            ...(rule.trigger === "CONTACT"
              ? { contact: { updatedAt: { gte: rule.createdAt } } }
              : {}),
            ...(rule.trigger === "PAYMENT"
              ? { payments: { some: { updatedAt: { gte: rule.createdAt } } } }
              : {}),
            ...(rule.trigger === "STAGE"
              ? {
                  contact: {
                    metadata: { path: ["crmStage"], equals: f.stage },
                  },
                }
              : {}),
          },
          select: { id: true },
          take: 500,
        });
        for (const c of conversations) {
          await tx.workflowRun.upsert({
            where: {
              workflowId_eventKey: { workflowId: rule.id, eventKey: c.id },
            },
            create: {
              tenantId: rule.tenantId,
              workflowId: rule.id,
              eventKey: c.id,
              conversationId: c.id,
              nextRunAt: new Date(),
            },
            update: {},
          });
        }
      });
    }
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.workflowRun.updateMany({
        where: {
          status: "RUNNING",
          updatedAt: { lt: new Date(Date.now() - 120000) },
        },
        data: {
          status: "REVIEW",
          error: "Etapa sem confirmação. Revise antes de repetir.",
        },
      });
      await this.enroll();
      for (let i = 0; i < 15; i++) {
        const claimed = await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<
            any[]
          >`SELECT r.id FROM workflow_runs r JOIN internal_workflows w ON w.id=r.workflow_id WHERE r.status='WAITING' AND r.next_run_at<=now() AND w.enabled=true ORDER BY r.next_run_at FOR UPDATE OF r SKIP LOCKED LIMIT 1`;
          if (!rows[0]) return null;
          return tx.workflowRun.update({
            where: { id: rows[0].id },
            data: { status: "RUNNING" },
          });
        });
        if (!claimed) break;
        await this.execute(claimed).catch(async (cause) => {
          const current = await this.prisma.workflowRun.findUnique({
            where: { id: claimed.id },
            include: { workflow: true },
          });
          if (!current || current.status !== "RUNNING") return;
          const filters = (current.workflow.filters || {}) as Record<string, unknown>;
          const maxAttempts = Number.isInteger(Number(filters.maxAttempts))
            ? Math.max(1, Math.min(10, Number(filters.maxAttempts)))
            : 3;
          const nextAttempts = current.attempts + 1;
          if (filters.retryFailed !== false && nextAttempts < maxAttempts) {
            await this.prisma.workflowRun.update({
              where: { id: current.id },
              data: {
                attempts: nextAttempts,
                status: "WAITING",
                nextRunAt: new Date(Date.now() + 5 * 60_000),
                error: cause instanceof Error ? cause.message.slice(0, 240) : "Falha temporária.",
              },
            });
            return;
          }
          await this.prisma.workflowRun.update({
            where: { id: current.id },
            data: {
              attempts: nextAttempts,
              status: filters.reviewUnsafe !== false ? "REVIEW" : "FAILED",
              error: "A etapa falhou após as tentativas configuradas. Confira a conexão e o contato.",
            },
          });
        });
      }
    } catch {
    } finally {
      this.running = false;
    }
  }
  private async execute(run: any) {
    const rule = await this.prisma.internalWorkflow.findUniqueOrThrow({
      where: { id: run.workflowId },
    });
    if (!rule.enabled) {
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "PAUSED" },
      });
      return;
    }
    const permission = await this.prisma.membership.findFirst({
      where: {
        tenantId: rule.tenantId,
        userId: rule.userId,
        role: { in: ["OWNER", "ADMIN"] },
        user: { isActive: true },
      },
    });
    if (!permission) throw Error("permission");
    const steps = workflowSteps(rule.steps),
      step = steps[run.position];
    if (!step) {
      await this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "DONE" },
      });
      return;
    }
    const conversation = run.conversationId
      ? await this.prisma.conversation.findFirst({
          where: { id: run.conversationId, tenantId: rule.tenantId },
          include: { contact: true, channelConnection: true },
        })
      : null;
    if (
      run.conversationId &&
      (!conversation ||
        conversation.deletedAt ||
        conversation.archivedAt ||
        ["CLOSED", "RESOLVED"].includes(conversation.status))
    )
      return this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "CANCELLED" },
      });
    const scope=(rule.filters||{}) as any;
    if(conversation&&(scope.departmentId||scope.assigneeId)){
      const departmentOk=!scope.departmentId||(conversation.departmentId===scope.departmentId&&await this.prisma.department.findFirst({where:{id:scope.departmentId,tenantId:rule.tenantId,isActive:true},select:{id:true}}));
      const personOk=!scope.assigneeId||(conversation.assigneeId===scope.assigneeId&&await this.prisma.membership.findFirst({where:{tenantId:rule.tenantId,userId:scope.assigneeId,user:{isActive:true}},select:{id:true}})&&(!scope.departmentId||await this.prisma.departmentMember.findFirst({where:{tenantId:rule.tenantId,departmentId:scope.departmentId,userId:scope.assigneeId},select:{id:true}})));
      if(!departmentOk||!personOk)return this.prisma.workflowRun.update({where:{id:run.id},data:{status:"CANCELLED"}});
    }
    if (
      conversation &&
      (rule.filters as any).stopOnReply !== false &&
      (await this.prisma.message.findFirst({
        where: {
          tenantId: rule.tenantId,
          conversationId: conversation.id,
          direction: "INBOUND",
          occurredAt: { gt: run.createdAt },
        },
        select: { id: true },
      }))
    )
      return this.prisma.workflowRun.update({
        where: { id: run.id },
        data: { status: "CANCELLED" },
      });
    const content = step.text.replace(
      /{{(?:nome|novo_nome)}}/g,
      String(
        (conversation?.contact.metadata as any)?.novo_nome ||
          conversation?.contact.name ||
          "",
      ),
    );
    if (step.type === "WHATSAPP") {
      if (
        !conversation?.channelConnection ||
        conversation.channelConnection.provider !== "WAHA" ||
        !conversation.channelConnection.isActive ||
        conversation.channelConnection.status !== "CONNECTED" ||
        !conversation.contact.phone
      )
        throw Error("channel");
      if (
        (conversation.contact.metadata as any)?.communications?.whatsappOptOut
      )
        throw Error("optout");
      const message = await this.prisma.message.create({
        data: {
          tenantId: rule.tenantId,
          conversationId: conversation.id,
          direction: "OUTBOUND",
          status: "QUEUED",
          content,
          metadata: { workflowRunId: run.id, step: run.position },
        },
      });
      try {
        const id = await this.waha.sendText(
          conversation.channelConnection,
          conversation.contact.phone.replace(/\D/g, "") + "@c.us",
          content,
        );
        await this.prisma.message.update({
          where: { id: message.id },
          data: { status: "SENT", providerMessageId: id },
        });
      } catch {
        await this.prisma.message.update({
          where: { id: message.id },
          data: { status: "FAILED" },
        });
        throw Error("unconfirmed");
      }
    } else
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM workflow_runs WHERE id=${run.id}::uuid FOR UPDATE`;
        const current = await tx.workflowRun.findUniqueOrThrow({
          where: { id: run.id },
        });
        if (current.status !== "RUNNING" || current.position !== run.position)
          return;
        if (step.type === "TASK")
          await tx.workTask.create({
            data: {
              tenantId: rule.tenantId,
              createdById: rule.userId,
              assigneeId: rule.userId,
              title: content.slice(0, 180),
              description: content,
              conversationId: conversation?.id,
              contactId: conversation?.contactId,
              dueAt: step.minutes
                ? new Date(Date.now() + step.minutes * 60000)
                : new Date(),
            },
          });
        if (step.type === "NOTE" && conversation)
          await tx.message.create({
            data: {
              tenantId: rule.tenantId,
              conversationId: conversation.id,
              direction: "INTERNAL",
              status: "SENT",
              content,
              metadata: { workflowRunId: run.id },
            },
          });
        if (step.type === "TAG" && conversation) {
          const contact = await lockedContact(
            tx,
            rule.tenantId,
            conversation.contactId,
          );
          const metadata = contactMetadata(contact.metadata);
          const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
          if (
            !tags.some(
              (tag: any) =>
                (typeof tag === "string" ? tag : tag?.name) === content,
            )
          )
            await tx.contact.update({
              where: { id: contact.id },
              data: {
                metadata: {
                  ...metadata,
                  tags: [
                    ...tags,
                    { name: content.slice(0, 40), color: "#6258df" },
                  ],
                },
              },
            });
        }
      });
    await this.prisma.workflowRun.updateMany({
      where: { id: run.id, status: "RUNNING" },
      data: {
        position: run.position + 1,
        attempts: 0,
        status: run.position + 1 >= steps.length ? "DONE" : "WAITING",
        nextRunAt: new Date(
          Date.now() + (step.type === "WAIT" ? step.minutes * 60000 : 0),
        ),
        error: null,
      },
    });
  }
}

