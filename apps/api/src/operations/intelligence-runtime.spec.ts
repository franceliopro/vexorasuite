import { compileChatbotFlow } from '../ai/chatbot-flow-skill';
import { IntelligenceRuntimeService } from './intelligence-runtime.service';
function setup(overrides: Record<string,unknown> = {}) {
 const flow:any={name:'Teste',welcome:'Olá',channelIds:['channel'],triggers:[{kind:'message'}],steps:[{id:'menu',title:'Menu',message:'Escolha',options:['Suporte'],transitions:{Suporte:'handoff'}},{id:'handoff',title:'Suporte',message:'',options:[],action:'human.handoff',config:'{"departmentKey":"SUPORTE"}'}]};
 const conversation:any={id:'conversation',tenantId:'tenant',channelConnectionId:'channel',handlingMode:'BOT',status:'OPEN',contactId:'contact',contact:{name:'Ana',externalId:'5511999999999@c.us',metadata:{novo_nome:'Ana'}},botState:{},...overrides};
 const inbound:any={id:'inbound',content:'oi',contentType:'text',metadata:{}};
 const published={active:true,source:'ui',revision:'r1',flow};
 const tx:any={$queryRaw:jest.fn(),conversation:{findFirst:jest.fn().mockResolvedValue(conversation),update:jest.fn()},message:{findMany:jest.fn().mockResolvedValue([]),update:jest.fn(),findFirst:jest.fn().mockImplementation(async({where}:any)=>where.status?{id:'out',status:'QUEUED',metadata:{revision:'r1'}}:inbound),create:jest.fn().mockImplementation(async({data}:any)=>({id:'out'+Math.random(),...data}))},tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({name:'Empresa',integrations:{intelligencePublished:published}})},auditLog:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()},department:{findFirst:jest.fn().mockResolvedValue({id:'support',name:'Suporte'}),findMany:jest.fn().mockResolvedValue([{id:'support',key:'SUPORTE'}])},contact:{update:jest.fn()},channelAttachment:{findMany:jest.fn().mockResolvedValue([{service:'CHATBOT',attached:true},{service:'IA',attached:true},{service:'INBOX',attached:true}])},storefrontToken:{findFirst:jest.fn().mockResolvedValue({siteUrl:'https://catalogo.example.com'})}};
 const prisma:any={...tx,$transaction:jest.fn((fn:any)=>fn(tx)),conversation:{...tx.conversation,findFirstOrThrow:jest.fn().mockResolvedValue(conversation)},message:{...tx.message,update:jest.fn().mockImplementation(async({data}:any)=>({id:'out',occurredAt:new Date(),...data}))}};
 prisma.channelConnection={findFirst:jest.fn().mockResolvedValue({id:'channel',tenantId:'tenant',provider:'WAHA',isActive:true})};
 prisma.tenant={findUnique:jest.fn().mockResolvedValue({integrations:{intelligencePublished:published}})};
 tx.contact.findFirst=jest.fn().mockResolvedValue(conversation.contact);
 const events:any={publish:jest.fn()}, waha:any={sendText:jest.fn().mockResolvedValue('provider')},zernio:any={request:jest.fn()};
 return {service:new IntelligenceRuntimeService(prisma,events,waha,zernio,{generate:jest.fn()} as any),tx,prisma,events,waha,zernio,channel:{id:'channel',tenantId:'tenant',provider:'WAHA'} as any,conversation,inbound,published,flow};
}
describe('Intelligence runtime',()=>{
 it.each(['2','Financeiro'])('routes the WhatsApp menu response %s to the same destination', async response => {
  const x = setup();
  x.flow.steps = [
   { id: 'menu', kind: 'condition', title: 'Canal', message: '', config: '{"variable":"canal_atendimento","value":"whatsapp"}',
     options: ['Sim','Não'], transitions: { Sim: 'sectors', Não: 'web' } },
   { id: 'sectors', kind: 'buttons', title: 'Setor', message: 'Com quem deseja falar?',
     options: ['Atendimento','Financeiro','Comercial'], transitions: { Atendimento: 'service', Financeiro: 'finance', Comercial: 'sales' } },
   { id: 'service', kind: 'text', title: 'Atendimento', message: 'Resposta do atendimento.', options: [] },
   { id: 'finance', kind: 'text', title: 'Financeiro', message: 'Resposta do financeiro.', options: [] },
   { id: 'sales', kind: 'text', title: 'Comercial', message: 'Resposta do comercial.', options: [] },
   { id: 'web', kind: 'text', title: 'Web', message: 'Resposta da página pública.', options: [] },
  ];

  await x.service.receive(x.channel, 'conversation', 'inbound');
  expect(x.waha.sendText).toHaveBeenCalledWith(expect.anything(), expect.any(String),
   'Com quem deseja falar?\n\n1. Atendimento\n2. Financeiro\n3. Comercial');
  x.conversation.botState = x.tx.conversation.update.mock.calls[0][0].data.botState;
  expect(x.conversation.botState).toMatchObject({ stepId: 'sectors', variables: { canal_atendimento: 'whatsapp' } });

  x.inbound.id = 'reply';
  x.inbound.content = response;
  x.waha.sendText.mockClear();
  await x.service.receive(x.channel, 'conversation', 'reply');
  expect(x.waha.sendText).toHaveBeenCalledTimes(1);
  expect(x.waha.sendText).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Resposta do financeiro.');
 });

 it.each([
  { permission: true, finance: true, provider: 'STRIPE', status: 'PAID', expected: 'O pagamento foi confirmado.' },
  { permission: true, finance: true, provider: 'INFINITEPAY', status: 'PENDING', expected: 'O pagamento ainda está pendente.' },
  { permission: false, finance: true, provider: 'STRIPE', status: 'PAID', expected: 'Vou conferir.' },
  { permission: true, finance: false, provider: 'INFINITEPAY', status: 'PAID', expected: 'Vou conferir.' },
 ])('limits agent payment queries to enabled Finance access (%j)', async ({ permission, finance, provider, status, expected }) => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  const originalOllamaOrigin = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
  try {
   x.tx.auditLog.count = jest.fn().mockResolvedValue(0);
   x.tx.payment = { findFirst: jest.fn().mockResolvedValue({ status }) };
   x.tx.tenant.findUniqueOrThrow.mockResolvedValue({
    name: 'Empresa', entitlements: { modules: finance ? ['FINANCE'] : ['AUTOMATION'], finance },
    integrations: { intelligencePublished: x.published, assistant: { enabled: true, agents: [{
     id: 'sales', enabled: true, bindings: { inboxes: ['channel'] }, llm: { provider: 'ollama', model: 'test' },
     allowedActions: permission ? ['payment.status'] : [],
    }] } },
   });
   const generate = jest.fn().mockResolvedValue({ model: 'test', usage: { totalTokens: 10 }, text: JSON.stringify({
    reply: 'Vou conferir.', actions: [{ type: 'check_payment', provider }],
   }) });
   const service = new IntelligenceRuntimeService(x.prisma, x.events, x.waha, x.zernio, { generate } as any);
   x.flow.steps.splice(1, 0, {
    id: 'agent', kind: 'agent', title: 'Agente', message: '', options: [], config: JSON.stringify({ agentId: 'sales' }),
   });
   x.flow.steps[0].transitions.Suporte = 'agent';
   x.inbound.content = '1';
   await service.receive(x.channel, 'conversation', 'inbound');
   expect(generate).toHaveBeenCalled();
   expect(x.tx.payment.findFirst).toHaveBeenCalledTimes(permission && finance ? 1 : 0);
   if (permission && finance) expect(x.tx.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { tenantId: 'tenant', conversationId: 'conversation', contactId: 'contact', provider: { in: expect.arrayContaining([provider]) }, environment: 'PRODUCTION' },
   }));
   expect(x.tx.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ content: expected }) });
  } finally {
   if (originalOllamaOrigin === undefined) delete process.env.OLLAMA_BASE_URL;
   else process.env.OLLAMA_BASE_URL = originalOllamaOrigin;
  }
 });

 it.each([
  { provider: 'STRIPE', local: 'SANDBOX', confirmed: 'LIVE', url: 'https://checkout.stripe.com/example' },
  { provider: 'INFINITEPAY', local: 'PRODUCTION', confirmed: 'PRODUCTION', url: 'https://checkout.infinitepay.io/example' },
 ])('generates and renders the link for the latest scoped payment (%j)', async ({ provider, local, confirmed, url }) => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  const createHostedCheckout = jest.fn().mockResolvedValue({ url, environment: confirmed });
  const createLink = jest.fn().mockResolvedValue({ url, environment: confirmed });
  const service = new IntelligenceRuntimeService(x.prisma, x.events, x.waha, x.zernio, { generate: jest.fn() } as any,
   undefined, undefined, undefined, { createHostedCheckout } as any, { createLink } as any);
  x.tx.payment = { findFirst: jest.fn().mockResolvedValue({
   id: 'latest-payment', status: 'PENDING', environment: local, externalId: null, invoiceUrl: null,
  }) };
  x.flow.steps.splice(1, 0,
   { id: 'payment', kind: 'payment.status', title: 'Pagamento', message: '', options: ['Continuar'],
    transitions: { Continuar: 'reply' }, config: JSON.stringify({ provider, createHostedLink: 'true' }) },
   { id: 'reply', kind: 'text', title: 'Link', message: 'Link: {{pagamento_link}}', options: ['Continuar'], transitions: { Continuar: 'handoff' } },
  );
  x.flow.steps[0].transitions.Suporte = 'payment';
  x.inbound.content = '1';
  await service.receive(x.channel, 'conversation', 'inbound');
  expect(x.tx.payment.findFirst).toHaveBeenCalledTimes(1);
  expect(x.tx.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
   where: expect.objectContaining({
    tenantId: 'tenant', conversationId: 'conversation', contactId: 'contact',
    ...(provider === 'STRIPE' ? { OR: [{ environment: 'PRODUCTION' }, { status: 'PENDING', externalId: null }] } : { environment: 'PRODUCTION' }),
   }),
   orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  }));
  if (provider === 'STRIPE') {
   expect(createHostedCheckout).toHaveBeenCalledWith('tenant', { paymentId: 'latest-payment' }, 'LIVE');
   expect(createLink).not.toHaveBeenCalled();
  } else {
   expect(createLink).toHaveBeenCalledWith('tenant', { paymentId: 'latest-payment' });
   expect(createHostedCheckout).not.toHaveBeenCalled();
  }
  expect(x.tx.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ content: 'Link: ' + url }) });
 });

 it.each([
  { provider: 'STRIPE', finance: true, payment: { status: 'PAID', invoiceUrl: 'https://checkout.stripe.com/example' }, expected: 'PAID', link: '' },
  { provider: 'INFINITEPAY', finance: true, payment: { status: 'PENDING', invoiceUrl: 'https://checkout.infinitepay.io/example' }, expected: 'PENDING', link: 'https://checkout.infinitepay.io/example' },
  { provider: 'INFINITEPAY', finance: true, payment: { status: 'PENDING', invoiceUrl: 'http://invalid.example/' }, expected: 'PENDING', link: '' },
  { provider: 'INFINITEPAY', finance: true, payment: null, expected: 'não encontrado', link: '' },
  { provider: 'INFINITEPAY', finance: false, payment: { status: 'PAID' }, expected: 'indisponível', link: '' },
 ])('scopes payment lookups to the conversation and Finance entitlement (%j)', async ({ provider, finance, payment, expected, link }) => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  x.tx.tenant.findUniqueOrThrow.mockResolvedValue({
   name: 'Empresa', entitlements: { modules: finance ? ['FINANCE'] : ['AUTOMATION'], finance },
   integrations: { intelligencePublished: x.published },
  });
  x.tx.payment = { findFirst: jest.fn().mockResolvedValue(payment ? { ...payment, environment: 'PRODUCTION' } : null) };
  x.flow.steps.splice(1, 0, {
   id: 'payment', kind: 'payment.status', title: 'Pagamento', message: '', options: ['Continuar'],
   transitions: { Continuar: 'handoff' }, config: JSON.stringify({ provider }),
  });
  x.flow.steps[0].transitions.Suporte = 'payment';
  x.inbound.content = '1';
  await x.service.receive(x.channel, 'conversation', 'inbound');
  expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables).toMatchObject({ pagamento_status: expected, pagamento_link: link });
  if (!finance) {
   expect(x.tx.payment.findFirst).not.toHaveBeenCalled();
   return;
  }
  expect(x.tx.payment.findFirst).toHaveBeenCalledWith({
   where: { tenantId: 'tenant', conversationId: 'conversation', contactId: 'contact', provider: { in: expect.arrayContaining([provider]) }, environment: 'PRODUCTION' },
   orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
   select: { id: true, status: true, invoiceUrl: true, externalId: true, environment: true },
  });
 });

 it.each([
  { allowed: true, busy: [], expected: 'O horário consultado está livre.' },
  { allowed: true, busy: [{}], expected: 'O horário consultado está ocupado.' },
  { allowed: false, busy: [], expected: 'Vou conferir.' },
 ])('uses the real calendar result only for agents with explicit permission (%j)', async ({ allowed, busy, expected }) => {
  const x = setup({ departmentId: 'support', botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  const originalOllamaOrigin = process.env.OLLAMA_BASE_URL;
  process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ calendars: { team: { busy } } })));
  try {
   x.tx.auditLog.count = jest.fn().mockResolvedValue(0);
   x.tx.calendarAssignment = { findMany: jest.fn().mockResolvedValue([{ userId: null, accountId: 'account', calendarId: 'team' }]) };
   x.tx.tenant.findUniqueOrThrow.mockResolvedValue({
    name: 'Empresa', entitlements: { modules: ['CALENDAR'] },
    integrations: { intelligencePublished: x.published, assistant: { enabled: true, agents: [{
     id: 'sales', enabled: true, bindings: { inboxes: ['channel'] }, llm: { provider: 'ollama', model: 'test' },
     allowedActions: allowed ? ['calendar.availability'] : [],
    }] } },
   });
   const token = jest.fn().mockResolvedValue('calendar-token');
   const start = new Date(Date.now() + 3600000).toISOString();
   const generate = jest.fn().mockResolvedValue({ model: 'test', usage: { totalTokens: 10 }, text: JSON.stringify({
    reply: 'Vou conferir.', actions: [{ type: 'check_calendar', start, minutes: 30 }],
   }) });
   const service = new IntelligenceRuntimeService(x.prisma, x.events, x.waha, x.zernio, { generate } as any, undefined, undefined, { token } as any);
   x.flow.steps.splice(1, 0, {
    id: 'agent', kind: 'agent', title: 'Agente', message: '', options: [], config: JSON.stringify({ agentId: 'sales' }),
   });
   x.flow.steps[0].transitions.Suporte = 'agent';
   x.inbound.content = '1';
   await service.receive(x.channel, 'conversation', 'inbound');
   expect(generate).toHaveBeenCalled();
   expect(token).toHaveBeenCalledTimes(allowed ? 1 : 0);
   expect(x.tx.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ content: expect.stringContaining(expected) }) });
  } finally {
   fetchMock.mockRestore();
   if (originalOllamaOrigin === undefined) delete process.env.OLLAMA_BASE_URL;
   else process.env.OLLAMA_BASE_URL = originalOllamaOrigin;
  }
 });

 it.each([
  { modules: ['CALENDAR'], matches: 1, busy: [], expected: 'sim' },
  { modules: ['CALENDAR'], matches: 1, busy: [{}], expected: 'não' },
  { modules: ['CALENDAR'], matches: 2, busy: [], expected: 'indisponível' },
  { modules: ['AUTOMATION'], matches: 1, busy: [], expected: 'indisponível' },
 ])('checks only the calendar assigned to the conversation scope (%j)', async ({ modules, matches, busy, expected }) => {
  const x = setup({ departmentId: 'support', botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  x.tx.tenant.findUniqueOrThrow.mockResolvedValue({ name: 'Empresa', entitlements: { modules }, integrations: { intelligencePublished: x.published } });
  x.tx.calendarAssignment = { findMany: jest.fn().mockResolvedValue(Array.from({ length: matches }, (_, i) => ({
   userId: null, accountId: 'account', calendarId: 'team-' + i,
  }))) };
  const token = jest.fn().mockResolvedValue('calendar-token');
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ calendars: { 'team-0': { busy } } })));
  const service = new IntelligenceRuntimeService(x.prisma, x.events, x.waha, x.zernio, { generate: jest.fn() } as any, undefined, undefined, { token } as any);
  const start = new Date(Date.now() + 3600000).toISOString();
  x.flow.steps.splice(1, 0, {
   id: 'availability', kind: 'calendar.availability', title: 'Agenda', message: '', options: ['Continuar'],
   transitions: { Continuar: 'handoff' }, config: JSON.stringify({ start, minutes: '30' }),
  });
  x.flow.steps[0].transitions.Suporte = 'availability';
  x.inbound.content = '1';
  try {
   await service.receive(x.channel, 'conversation', 'inbound');
   expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.agenda_disponivel).toBe(expected);
   if (modules.includes('CALENDAR')) expect(x.tx.calendarAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { tenantId: 'tenant', OR: [{ departmentId: 'support' }] },
   }));
   if (expected === 'indisponível') expect(token).not.toHaveBeenCalled();
   else expect(token).toHaveBeenCalledWith('tenant', 'account', 'calendar');
  } finally {
   fetchMock.mockRestore();
  }
 });

 it.each([
  { modules: ['TASKS'], member: true, created: true },
  { modules: ['AUTOMATION'], member: true, created: false },
  { modules: ['TASKS'], member: false, created: false },
 ])('scopes chatbot reminders to the company and active attendant (%j)', async ({ modules, member, created }) => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  const userId = '1e7a3d92-cbf0-4560-b710-60f8e87c6e48';
  x.conversation.contact.id = 'contact';
  x.tx.tenant.findUniqueOrThrow.mockResolvedValue({ name: 'Empresa', entitlements: { modules }, integrations: { intelligencePublished: x.published } });
  x.tx.membership = { findFirst: jest.fn().mockResolvedValue(member ? { userId } : null) };
  x.tx.workTask = { create: jest.fn().mockResolvedValue({ id: 'task' }) };
  x.flow.steps.splice(1, 0, {
   id: 'reminder', kind: 'task.reminder', title: 'Lembrete', message: '', options: ['Continuar'],
   transitions: { Continuar: 'handoff' }, config: JSON.stringify({ title: 'Acompanhar proposta', minutes: '30', reminderUserId: userId }),
  });
  x.flow.steps[0].transitions.Suporte = 'reminder';
  x.inbound.content = '1';
  await x.service.receive(x.channel, 'conversation', 'inbound');
  expect(x.tx.workTask.create).toHaveBeenCalledTimes(created ? 1 : 0);
  if (created) expect(x.tx.workTask.create).toHaveBeenCalledWith({ data: expect.objectContaining({
   tenantId: 'tenant', assigneeId: userId, contactId: 'contact', conversationId: 'conversation', dueAt: expect.any(Date),
  }) });
  expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.lembrete_criado).toBe(created ? 'sim' : 'não');
 });

 it('persists state, outbox and zero-token audit',async()=>{const x=setup();expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);expect(x.waha.sendText).toHaveBeenCalledTimes(2);expect(x.tx.auditLog.create.mock.calls[0][0].data.details.tokensUsed).toBe(0);expect(x.tx.conversation.update.mock.calls[0][0].data.botState.stepId).toBe('menu');});
 it('exposes saved company data as rendered variables',async()=>{const x=setup({departmentId:'support'});x.flow.welcome='{{empresa}} · {{razao_social}} · {{cnpj}} · {{endereco_completo}} · {{departamento}}';x.tx.tenant.findUniqueOrThrow.mockResolvedValue({name:'Empresa',integrations:{organization:{legalName:'Empresa Ltda.',cnpj:'00.000.000/0001-00',address:'Rua Teste, 100',city:'Cuiabá',state:'MT',zipCode:'78000-000'},intelligencePublished:x.published}});await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.message.create.mock.calls[0][0].data.content).toBe('Empresa · Empresa Ltda. · 00.000.000/0001-00 · Rua Teste, 100 · Cuiabá · MT · 78000-000 · Suporte');});
 it('respects human ownership',async()=>{const x=setup({handlingMode:'HUMAN'});expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(false);expect(x.waha.sendText).not.toHaveBeenCalled();});
 it('deduplicates processed input',async()=>{const x=setup();x.tx.auditLog.findFirst.mockResolvedValue({id:'existing'});await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.message.create).not.toHaveBeenCalled();});
 it('hands off with history preserved',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});x.inbound.content='1';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data).toMatchObject({handlingMode:'HUMAN',departmentId:'support',assigneeId:null});});
 it('creates an internal handoff context without sending it to the customer',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'input',variables:{}}});x.flow.steps=[{id:'input',title:'Problema',kind:'input.text',config:'{"variable":"solicitacao"}',message:'Descreva',options:['Continuar'],transitions:{Continuar:'handoff'}},{id:'handoff',title:'Suporte',message:'',options:[],action:'human.handoff',config:'{"departmentKey":"SUPORTE"}'}];x.inbound.content='Sem sinal no rastreador';await x.service.receive(x.channel,'conversation','inbound');const internal=x.tx.message.create.mock.calls.map((call:any)=>call[0].data).find((data:any)=>data.direction==='INTERNAL');expect(internal).toEqual(expect.objectContaining({direction:'INTERNAL',senderName:'Contexto do atendimento'}));expect(internal.content).toContain('Sem sinal no rastreador');expect(x.waha.sendText).not.toHaveBeenCalledWith(expect.anything(),expect.anything(),expect.stringContaining('Contexto do transbordo'));});
 it('honors explicit human requests',async()=>{const x=setup();x.inbound.content='atendente';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data.handlingMode).toBe('HUMAN');});
 it('sends the configured handoff message with the conversation variables', async () => {
  const x = setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});
  const handoff = x.flow.steps.find((step: { id: string }) => step.id === 'handoff')!;
  handoff.message = 'A equipe da {{empresa}} continua o atendimento.';
  x.inbound.content = '1';
  await x.service.receive(x.channel, 'conversation', 'inbound');
  expect(x.waha.sendText).toHaveBeenCalledTimes(1);
  expect(x.waha.sendText).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'A equipe da Empresa continua o atendimento.');
  expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:'engine.processed',details:expect.objectContaining({visitedSteps:[{id:'menu',title:'Menu'},{id:'handoff',title:'Suporte'}],visitedEdges:[{from:'menu',option:'Suporte',to:'handoff'}],waitingStepId:null})})}));
 });
 it('uses the inbox department as the default fallback for explicit human requests',async()=>{const x=setup({departmentId:'admin'});x.inbound.content='atendente';x.channel.settings={inboxRouting:{mode:'AUTOMATION',departmentId:'admin',targetType:'DEPARTMENT'}};x.tx.tenant.findUniqueOrThrow.mockResolvedValue({name:'Empresa',integrations:{intelligencePublished:x.published,intelligencePublications:{'department:admin':x.published}}});x.tx.department.findFirst.mockImplementation(async({where}:any)=>where.id==='admin'?{id:'admin',name:'Administrativo',key:'ADMINISTRATIVO'}:{id:'support',name:'Suporte',key:'SUPORTE'});await x.service.receive(x.channel,'conversation','inbound');const handoff=x.tx.conversation.update.mock.calls.find((call:any)=>call[0].data.handlingMode==='HUMAN');expect(handoff?.[0].data).toMatchObject({handlingMode:'HUMAN',departmentId:'admin',assigneeId:null});expect(x.waha.sendText).toHaveBeenCalledWith(expect.objectContaining({provider:'WAHA'}),expect.any(String),expect.stringContaining('Administrativo'));});
 it('pauses legacy replies and degrades to human with a single notice',async()=>{const x=setup();x.published.active=false;expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);expect(x.tx.message.create).toHaveBeenCalled();});
 it('rejects channels outside binding by degrading to human, never silent',async()=>{const x=setup();x.flow.channelIds=['other'];expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);});
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
   x.flow.steps.splice(1,0,{id:'tag',kind:'tag',title:'Tag',message:'',options:['Continuar'],transitions:{Continuar:'handoff'},config:'{"name":"VIP","color":"#123456"}'});
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

