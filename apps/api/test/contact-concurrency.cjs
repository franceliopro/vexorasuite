// Runs only against the ephemeral PostgreSQL service configured by GitHub Actions.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { ContactsController } = require('../dist/operations/contacts.controller');
const { lockedContact, contactMetadata } = require('../dist/prisma/contact-metadata');

async function main() {
  const database = new URL(process.env.DATABASE_URL || '');
  assert(process.env.CI === 'true' && ['localhost', '127.0.0.1'].includes(database.hostname),
    'Use the isolated CI database for this regression check');
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.create({ data: { name: 'Concurrency regression', slug: 'ci-' + randomUUID() } });
  const controller = new ContactsController(prisma, { publish() {} }, { syncCustomerByContact() { throw Error('No external calls allowed'); } });
  const req = { user: { tenantId: tenant.id, sub: randomUUID(), role: 'OWNER' } };
  try {
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, name: 'Test contact', metadata: {} } });
    for (let run = 0; run < 10; run++) {
      await prisma.contact.update({ where: { id: contact.id }, data: { metadata: { asaas: { customerId: 'cus_preserved' }, tags: [] } } });
      await Promise.all([
        controller.updateProfile(req, contact.id, { notes: 'Note ' + run }),
        controller.updateProfile(req, contact.id, { customFields: { reference: String(run) } }),
        prisma.$transaction(async tx => {
          const latest = await lockedContact(tx, tenant.id, contact.id);
          const metadata = contactMetadata(latest.metadata);
          await tx.contact.update({ where: { id: contact.id }, data: { metadata: { ...metadata, tags: [{ name: 'Engine', color: '#123456' }] } } });
        }),
      ]);
      const latest = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(latest.metadata.notes, 'Note ' + run);
      assert.equal(latest.metadata.customFields.reference, String(run));
      assert.equal(latest.metadata.asaas.customerId, 'cus_preserved');
      assert.equal(latest.metadata.tags[0].name, 'Engine');
    }
    await assert.rejects(controller.updateProfile({ user: { ...req.user, tenantId: randomUUID() } }, contact.id, { notes: 'Forbidden' }));
    const conversation = await prisma.conversation.create({ data: { tenantId: tenant.id, contactId: contact.id } });
    const results = await Promise.allSettled([
      controller.finalize(req, contact.id, { outcome: 'LOST', reason: 'Sem interesse' }),
      controller.updateStage(req, contact.id, { stage: 'proposal' }),
    ]);
    assert.equal(results[0].status, 'fulfilled');
    const finalized = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    assert.equal(finalized.metadata.crmFinalization.outcome, 'LOST');
    assert.equal(finalized.metadata.crmStage, undefined);
    assert.equal(finalized.metadata.notes, 'Note 9');
    assert.equal((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).status, 'RESOLVED');
    console.log('PostgreSQL: concurrent profile/tag edits, tenant isolation and finalization race passed');
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
