import { encryptProviderKey, providerApiKey, providerConnectionStatus } from './provider-credentials';
import { ProviderConnectionsController } from './provider-connections.controller';
import { economicalProviders } from './economical-providers';
import { AssistantAutomationService } from './assistant-automation.service';
import { VoiceService } from './voice.service';
import { AssistantController } from './assistant.controller';

describe('company provider credentials',()=>{
  const names=['INTEGRATION_ENCRYPTION_KEY','JWT_ACCESS_SECRET','OPENROUTER_API_KEY','OPENAI_API_KEY','BRAVE_SEARCH_API_KEY'];
  let previous:Record<string,string|undefined>={};
  const req:any={user:{tenantId:'company-a',sub:'owner-a',role:'OWNER'}};
  beforeEach(()=>{previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));process.env.INTEGRATION_ENCRYPTION_KEY='test-only-encryption-secret';process.env.OPENROUTER_API_KEY='shared-router-key';process.env.OPENAI_API_KEY='shared-openai-key';process.env.BRAVE_SEARCH_API_KEY='shared-brave-key';});
  afterEach(()=>{jest.restoreAllMocks();for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}});
  function root(provider:'openrouter'|'openai'|'brave',key:string){return {aiProviderCredentials:{[provider]:{encryptedKey:encryptProviderKey(req.user.tenantId,provider,key)}}};}

  it('binds encrypted keys to both the company and the provider',()=>{
    const stored=root('openrouter','company-router-key');
    expect(JSON.stringify(stored)).not.toContain('company-router-key');
    expect(providerApiKey('openrouter',stored,'company-a')).toBe('company-router-key');
    expect(()=>providerApiKey('openrouter',stored,'company-b')).toThrow('Cadastre-a novamente');
    expect(()=>providerApiKey('openai',{aiProviderCredentials:{openai:stored.aiProviderCredentials.openrouter}},'company-a')).toThrow();
    expect(encryptProviderKey('company-a','openrouter','company-router-key')).not.toBe(stored.aiProviderCredentials.openrouter!.encryptedKey);
  });
  it('never substitutes a shared key after a damaged company override',()=>{
    const damaged={aiProviderCredentials:{openrouter:{encryptedKey:'broken'}}};
    expect(()=>providerApiKey('openrouter',damaged,'company-a')).toThrow();
    expect(providerConnectionStatus(damaged,'company-a')[0]).toEqual({provider:'openrouter',configured:false,source:'tenant',needsRepair:true});
    expect(providerApiKey('openrouter',{},'company-b')).toBe('shared-router-key');
    expect(providerApiKey('constructor',{},'company-a')).toBeUndefined();
  });
  it('resolves the company key for model execution instead of the shared key',()=>{
    const providers=economicalProviders({llm:{provider:'openrouter',model:'selected-model',tier:'Econômico'}},undefined,root('openrouter','company-router-key'),'company-a');
    expect(providers).toHaveLength(1);expect(providers[0]!.apiKey).toBe('company-router-key');
    expect(JSON.stringify(providerConnectionStatus(root('openrouter','company-router-key'),'company-a'))).not.toContain('company-router-key');
  });
  it('denies non-administrators before reading or changing credentials',async()=>{
    const controller=new ProviderConnectionsController({} as any);
    for(const role of ['AGENT','MANAGER']){
      const other={user:{...req.user,role}} as any;
      await expect(controller.status(other)).rejects.toThrow('Somente administradores');
      await expect(controller.save(other,{provider:'openrouter',key:'company-router-key'})).rejects.toThrow('Somente administradores');
    }
  });
  it('rejects unknown providers and malformed secrets before persistence',async()=>{
    const controller=new ProviderConnectionsController({} as any);
    for(const body of [{provider:'constructor',key:'company-router-key'},{provider:'openrouter',key:'not a valid key'},{provider:'openai',key:'secret\nwith-newline'},{provider:'brave',key:'short'}])await expect(controller.save(req,body)).rejects.toThrow('chave válida');
  });
  it('stores only ciphertext and audits only the provider while preserving other settings',async()=>{
    const integrations={marketingLibrary:{folderId:'references'},assistant:{name:'Véxora'},...root('brave','company-brave-key')};
    const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations}),update:jest.fn()},auditLog:{create:jest.fn()}};
    const prisma:any={$transaction:(callback:any)=>callback(tx)};
    const result=await new ProviderConnectionsController(prisma).save(req,{provider:'openrouter',key:'company-router-key'});
    const update=tx.tenant.update.mock.calls[0][0];
    expect(update.where.id).toBe('company-a');expect(update.data.integrations.marketingLibrary).toEqual(integrations.marketingLibrary);
    expect(providerApiKey('brave',update.data.integrations,'company-a')).toBe('company-brave-key');
    expect(providerApiKey('openrouter',update.data.integrations,'company-a')).toBe('company-router-key');
    expect(JSON.stringify(update)).not.toContain('company-router-key');
    expect(JSON.stringify(result)).not.toContain('company-router-key');expect(JSON.stringify(result)).not.toContain('encryptedKey');
    expect(tx.auditLog.create.mock.calls[0][0].data.details).toEqual({provider:'openrouter'});
  });
  it('fails closed if the encryption key is not configured',()=>{
    delete process.env.INTEGRATION_ENCRYPTION_KEY;delete process.env.JWT_ACCESS_SECRET;
    expect(()=>encryptProviderKey('company-a','openrouter','company-router-key')).toThrow('proteção');
  });
  it('rejects ambiguous agent IDs before saving configuration',async()=>{
    const controller=new AssistantController({} as any,{} as any,{} as any,{} as any);
    const agent={id:'same-id',name:'Marketing',role:'Marketing',tier:'Econômico',enabled:false,instructions:''};
    const config={name:'Véxora',wakeWord:'Olá',enabled:true,agents:[agent,{...agent}]} as any;
    await expect(controller.save(req,config)).rejects.toThrow('IDs de agentes duplicados');
    await expect(controller.save(req,{...config,agents:[{...agent,id:' '}]})).rejects.toThrow('Agente inválido');
  });
  it('uses the company search key with a fixed Brave endpoint',async()=>{
    const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root('brave','company-brave-key')})}};
    const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({web:{results:[]}})));
    await new AssistantAutomationService(prisma,{} as any,{} as any,{} as any).search('Frotas','company-a');
    expect(prisma.tenant.findUniqueOrThrow.mock.calls[0][0].where.id).toBe('company-a');
    expect(String(fetch.mock.calls[0]![0])).toMatch(/^https:\/\/api.search.brave.com\//);
    expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({'X-Subscription-Token':'company-brave-key'});
  });
  it('uses the company voice key without exposing it in request bodies or responses',async()=>{
    const tx:any={$queryRaw:jest.fn(),auditLog:{count:jest.fn().mockResolvedValue(0),create:jest.fn()}};
    const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:{...root('openai','company-openai-key'),assistant:{enabled:true,dailyAiLimit:5,tts:{provider:'openai',model:'gpt-4o-mini-tts'}}}})},$transaction:(callback:any)=>callback(tx)};
    const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(new Uint8Array([1,2,3])));
    const response=await new VoiceService(prisma).speak(req,'Olá');
    expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({authorization:'Bearer company-openai-key'});
    expect(String(fetch.mock.calls[0]![1]?.body)).not.toContain('company-openai-key');expect(response).toEqual(Buffer.from([1,2,3]));
  });
});
