import { BadRequestException } from '@nestjs/common';
import { lockedContact, mutateContactMetadata } from './contact-metadata';

describe('contact metadata mutations', () => {
  it('reads the current contact after acquiring the tenant-scoped row lock', async () => {
    const calls: string[] = [];
    const latest = { id: 'contact', metadata: { notes: 'fresh', asaas: { customerId: 'cus_1' } } };
    const tx: any = {
      $queryRaw: jest.fn(async () => { calls.push('lock'); }),
      contact: {
        findFirst: jest.fn(async () => { calls.push('read'); return latest; }),
        update: jest.fn(async ({ data }: any) => ({ ...latest, ...data })),
      },
    };
    const updated = await mutateContactMetadata({ $transaction: (fn: any) => fn(tx) } as any,
      'tenant', 'contact', metadata => ({ ...metadata, crmStage: 'proposal' }));
    expect(calls).toEqual(['lock', 'read']);
    expect(updated.metadata).toEqual({ notes: 'fresh', asaas: { customerId: 'cus_1' }, crmStage: 'proposal' });
    expect(tx.contact.findFirst).toHaveBeenCalledWith({ where: { id: 'contact', tenantId: 'tenant' } });
    expect(tx.$queryRaw.mock.calls[0].slice(1)).toEqual(['contact', 'tenant']);
  });

  it('does not write when the contact is absent from the tenant', async () => {
    const tx: any = { $queryRaw: jest.fn(), contact: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } };
    await expect(lockedContact(tx, 'tenant', 'other-contact')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.contact.update).not.toHaveBeenCalled();
  });
});
