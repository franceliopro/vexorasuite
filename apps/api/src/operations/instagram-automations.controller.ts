import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ZernioService } from './zernio.service';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metric(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

@Controller('chatbot/instagram')
@UseGuards(AuthGuard)
export class InstagramAutomationsController {
  constructor(private readonly prisma: PrismaService, private readonly zernio: ZernioService) {}

  @Get('campaigns')
  async campaigns(@Req() req: AuthenticatedRequest) {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem consultar as campanhas.');
    const tenantId = req.user.tenantId;
    const [profile, channels] = await Promise.all([
      this.prisma.zernioProfile.findUnique({ where: { tenantId }, select: { profileId: true } }),
      this.prisma.channelConnection.findMany({
        where: { tenantId, provider: 'ZERNIO', isActive: true },
        select: { id: true, name: true, settings: true },
      }),
    ]);
    if (!profile) return { accounts: [], campaigns: [] };
    const connectedAccounts = new Map<string, { id: string; name: string }>();
    for (const channel of channels) {
      const settings = record(channel.settings);
      if (String(settings.platform).toLowerCase() === 'instagram' && settings.profileId === profile.profileId &&
          typeof settings.accountId === 'string' && settings.accountId) {
        connectedAccounts.set(settings.accountId, { id: channel.id, name: channel.name });
      }
    }
    if (!connectedAccounts.size) return { accounts: [], campaigns: [] };
    const result = record(await this.zernio.request<unknown>(
      '/comment-automations?profileId=' + encodeURIComponent(profile.profileId), {}, tenantId,
    ));
    const rows: unknown[] = Array.isArray(result.automations) ? result.automations : [];
    const campaigns = rows.flatMap(raw => {
      const row = record(raw);
      const channel = typeof row.accountId === 'string' ? connectedAccounts.get(row.accountId) : undefined;
      if (!channel || row.platform !== 'instagram' || typeof row.id !== 'string') return [];
      const stats = record(row.stats);
      return [{
        id: row.id,
        name: typeof row.name === 'string' ? row.name : 'Campanha',
        channelId: channel.id,
        channelName: channel.name,
        trigger: typeof row.trigger === 'string' ? row.trigger : 'comment',
        postTitle: typeof row.postTitle === 'string' ? row.postTitle : null,
        keywords: Array.isArray(row.keywords) ? row.keywords.filter(word => typeof word === 'string') : [],
        active: row.isActive === true,
        delaySeconds: metric(row.dmDelaySeconds) ?? 0,
        stats: { sent: metric(stats.dmsSent), read: metric(stats.read), clicks: metric(stats.linkClicks) },
      }];
    });
    return { accounts: [...connectedAccounts.values()], campaigns };
  }
}
