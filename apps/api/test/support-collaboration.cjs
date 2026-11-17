const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { ConversationsController } = require("../dist/operations/conversations.controller");

async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  assert(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(database.hostname), "Use isolated CI database only");
  const prisma = new PrismaClient();
  const tenants = [];
  const users = [];
  const events = [];
  const controller = new ConversationsController(prisma, { publish: (...event) => events.push(event) }, {}, {});
  const create = async (delegate, tracked, data) => {
    const row = await delegate.create({ data });
    tracked.push(row.id);
    return row.id;
  };
  try {
    const tenant = await create(prisma.tenant, tenants, { name: "Pilot A", slug: "support-" + randomUUID() });
    const other = await create(prisma.tenant, tenants, { name: "Pilot B", slug: "support-" + randomUUID() });
    const staff = await Promise.all(["Origin", "Expert 1", "Expert 2", "Admin"].map(name => create(prisma.user, users, {
      name, email: randomUUID() + "@example.test", passwordHash: "ci-only",
    })));
    const [owner, expert, backup, admin] = staff;
    await prisma.membership.createMany({ data: staff.map(userId => ({ userId, tenantId: tenant, role: userId === admin ? "OWNER" : "AGENT" })) });
    await prisma.membership.create({ data: { userId: admin, tenantId: other, role: "OWNER" } });
    const req = (sub, tenantId = tenant) => ({ user: { tenantId, sub, role: sub === admin ? "OWNER" : "AGENT" } });
    await prisma.tenant.update({ where: { id: tenant }, data: { integrations: { teamTransferScope: { [owner]: { ownDepartment: true, anyDepartment: true } } } } });
    const team = (tenantId, key) => prisma.department.create({ data: { tenantId, key, name: key, modules: ["INBOX"] } });
    const origin = await team(tenant, "Origem"), destination = await team(tenant, "Especialistas"), foreign = await team(other, "Outra empresa");
    await prisma.departmentMember.createMany({ data: [
      { tenantId: tenant, userId: owner, departmentId: origin.id },
      { tenantId: tenant, userId: expert, departmentId: destination.id },
      { tenantId: tenant, userId: backup, departmentId: destination.id },
    ] });
    const contact = await prisma.contact.create({ data: { tenantId: tenant, name: "Cliente teste" } });
    const conversation = await prisma.conversation.create({ data: {
      tenantId: tenant, contactId: contact.id, handlingMode: "HUMAN", departmentId: origin.id, assigneeId: owner,
    } });
    const id = conversation.id;
    await controller.setSupportSettings(req(admin), { fields: [{ key: "equipment", label: "Equipamento" }], helpMinutes: 45, escalationMinutes: 15, replyMinutes: 20 });
    await controller.setSupportSettings(req(admin, other), { fields: [{ key: "appointment", label: "Consulta" }], helpMinutes: 60, escalationMinutes: 25, replyMinutes: 30 });
    await controller.saveSupportContext(req(owner), id, { values: { equipment: "R-01", hidden: "ignored" } });
    assert.deepEqual((await controller.getSupportContext(req(owner), id)).values, { equipment: "R-01" });
    assert.equal((await controller.getSupportSettings(req(admin, other))).fields[0].key, "appointment");
    await assert.rejects(controller.getSupportContext(req(admin, other), id), { status: 404 });
    await assert.rejects(controller.requestSupport(req(owner), id, { kind: "HELP", destinationId: foreign.id, note: "test" }), { status: 400 });

    const now = Date.now();
    const message = (direction, status, minutes) => prisma.message.create({ data: {
      tenantId: tenant, conversationId: id, direction, status, occurredAt: new Date(now - minutes * 60_000),
    } });
    await message("INBOUND", "RECEIVED", 25);
    await message("INBOUND", "RECEIVED", 1);
    await message("OUTBOUND", "FAILED", 0);
    const waiting = await controller.supportQueue(req(admin));
    assert.equal(waiting.waiting.length, 1);
    assert.equal(waiting.waiting[0].since.getTime(), now - 25 * 60_000);
    assert.equal((await controller.supportQueue(req(admin, other))).waiting.length, 0);

    const help = await controller.requestSupport(req(owner), id, { kind: "HELP", destinationId: destination.id, note: "Conferir teste." });
    assert.equal((await controller.supportQueue(req(expert))).requests[0].id, help.id);
    await controller.respondToSupport(req(expert), help.id, { decision: "answer", answer: "Teste confirmado." });
    assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id } })).assigneeId, owner);
    assert.equal((await controller.getSupportContext(req(owner), id)).history[0].answer, "Teste confirmado.");

    const escalation = await controller.requestSupport(req(owner), id, { kind: "ESCALATION", destinationId: destination.id, note: "Diagnóstico avançado." });
    assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id } })).assigneeId, owner);
    await assert.rejects(controller.respondToSupport(req(admin, other), escalation.id, { decision: "accept" }), { status: 404 });
    await assert.rejects(controller.respondToSupport(req(owner), escalation.id, { decision: "accept" }), { status: 403 });
    const attempts = await Promise.allSettled([expert, backup].map(user => controller.respondToSupport(req(user), escalation.id, { decision: "accept" })));
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    const current = await prisma.conversation.findUniqueOrThrow({ where: { id } });
    assert.equal(current.departmentId, destination.id);
    assert([expert, backup].includes(current.assigneeId));
    assert.equal(events.filter(event => event[1] === "conversation.assigned").length, 1);
    console.log("Support context, tenant isolation, reply SLA, and concurrent escalation OK.");
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
