import { ChatbotTriggerPreviewController } from './chatbot-trigger-preview.controller';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

describe('chatbot trigger preview', () => {
  it('accepts the normalized exact keyword and rejects a partial match', async () => {
    const prisma = {
      tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({
        integrations: { chatbotDraft: { channelIds: ['channel'], triggers: [{ kind: 'keyword', keyword: 'Segunda via' }] } },
      }) },
    } as unknown as PrismaService;
    const controller = new ChatbotTriggerPreviewController(prisma);
    const request = { user: { tenantId: 'tenant' } } as AuthenticatedRequest;
    const preview = (text: string) => controller.preview(request, { channelId: 'channel', eventType: 'dm', text });
    await expect(preview('  SÉGUNDA   VIA  ')).resolves.toMatchObject({ matched: true, executed: false, sent: false });
    await expect(preview('Quero segunda via')).resolves.toMatchObject({ matched: false, executed: false, sent: false });
  });
  it('matches an unsaved draft without reading or writing the saved flow', async () => {
    const lookup = jest.fn();
    const controller = new ChatbotTriggerPreviewController({
      tenant: { findUniqueOrThrow: lookup },
    } as unknown as PrismaService);
    const request = { user: { tenantId: 'tenant' } } as AuthenticatedRequest;
    const draft = { name: 'Rascunho', welcome: 'Olá', steps: [], channelIds: ['test-channel'], triggers: [{ kind: 'keyword', keyword: 'teste' }] };
    await expect(controller.preview(request, { draft, channelId: 'test-channel', eventType: 'dm', text: 'teste' }))
      .resolves.toMatchObject({ matched: true, previewMessage: 'Olá', executed: false, sent: false });
    expect(lookup).not.toHaveBeenCalled();
  });
});
