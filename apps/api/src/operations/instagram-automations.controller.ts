import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ZernioService } from './zernio.service';
import { randomUUID } from 'node:crypto';
import { mutateTenantSetting } from '../prisma/tenant-settings';
import { Prisma } from '../generated/prisma/client';

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

  private authorize(req:AuthenticatedRequest) {
    if (!['OWNER','ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem gerenciar campanhas.');
  }

  private async connected(tenantId:string) {
    const [profile, channels] = await Promise.all([
      this.prisma.zernioProfile.findUnique({ where: { tenantId }, select: { profileId: true } }),
      this.prisma.channelConnection.findMany({
        where: { tenantId, provider: 'ZERNIO', isActive: true },
        select: { id: true, name: true, settings: true },
      }),
    ]);
    const connectedAccounts = new Map<string, { id: string; name: string }>();
    for (const channel of channels) {
      const settings = record(channel.settings);
      if (profile && String(settings.platform).toLowerCase() === 'instagram' && settings.profileId === profile.profileId &&
          typeof settings.accountId === 'string' && settings.accountId) {
        connectedAccounts.set(settings.accountId, { id: channel.id, name: channel.name });
      }
    }
    return {profile,connectedAccounts};
  }

  @Get('campaigns')
  async campaigns(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    const tenantId=req.user.tenantId;
    const [{profile,connectedAccounts},tenant]=await Promise.all([
      this.connected(tenantId),
      this.prisma.tenant.findUniqueOrThrow({where:{id:tenantId},select:{integrations:true}}),
    ]);
    const drafts=Object.entries(record(record(tenant.integrations).instagramCampaignDrafts)).map(([id,value])=>({...record(value),id}));
    if (!profile||!connectedAccounts.size) return { accounts: [], campaigns: [], drafts };
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
    return { accounts: [...connectedAccounts.values()], campaigns, drafts };
  }

  @Post('campaigns/drafts')
  async saveDraft(@Req() req:AuthenticatedRequest,@Body() body:unknown) {
    this.authorize(req);
    const input=record(body);
    const text=(value:unknown)=>typeof value==='string'?value.trim():'';
    const channelId=text(input.channelId),name=text(input.name),trigger=text(input.trigger),mediaId=text(input.mediaId);
    const keyword=text(input.keyword),message=text(input.message),link=text(input.link);
    const delaySeconds=metric(input.delaySeconds??0);
    if(!name||name.length>120||!['comment','story_reply','story_mention','live_comment'].includes(trigger)||!message||message.length>(link?640:1000))throw new BadRequestException('Confira o nome, o evento e a mensagem da campanha.');
    if(trigger!=='story_mention'&&(!keyword||keyword.length>120))throw new BadRequestException('Informe a palavra-chave da campanha.');
    if(mediaId&&(!/^[0-9]{1,40}$/.test(mediaId)||trigger==='story_mention'||trigger==='live_comment'))throw new BadRequestException('Informe um ID de mídia válido para este evento.');
    if(delaySeconds===null||delaySeconds>86400||(delaySeconds>0&&trigger==='live_comment'))throw new BadRequestException('Atraso inválido para este evento.');
    if(link){
      try{const url=new URL(link);if(url.protocol!=='https:'||url.username||url.password||link.length>2000)throw Error('invalid');}
      catch{throw new BadRequestException('Informe um link HTTPS válido.');}
    }
    const {connectedAccounts}=await this.connected(req.user.tenantId);
    if(![...connectedAccounts.values()].some(account=>account.id===channelId))throw new BadRequestException('Conta Instagram indisponível nesta empresa.');
    const id=randomUUID();
    const draft={channelId,name,trigger,mediaId,keyword:trigger==='story_mention'?'':keyword,message,link,delaySeconds};
    await mutateTenantSetting(this.prisma,req.user.tenantId,'instagramCampaignDrafts',current=>({...record(current),[id]:draft} as Prisma.InputJsonValue));
    return {id,draft};
  }
}
