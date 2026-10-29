import {ChannelConnectionsController} from "./channels.controller";
function setup(){
 const row:any={id:"channel",tenantId:"tenant",provider:"ZERNIO",isActive:true,status:"CONNECTED",name:"Old",settings:{platform:"instagram",accountId:"old",username:"old",webhookSecret:"private",webhookVerifiedAt:"verified",inboxRouting:{mode:"HUMAN",revision:"r1"}}};
 const tx:any={$queryRaw:jest.fn(),channelConnection:{findMany:jest.fn().mockResolvedValue([row]),findFirst:jest.fn(async()=>row),update:jest.fn(async({data}:any)=>{Object.assign(row,data);return row;})}};
 const prisma:any={...tx,tenant:{findFirst:jest.fn().mockResolvedValue({kind:"COMPANY"})},zernioProfile:{findUnique:jest.fn().mockResolvedValue({tenantId:"tenant",profileId:"profile",externalId:"vexora-tenant-tenant"})},$transaction:jest.fn((fn:any)=>fn(tx))};
 const zernio:any={request:jest.fn(async(path:string)=>path==="/auth/verify"?{valid:true}:{accounts:[{id:"old",profileId:"profile",platform:"instagram",username:"newhandle",name:"New name",status:"ACTIVE"},{id:"new-facebook",profileId:"profile",platform:"facebook",username:"business",status:"ACTIVE"}]})};
 const events:any={publish:jest.fn()},req:any={user:{tenantId:"tenant",sub:"owner",role:"OWNER"}};
 return {row,tx,prisma,zernio,events,req,controller:new ChannelConnectionsController(prisma,{} as any,events,zernio)};
}
describe("social account reconciliation",()=>{
 const originalKey=process.env.ZERNIO_API_KEY;
 beforeEach(()=>{process.env.ZERNIO_API_KEY="test-only";});
 afterEach(()=>{if(originalKey===undefined)delete process.env.ZERNIO_API_KEY;else process.env.ZERNIO_API_KEY=originalKey;});
 it("updates the same provider account without losing routing, secrets or its channel ID",async()=>{
  const x=setup();const result=await x.controller.syncZernio(x.req);
  expect(result.synchronized).toBe(true);expect(result.accounts).toHaveLength(2);
  expect(x.row).toMatchObject({id:"channel",name:"New name",status:"CONNECTED",settings:{username:"newhandle",webhookSecret:"private",inboxRouting:{revision:"r1"}}});
  expect(x.tx.channelConnection.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{tenantId:"tenant",provider:"ZERNIO",isActive:true}}));
  expect(x.tx.channelConnection.update).toHaveBeenCalledTimes(1);expect(JSON.stringify(result)).not.toContain("private");
 });
 it("detects a replacement and Facebook without reassigning the old inbox or its conversations",async()=>{
  const x=setup();x.zernio.request.mockImplementation(async(p:string)=>p==="/auth/verify"?{valid:true}:{accounts:[{id:"replacement",profileId:"profile",platform:"instagram",username:"new",status:"ACTIVE"},{id:"fb",profileId:"profile",platform:"facebook",status:"ACTIVE"}]});
  const result=await x.controller.syncZernio(x.req);expect(result.accounts).toHaveLength(2);
  expect(x.row).toMatchObject({status:"DISCONNECTED",lastError:"ZERNIO_ACCOUNT_MISSING",settings:{accountId:"old",inboxRouting:{revision:"r1"}}});
  expect(x.row.isActive).toBe(true);
 });
 it("does not treat an incomplete provider payload as an empty account list",async()=>{
  const x=setup();x.zernio.request.mockImplementation(async(p:string)=>p==="/auth/verify"?{valid:true}:{unexpected:true});
  expect((await x.controller.syncZernio(x.req)).synchronized).toBe(false);expect(x.tx.channelConnection.update).not.toHaveBeenCalled();
 });
 it("keeps existing state after authentication or provider failure",async()=>{
  const x=setup();x.zernio.request.mockRejectedValue(Error("offline"));
  expect((await x.controller.syncZernio(x.req)).synchronized).toBe(false);expect(x.tx.channelConnection.update).not.toHaveBeenCalled();
 });
 it("clears a stale handle and never confirms messaging solely from provider account availability",async()=>{
  const x=setup();delete x.row.settings.webhookVerifiedAt;x.zernio.request.mockImplementation(async(p:string)=>p==="/auth/verify"?{valid:true}:{accounts:[{id:"old",platform:"instagram",status:"ACTIVE"}]});
  await x.controller.syncZernio(x.req);expect(x.row.settings.username).toBe("");expect(x.row.status).toBe("CONNECTING");
 });
 it("does not overwrite a newer reconciliation snapshot",async()=>{
  const x=setup();x.row.settings.socialSyncStartedAt="2999-01-01T00:00:00.000Z";await x.controller.syncZernio(x.req);expect(x.tx.channelConnection.update).not.toHaveBeenCalled();
 });
 it("rejects non-managers before any provider access",async()=>{
  const x=setup();x.req.user.role="AGENT";await expect(x.controller.syncZernio(x.req)).rejects.toThrow("gestores");expect(x.zernio.request).not.toHaveBeenCalled();
 });
});
