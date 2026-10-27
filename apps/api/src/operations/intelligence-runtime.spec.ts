import { IntelligenceRuntimeService } from './intelligence-runtime.service';
function setup(overrides: Record<string,unknown> = {}) {
 const flow:any={name:'Teste',welcome:'Olá',channelIds:['channel'],triggers:[{kind:'message'}],steps:[{id:'menu',title:'Menu',message:'Escolha',options:['Suporte'],transitions:{Suporte:'handoff'}},{id:'handoff',title:'Suporte',message:'',options:[],action:'human.handoff',config:'{"departmentKey":"SUPORTE"}'}]};
 const conversation:any={id:'conversation',tenantId:'tenant',channelConnectionId:'channel',handlingMode:'BOT',status:'OPEN',contactId:'contact',contact:{name:'Ana',externalId:'5511999999999@c.us',metadata:{novo_nome:'Ana'}},botState:{},...overrides};
 const inbound:any={id:'inbound',content:'oi',contentType:'text',metadata:{}};
 const published={active:true,revision:'r1',flow};
 const tx:any={$queryRaw:jest.fn(),conversation:{findFirst:jest.fn().mockResolvedValue(conversation),update:jest.fn()},message:{findMany:jest.fn().mockResolvedValue([]),update:jest.fn(),findFirst:jest.fn().mockImplementation(async({where}:any)=>where.status?{id:'out',status:'QUEUED',metadata:{revision:'r1'}}:inbound),create:jest.fn().mockImplementation(async({data}:any)=>({id:'out'+Math.random(),...data}))},tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({name:'Empresa',integrations:{intelligencePublished:published}})},auditLog:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()},department:{findFirst:jest.fn().mockResolvedValue({id:'support',name:'Suporte'}),findMany:jest.fn().mockResolvedValue([{id:'support',key:'SUPORTE'}])},contact:{update:jest.fn()}};
 const prisma:any={...tx,$transaction:jest.fn((fn:any)=>fn(tx)),conversation:{...tx.conversation,findFirstOrThrow:jest.fn().mockResolvedValue(conversation)},message:{...tx.message,update:jest.fn().mockImplementation(async({data}:any)=>({id:'out',occurredAt:new Date(),...data}))}};
 prisma.channelConnection={findFirst:jest.fn().mockResolvedValue({id:'channel',tenantId:'tenant',provider:'WAHA',isActive:true})};
 prisma.tenant={findUnique:jest.fn().mockResolvedValue({integrations:{intelligencePublished:published}})};
 tx.contact.findFirst=jest.fn().mockResolvedValue(conversation.contact);
 const events:any={publish:jest.fn()}, waha:any={sendText:jest.fn().mockResolvedValue('provider')},zernio:any={request:jest.fn()};
 return {service:new IntelligenceRuntimeService(prisma,events,waha,zernio,{generate:jest.fn()} as any),tx,prisma,events,waha,zernio,channel:{id:'channel',tenantId:'tenant',provider:'WAHA'} as any,conversation,inbound,published,flow};
}
describe('Intelligence runtime',()=>{
 it('persists state, outbox and zero-token audit',async()=>{const x=setup();expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);expect(x.waha.sendText).toHaveBeenCalledTimes(2);expect(x.tx.auditLog.create.mock.calls[0][0].data.details.tokensUsed).toBe(0);expect(x.tx.conversation.update.mock.calls[0][0].data.botState.stepId).toBe('menu');});
 it('respects human ownership',async()=>{const x=setup({handlingMode:'HUMAN'});expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(false);expect(x.waha.sendText).not.toHaveBeenCalled();});
 it('deduplicates processed input',async()=>{const x=setup();x.tx.auditLog.findFirst.mockResolvedValue({id:'existing'});await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.message.create).not.toHaveBeenCalled();});
 it('hands off with history preserved',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});x.inbound.content='1';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data).toMatchObject({handlingMode:'HUMAN',departmentId:'support',assigneeId:null});});
 it('honors explicit human requests',async()=>{const x=setup();x.inbound.content='atendente';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data.handlingMode).toBe('HUMAN');});
 it('pauses legacy replies too',async()=>{const x=setup();x.published.active=false;expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);expect(x.waha.sendText).not.toHaveBeenCalled();});
 it('rejects channels outside binding',async()=>{const x=setup();x.flow.channelIds=['other'];expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(false);});
 it('does not execute in groups',async()=>{const x=setup();x.inbound.metadata.isGroup=true;expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(false);});
 it('records delivery failure',async()=>{const x=setup();x.waha.sendText.mockRejectedValue(new Error('offline'));await x.service.receive(x.channel,'conversation','inbound');expect(x.prisma.message.update).toHaveBeenCalledWith(expect.objectContaining({data:{status:'FAILED'}}));});
 it('captures input before handoff',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'input',variables:{}}});x.flow.steps.push({id:'input',title:'Problema',kind:'input.text',config:'{"variable":"solicitacao"}',message:'Descreva',options:['Continuar'],transitions:{Continuar:'handoff'}});x.inbound.content='Sem sinal';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.solicitacao).toBe('Sem sinal');});
 it('requires identity verification for social billing',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});x.channel.provider='ZERNIO';x.flow.steps[1].action='asaas.payment.lookup';x.inbound.content='1';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data.handlingMode).toBe('HUMAN');});
});

