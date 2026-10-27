const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {PreparedMediaService}=require('../dist/ai/prepared-media.service');
const {runFfmpeg}=require('../dist/ai/video-render.service');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vexora-ready-smoke-'));
 try{
  process.env.AUTOMATION_MEDIA_PATH=path.join(dir,'media');process.env.API_PUBLIC_URL='https://api.example.test';process.env.JWT_ACCESS_SECRET='ci-media-secret';
  const service=new PreparedMediaService(),tenant=randomUUID(),image=randomUUID(),video=randomUUID();
  const input=await sharp({create:{width:720,height:960,channels:3,background:'#6658d3'}}).png().toBuffer();
  assert.equal((await service.prepare(tenant,image,'image/png',input)).type,'image');assert.equal((await sharp(await service.read(tenant,image,'image')).metadata()).width,720);
  await runFfmpeg(['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=320x240:r=24:d=2','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',path.join(dir,'input.mp4')]);
  assert.equal((await service.prepare(tenant,video,'video/mp4',await fs.readFile(path.join(dir,'input.mp4')))).type,'video');
  assert((await service.read(tenant,video,'video')).length>1000);assert((await sharp(await service.read(tenant,video,'video',true)).metadata()).width>0);
  const url=new URL(service.url(tenant,video));assert(service.verify(tenant,video,Number(url.searchParams.get('expires')),url.searchParams.get('signature')));assert(!service.verify(randomUUID(),video,Number(url.searchParams.get('expires')),url.searchParams.get('signature')));
  console.log('Prepared image, preserved MP4, real preview and tenant-bound signed URL passed');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
