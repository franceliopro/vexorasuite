const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {VideoRenderService,runFfmpeg}=require('../dist/ai/video-render.service');
const {composeVideoScene,footageOverlay}=require('../dist/ai/video-scenes');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
(async()=>{const renderer=new VideoRenderService();const tenantId=randomUUID(),id=randomUUID();const photo=await sharp({create:{width:600,height:400,channels:3,background:'#5865da'}}).png().toBuffer();const slide=await composeVideoScene({title:'Acompanhe sua frota',body:'Uma ideia por cena, com imagem da biblioteca.'},0,2,'#5865da','Véxora',photo);const result=await renderer.render(tenantId,id,[slide,slide]);const bytes=await renderer.read(tenantId,id);assert.equal(result.durationSeconds,12);assert.equal(result.visualVersion,2);assert(bytes.length>1000);assert(bytes.subarray(4,8).toString()==='ftyp');const frame=await renderer.readScene(tenantId,id,0);assert.equal((await sharp(frame).metadata()).height,1280);console.log('FFmpeg: animated vertical H.264/AAC MP4 and composed reference scenes persisted');})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 const dir=await mkdtemp(join(tmpdir(),'vexora-footage-smoke-'));
 try{
  const input=join(dir,'synthetic.mp4');await runFfmpeg(['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=720x1280:rate=24','-t','2','-c:v','libx264','-threads','1','-preset','ultrafast','-pix_fmt','yuv420p',input]);
  const renderer=new VideoRenderService(),tenant=randomUUID(),id=randomUUID();const overlay=await footageOverlay({title:'Gestão de frotas',body:''},0,2,'#ff7900','Rastreabem');
  const result=await renderer.renderFootage(tenant,id,[overlay,overlay],await readFile(input),undefined,true);
  assert.equal(result.visualVersion,3);assert.equal(result.backgroundMusic,true);assert.equal(result.durationSeconds,12);
  const converted=randomUUID();await renderer.importReady(tenant,converted,await renderer.read(tenant,id));
  assert.equal((await sharp(await renderer.readScene(tenant,converted,0)).metadata()).height,1280);
  console.log('FFmpeg: moving footage, transparent overlays, original music and ready video import OK');
 }finally{await rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
