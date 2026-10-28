import { usageView, providerLimit } from "./provider-usage";
import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { providerApiKey, credentialProviders, CredentialProvider, encryptProviderKey, providerConnectionStatus } from './provider-credentials';
import { aiRuntimeStatus } from './local-services';
import { mutateTenantSetting } from '../prisma/tenant-settings';
const object = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

@Controller('assistant/provider-connections')
@UseGuards(AuthGuard)
export class ProviderConnectionsController {
  constructor(private readonly prisma: PrismaService) {}
  private authorize(req: AuthenticatedRequest) {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) throw new ForbiddenException('Somente administradores podem configurar as conexões de IA.');
  }
  @Get()
  async status(@Req() req: AuthenticatedRequest) {
    this.authorize(req);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
    return { connections: providerConnectionStatus(tenant.integrations, req.user.tenantId),...aiRuntimeStatus(tenant.integrations) };
  }
  private usageCache=new Map<string,{expires:number;value:any}>();
  @Get('usage')
  async usage(@Req() req:AuthenticatedRequest){
    this.authorize(req);
    const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
    const assistant=object(object(tenant.integrations).assistant);
    const selections=[assistant.llm,...(Array.isArray(assistant.agents)?assistant.agents.map((agent:any)=>agent.llm):[]),...(Array.isArray(assistant.fallbackModels)?assistant.fallbackModels:[])];
    if(!selections.some((selection:any)=>selection?.provider==='openrouter'&&selection.model))return {configured:false,provider:'local',message:'OpenRouter não está em uso nos modelos configurados.'};
    const key=providerApiKey('openrouter',tenant.integrations,req.user.tenantId);
    if(!key)return {configured:false};
    const incident=providerLimit(key),cached=this.usageCache.get(req.user.tenantId);
    if(cached&&cached.expires>Date.now())return {...cached.value,incident};
    let value:any;
    try{
      const response=await fetch('https://openrouter.ai/api/v1/key',{headers:{authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error();
      const data=await response.json() as any;
      value={configured:true,available:true,...usageView(data.data),checkedAt:new Date().toISOString()};
    }catch{value={configured:true,available:false,message:'Não foi possível verificar a cota no OpenRouter. Confira seu painel do provedor.',checkedAt:new Date().toISOString()};}
    if(this.usageCache.size>=1000)this.usageCache.clear();
    this.usageCache.set(req.user.tenantId,{expires:Date.now()+60000,value});
    return {...value,incident};
  }
  @Put()
  async save(@Req() req: AuthenticatedRequest, @Body() body: { provider?: string; key?: string }) {
    this.authorize(req);
    if (!body || !(credentialProviders as readonly unknown[]).includes(body.provider) || typeof body.key !== 'string' || !/^[\x21-\x7e]{12,512}$/.test(body.key.trim())) throw new BadRequestException('Selecione um provedor e informe uma chave válida, sem espaços ou quebras de linha.');
    const provider = body.provider as CredentialProvider;
    const encryptedKey = encryptProviderKey(req.user.tenantId, provider, body.key.trim());
    const root = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${req.user.tenantId}::uuid FOR UPDATE`;
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: req.user.tenantId }, select: { integrations: true } });
      const current = object(tenant.integrations);
      const next = { ...current, aiProviderCredentials: { ...object(current.aiProviderCredentials), [provider]: { encryptedKey, updatedAt: new Date().toISOString() } } };
      await tx.tenant.update({ where: { id: req.user.tenantId }, data: { integrations: next as Prisma.InputJsonObject } });
      await tx.auditLog.create({ data: { tenantId: req.user.tenantId, userId: req.user.sub, action: 'assistant.provider.configured', entityType: 'integration', details: { provider } } });
      return next;
    });
    return { connections: providerConnectionStatus(root, req.user.tenantId),...aiRuntimeStatus(root) };
  }
  @Put('policy')
  async policy(@Req() req:AuthenticatedRequest,@Body() body:{freeFirst?:boolean;allowPaidFallback?:boolean;customerSearch?:boolean}){
    this.authorize(req);
    if(!body||typeof body.freeFirst!=='boolean'||typeof body.allowPaidFallback!=='boolean')throw new BadRequestException('Política de custo inválida.');
    if(body.customerSearch!==undefined&&typeof body.customerSearch!=='boolean')throw new BadRequestException('Opção de pesquisa inválida.');
    const policy={freeFirst:body.freeFirst,allowPaidFallback:body.allowPaidFallback,customerSearch:body.customerSearch===true};
    await mutateTenantSetting(this.prisma,req.user.tenantId,'aiCostPolicy',()=>policy);
    return {costPolicy:policy};
  }
}
