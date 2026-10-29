import {InboxesController} from "./inboxes.controller";
const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",departmentId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function setup(){
 const publication={active:true,revision:"flow1",flow:{name:"Entrada",steps:[{id:"menu",kind:"agent",config:'{"agentId":"customer"}'}],channelIds:[id],triggers:[{kind:"message"}]}};
 const root:any={assistant:{enabled:true,agents:[{id:"customer",name:"Atendimento",enabled:true}]},intelligencePublished:publication};
 const channel:any={id,tenantId:"tenant",isActive:true,provider:"WAHA",status:"CONNECTED",name:"Principal",settings:{accountPhone:"5566996361707",webhookSecret:"private"}};
 const tx:any={$queryRaw:jest.fn(),channelConnection:{findFirst:jest.fn().mockResolvedValue(channel),findMany:jest.fn().mockResolvedValue([channel]),update:jest.fn()},tenant:{findUniqueOrThrow:jest.fn().mockImplementation(async()=>({integrations:root}))},department:{findFirst:jest.fn().mockResolvedValue({id:departmentId}),findMany:jest.fn().mockResolvedValue([{id:departmentId,name:"Financeiro"}])},message:{findFirst:jest.fn().mockResolvedValue(null)},auditLog:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()}};
 const prisma:any={...tx,$transaction:jest.fn((fn:any)=>fn(tx))};const req:any={user:{tenantId:"tenant",sub:"owner",role:"OWNER"}};
 return {controller:new InboxesController(prisma),prisma,tx,root,channel,req};
}
describe("inbox management",()=>{
 it("exposes physical identity and actual published agents without credentials",async()=>{
  const x=setup();const data=await x.controller.list(x.req);expect(data.inboxes[0]).toMatchObject({identity:"5566996361707",flow:{agents:[{id:"customer",name:"Atendimento",enabled:true}]},blockers:[]});
  expect(JSON.stringify(data)).not.toContain("private");expect(x.tx.channelConnection.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId:"tenant",isActive:true,provider:{in:["WAHA","ZERNIO"]}}}));
 });
 it("rejects attendants before reading inbox diagnostics",async()=>{
  const x=setup();x.req.user.role="AGENT";await expect(x.controller.list(x.req)).rejects.toThrow("administradores");expect(x.tx.channelConnection.findMany).not.toHaveBeenCalled();
 });
 it("reports a connected account lacking any publication honestly",async()=>{
  const x=setup();delete x.root.intelligencePublished;const data=await x.controller.list(x.req);expect(data.inboxes[0]!.blockers).toContain("Não há fluxo publicado para a entrada desta inbox.");
 });
 it("does not configure a channel belonging to another tenant",async()=>{
  const x=setup();x.tx.channelConnection.findFirst.mockResolvedValue(null);await expect(x.controller.configure(x.req,id,{mode:"HUMAN",expectedRevision:null})).rejects.toThrow("indisponível");expect(x.tx.channelConnection.update).not.toHaveBeenCalled();
 });
 it("rejects foreign or inactive departments",async()=>{
  const x=setup();x.tx.department.findFirst.mockResolvedValue(null);await expect(x.controller.configure(x.req,id,{mode:"HUMAN",departmentId,expectedRevision:null})).rejects.toThrow("Departamento indisponível");expect(x.tx.channelConnection.update).not.toHaveBeenCalled();
 });
 it("refuses automation unless the exact department publication contains this inbox",async()=>{
  const x=setup();await expect(x.controller.configure(x.req,id,{mode:"AUTOMATION",departmentId,expectedRevision:null})).rejects.toThrow("Publique");expect(x.tx.channelConnection.update).not.toHaveBeenCalled();
 });
 it("blocks stale edits and keeps unrelated connection settings",async()=>{
  const x=setup();x.channel.settings.inboxRouting={mode:"HUMAN",revision:"new"};await expect(x.controller.configure(x.req,id,{mode:"AUTOMATION",expectedRevision:null})).rejects.toThrow("alterada");
  await x.controller.configure(x.req,id,{mode:"AUTOMATION",expectedRevision:"new"});expect(x.tx.channelConnection.update).toHaveBeenCalledWith(expect.objectContaining({data:{settings:expect.objectContaining({webhookSecret:"private",inboxRouting:expect.objectContaining({mode:"AUTOMATION"})})}}));
 });
 it("validates unknown modes and mandatory revision",async()=>{
  const x=setup();await expect(x.controller.configure(x.req,id,{mode:"UNKNOWN",expectedRevision:null})).rejects.toThrow("Escolha");await expect(x.controller.configure(x.req,id,{mode:"HUMAN"})).rejects.toThrow("Atualize");
 });
});
