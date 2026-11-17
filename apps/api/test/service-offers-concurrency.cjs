const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { ConversationsController } = require("../dist/operations/conversations.controller");
const { PublicServiceOffersController, offerTokenHash } = require("../dist/operations/public-service-offers.controller");

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  assert(process.env.CI === "true" && ["localhost", "127.0.0.1"].includes(url.hostname), "Use isolated CI database only");
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.create({ data: { name: "Service offers CI", slug: "offers-" + randomUUID() } });
  try {
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, name: "CI contact" } });
    const conversation = await prisma.conversation.create({ data: { tenantId: tenant.id, contactId: contact.id } });
    const createOffer = async offset => {
      const token = randomBytes(32).toString("base64url");
      const offer = await prisma.serviceOffer.create({ data: {
        tenantId: tenant.id, conversationId: conversation.id, publicTokenHash: offerTokenHash(token),
        title: "Instalação", sellerName: "Teste", scope: "Instalação e teste", platform: "Plataforma A",
        setupCents: 10000, monthlyCents: 2000, expiresAt: new Date(Date.now() + offset),
      } });
      return { token, offer };
    };
    const controller = new PublicServiceOffersController(prisma);
    const { token, offer } = await createOffer(60000);
    const responses = await Promise.all(Array.from({ length: 4 }, () => controller.respond(token, { decision: "accept", name: "Cliente de teste" })));
    assert(responses.every(response => response.state === "ACCEPTED" && !("tenantId" in response) && !("publicTokenHash" in response)));
    assert.equal(await prisma.serviceOrder.count({ where: { offerId: offer.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { entityId: offer.id, action: "service_offer.accepted" } }), 1);
    await assert.rejects(controller.respond(token, { decision: "changes", reason: "Trocar a data" }), { status: 409 });

    const expired = await createOffer(-1000);
    assert.equal((await controller.read(expired.token)).state, "EXPIRED");
    await assert.rejects(controller.respond(expired.token, { decision: "accept", name: "Cliente de teste" }), { status: 409 });
    assert.equal(await prisma.serviceOrder.count({ where: { offerId: expired.offer.id } }), 0);

    const changes = await createOffer(60000);
    await controller.respond(changes.token, { decision: "changes", reason: "Trocar a data" });
    assert.equal(await prisma.serviceOrder.count({ where: { offerId: changes.offer.id } }), 0);
    const staff = new ConversationsController(prisma, {}, {}, {});
    const request = { user: { tenantId: tenant.id, role: "OWNER" } };
    const main = await staff.createServiceOffer(request, conversation.id, {
      title: "Instalação com contrato", scope: "Instalação", platform: "Plataforma A",
      setupCents: 10000, monthlyCents: 0, requiresContract: true, depositCents: 2000,
    });
    await controller.respond(main.path.split("/").at(-1), { decision: "accept", name: "Cliente de teste" });
    const schedule = { scheduledAt: new Date(Date.now() + 3600000).toISOString() };
    await assert.rejects(staff.updateServiceOrder(request, conversation.id, main.id, schedule), { status: 404 });
    await prisma.serviceOffer.update({ where: { id: main.id }, data: { signedAt: new Date() } });
    await assert.rejects(staff.updateServiceOrder(request, conversation.id, main.id, schedule), { status: 404 });
    await prisma.serviceOffer.update({ where: { id: main.id }, data: { depositReceivedAt: new Date() } });
    await staff.updateServiceOrder(request, conversation.id, main.id, schedule);

    const extra = await staff.createServiceOffer(request, conversation.id, {
      title: "Adicional", scope: "Acessório", platform: "Plataforma A",
      setupCents: 1000, monthlyCents: 0, parentOfferId: main.id,
    });
    const installation = { installation: "Instalado e testado.", assets: [{ vehicle: "ABC1D23", equipment: "DEV123" }] };
    await assert.rejects(staff.updateServiceOrder(request, conversation.id, main.id, installation), { status: 404 });
    await controller.respond(extra.path.split("/").at(-1), { decision: "accept", name: "Cliente de teste" });
    assert.equal(await prisma.serviceOrder.count({ where: { offerId: extra.id } }), 0);
    await staff.updateServiceOrder(request, conversation.id, main.id, installation);
    const followUp = await prisma.conversation.create({ data: { tenantId: tenant.id, contactId: contact.id } });
    const history = await staff.listServiceAssets(request, followUp.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].equipment, "DEV123");

    console.log("Service offers: concurrent acceptance generates one order; expired and change-requested offers generate none.");
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