describe('delivery authorization at dispatch time', () => {
 it('stops the remaining queued replies immediately after an engine stop', async () => {
   const x=setup();
   x.waha.sendText.mockImplementation(async () => { x.published.active=false; return 'provider'; });
   await x.service.receive(x.channel,'conversation','inbound');
   expect(x.waha.sendText).toHaveBeenCalledTimes(1);
   expect(x.prisma.message.update).toHaveBeenCalledWith(expect.objectContaining({data:{status:'FAILED'}}));
 });
 it('rejects a response prepared under a replaced publication', async () => {
   const x=setup();
   x.prisma.tenant.findUnique.mockResolvedValue({integrations:{intelligencePublished:{...x.published,revision:'r2'}}});
   await x.service.receive(x.channel,'conversation','inbound');
   expect(x.waha.sendText).not.toHaveBeenCalled();
 });
 it('does not send through a deactivated channel or suspended tenant', async () => {
   const x=setup();
   x.prisma.channelConnection.findFirst.mockResolvedValue(null);
   await x.service.receive(x.channel,'conversation','inbound');
   expect(x.waha.sendText).not.toHaveBeenCalled();
   expect(x.prisma.channelConnection.findFirst).toHaveBeenCalledWith({where:{id:'channel',tenantId:'tenant',isActive:true,tenant:{status:'ACTIVE'}}});
 });
 it('does not send after a channel has been removed from the published flow', async () => {
   const x=setup();
   x.prisma.tenant.findUnique.mockResolvedValue({integrations:{intelligencePublished:{...x.published,flow:{...x.flow,channelIds:['other']}}}});
   await x.service.receive(x.channel,'conversation','inbound');
   expect(x.waha.sendText).not.toHaveBeenCalled();
 });
 it('does not deliver after a conversation moves to another channel', async () => {
   const x=setup();
   x.prisma.conversation.findFirstOrThrow.mockRejectedValue(new Error('Moved'));
   await x.service.receive(x.channel,'conversation','inbound');
   expect(x.waha.sendText).not.toHaveBeenCalled();
   expect(x.prisma.conversation.findFirstOrThrow).toHaveBeenCalledWith(expect.objectContaining({where:{id:'conversation',tenantId:'tenant',channelConnectionId:'channel'}}));
 });
 it('does not use a stale contact snapshot when an engine tag is applied', async () => {
   const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});
   x.flow.steps.splice(1,0,{id:'tag',kind:'tag',title:'Etiqueta',message:'',options:['Continuar'],transitions:{Continuar:'handoff'},config:'{"name":"VIP","color":"#123456"}'});
   x.flow.steps[0].transitions.Suporte='tag';
   x.tx.contact.findFirst.mockResolvedValue({id:'contact',metadata:{notes:'Updated elsewhere',asaas:{customerId:'cus_1'},tags:[]}});
   x.inbound.content='1';
   await x.service.receive(x.channel,'conversation','inbound');
   expect(x.tx.contact.update).toHaveBeenCalledWith(expect.objectContaining({data:{metadata:{notes:'Updated elsewhere',asaas:{customerId:'cus_1'},tags:[{name:'VIP',color:'#123456'}]}}}));
 });
});


