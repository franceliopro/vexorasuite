import { AssistantController } from './assistant.controller';
jest.mock('./economical-providers',()=>({economicalProviders:()=>[{provider:'ollama',model:'installed',apiKey:'local'}]}));
describe('assistant flow creation',()=>{
 const req:any={user:{tenantId:'tenant',sub:'owner',role:'OWNER'}};
 const draft={name:'Atendimento',welcome:'Olá!',steps:[{id:'menu',kind:'text',title:'Menu',message:'Como ajudar?',options:[]}]};
 function fixture(){
  const before={name:'Anterior',welcome:'Oi',steps:[]};
  const root={assistant:{enabled:true,agents:[]},chatbotDraft:before,intelligencePublished:{active:true,revision:'existing'}};
  const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root}),update:jest.fn().mockResolvedValue({})},auditLog:{count:jest.fn().mockResolvedValue(0),create:jest.fn()}};
  const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:root})},$transaction:(fn:any)=>fn(tx)};
  const ai:any={generate:jest.fn().mockResolvedValue({text:JSON.stringify(draft),model:'installed'})};
  return {controller:new AssistantController(prisma,{} as any,{} as any,{} as any,ai),tx,ai,before};
 }
 it('saves a draft, retains the previous draft and leaves publication untouched',async()=>{
  const {controller,tx,before}=fixture();
  const result=await controller.createFlow(req,{request:'Crie um fluxo de atendimento'});
  expect(result.persisted).toBe(true);expect(result.active).toBe(false);
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
});
