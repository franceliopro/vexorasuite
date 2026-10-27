import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { isUUID } from 'class-validator';
import sharp from 'sharp';
import { runFfmpeg } from './video-render.service';

@Injectable()
export class PreparedMediaService {
 private path(tenantId:string,id:string,extension:string){
  if(!isUUID(tenantId)||!isUUID(id)||!['jpg','mp4','preview.jpg'].includes(extension))throw new BadRequestException('Mídia inválida.');
  return join(resolve(process.env.AUTOMATION_MEDIA_PATH||'work/automation-media'),tenantId,'prepared-'+id+'.'+extension);
 }
 async prepare(tenantId:string,id:string,mime:string,buffer:Buffer){
  if(!buffer.length||buffer.length>20*1024*1024)throw new BadRequestException('Envie até 20 MB.');
  const video=mime==='video/mp4';if(!video&&!['image/jpeg','image/png','image/webp'].includes(mime))throw new BadRequestException('Use JPG, PNG, WebP ou vídeo MP4.');
  const destination=this.path(tenantId,id,video?'mp4':'jpg');await mkdir(resolve(destination,'..'),{recursive:true});
  let bytes:Buffer,preview:Buffer;
  if(video){
   if(buffer.length<12||buffer.toString('ascii',4,8)!=='ftyp')throw new BadRequestException('O arquivo enviado não contém um MP4 válido.');
   const temp=await mkdtemp(join(tmpdir(),'vexora-ready-'));
   try{
    await writeFile(join(temp,'input.mp4'),buffer);
    await runFfmpeg(['-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-f','mov','-i',join(temp,'input.mp4'),'-map','0:v:0','-map','0:a?','-c','copy','-movflags','+faststart',join(temp,'output.mp4')]);
    await runFfmpeg(['-hide_banner','-loglevel','error','-y','-protocol_whitelist','file,pipe','-f','mov','-i',join(temp,'output.mp4'),'-frames:v','1','-vf','scale=768:-2',join(temp,'preview.jpg')]);
    bytes=await readFile(join(temp,'output.mp4'));preview=await readFile(join(temp,'preview.jpg'));
   }finally{await rm(temp,{recursive:true,force:true});}
  }else{bytes=await sharp(buffer,{limitInputPixels:40000000}).rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).jpeg({quality:92}).toBuffer();preview=await sharp(bytes).resize({width:768,height:768,fit:'inside'}).jpeg({quality:80}).toBuffer();}
  if(bytes.length>40*1024*1024)throw new BadRequestException('A mídia preparada excedeu 40 MB.');
  await writeFile(destination+'.part',bytes);await rename(destination+'.part',destination);
  await writeFile(this.path(tenantId,id,'preview.jpg'),preview);
  return {type:video?'video':'image',preview};
 }
 read(tenantId:string,id:string,type:string,preview=false){return readFile(this.path(tenantId,id,preview?'preview.jpg':type==='video'?'mp4':'jpg'));}
 private sign(tenantId:string,id:string,expires:number){const secret=process.env.AUTOMATION_MEDIA_SECRET||process.env.JWT_ACCESS_SECRET;if(!secret)throw new BadRequestException('Assinatura de mídia indisponível.');return createHmac('sha256',secret).update('prepared:'+tenantId+':'+id+':'+expires).digest('hex');}
 url(tenantId:string,id:string){const origin=process.env.API_PUBLIC_URL;if(!origin?.startsWith('https://'))throw new BadRequestException('URL pública de mídia indisponível.');const expires=Date.now()+7*86400000;return origin.replace(/\/$/,'')+'/api/marketing-media/'+tenantId+'/'+id+'?expires='+expires+'&signature='+this.sign(tenantId,id,expires);}
 verify(tenantId:string,id:string,expires:number,signature:string){if(!Number.isSafeInteger(expires)||expires<Date.now()||expires>Date.now()+8*86400000||!/^[a-f0-9]{64}$/.test(signature))return false;return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(this.sign(tenantId,id,expires),'hex'));}
}