describe('conversation-start trigger',()=>{
 it.each([true,false])('only starts on the first inbound message (%s)',async(first)=>{
  const x=setup();
  x.flow.triggers=[{kind:'first_message'}];
  x.flow.welcome='';
  x.flow.steps=[{id:'start',kind:'text',title:'Mensagem',message:'Bem-vindo',options:[]}];
  const lookup=x.tx.message.findFirst.getMockImplementation();
  x.tx.message.findFirst.mockImplementation(async(args:any)=>args.orderBy
   ? {id:first?x.inbound.id:'earlier-message'}
   : lookup(args));
  await x.service.receive(x.channel,'conversation','inbound');
  expect(x.waha.sendText).toHaveBeenCalledTimes(first?1:0);
 });
});
describe('persistent preferred name',()=>{
 it('starts the configured flow without asking for a name when disabled',async()=>{
  const x=setup();
  x.flow.askPreferredName=false;
  x.flow.welcome='';
  x.flow.steps=[{id:'start',kind:'text',title:'Mensagem',message:'Olá! Como posso ajudar?',options:[]}];
  x.conversation.contact.metadata={};
  await x.service.receive(x.channel,'conversation','inbound');
  expect(x.waha.sendText).toHaveBeenCalledTimes(1);
  expect(x.waha.sendText).toHaveBeenCalledWith(expect.anything(),expect.any(String),'Olá! Como posso ajudar?');
 });
 it('does not save a phone number as a preferred name when the contact answers sim',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',awaitingName:true}});x.conversation.contact.name='5511999999999';x.conversation.contact.metadata={};x.inbound.content='sim';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.contact.update).not.toHaveBeenCalled();expect(x.tx.conversation.update.mock.calls[0][0].data.botState.awaitingName).toBe(true)});
 it('asks before a new contact proceeds to the workflow',async()=>{const x=setup();x.conversation.contact.metadata={};await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.message.create.mock.calls[0][0].data.content).toContain('Como gostaria de ser chamado');expect(x.tx.conversation.update.mock.calls[0][0].data.botState.awaitingName).toBe(true)});
 it('saves a chosen name with unrelated CRM metadata preserved',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',awaitingName:true}});x.conversation.contact.metadata={notes:'Preservar'};x.inbound.content='Aninha';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.contact.update).toHaveBeenCalledWith(expect.objectContaining({data:{metadata:{notes:'Preservar',novo_nome:'Aninha'}}}));expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.novo_nome).toBe('Aninha')});
 it('accepts keeping the current name and remembers it across a fresh conversation',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',awaitingName:true}});x.conversation.contact.metadata={};x.inbound.content='sim';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.contact.update).toHaveBeenCalledWith(expect.objectContaining({data:{metadata:{novo_nome:'Ana'}}}));const y=setup();await y.service.receive(y.channel,'conversation','inbound');expect(y.tx.message.create.mock.calls.some((call:any)=>call[0].data.content.includes('Como gostaria'))).toBe(false)});
 it('normalizes document variables before the next step uses them',async()=>{const x=setup({botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'doc',variables:{}}});x.flow.steps=[{id:'doc',kind:'input.text',message:'CPF',title:'CPF',options:['Continuar'],transitions:{Continuar:'done'},config:'{"variable":"cpf"}'},{id:'done',kind:'text',message:'Recebido',title:'Fim',options:[]}];x.inbound.content='012.345.678-90';await x.service.receive(x.channel,'conversation','inbound');expect(x.tx.conversation.update.mock.calls[0][0].data.botState.variables.cpf).toBe('01234567890')});
});

describe('department and attendant publications in the message engine',()=>{
 function scoped(overrides:any={}){
 const x=setup({departmentId:'link',assigneeId:null,...overrides});
 const publications:any={'department:link':{...x.published,revision:'link-r1',flow:{...structuredClone(x.flow),welcome:'Financeiro Link'}}};
 const root:any={intelligencePublished:x.published,intelligencePublications:publications};
 const queued=new Map<string,any>();
 x.tx.tenant.findUniqueOrThrow.mockResolvedValue({name:'Empresa',integrations:root});
 x.prisma.tenant.findUnique.mockResolvedValue({integrations:root});
 x.tx.department.findFirst.mockImplementation(async({where}:any)=>({id:where.id||'link',key:where.key||'LINK',name:'Financeiro Link',routingCategory:'FINANCE'}));
 x.tx.membership={findFirst:jest.fn().mockResolvedValue({id:'member'})};
 x.tx.departmentMember={findFirst:jest.fn().mockResolvedValue({id:'link-member'})};
 x.prisma.membership=x.tx.membership;x.prisma.departmentMember=x.tx.departmentMember;
 x.tx.message.create.mockImplementation(async({data}:any)=>{const m={id:'out-'+queued.size,...data};queued.set(m.id,m);return m});
 x.tx.message.findFirst.mockImplementation(async({where}:any)=>where.status?queued.get(where.id):x.inbound);
 x.tx.conversation.update.mockImplementation(async({data}:any)=>{Object.assign(x.conversation,data);return x.conversation});
 return {...x,root,publications,queued};
 }
 it('runs the current departments publication and records its context',async()=>{
 const x=scoped();await x.service.receive(x.channel,'conversation','inbound');
 expect(x.waha.sendText.mock.calls[0][2]).toBe('Financeiro Link');
 expect(x.conversation.botState.scopeKey).toBe('department:link');
 expect(x.conversation.botState.revision).toBe('link-r1');
 });
 it('lets a BOT-owned conversation inherit its assigned attendants department',async()=>{
 const x=scoped({assigneeId:'ana'});await x.service.receive(x.channel,'conversation','inbound');
 expect(x.waha.sendText).toHaveBeenCalled();expect(x.tx.departmentMember.findFirst).toHaveBeenCalled();
 });
 it('does not inherit after the attendant has left the department',async()=>{
 const x=scoped({assigneeId:'ana'});x.tx.departmentMember.findFirst.mockResolvedValue(null);
 expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);
 expect(x.tx.message.create).toHaveBeenCalled();
 });
 it('does not deliver remaining messages when the department changes before dispatch',async()=>{
 const x=scoped();x.prisma.conversation.findFirstOrThrow.mockResolvedValue({...x.conversation,departmentId:'tracking'});
 await x.service.receive(x.channel,'conversation','inbound');expect(x.waha.sendText).not.toHaveBeenCalled();
 });
 it('honors a department pause by degrading to human, never silent',async()=>{
 const x=scoped();x.publications['department:link'].active=false;
 expect(await x.service.receive(x.channel,'conversation','inbound')).toBe(true);expect(x.tx.message.create).toHaveBeenCalled();
 });
 it('routes a department block into the departments published chatbot',async()=>{
 const x=scoped({departmentId:null,botState:{flow:'INTELLIGENCE',revision:'r1',stepId:'menu',variables:{}}});
 x.flow.steps[1]={id:'handoff',title:'Financeiro',message:'',kind:'department.route',config:'{"departmentKey":"LINK"}',options:[]};
 x.inbound.content='1';await x.service.receive(x.channel,'conversation','inbound');
 expect(x.conversation.handlingMode).toBe('BOT');expect(x.conversation.departmentId).toBe('link');
 expect(x.conversation.botState.scopeKey).toBe('department:link');
 expect(x.waha.sendText.mock.calls[0][2]).toBe('Financeiro Link');
 });
});


