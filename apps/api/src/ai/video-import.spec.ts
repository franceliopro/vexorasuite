import { AssistantAutomationService } from './assistant-automation.service';
import { instrumentalBed } from './instrumental-bed';
import { footageOverlay } from './video-scenes';
import sharp from 'sharp';

describe('ready video drafts and original audio bed',()=>{
 const req:any={user:{role:'OWNER',tenantId:'company',sub:'owner'}};
 const file={buffer:Buffer.from('video'),mimetype:'video/mp4',size:5};
 function setup(){const prisma:any={auditLog:{create:jest.fn().mockResolvedValue({id:'audit'}),update:jest.fn()}};const video:any={importReady:jest.fn().mockResolvedValue({visualVersion:4})};const zernio:any={request:jest.fn()};return {prisma,video,zernio,service:new AssistantAutomationService(prisma,{} as any,zernio,{} as any,video)};}
 it('saves a tenant-owned draft without sending it to the social provider',async()=>{
  const x=setup();expect((await x.service.importVideo(req,{title:'Rastreabem',caption:'Gestão de frotas'},file)).status).toBe('DRAFT');
  expect(x.prisma.auditLog.create.mock.calls[0][0].data.tenantId).toBe('company');expect(x.prisma.auditLog.update.mock.calls[0][0].data.details.status).toBe('DRAFT');expect(x.zernio.request).not.toHaveBeenCalled();
 });
 it('rejects agents and oversized or invalid inputs before creating a draft',async()=>{
  const x=setup();await expect(x.service.importVideo({user:{role:'AGENT'}} as any,{title:'A',caption:'B'},file)).rejects.toThrow();
  await expect(x.service.importVideo(req,{title:'A',caption:'B'},{...file,size:21*1024*1024})).rejects.toThrow();
  await expect(x.service.importVideo(req,{title:'',caption:'B'},file)).rejects.toThrow();expect(x.prisma.auditLog.create).not.toHaveBeenCalled();
 });
 it('marks a failed conversion instead of exposing it as ready to publish',async()=>{
  const x=setup();x.video.importReady.mockRejectedValue(new Error('invalid media'));
  await expect(x.service.importVideo(req,{title:'A',caption:'B'},file)).rejects.toThrow();expect(x.prisma.auditLog.update.mock.calls[0][0].data.details.status).toBe('FAILED');
 });
 it('creates bounded PCM instrumental audio locally',()=>{
  const wav=instrumentalBed(2);expect(wav.subarray(0,4).toString()).toBe('RIFF');expect(wav.subarray(8,12).toString()).toBe('WAVE');expect(wav.length).toBe(44+2*24000*2);expect(()=>instrumentalBed(60)).toThrow();
 });
 it('keeps the road visible through the gradient and renders short text',async()=>{
  const buffer=await footageOverlay({title:'Sua frota sob controle',body:'Not shown'},0,5,'#ff7900','Rastreabem');
  const metadata=await sharp(buffer).metadata();expect(metadata.hasAlpha).toBe(true);expect(metadata.width).toBe(720);
  const pixel=await sharp(buffer).extract({left:360,top:500,width:1,height:1}).raw().toBuffer();expect(pixel[3]).toBeLessThan(100);
 });
});
