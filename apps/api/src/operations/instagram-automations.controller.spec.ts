import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { InstagramAutomationsController } from './instagram-automations.controller';
import { ZernioService } from './zernio.service';

const draftId = '11111111-1111-4111-8111-111111111111';
const request = { user: { tenantId: 'tenant', role: 'OWNER' } } as AuthenticatedRequest;

function fixture(bots: number) {
  const draft = { name: 'Oferta', channelId: 'channel', trigger: 'comment', keyword: 'Eu quero', message: 'Aqui está!', delaySeconds: 0 };
  let integrations = { instagramCampaignDrafts: { [draftId]: draft } };
  const tenant = {
    findUniqueOrThrow: jest.fn(async () => ({ integrations, entitlements: { modules: ['AUTOMATION'], bots } })),
    update: jest.fn(async ({ data }) => { integrations = data.integrations; }),
  };
  const tx = { $queryRaw: jest.fn(), tenant };
  const db = {
    tenant,
    $transaction: (run: (client: typeof tx) => unknown) => run(tx),
    zernioProfile: { findUnique: jest.fn(async () => ({ profileId: 'profile' })) },
    channelConnection: { findMany: jest.fn(async () => [{
      id: 'channel', name: 'Instagram', settings: { platform: 'instagram', profileId: 'profile', accountId: 'mine' },
    }]) },
  };
  const provider = jest.fn();
  const controller = new InstagramAutomationsController(db as unknown as PrismaService, { request: provider } as unknown as ZernioService);
  return { controller, provider, tenant, getDrafts: () => integrations.instagramCampaignDrafts };
}

describe('Instagram campaigns', () => {
  it('activates a draft and clears it after provider confirmation', async () => {
    const { controller, provider, getDrafts } = fixture(1);
    provider.mockResolvedValueOnce({ automations: [
      { id: 'foreign', platform: 'instagram', accountId: 'another', isActive: true },
    ] }).mockResolvedValueOnce({ automation: { id: 'created', isActive: true } });
    await expect(controller.activateDraft(request, draftId)).resolves.toEqual({ id: 'created', active: true });
    expect(provider).toHaveBeenLastCalledWith('/comment-automations', expect.objectContaining({
      method: 'POST',
      idempotencyKey: draftId,
      body: expect.objectContaining({ profileId: 'profile', accountId: 'mine', keywords: ['Eu quero'], isActive: true }),
    }), 'tenant');
    expect(getDrafts()).toEqual({});
  });

  it('does not issue a blind create after an uncertain provider result', async () => {
    const { controller, provider, getDrafts } = fixture(1);
    provider.mockResolvedValueOnce({ automations: [] }).mockRejectedValueOnce(new Error('network'));
    await expect(controller.activateDraft(request, draftId)).rejects.toThrow('ainda não confirmou');
    expect(getDrafts()[draftId]).toMatchObject({ activationPending: true });
    provider.mockResolvedValueOnce({ automations: [] });
    await expect(controller.activateDraft(request, draftId)).rejects.toThrow('ainda não confirmou');
    expect(provider).toHaveBeenCalledTimes(3);
  });

  it('blocks new activation and resumption when the tenant has reached its limit', async () => {
    const { controller, provider } = fixture(1);
    provider.mockResolvedValue({ automations: [
      { id: 'active', platform: 'instagram', accountId: 'mine', isActive: true },
      { id: 'paused', platform: 'instagram', accountId: 'mine', isActive: false },
    ] });
    await expect(controller.activateDraft(request, draftId)).rejects.toThrow('limite');
    await expect(controller.changeCampaignStatus(request, 'paused', { active: true })).rejects.toThrow('limite');
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('prevents updating an automation belonging to another account', async () => {
    const { controller, provider } = fixture(1);
    provider.mockResolvedValue({ automations: [
      { id: 'foreign', platform: 'instagram', accountId: 'another', isActive: true },
    ] });
    await expect(controller.changeCampaignStatus(request, 'foreign', { active: false })).rejects.toThrow('não encontrada');
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
