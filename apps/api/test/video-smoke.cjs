const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {VideoRenderService}=require('../dist/ai/video-render.service');
const {composeVideoScene}=require('../dist/ai/video-scenes');
(async()=>{const renderer=new VideoRenderService();const tenantId=randomUUID(),id=randomUUID();const photo=await sharp({create:{width:600,height:400,channels:3,background:'#5865da'}}).png().toBuffer();const slide=await composeVideoScene({title:'Acompanhe sua frota',body:'Uma ideia por cena, com imagem da biblioteca.'},0,2,'#5865da','Véxora',photo);const result=await renderer.render(tenantId,id,[slide,slide]);const bytes=await renderer.read(tenantId,id);assert.equal(result.durationSeconds,12);assert.equal(result.visualVersion,2);assert(bytes.length>1000);assert(bytes.subarray(4,8).toString()==='ftyp');const frame=await renderer.readScene(tenantId,id,0);assert.equal((await sharp(frame).metadata()).height,1280);console.log('FFmpeg: animated vertical H.264/AAC MP4 and composed reference scenes persisted');})().catch(e=>{console.error(e);process.exitCode=1});