describe('workflow edge cases',()=>{

describe('explicit human handoff destinations',()=>{
 it('assigns a named tenant member and preserves the handoff confirmation',async()=>{
  const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});
  const userId='11111111-1111-4111-8111-111111111111';
  x.flow.steps[1].config=JSON.stringify({targetMode:'PERSON',departmentKey:'SUPORTE',userId});
  x.tx.membership={findFirst:jest.fn().mockResolvedValue({userId,user:{name:'Ana'}})};
  x.tx.departmentMember={findFirst:jest.fn().mockResolvedValue({id:'member'})};
  x.tx.message.findFirst.mockImplementation(async({where}:any)=>where.status?{metadata:{revision:'r1',handoffAssigneeId:userId}}:x.inbound);
  x.prisma.conversation.findFirstOrThrow.mockResolvedValue({...x.conversation,handlingMode:'HUMAN',assigneeId:userId});
  x.inbound.content='1';
  await x.service.receive(x.channel,'conversation','inbound');
  expect(x.tx.conversation.update.mock.calls[0][0].data).toMatchObject({handlingMode:'HUMAN',departmentId:'support',assigneeId:userId});
  expect(x.waha.sendText).toHaveBeenCalledWith(expect.objectContaining(x.channel),'5511999999999@c.us',expect.stringContaining('Ana, do time Suporte'));
 });
 it('falls back visibly to the general queue if the configured person was removed',async()=>{
  const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});
  x.flow.steps[1].config=JSON.stringify({targetMode:'PERSON',userId:'11111111-1111-4111-8111-111111111111'});
  x.tx.membership={findFirst:jest.fn().mockResolvedValue(null)};
  x.inbound.content='1';await x.service.receive(x.channel,'conversation','inbound');
  expect(x.tx.conversation.update.mock.calls[0][0].data).toMatchObject({assigneeId:null,departmentId:null,handlingMode:'HUMAN'});
  expect(x.tx.auditLog.create.mock.calls[0][0].data.details.reason).toBe('handoff_target_unavailable');
  expect(x.waha.sendText).toHaveBeenCalledWith(expect.objectContaining(x.channel),expect.any(String),expect.stringContaining('destino configurado está indisponível'));
 });
});

 it('does not invoke legacy menus when a keyword trigger does not match',async()=>{const x=setup();x.flow.triggers=[{kind:'keyword',keyword:'ativar'}];expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);expect(x.waha.sendText).not.toHaveBeenCalled();});
 it('allows restarting completed flows',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{},completed:true}});x.inbound.content='menu';await x.service.receive(x.channel,'conversation','inbound');expect(x.waha.sendText).toHaveBeenCalled();});
 it('auto-advances plain text blocks without requiring a customer reply',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});x.flow.steps.splice(1,0,{id:'greeting',kind:'text',title:'Aviso',message:'Aguarde',options:['Continuar'],transitions:{Continuar:'handoff'}});x.flow.steps[0].transitions.Suporte='greeting';x.inbound.content='1';await x.service.receive(x.channel,'conversation','inbound');expect(x.waha.sendText).toHaveBeenCalledTimes(2);expect(x.tx.conversation.update.mock.calls[0][0].data.handlingMode).toBe('HUMAN');});
 it('does not resend outbox messages with an existing delivery claim',async()=>{const x=setup();x.tx.message.findFirst.mockImplementation(async({where}:any)=>where.status?{id:'out',status:'QUEUED',metadata:{deliveryState:'SENDING'}}:x.inbound);await x.service.receive(x.channel,'conversation','inbound');expect(x.waha.sendText).not.toHaveBeenCalled();});
});

describe('persistent preferred name',()=>{
 it('does not save a phone number as a preferred name when the contact answers sim',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',awaitingName:true}});x.conversation.contact.name='5511999999999';x.conversation.contact.metadata={};x.inbound.content='sim';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.contact.update).not.toHaveBeenCalled();expect(x.tx.conversation.update.mock.calls[0][0].data.botState.awaitingName).toBe(true)});
 it('asks before a new contact proceeds to the workflow',async()=>{const x=setup();x.conversation.contact.metadata={};await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.message.create.mock.calls[0][0].data.content).toContain('Como gostaria de ser chamado');expect(x.tx.conversation.update.mock.calls[0][0].data.botState.awaitingName).toBe(true)});
 it('saves a chosen name with unrelated CRM metadata preserved',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',awaitingName:true}});x.conversation.contact.metadata={notes:'Preservar'};x.inbound.content='Aninha';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.contact.update).toHaveBeenCalledWith(expect.objectContaining({data:{metadata:{notes:'Preservar',novo_nome:'Aninha'}}}));expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.novo_nome).toBe('Aninha')});
 it('accepts keeping the current name and remembers it across a fresh conversation',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',awaitingName:true}});x.conversation.contact.metadata={};x.inbound.content='sim';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.contact.update).toHaveBeenCalledWith(expect.objectContaining({data:{metadata:{novo_nome:'Ana'}}}));const y=setup();await y.service.receive(y.channel,'conversation','inbound');expect(y.tx.message.create.mock.calls.some((call:any)=>call[0].data.content.includes('Como gostaria'))).toBe(false)});
 it('normalizes document variables before the next step uses them',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'doc',variables:{}}});x.flow.steps=[{id:'doc',kind:'input.text',message:'CPF',title:'CPF',options:['Continuar'],transitions:{Continuar:'done'},config:'{"variable":"cpf"}'},{id:'done',kind:'text',message:'Recebido',title:'Fim',options:[]}];x.inbound.content='012.345.678-90';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.cpf).toBe('01234567890')});
});
