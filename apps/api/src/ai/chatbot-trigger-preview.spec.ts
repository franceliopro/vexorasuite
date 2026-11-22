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
});
