const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PrismaClient } = require("../dist/generated/prisma/client");
const { createPrismaAdapter } = require('../dist/prisma/adapter');
const { TrackService } = require("../dist/operations/track.controller");

async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  assert(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(database.hostname), "Use isolated CI database only");
  const prisma = new PrismaClient({ adapter: createPrismaAdapter() }), track = new TrackService(prisma);
  const tenantIds = [], userIds = [];
  try {
    for (const name of ["Empresa A","Empresa B"]) {
      const tenant = await prisma.tenant.create({ data: { name, slug: "track-" + randomUUID() } });
      tenantIds.push(tenant.id);
    }
    for (const name of ["Admin","Atendente"]) {
      const user = await prisma.user.create({ data: { name, email: randomUUID() + "@example.test", passwordHash: "ci-only" } });
      userIds.push(user.id);
    }
    const [first, second] = tenantIds;
    const admin = tenantId => ({ user: { tenantId, sub: userIds[0], role: "OWNER" } });
    const operator = { user: { tenantId: first, sub: userIds[1], role: "AGENT" } };
    const department = await prisma.department.create({ data: { tenantId: first, key: "SUPPORT", name: "Suporte", modules: ["INBOX"] } });
    const firstDevice = await track.create(admin(first), { name: "Veículo A", reference: "TRK-01", isSimulation: false, departmentId: department.id });
    const secondDevice = await track.create(admin(second), { name: "Veículo B", reference: "TRK-01", isSimulation: false });
    await assert.rejects(track.history(admin(second), firstDevice.id), { status: 404 });
    assert.equal((await track.list(operator, 1)).devices.length, 0);
    await prisma.departmentMember.create({ data: { tenantId: first, departmentId: department.id, userId: userIds[1] } });
    assert.equal((await track.list(operator, 1)).devices[0].id, firstDevice.id);
    await assert.rejects(track.create(operator, { name: "Bloqueado", reference: "TRK-02" }), { status: 403 });
    const position = { eventId: "reading-1", latitude: -5.19, longitude: -37.34, recordedAt: new Date(Date.now() - 60000).toISOString() };
    const authorization = "Bearer " + firstDevice.token;
    const deliveries = await Promise.all(Array.from({ length: 4 }, () => track.ingest(authorization, position)));
    assert.equal(deliveries.filter(item => !item.duplicate).length, 1);
    await assert.rejects(track.ingest(authorization, { ...position, latitude: 24 }), { status: 409 });
    await track.ingest(authorization, { ...position, eventId: "older", latitude: -6, recordedAt: new Date(Date.now() - 120000).toISOString() });
    const view = (await track.list(admin(first), 1)).devices[0];
    assert.equal(view.position.latitude, position.latitude);
    assert(view.lastSeenAt > view.position.recordedAt);
    assert.equal((await track.history(admin(first), firstDevice.id)).length, 2);
    assert.equal((await track.history(admin(second), secondDevice.id)).length, 0);
    const replacement = await track.change(admin(first), firstDevice.id, "rotate");
    await assert.rejects(track.ingest(authorization, position), { status: 401 });
    await track.change(admin(first), firstDevice.id, "pause");
    await assert.rejects(track.ingest("Bearer " + replacement.token, position), { status: 401 });
    const simulation = await track.create(admin(first), { name: "Teste", reference: "SIM-01", isSimulation: true });
    assert.equal(simulation.token, undefined);
    await track.simulate(admin(first), simulation.id, { latitude: -5, longitude: -37 });
    assert.equal((await track.history(admin(first), simulation.id)).length, 1);
    console.log("Track: simulation, duplicate delivery, delayed positions, credential rotation and tenant isolation OK.");
  } finally {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
