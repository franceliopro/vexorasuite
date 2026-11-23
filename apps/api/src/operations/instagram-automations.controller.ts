import { BadRequestException, Body, ConflictException, HttpException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, ServiceUnavailableException, Req, UseGuards } from '@nestjs/common';
import { resolveEntitlements } from '../auth/entitlements';
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
    const accounts = [...connectedAccounts.values()];
    const providerData = await this.zernio.request<unknown>(
      '/comment-automations?profileId=' + encodeURIComponent(profile.profileId), {}, tenantId,
    ).catch(() => null);
    if (providerData === null) return { accounts, campaigns: [], drafts, providerUnavailable: true };
    const result = record(providerData);
    const rows: unknown[] = Array.isArray(result.automations) ? result.automations : [];
    const campaigns = rows.flatMap(raw => {
      const row = record(raw);
      const channel = typeof row.accountId === 'string' ? connectedAccounts.get(row.accountId) : undefined;
      if (!channel || row.platform !== 'instagram' || typeof row.id !== 'string') return [];
      const stats = record(row.stats);
      return [{
        id: row.id,
        name: typeof row.name === 'string' ? row.name.replace(/ \[Vexora:[a-f0-9-]{36}\]$/, '') : 'Campanha',
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
    return { accounts, campaigns, drafts };
  }

  @Post('campaigns/drafts/:id/activate')
  async activateDraft(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.authorize(req);
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new NotFoundException('Rascunho não encontrado.');
    const tenantId = req.user.tenantId;
    const { profile, connectedAccounts } = await this.connected(tenantId);
    if (!profile) throw new BadRequestException('Conecte uma conta do Instagram.');
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId }, select: { integrations: true, entitlements: true },
      });
      const integrations = record(tenant.integrations);
      const drafts = record(integrations.instagramCampaignDrafts);
      const draft = record(drafts[id]);
      if (typeof draft.name !== 'string') throw new NotFoundException('Rascunho não encontrado.');
      const account = [...connectedAccounts.entries()].find(([, channel]) => channel.id === draft.channelId);
      if (!account) throw new BadRequestException('Conta Instagram indisponível nesta empresa.');

      const provider = record(await this.zernio.request<unknown>(
        '/comment-automations?profileId=' + encodeURIComponent(profile.profileId), {}, tenantId,
      ));
      if (!Array.isArray(provider.automations)) throw new ServiceUnavailableException('Não foi possível consultar as campanhas.');
      const campaigns = provider.automations.map(record).filter(row => row.platform === 'instagram' &&
        typeof row.accountId === 'string' && connectedAccounts.has(row.accountId));
      const name = draft.name + ' [Vexora:' + id + ']';
      let campaign = campaigns.find(row => row.name === name && row.accountId === account[0]);
      if (!campaign) {
        if (draft.activationPending === true) return null;
        const limit = resolveEntitlements(tenant.entitlements).bots;
        const activeCount = campaigns.filter(row => row.isActive === true).length;
        const pendingCount = Object.values(drafts).filter(value => {
          const pending = record(value);
          return pending.activationPending === true &&
            !campaigns.some(row => row.name === pending.providerName && row.isActive === true);
        }).length;
        if (activeCount + pendingCount >= limit) throw new ConflictException('O limite de campanhas ativas do plano foi atingido.');

        try {
          const created = record(await this.zernio.request<unknown>('/comment-automations', {
            method: 'POST',
            idempotencyKey: id,
            body: {
              profileId: profile.profileId,
              accountId: account[0],
              name,
              trigger: draft.trigger,
              keywords: draft.keyword ? [draft.keyword] : [],
              matchMode: 'contains',
              dmMessage: draft.message,
              dmDelaySeconds: draft.delaySeconds,
              ...(draft.mediaId ? { platformPostId: draft.mediaId } : {}),
              ...(draft.link ? { buttons: [{ type: 'url', title: 'Abrir oferta', url: draft.link }] } : {}),
            },
          }, tenantId));
          campaign = record(created.automation);
        } catch (error) {
          const response = error instanceof HttpException ? record(error.getResponse()) : {};
          const status = response.providerStatus;
          if (typeof status === 'number' && status >= 400 && status < 500) throw error;
        }
      }

      const confirmedId = typeof campaign?.id === 'string' ? campaign.id : null;
      if (confirmedId) delete drafts[id];
      else drafts[id] = { ...draft, activationPending: true, providerName: name };
      await tx.tenant.update({
        where: { id: tenantId },
        data: { integrations: { ...integrations, instagramCampaignDrafts: drafts } as Prisma.InputJsonObject },
      });
      return confirmedId ? { id: confirmedId, active: campaign?.isActive === true } : null;
    }, { timeout: 75000 });
    if (!result) throw new ServiceUnavailableException('O Instagram ainda não confirmou a ativação. Use Verificar ativação antes de tentar novamente.');
    return result;
  }

  @Post('campaigns/:id/pause')
  async pauseCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    this.authorize(req);
    const tenantId = req.user.tenantId;
    const { campaigns, providerUnavailable } = await this.campaigns(req);
    if (providerUnavailable) throw new ServiceUnavailableException('Não foi possível consultar o Instagram.');
    const campaign = campaigns.find(item => item.id === id);
    if (!campaign) throw new NotFoundException('Campanha não encontrada nesta empresa.');
    if (!campaign.active) return { id, active: false };

    const result = record(await this.zernio.request<unknown>(
      '/comment-automations/' + encodeURIComponent(id),
      { method: 'PATCH', body: { isActive: false } },
      tenantId,
    ));
    if (record(result.automation).isActive !== false) {
      throw new ServiceUnavailableException('O Instagram não confirmou a pausa. Atualize a lista para verificar.');
    }
    return { id, active: false };
  }

  @Get('campaigns/media')
  async campaignMedia(@Req() req: AuthenticatedRequest, @Query('channelId') channelId: string, @Query('cursor') cursor?: string) {
    this.authorize(req);
    const tenantId = req.user.tenantId;
    const { connectedAccounts } = await this.connected(tenantId);
    const account = [...connectedAccounts.entries()].find(([, channel]) => channel.id === channelId);
    if (!account) throw new BadRequestException('Conta Instagram indisponível nesta empresa.');
    const query = new URLSearchParams({ limit: '25' });
    if (cursor) query.set('cursor', cursor);
    const result = record(await this.zernio.request<unknown>(
      '/accounts/' + encodeURIComponent(account[0]) + '/posts?' + query.toString(), {}, tenantId,
    ));
    const posts: unknown[] = Array.isArray(result.posts) ? result.posts : [];
    const pagination = record(result.pagination);
    return {
      posts: posts.flatMap(value => {
        const post = record(value);
        if (post.platform !== 'instagram' || typeof post.id !== 'string' || !/^[0-9]{1,40}$/.test(post.id)) return [];
        return [{
          id: post.id,
          caption: typeof post.message === 'string' ? post.message.slice(0, 110) : '',
          date: typeof post.createdTime === 'string' ? post.createdTime.slice(0, 10) : '',
        }];
      }),
      nextCursor: pagination.hasMore === true && typeof pagination.nextCursor === 'string' ? pagination.nextCursor : null,
    };
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
