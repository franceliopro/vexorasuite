const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {VideoRenderService}=require('../dist/ai/video-render.service');
(async()=>{const renderer=new VideoRenderService();const tenantId=randomUUID(),id=randomUUID();const slide=await sharp({create:{width:720,height:1280,channels:3,background:'#5865da'}}).png().toBuffer();const result=await renderer.render(tenantId,id,[slide,slide]);const bytes=await renderer.read(tenantId,id);assert.equal(result.durationSeconds,12);assert(bytes.length>1000);assert(bytes.subarray(4,8).toString()==='ftyp');console.log('FFmpeg: vertical H.264/AAC MP4 rendered and read from persistent media directory');})().catch(e=>{console.error(e);process.exitCode=1});
