const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { MailService } = require("../dist/communications/mail.service");
const {
  WorkflowsService,
} = require("../dist/communications/workflows.service");
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  assert(
    process.env.CI === "true" &&
      ["localhost", "127.0.0.1"].includes(url.hostname),
    "Use isolated CI database only",
  );
  const prisma = new PrismaClient(),
    tenant = await prisma.tenant.create({
      data: { name: "Communications CI", slug: "mail-ci-" + randomUUID() },
    }),
    user = await prisma.user.create({
      data: {
        email: randomUUID() + "@example.test",
        name: "CI owner",
        passwordHash: "not-a-login",
      },
    });
  try {
    await prisma.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
    });
    const req = { user: { tenantId: tenant.id, sub: user.id, role: "OWNER" } },
      account = await prisma.mailAccount.create({
        data: {
          tenantId: tenant.id,
          name: "CI mail",
          email: "sender@example.test",
          configEncrypted: "fixture-not-a-secret",
        },
      });
    const contact = await prisma.contact.create({
      data: {
        tenantId: tenant.id,
        name: "CI contact",
        email: "contact@example.test",
      },
    });
    const campaign = await prisma.mailCampaign.create({
      data: {
        tenantId: tenant.id,
        accountId: account.id,
        userId: user.id,
        name: "CI campaign",
        subject: "Hello",
        html: "<p>Hello</p>",
        status: "ACTIVE",
      },
    });
    const delivery = await prisma.mailDelivery.create({
      data: {
        tenantId: tenant.id,
        campaignId: campaign.id,
        email: contact.email,
        name: contact.name,
      },
    });
    let sends = 0;
    const a = new MailService(prisma),
      b = new MailService(prisma);
    for (const service of [a, b]) {
      service.account = async () => ({ ...account, config: {} });
      service.transport = async () => ({
        sendMail: async () => {
          sends++;
          return { messageId: "ci-message" };
        },
        close() {},
      });
    }
    await Promise.all([a.tick(), b.tick()]);
    assert.equal(sends, 1);
    assert.equal(
      (
        await prisma.mailDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
      "SENT",
    );
    const pending = await prisma.mailDelivery.create({
      data: {
        tenantId: tenant.id,
        campaignId: campaign.id,
        email: "other@example.test",
        name: "Other",
      },
    });
    await prisma.mailCampaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
    });
    await a.tick();
    assert.equal(sends, 1);
    assert.equal(
      (
        await prisma.mailDelivery.findUniqueOrThrow({
          where: { id: pending.id },
        })
      ).status,
      "QUEUED",
    );
    const unknown = await prisma.mailDelivery.create({
      data: {
        tenantId: tenant.id,
        campaignId: campaign.id,
        email: "unknown@example.test",
        name: "Unknown",
        status: "SENDING",
        updatedAt: new Date(Date.now() - 300000),
      },
    });
    await a.tick();
    assert.equal(
      (
        await prisma.mailDelivery.findUniqueOrThrow({
          where: { id: unknown.id },
        })
      ).status,
      "REVIEW",
    );
    assert.equal(sends, 1);
    const workflow = await prisma.internalWorkflow.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        name: "CI reminder",
        enabled: true,
        trigger: "SCHEDULE",
        nextRunAt: new Date(Date.now() - 60000),
        steps: [{ type: "TASK", text: "CI follow-up", minutes: 5 }],
      },
    });
    const x = new WorkflowsService(prisma, {}),
      y = new WorkflowsService(prisma, {});
    await Promise.all([x.tick(), y.tick()]);
    assert.equal(
      await prisma.workTask.count({
        where: { tenantId: tenant.id, title: "CI follow-up" },
      }),
      1,
    );
    assert.equal(
      await prisma.workflowRun.count({ where: { workflowId: workflow.id } }),
      1,
    );
    const channel = await prisma.channelConnection.create({
      data: {
        tenantId: tenant.id,
        name: "CI WA",
        provider: "WAHA",
        status: "CONNECTED",
        sessionName: "ci-mail-" + randomUUID(),
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        channelConnectionId: channel.id,
      },
    });
    const paused = await prisma.internalWorkflow.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        name: "CI paused",
        enabled: false,
        nextRunAt: new Date(),
        steps: [{ type: "TASK", text: "Must not execute", minutes: 0 }],
      },
    });
    const run = await prisma.workflowRun.create({
      data: {
        tenantId: tenant.id,
        workflowId: paused.id,
        eventKey: "ci",
        nextRunAt: new Date(),
        conversationId: conversation.id,
      },
    });
    await x.tick();
    assert.equal(
      await prisma.workTask.count({
        where: { tenantId: tenant.id, title: "Must not execute" },
      }),
      0,
    );
    await x.toggle(req, paused.id, { enabled: true });
    await prisma.message.create({
      data: {
        tenantId: tenant.id,
        conversationId: conversation.id,
        direction: "INBOUND",
        status: "RECEIVED",
        content: "I replied",
        occurredAt: new Date(Date.now() + 1000),
      },
    });
    await x.tick();
    assert.equal(
      (await prisma.workflowRun.findUniqueOrThrow({ where: { id: run.id } }))
        .status,
      "CANCELLED",
    );
    console.log(
      "Communications: two workers send once, pause stops queued delivery, uncertain sends are not retried; workflow workers create one task and stop after customer replies.",
    );
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
