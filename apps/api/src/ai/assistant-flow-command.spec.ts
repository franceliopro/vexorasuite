import { jest as jestGlobals } from "@jest/globals";
const jest = jestGlobals as any;

jest.unstable_mockModule('./economical-providers',()=>({economicalProviders:()=>[{provider:'ollama',model:'local',apiKey:'local',timeoutMs:300_000}]}));

let AssistantController: typeof import('./assistant.controller').AssistantController;
beforeAll(async()=>{({AssistantController}=await import('./assistant.controller'));});

const command = 'No bloco Menu principal, acrescente a opção 2ª Via Boleto (Rastreabem)';
const current = {
  name: 'Fluxo Rastreabem',
  welcome: 'Olá!',
  channelIds: ['draft'],
  triggers: [{kind:'message' as const}],
  steps: [
    {id:'menu',kind:'buttons',title:'Menu principal',message:'Escolha',options:['Rastreamento'],transitions:{Rastreamento:'rastreamento'}},
    {id:'rastreamento',kind:'text',title:'Rastreamento',message:'Consulte seu veículo.',options:[]},
  ],
};
const aiPatch = JSON.stringify({operations:[
  {op:'addOption',block:'Menu principal',option:'2ª Via Boleto (Rastreabem)'},
  {op:'addBlock',id:'via-boleto',title:'2ª Via Boleto (Rastreabem)',kind:'text',message:'Para emitir a 2ª via do boleto, informe os dados da cobrança.',after:'Menu principal'},
  {op:'connect',from:'Menu principal',option:'2ª Via Boleto (Rastreabem)',to:'via-boleto'},
]});

describe('assistant flow command',()=>{
  const req:any={user:{tenantId:'tenant',sub:'owner',role:'OWNER'}};
  function fixture(){
    const root={assistant:{enabled:true,agents:[]},chatbotDraft:current};
    const tx:any={$queryRaw:jest.fn(),auditLog:{count:jest.fn().mockResolvedValue(0),create:jest.fn()},tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root}),update:jest.fn()}};
    const prisma:any={department:{findMany:jest.fn().mockResolvedValue([])},tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root})},$transaction:(fn:any)=>fn(tx)};
    const ai:any={generate:jest.fn().mockImplementation(async(_messages:any,_providers:any,accept:any)=>{
      expect(accept(aiPatch)).toBe(true);
      return {text:aiPatch,model:'local',provider:'ollama'};
    })};
    return {controller:new AssistantController(prisma,{} as any,{} as any,{} as any,ai),ai,prisma,tx};
  }

  it('applies the natural-language command to the open draft without persisting it',async()=>{
    const {controller,ai,tx}=fixture();
    const result=await controller.flowCommand(req,{command,baseDraft:current});
    expect(result.persisted).toBe(false);expect(result.active).toBe(false);expect(result.mode).toBe('adjust');
    expect(result.draft.steps.map((step:any)=>step.id)).toEqual(['menu','via-boleto','rastreamento']);
    expect(result.draft.steps[0].options).toContain('2ª Via Boleto (Rastreabem)');
    expect(result.draft.steps[0].transitions['2ª Via Boleto (Rastreabem)']).toBe('via-boleto');
    const [,user]=ai.generate.mock.calls[0][0];
    expect(user.content).toContain(command);
    expect(user.content).toContain('Menu principal');
    expect(user.content).not.toContain('targetMode');
    const providers=ai.generate.mock.calls[0][1];
    expect(providers[0]).toMatchObject({maxTokens:1200,timeoutMs:60_000,jsonOutput:true});
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({details:expect.objectContaining({purpose:'assistant_flow_command'})})}));
  });

  it('refuses an attendant before invoking AI',async()=>{
    const {controller,ai}=fixture();
    await expect(controller.flowCommand({user:{...req.user,role:'AGENT'}} as any,{command})).rejects.toThrow('Permissão');
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it('repara a criação com as regras de criação, nunca com as de ajuste',async()=>{
    const {controller,ai,prisma}=fixture();
    prisma.department.findMany.mockResolvedValue([{key:'SUPORTE',name:'Suporte Técnico'}]);
    const validPlan=JSON.stringify({name:'Fluxo novo',welcome:'Olá!',steps:[{id:'inicio',kind:'text',message:'Oi',options:[]}]});
    ai.generate.mockImplementationOnce(async (_messages:any,_providers:any,accept:any)=>{
      expect(accept(JSON.stringify({operations:[{op:'setName',value:'x'}]}))).toBe(false);
      throw new Error('invalid output');
    }).mockImplementationOnce(async(messages:any,_providers:any,accept:any)=>{
      expect(messages[0].content).toContain('Corrija o roteiro completo como um único JSON');
      expect(messages[0].content).toContain('preferred-name com options:["Continuar"]');
      expect(messages[0].content).toContain('human.handoff sem options e sem transitions');
      expect(messages[0].content).not.toContain('use somente operações permitidas');
      expect(accept(validPlan)).toBe(true);
      return {text:validPlan,provider:'ollama',model:'local'};
    });
    const result=await controller.flowCommand(req,{command:'Crie um fluxo do zero chamado Teste',baseDraft:current});
    expect(result).toMatchObject({mode:'create',persisted:false,active:false});
    expect(result.draft.name).toBe('Fluxo novo');
  });

  it('entende o pedido em linguagem natural quando a IA não devolve JSON válido',async()=>{
    const {controller,ai,prisma}=fixture();
    prisma.department.findMany.mockResolvedValue([{key:'SUPORTE',name:'Suporte Técnico'},{key:'ADM',name:'Administrativo'}]);
    ai.generate.mockRejectedValue(new Error('invalid output'));
    const naturalCommand='Crie um fluxo do zero chamado "Atendimento com nome preferido". Use uma etapa preferred-name para identificar o nome do contato e perguntar se ele quer ser chamado por esse nome ou por outro; mantenha o nome identificado ou capture e valide o novo nome, gravando tudo em {{novo_nome}}. Em seguida, mostre um menu com as opções "Suporte" e "Administrativo" e use {{novo_nome}} na saudação. Encaminhe "Suporte" para o time Suporte Técnico e "Administrativo" para o time Administrativo. Não publique.';
    const result=await controller.flowCommand(req,{command:naturalCommand});
    expect(result).toMatchObject({mode:'create',persisted:false,active:false,usedAi:false,provider:'deterministic',warnings:[]});
    expect(result.draft.name).toBe('Atendimento com nome preferido');
    expect(result.draft.steps.map((step:any)=>step.id)).toEqual(['nome','nome-escolha','nome-manter','nome-digitar','areas','suporte','administrativo']);
    expect(result.draft.steps.find((step:any)=>step.id==='areas')?.message).toBe('{{novo_nome}}, qual área?');
    expect(result.draft.steps.find((step:any)=>step.id==='suporte')?.config).toBe('{"targetMode":"DEPARTMENT","departmentKey":"SUPORTE"}');
    expect(ai.generate).toHaveBeenCalledTimes(1);
  });
});
