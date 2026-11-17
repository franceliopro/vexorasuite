const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
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
    console.log("Service offers: concurrent acceptance generates one order; expired and change-requested offers generate none.");
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
