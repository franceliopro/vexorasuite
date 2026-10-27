import { randomUUID } from 'node:crypto';
import { PublicationFoldersService, confirmedPublication, parseCaption } from './publication-folders.service';
const req:any={user:{tenantId:randomUUID(),sub:randomUUID(),role:'OWNER'}};
describe('prepared publication safety',()=>{
 it('requires every selected network to confirm before moving a Drive file',()=>{
  expect(confirmedPublication({status:'published',platforms:[{accountId:'a',status:'published'},{accountId:'b',status:'failed'}]},['a','b'])).toBe(false);
  expect(confirmedPublication({status:'published',platforms:[]},['a'])).toBe(false);
  expect(confirmedPublication({status:'published',platforms:[{accountId:'a',status:'published'},{accountId:'b',status:'published'}]},['a','b'])).toBe(true);
 });
 it('requires an image-grounded caption instead of publishing an unverified guess',()=>{
  expect(parseCaption('{"grounded":false,"caption":"invented"}')).toBeNull();expect(parseCaption('plain text')).toBeNull();
  expect(parseCaption('{"grounded":true,"caption":"  Conteúdo visível  "}')).toBe('Conteúdo visível');
 });
 function setup(status='PREPARING'){
  const row:any={id:randomUUID(),tenantId:req.user.tenantId,userId:req.user.sub,type:'image',caption:'Legenda já informada',name:'Pronta',channelIds:[randomUUID()],status,result:{}};
  const tx:any={$queryRaw:jest.fn(),publicationFolder:{findFirst:jest.fn().mockResolvedValue({enabled:true})},preparedPublication:{updateMany:jest.fn(async({where,data}:any)=>{if(row.status!==where.status)return {count:0};Object.assign(row,data);return {count:1}})}};
  const prisma:any={$transaction:jest.fn((f:any)=>f(tx)),membership:{findFirst:jest.fn().mockResolvedValue({role:'OWNER',tenant:{slug:'test'}})},channelConnection:{findMany:jest.fn().mockResolvedValue([{id:row.channelIds[0],settings:{accountId:'account',platform:'instagram'}}])},preparedPublication:{update:jest.fn(async({data}:any)=>Object.assign(row,data))}};
  const drive:any={change:jest.fn(),download:jest.fn()},media:any={url:jest.fn().mockReturnValue('https://api.example.test/media')},zernio:any={request:jest.fn().mockResolvedValue({post:{_id:'post',status:'published',platforms:[{accountId:'account',status:'published'}]}})};
  return {row,prisma,tx,drive,media,zernio,service:new PublicationFoldersService(prisma,drive,{} as any,media,{} as any,zernio)};
 }
 it('sends once with stable idempotency and never archives before provider confirmation',async()=>{
  const x=setup();await (x.service as any).send(x.row);
  expect(x.zernio.request).toHaveBeenCalledWith('/posts',expect.objectContaining({idempotencyKey:x.row.id}));expect(x.row.status).toBe('PUBLISHED');expect(x.drive.change).not.toHaveBeenCalled();
 });
 it('keeps uncertain responses for human review without requeueing',async()=>{
  const x=setup();x.zernio.request.mockRejectedValue(new Error('timeout'));await (x.service as any).send(x.row);expect(x.row.status).toBe('NEEDS_REVIEW');expect(x.drive.change).not.toHaveBeenCalled();
 });
 it('blocks a revoked owner and a disconnected target before sending',async()=>{
  const x=setup();x.prisma.membership.findFirst.mockResolvedValue(null);await (x.service as any).send(x.row);expect(x.zernio.request).not.toHaveBeenCalled();expect(x.row.status).toBe('FAILED');
  const y=setup();y.prisma.channelConnection.findMany.mockResolvedValue([]);await (y.service as any).send(y.row);expect(y.zernio.request).not.toHaveBeenCalled();
 });
 it('blocks publication when a folder is paused during preparation',async()=>{
  const x=setup();x.row.ruleId=randomUUID();x.row.fileId='file';x.row.accountId=randomUUID();x.prisma.publicationFolder={findFirst:jest.fn().mockResolvedValue(null)};await (x.service as any).send(x.row);expect(x.zernio.request).not.toHaveBeenCalled();expect(x.drive.change).not.toHaveBeenCalled();
 });
 it('isolates list and media access to the requesting tenant',async()=>{
  const x=setup();x.prisma.preparedPublication.findFirst=jest.fn().mockResolvedValue(null);await expect(x.service.content(req,randomUUID())).rejects.toThrow();expect(x.prisma.preparedPublication.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({tenantId:req.user.tenantId})}));
 });
});