describe("inbox entry routing",()=>{
 it("routes unassigned bot traffic into the inbox department before choosing its flow",async()=>{
  const x=setup();x.channel.settings={inboxRouting:{mode:"AUTOMATION",departmentId:"support",revision:"inbox1"}};
  x.tx.tenant.findUniqueOrThrow.mockResolvedValue({name:"Empresa",integrations:{intelligencePublications:{"department:support":x.published}}});
  await x.service.receive(x.channel,"conversation","inbound");
  expect(x.conversation.departmentId).toBe("support");
  expect(x.tx.message.create.mock.calls[0][0].data.metadata).toMatchObject({scopeKey:"department:support",inboxRoutingRevision:"inbox1"});
 });
 it("puts bot traffic into human ownership without invoking a model or sending",async()=>{
  const x=setup();x.channel.settings={inboxRouting:{mode:"HUMAN",departmentId:"support",revision:"inbox1"}};
  expect(await x.service.receive(x.channel,"conversation","inbound")).toBe(true);
  expect(x.tx.conversation.update).toHaveBeenCalledWith(expect.objectContaining({data:{handlingMode:"HUMAN",departmentId:"support"}}));
  expect(x.waha.sendText).not.toHaveBeenCalled();expect(x.events.publish).toHaveBeenCalledWith("tenant","conversation.assigned",{id:"conversation"});
 });
 it("preserves existing human assignment when the inbox is automated",async()=>{
  const x=setup({handlingMode:"HUMAN",departmentId:"other",assigneeId:"attendant"});x.channel.settings={inboxRouting:{mode:"AUTOMATION",departmentId:"support"}};
  expect(await x.service.receive(x.channel,"conversation","inbound")).toBe(false);expect(x.tx.conversation.update).not.toHaveBeenCalled();
 });
 it("never replaces a current departmental context with the inbox default",async()=>{
  const x=setup({departmentId:"other"});x.channel.settings={inboxRouting:{mode:"AUTOMATION",departmentId:"support"}};
  await x.service.receive(x.channel,"conversation","inbound");expect(x.conversation.departmentId).toBe("other");
 });
 it("does not fall back to the company flow and degrades to human instead",async()=>{
  const x=setup();x.channel.settings={inboxRouting:{mode:"AUTOMATION",departmentId:"support"}};
  expect(await x.service.receive(x.channel,"conversation","inbound")).toBe(true);expect(x.tx.message.create).toHaveBeenCalled();
 });
 it("does not use the legacy bot and degrades to human instead",async()=>{
  const x=setup();x.channel.settings={inboxRouting:{mode:"AUTOMATION"}};x.tx.tenant.findUniqueOrThrow.mockResolvedValue({name:"Empresa",integrations:{}});
  expect(await x.service.receive(x.channel,"conversation","inbound")).toBe(true);expect(x.waha.sendText).toHaveBeenCalled();
 });
 it("cancels queued output when inbox routing changed during generation",async()=>{
  const x=setup();x.prisma.channelConnection.findFirst.mockResolvedValue({id:"channel",tenantId:"tenant",provider:"WAHA",isActive:true,settings:{inboxRouting:{mode:"HUMAN",revision:"changed"}}});
  await x.service.receive(x.channel,"conversation","inbound");expect(x.waha.sendText).not.toHaveBeenCalled();
 });
});

