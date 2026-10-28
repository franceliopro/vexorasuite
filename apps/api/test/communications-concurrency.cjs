const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
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
    const req={user:{tenantId:tenant.id,sub:user.id,role:'OWNER'}};
    const contact=await prisma.contact.create({data:{tenantId:tenant.id,name:'CI contact',email:'contact@example.test'}});
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
      "Internal workflow workers create one task and stop after customer replies.",
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
