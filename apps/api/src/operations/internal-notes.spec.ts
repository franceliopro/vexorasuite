import {ConversationsController} from "./conversations.controller";
describe("private conversation collaboration",()=>{
 const req:any={user:{tenantId:"tenant",sub:"author",role:"OWNER"}};
 function setup(){
  const tx:any={internalMention:{createMany:jest.fn()},membership:{findFirst:jest.fn().mockResolvedValue({id:"member"})},department:{findFirst:jest.fn().mockResolvedValue({name:"Atual"})},departmentMember:{findFirst:jest.fn().mockResolvedValue({id:"department-member"})},conversationParticipant:{upsert:jest.fn()},$queryRaw:jest.fn(),conversation:{findFirst:jest.fn().mockResolvedValue({id:"conversation",status:"OPEN",handlingMode:"HUMAN"}),update:jest.fn().mockResolvedValue({id:"conversation",status:"OPEN",department:{name:"Financeiro"},assignee:{name:"Ana"}})},message:{create:jest.fn().mockImplementation(async({data}:any)=>({id:"note",...data}))},auditLog:{create:jest.fn()}};
  const prisma:any={...tx,$transaction:jest.fn((fn:any)=>fn(tx)),user:{findUnique:jest.fn().mockResolvedValue({name:"João"})},departmentMember:{findMany:jest.fn().mockResolvedValue([]),findFirst:jest.fn().mockResolvedValue({id:"department-member"})}};
  const events:any={publish:jest.fn()},waha:any={sendText:jest.fn()},zernio:any={request:jest.fn()};
  return {tx,prisma,events,waha,zernio,controller:new ConversationsController(prisma,events,waha,zernio)};
 }
 it("stores notes internally with author and audit without invoking an external provider",async()=>{
  const x=setup();const note=await x.controller.addInternalNote(req,"conversation",{content:" Contexto reservado "});
  expect(note).toMatchObject({tenantId:"tenant",conversationId:"conversation",direction:"INTERNAL",status:"SENT",content:"Contexto reservado",senderName:"João",metadata:{authorId:"author",kind:"private_note"}});
  expect(x.waha.sendText).not.toHaveBeenCalled();expect(x.zernio.request).not.toHaveBeenCalled();
  expect(x.tx.auditLog.create).toHaveBeenCalled();expect(x.events.publish).toHaveBeenCalledWith("tenant","conversation.updated",{id:"conversation",internalNote:true});
 });
 it("rejects missing, blank, oversized and non-text notes",async()=>{const x=setup();for(const content of [undefined," ","x".repeat(4001),42])await expect(x.controller.addInternalNote(req,"conversation",{content})).rejects.toThrow();expect(x.tx.message.create).not.toHaveBeenCalled();});
 it("checks current tenant and conversation access under the lock",async()=>{const x=setup();x.tx.conversation.findFirst.mockResolvedValue(null);await expect(x.controller.addInternalNote(req,"foreign",{content:"private"})).rejects.toThrow();expect(x.tx.conversation.findFirst).toHaveBeenCalledWith({where:{id:"foreign",tenantId:"tenant"}});expect(x.tx.message.create).not.toHaveBeenCalled();});
 it("applies human assignment visibility for regular attendants",async()=>{const x=setup();await x.controller.addInternalNote({user:{...req.user,role:"AGENT"}} as any,"conversation",{content:"private"});const where=x.tx.conversation.findFirst.mock.calls[0][0].where;expect(where.handlingMode).toBe("HUMAN");expect(where.OR).toContainEqual({assigneeId:"author"});});
 it("rejects notes on archived or deleted conversations",async()=>{for(const state of [{archivedAt:new Date()},{deletedAt:new Date()}]){const x=setup();x.tx.conversation.findFirst.mockResolvedValue({status:"OPEN",...state});await expect(x.controller.addInternalNote(req,"conversation",{content:"private"})).rejects.toThrow();expect(x.tx.message.create).not.toHaveBeenCalled();}});
 it("persists handoff and private context together before notifying the destination",async()=>{const x=setup();await x.controller.handoff(req,"conversation",{note:"Cliente aguarda retorno"});expect(x.tx.conversation.update).toHaveBeenCalled();expect(x.tx.message.create.mock.calls[0][0].data).toMatchObject({direction:"INTERNAL",content:"Transferência para Financeiro · Ana\n\nCliente aguarda retorno",metadata:{kind:"handoff_context"}});expect(x.events.publish).toHaveBeenCalled();expect(x.waha.sendText).not.toHaveBeenCalled();});
 it("does not transfer when context is invalid",async()=>{const x=setup();await expect(x.controller.handoff(req,"conversation",{note:42})).rejects.toThrow();expect(x.tx.conversation.update).not.toHaveBeenCalled();});
 it("does not route to a person outside the current department",async()=>{const x=setup();x.tx.conversation.findFirst.mockResolvedValue({id:"conversation",status:"OPEN",handlingMode:"HUMAN",departmentId:"current-department"});x.prisma.departmentMember.findFirst.mockResolvedValue(null);await expect(x.controller.handoff(req,"conversation",{assigneeId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"})).rejects.toThrow("O atendente não pertence ao departamento escolhido.");expect(x.tx.conversation.update).not.toHaveBeenCalled();});
 it("returns the most recent internal notes in chronological order within the tenant",async()=>{const x=setup();x.prisma.message.findMany=jest.fn().mockResolvedValue([{id:"new"},{id:"old"}]);expect(await x.controller.internalNotes(req,"conversation")).toEqual([{id:"old"},{id:"new"}]);expect(x.prisma.message.findMany.mock.calls[0][0].where).toEqual({tenantId:"tenant",conversationId:"conversation",direction:"INTERNAL"});});
 it("adds selected @mentions as invited participants atomically with the private note",async()=>{const x=setup();const userId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";await x.controller.addInternalNote(req,"conversation",{content:"@Ana pode ajudar?",mentionedUserIds:[userId,userId]});expect(x.tx.conversationParticipant.upsert).toHaveBeenCalledTimes(1);expect(x.tx.conversationParticipant.upsert).toHaveBeenCalledWith({where:{conversationId_userId:{conversationId:"conversation",userId}},create:{tenantId:"tenant",conversationId:"conversation",userId,kind:"INVITED"},update:{kind:"INVITED"}});expect(x.tx.membership.findFirst.mock.calls[0][0].where.tenantId).toBe("tenant");expect(x.waha.sendText).not.toHaveBeenCalled();});
 it("rejects mentions from another company or inactive members before creating participants or a note",async()=>{const x=setup();x.tx.membership.findFirst.mockResolvedValue(null);await expect(x.controller.addInternalNote(req,"conversation",{content:"@Pessoa",mentionedUserIds:["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]})).rejects.toThrow();expect(x.tx.conversationParticipant.upsert).not.toHaveBeenCalled();expect(x.tx.message.create).not.toHaveBeenCalled();});
 it("rejects invalid mention IDs and prevents invitations into bot contexts",async()=>{const x=setup();await expect(x.controller.addInternalNote(req,"conversation",{content:"nota",mentionedUserIds:["foreign"]})).rejects.toThrow();x.tx.conversation.findFirst.mockResolvedValue({status:"OPEN",handlingMode:"BOT"});await expect(x.controller.addInternalNote(req,"conversation",{content:"nota",mentionedUserIds:["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]})).rejects.toThrow();expect(x.tx.conversationParticipant.upsert).not.toHaveBeenCalled();});
 it("keeps mentions scoped to the recipient and rechecks current conversation visibility",async()=>{const x=setup();x.prisma.internalMention={findMany:jest.fn().mockResolvedValue([{id:"mine",userId:"author",conversationId:"visible",messageId:"n1"},{id:"hidden",userId:"author",conversationId:"revoked",messageId:"n2"}]),updateMany:jest.fn()};x.prisma.conversation.findMany=jest.fn().mockResolvedValue([{id:"visible"}]);x.prisma.message.findMany=jest.fn().mockResolvedValue([{id:"n1",senderName:"Tonico",metadata:{departmentName:"Financeiro Link"}}]);const result=await x.controller.mentions(req);expect(result.map(n=>n.id)).toEqual(["mine"]);expect(result[0]).toMatchObject({authorName:"Tonico",departmentName:"Financeiro Link"});expect(x.prisma.internalMention.findMany.mock.calls[0][0].where).toEqual({tenantId:"tenant",userId:"author"});await x.controller.readMention(req,"mine");expect(x.prisma.internalMention.updateMany.mock.calls[0][0].where).toEqual({id:"mine",tenantId:"tenant",userId:"author",readAt:null});});
 it("records the company nickname on private messages",async()=>{const x=setup();x.tx.membership.findFirst.mockResolvedValue({id:"membership",knownBy:"Tonico"});const note=await x.controller.addInternalNote(req,"conversation",{content:"Contexto"});expect(note.senderName).toBe("Tonico");});
});


describe("conversation lifecycle audit", () => {
  const request: any = { user: { tenantId: "tenant", sub: "agent", role: "OWNER" } };
  function setup() {
    const tx: any = {
      conversation: { update: jest.fn().mockResolvedValue({ id: "conversation", status: "RESOLVED", handlingMode: "BOT", departmentId: null, assigneeId: null }) },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ id: "conversation", status: "OPEN", contactId: "contact", handlingMode: "HUMAN" }) },
      contact: { findFirst: jest.fn().mockResolvedValue({ metadata: {} }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const events: any = { publish: jest.fn() };
    return { tx, controller: new ConversationsController(prisma, events, {} as any, {} as any) };
  }
  it("audits status transitions with previous and next status", async () => {
    const x = setup();
    await x.controller.updateStatus(request, "conversation", "RESOLVED");
    expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "conversation.status_changed", details: { from: "OPEN", to: "RESOLVED", contactId: "contact" } }) }));
  });
  it("audits returning an atendimento to the bot", async () => {
    const x = setup();
    await x.controller.returnToBot(request, "conversation");
    expect(x.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "conversation.returned_to_bot", details: { from: "HUMAN", to: "BOT" } }) }));
  });
});


describe("guided chatbot handoff context", () => {
  it("stores internal context and avoids duplicating it", async () => {
    const tx: any = {
      conversation: { findFirst: jest.fn().mockResolvedValue({ contact: { name: "Ana", phone: "556699999999" } }) },
      message: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ content: "Preciso de suporte" }), create: jest.fn().mockResolvedValue({ id: "context" }) },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn: any) => fn(tx)) };
    const { WahaWebhookController } = await import("./waha-webhook.controller");
    const controller = new WahaWebhookController(prisma, {} as any, {} as any, {} as any, {} as any, {} as any);
    await (controller as any).recordGuidedHandoffContext("tenant", "conversation", "SUPORTE", "RASTREABEM", "Suporte · Rastreabem", "Suporte");
    expect(tx.message.create.mock.calls[0][0].data).toMatchObject({ direction: "INTERNAL", senderName: "Contexto do atendimento", metadata: { kind: "guided_handoff_context" } });
    expect(tx.message.create.mock.calls[0][0].data.content).toContain("Última mensagem do cliente: Preciso de suporte");
    tx.message.findFirst.mockReset();
    tx.message.findFirst.mockResolvedValue({ metadata: { kind: "guided_handoff_context" } });
    await (controller as any).recordGuidedHandoffContext("tenant", "conversation", "SUPORTE", null, "Suporte", "Suporte");
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});


describe("conversation lifecycle audit: archive and recovery", () => {
  const request: any = { user: { tenantId: "tenant", sub: "agent", role: "OWNER" } };
  it("audits archive, restore and trash", async () => {
    const tx: any = { conversation: { update: jest.fn().mockResolvedValue({ id: "conversation", status: "OPEN" }) }, auditLog: { create: jest.fn() } };
    const prisma: any = { conversation: { findFirst: jest.fn().mockResolvedValue({ id: "conversation", status: "OPEN", contact: { metadata: {} } }) }, $transaction: jest.fn((fn: any) => fn(tx)) };
    const controller = new ConversationsController(prisma, { publish: jest.fn() } as any, {} as any, {} as any);
    await controller.archive(request, "conversation");
    await controller.restore(request, "conversation");
    await controller.trash(request, "conversation");
    expect(tx.auditLog.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual(["conversation.archived", "conversation.restored", "conversation.trashed"]);
  });
});


describe("conversation collaboration audit", () => {
  it("audits assume, assign and invite actions", async () => {
    const request: any = { user: { tenantId: "tenant", sub: "agent", role: "OWNER" } };
    const tx: any = { conversation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: "conversation", status: "OPEN" }) }, conversationParticipant: { upsert: jest.fn().mockResolvedValue({ id: "participant" }) }, auditLog: { create: jest.fn() } };
    const prisma: any = { conversation: { findFirst: jest.fn().mockResolvedValue({ id: "conversation", status: "OPEN", assigneeId: null, departmentId: null, contact: { metadata: {} } }) }, membership: { findFirst: jest.fn().mockResolvedValue({ id: "membership" }) }, $transaction: jest.fn((fn: any) => fn(tx)) };
    const controller = new ConversationsController(prisma, { publish: jest.fn() } as any, {} as any, {} as any);
    await controller.assume(request, "conversation");
    await controller.assign(request, "conversation", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await controller.invite(request, "conversation", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(tx.auditLog.create.mock.calls.map((call: any[]) => call[0].data.action)).toEqual(["conversation.assumed", "conversation.assigned", "conversation.participant_invited"]);
  });
});
