import { AssistantController } from './assistant.controller';
jest.mock('./economical-providers',()=>({economicalProviders:()=>[{provider:'ollama',model:'installed',apiKey:'local'}]}));

const departments = [{key:'SUPORTE',name:'Suporte Técnico'},{key:'ADM',name:'Administrativo'}];
const modelPlan = {name:'Véxora Suite',welcome:'Olá!',steps:[
  {id:'nome',kind:'preferred-name',options:['Continuar'],transitions:{Continuar:'menu'}},
  {id:'menu',kind:'buttons',message:'{{novo_nome}}, qual área?',options:['Suporte Técnico','Administrativo'],transitions:{'Suporte Técnico':'tecnico',Administrativo:'administrativo'}},
  {id:'tecnico',kind:'human.handoff',department:'Suporte Técnico'},
  {id:'administrativo',kind:'human.handoff',department:'Administrativo'},
]};

describe('assistant flow creation',()=>{
 const req:any={user:{tenantId:'tenant',sub:'owner',role:'OWNER'}};
 const draft={name:'Atendimento',welcome:'Olá!',steps:[{id:'menu',kind:'text',title:'Menu',message:'Como ajudar?',options:[]}]};
 function fixture(){
  const before={name:'Anterior',welcome:'Oi',steps:[]};
  const root={assistant:{enabled:true,agents:[]},chatbotDraft:before,intelligencePublished:{active:true,revision:'existing'}};
  const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root}),update:jest.fn().mockResolvedValue({})},auditLog:{count:jest.fn().mockResolvedValue(0),create:jest.fn()}};
  const prisma:any={department:{findMany:jest.fn().mockResolvedValue([])},tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root})},$transaction:(fn:any)=>fn(tx)};
  const ai:any={generate:jest.fn().mockResolvedValue({text:JSON.stringify(draft),model:'installed',provider:'ollama'})};
  return {controller:new AssistantController(prisma,{} as any,{} as any,{} as any,ai),tx,ai,before,prisma};
 }
 it('saves a draft, retains the previous draft and leaves publication untouched',async()=>{
  const {controller,tx,before}=fixture();
  const result=await controller.createFlow(req,{request:'Crie um fluxo de atendimento'});
  expect(result.persisted).toBe(true);expect(result).toMatchObject({provider:'ollama',model:'installed'});expect(result.active).toBe(false);
  const root=tx.tenant.update.mock.calls[0][0].data.integrations;
  expect(root.chatbotDraft.name).toBe('Atendimento');
  expect(root.chatbotDraft.channelIds).toEqual([]);
  expect(root.chatbotDraftHistory).toEqual([before]);
  expect(root.intelligencePublished).toEqual({active:true,revision:'existing'});
  expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({tenantId:'tenant',userId:'owner',action:'assistant.flow.created'})}));
 });
 it('refuses creation by an attendant before invoking AI or persistence',async()=>{
  const {controller,tx,ai}=fixture();
  await expect(controller.createFlow({user:{...req.user,role:'AGENT'}} as any,{request:'Crie fluxo'})).rejects.toThrow('Permissão');
  expect(ai.generate).not.toHaveBeenCalled();expect(tx.tenant.update).not.toHaveBeenCalled();
 });
 it('refuses to overwrite a draft changed while the AI was generating',async()=>{
  const {controller,tx}=fixture();
  tx.tenant.findUniqueOrThrow.mockResolvedValue({integrations:{chatbotDraft:{name:'Edição concorrente'}}});
  await expect(controller.createFlow(req,{request:'Crie fluxo'})).rejects.toThrow('rascunho mudou');
  expect(tx.tenant.update).not.toHaveBeenCalled();
 });

 it('uses the chatbot skill with the user request, repairs invalid plans, and records the actual provider',async()=>{
  const {controller,ai,prisma}=fixture();
  prisma.department.findMany.mockResolvedValue(departments);
  ai.generate.mockImplementationOnce(async (_messages:any,_providers:any,accept:any)=>{
   expect(accept(JSON.stringify({name:'Roteiro',steps:[{id:'menu',kind:'buttons',options:['1']}]}))).toBe(false);
   throw new Error('invalid output');
  }).mockImplementationOnce(async(messages:any,providers:any,accept:any)=>{
   expect(messages[0].content).toContain('preferred-name');
   expect(messages[0].content).toContain('Suporte Técnico');
   expect(messages[1].content).toBe("Crie o fluxo de atendimento do zero para a Véxora Suite. é um teste. Mas ele vai perguntar como o cliente gostaria de ser chamado e terá a opção de escolher o nome dele mesmo ou digitar o outro nome, seja qual for a resposta a variável {{novo_nome}} vai receber ou o novo nome que ele digitar ou o nome atual identificado. Depois ele fará uma triagem para levar ao suporte técnico ou ao administrativo. Encaminhe ele para isso, caso ele não responda corretamente repita a pergunta");
   expect(providers[0].jsonOutput).toBe(true);
   const text='Segue o roteiro:\n'+String.fromCharCode(96,96,96)+'json\n'+JSON.stringify(modelPlan)+'\n'+String.fromCharCode(96,96,96);
   expect(accept(text)).toBe(true);
   return {text,provider:'llama-cpp',model:'modelo efetivo'};
  });
  const result=await controller.createFlow(req,{request:"Crie o fluxo de atendimento do zero para a Véxora Suite. é um teste. Mas ele vai perguntar como o cliente gostaria de ser chamado e terá a opção de escolher o nome dele mesmo ou digitar o outro nome, seja qual for a resposta a variável {{novo_nome}} vai receber ou o novo nome que ele digitar ou o nome atual identificado. Depois ele fará uma triagem para levar ao suporte técnico ou ao administrativo. Encaminhe ele para isso, caso ele não responda corretamente repita a pergunta"});
  expect(result).toMatchObject({active:false,provider:'llama-cpp',model:'modelo efetivo',warnings:[]});
  expect(result.draft.steps[0]).toMatchObject({id:'nome',kind:'condition'});
  expect(result.draft.steps.find(s=>s.id==='tecnico')?.config).toBe('{"targetMode":"DEPARTMENT","departmentKey":"SUPORTE"}');
  expect(prisma.department.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId:'tenant',isActive:true}}));
 });
 it('preserves an unresolved destination for review without substituting a human queue',async()=>{
  const {controller,ai}=fixture();
  ai.generate.mockResolvedValue({text:JSON.stringify(modelPlan),provider:'ollama',model:'installed'});
  const result=await controller.createFlow(req,{request:'Encaminhe ao Suporte Técnico ou Administrativo'});
  expect(result.warnings).toHaveLength(2);
  expect(result.draft.steps.find(s=>s.id==='tecnico')?.config).toBe('{"targetMode":"DEPARTMENT","departmentKey":""}');
 });
});