const departments = [{key:'SUPORTE',name:'Suporte Técnico'},{key:'ADM',name:'Administrativo'}];
const modelPlan = {name:'Véxora Suite',welcome:'Olá!',steps:[
  {id:'nome',kind:'preferred-name',options:['Continuar'],transitions:{Continuar:'menu'}},
  {id:'menu',kind:'buttons',message:'{{novo_nome}}, qual área?',options:['Suporte Técnico','Administrativo'],transitions:{'Suporte Técnico':'tecnico',Administrativo:'administrativo'}},
  {id:'tecnico',kind:'human.handoff',department:'Suporte Técnico'},
  {id:'administrativo',kind:'human.handoff',department:'Administrativo'},
]};

describe('AI generated preferred-name and triage flow',()=>{
 it.each([
   ['Usar Ana','Ana','1','SUPORTE'],
   ['Digitar outro nome','Beatriz','Administrativo','ADM'],
 ])('handles %s and transfers to the correct tenant department',async(choice,name,route,key)=>{
  const x=setup();
  x.conversation.contact.metadata={};
  const compiled=compileChatbotFlow(JSON.stringify(modelPlan),departments);
  expect(compiled).toBeDefined();
  x.flow.steps=compiled!.draft.steps;
  x.tx.department.findFirst.mockImplementation(async({where}:any)=>where.key?{id:where.key,name:where.key}:null);
  const reply=async(content:string)=>{
   x.inbound.content=content;
   x.tx.conversation.update.mockClear();
   await x.service.receive(x.channel,'conversation','inbound');
   const update=x.tx.conversation.update.mock.calls.find(([call]:any[])=>call.data.botState)?.[0].data;
   x.conversation.botState=update.botState;
   return update;
  };
  expect((await reply('oi')).botState.stepId).toBe('nome-escolha');
  const picked=await reply(choice);
  if(choice==='Digitar outro nome'){
   expect(picked.botState.stepId).toBe('nome-digitar');
   expect((await reply('123')).botState.stepId).toBe('nome-digitar');
   expect((await reply(name)).botState.variables.novo_nome).toBe(name);
  } else expect(picked.botState.variables.novo_nome).toBe(name);
  expect((await reply('opção inválida')).botState.stepId).toBe('menu-triagem');
  expect(x.tx.message.create.mock.calls.some(([call]:any[])=>call.data.content.includes(name+', qual área?'))).toBe(true);
  expect(await reply(route)).toMatchObject({departmentId:key,handlingMode:'HUMAN',botState:{variables:{novo_nome:name}}});
 });

 it('sends only the explicitly chosen tenant catalog item, keeping image and description private', async () => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  const imageUrl = 'https://intranet.example.com/catalog/crm.png';
  const description = 'Diagnóstico e plano de ação';
  x.tx.catalogItem = { findFirst: jest.fn().mockResolvedValue({
   id: '12345678-1234-4234-8234-123456789abc', kind: 'SERVICE', name: 'Consultoria de CRM',
   description, sku: 'SRV-CRM', priceCents: 15000, currency: 'BRL', unit: 'hora', category: 'Consultoria', imageUrl,
  }) };
  const itemId = '12345678-1234-4234-8234-123456789abc';
  x.flow.steps.splice(1, 0,
   { id: 'catalog', kind: 'catalog.item', title: 'Item', message: '', options: ['Continuar'], transitions: { Continuar: 'reply' }, config: JSON.stringify({ itemId }) },
   { id: 'reply', kind: 'text', title: 'Resposta', message: 'Posso continuar?', options: [] },
  );
  x.flow.steps[0].transitions.Suporte = 'catalog';
  x.inbound.content = '1';
  await x.service.receive(x.channel, 'conversation', 'inbound');
  expect(x.tx.catalogItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
   where: { id: itemId, tenantId: 'tenant', active: true },
   select: expect.objectContaining({ imageUrl: true, description: true }),
  }));
  const created = x.tx.message.create.mock.calls.map(([call]: any[]) => call.data);
  const sent = created.map((data: any) => data.content as string);
  expect(created.some((data: any) => data.metadata?.catalogItems)).toBe(true);
  const internal = created.find((data: any) => data.metadata?.catalogItems)?.metadata.catalogItems;
  expect(internal).toEqual([{ id: itemId, imageUrl, description }]);
  expect(x.tx.auditLog.create.mock.calls[0][0].data.details.catalogItems).toEqual([{ id: itemId, imageUrl, description }]);
  expect(sent).toContain('Item do catálogo: Consultoria de CRM\nTipo: Serviço\nSKU: SRV-CRM\nCategoria: Consultoria\nPreço: 150.00 BRL / hora\nVitrine: https://catalogo.example.com/servicos/12345678-1234-4234-8234-123456789abc/');
  expect(sent.some((content: string) => content.includes('150,00') && !content.includes('150.00'))).toBe(false);
  expect(sent.join('\n')).not.toContain(imageUrl);
  expect(sent.join('\n')).not.toContain(description);
  for (const call of x.waha.sendText.mock.calls) {
   expect(call[2]).not.toContain(imageUrl);
   expect(call[2]).not.toContain(description);
  }
 });

 it('sends the configured full catalog link for catalog.list without private fields', async () => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  x.flow.steps.splice(1, 0,
   { id: 'catalog', kind: 'catalog.list', title: 'Catálogo', message: '', options: ['Continuar'], transitions: { Continuar: 'reply' } },
   { id: 'reply', kind: 'text', title: 'Resposta', message: 'Posso continuar?', options: [] },
  );
  x.flow.steps[0].transitions.Suporte = 'catalog';
  x.inbound.content = '1';
  await x.service.receive(x.channel, 'conversation', 'inbound');
  const sent = x.tx.message.create.mock.calls.map(([call]: any[]) => call.data.content as string);
  expect(sent.some((content: string) => content.includes('https://catalogo.example.com/servicos/\n'))).toBe(true);
  expect(sent.some((content: string) => content.includes('não confirma pagamento'))).toBe(true);
  expect(sent.join('\n')).not.toContain('description');
  expect(sent.join('\n')).not.toContain('imageUrl');
 });

 it('fails clearly when the chosen catalog item is no longer available', async () => {
  const x = setup({ botState: { flow: 'INTELLIGENCE', revision: 'r1', stepId: 'menu', variables: {} } });
  x.tx.catalogItem = { findFirst: jest.fn().mockResolvedValue(null) };
  x.flow.steps.splice(1, 0,
   { id: 'catalog', kind: 'catalog.item', title: 'Item', message: '', options: ['Continuar'], transitions: { Continuar: 'reply' }, config: JSON.stringify({ itemId: '12345678-1234-4234-8234-123456789abc' }) },
   { id: 'reply', kind: 'text', title: 'Resposta', message: 'Posso continuar?', options: [] },
  );
  x.flow.steps[0].transitions.Suporte = 'catalog';
  x.inbound.content = '1';
  await x.service.receive(x.channel, 'conversation', 'inbound');
  const sent = x.tx.message.create.mock.calls.map(([call]: any[]) => call.data.content as string);
  expect(sent).toContain('Item do catálogo indisponível. Escolha outro item ou fale com um atendente.');
 });
});
