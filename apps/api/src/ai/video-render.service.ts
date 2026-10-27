import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isUUID } from 'class-validator';
import sharp from 'sharp';
import { instrumentalBed } from './instrumental-bed';

export function runFfmpeg(args:string[],timeout=120000):Promise<void>{
 return new Promise((resolve,reject)=>{const child=spawn(process.env.FFMPEG_PATH||'ffmpeg',args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';const timer=setTimeout(()=>child.kill(),timeout);child.stderr.on('data',chunk=>{error=(error+chunk.toString()).slice(-1000)});child.on('error',()=>{clearTimeout(timer);reject(new ServiceUnavailableException('Renderizador de vídeo indisponível.'))});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new ServiceUnavailableException('Não foi possível renderizar o vídeo.'))});});
}
@Injectable()
export class VideoRenderService {
 private path(tenantId:string,id:string){if(!isUUID(tenantId)||!isUUID(id))throw new BadRequestException('Identificador de mídia inválido.');return join(resolve(process.env.AUTOMATION_MEDIA_PATH||'work/automation-media'),tenantId,id+'.mp4');}
 async render(tenantId:string,id:string,slides:Buffer[],narration?:Buffer){
  if(slides.length<2||slides.length>7)throw new BadRequestException('Use de 2 a 7 cenas para o vídeo curto.');
  const dir=await mkdtemp(join(tmpdir(),'vexora-video-'));
  try{
   for(let i=0;i<slides.length;i++)await writeFile(join(dir,'slide-'+i+'.png'),await sharp(slides[i]).resize(720,1280,{fit:'contain',background:'#191d28'}).png().toBuffer());
   for(let i=0;i<slides.length;i++)await runFfmpeg(['-hide_banner','-loglevel','error','-y','-loop','1','-framerate','24','-i',join(dir,'slide-'+i+'.png'),'-t','6','-vf',"zoompan=z='min(1+on*0.00025,1.036)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=720x1280:fps=24,fade=t=in:st=0:d=0.25,fade=t=out:st=5.75:d=0.25,format=yuv420p",'-an','-c:v','libx264','-threads','1','-preset','veryfast','-crf','23',join(dir,'scene-'+i+'.mp4')]);
   const list=slides.map((_,i)=>"file 'scene-"+i+".mp4'").join('\n');
   await writeFile(join(dir,'scenes.txt'),list);if(narration)await writeFile(join(dir,'voice.mp3'),narration);
   await runFfmpeg(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',join(dir,'scenes.txt'),...(narration?['-i',join(dir,'voice.mp3')]:['-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100']),'-t',String(slides.length*6),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','apad','-c:a','aac','-ar','48000','-ac','2','-b:a','96k','-movflags','+faststart',join(dir,'output.mp4')]);
   const destination=this.path(tenantId,id);await mkdir(resolve(destination,'..'),{recursive:true});
   // Copy then rename within the persistent filesystem, so providers never read a partial file.
   for(let i=0;i<slides.length;i++){const scene=this.scenePath(tenantId,id,i);await writeFile(scene+'.part',await readFile(join(dir,'slide-'+i+'.png')));await rename(scene+'.part',scene);}
   await writeFile(destination+'.part',await readFile(join(dir,'output.mp4')));await rename(destination+'.part',destination);
   return {durationSeconds:slides.length*6,width:720,height:1280,visualVersion:2};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 read(tenantId:string,id:string){return readFile(this.path(tenantId,id)).catch(()=>{throw new ServiceUnavailableException('O vídeo ainda não está disponível.');});}
 async importReady(tenantId:string,id:string,buffer:Buffer){
  if(buffer.length<32||buffer.length>20*1024*1024||buffer.subarray(4,8).toString()!=='ftyp')throw new BadRequestException('Envie um vídeo MP4 válido com até 20 MB.');
  const destination=this.path(tenantId,id),dir=await mkdtemp(join(tmpdir(),'vexora-import-'));
  try{
   await writeFile(join(dir,'input.mp4'),buffer);
   await runFfmpeg(['-hide_banner','-loglevel','error','-y','-max_alloc','67108864','-f','mp4','-i',join(dir,'input.mp4'),'-t','60','-map','0:v:0','-map','0:a?','-vf','scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24','-c:v','libx264','-threads','1','-preset','veryfast','-crf','21','-c:a','aac','-ar','48000','-ac','2','-b:a','128k','-movflags','+faststart',join(dir,'output.mp4')]);
   const frame=join(dir,'poster.png');
   await runFfmpeg(['-hide_banner','-loglevel','error','-y','-i',join(dir,'output.mp4'),'-frames:v','1','-update','1',frame]);
   await mkdir(resolve(destination,'..'),{recursive:true});
   const poster=this.scenePath(tenantId,id,0);await writeFile(poster+'.part',await readFile(frame));await rename(poster+'.part',poster);
   await writeFile(destination+'.part',await readFile(join(dir,'output.mp4')));await rename(destination+'.part',destination);
   return {width:720,height:1280,visualVersion:4,imported:true};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 async renderFootage(tenantId:string,id:string,overlays:Buffer[],footage:Buffer,narration?:Buffer,music=true){
  if(overlays.length<2||overlays.length>7||!footage.length||footage.length>20*1024*1024||narration&&narration.length>20*1024*1024)throw new BadRequestException('Filmagem ou cenas fora dos limites permitidos.');
  const destination=this.path(tenantId,id),duration=overlays.length*6,dir=await mkdtemp(join(tmpdir(),'vexora-footage-'));
  try{
   await writeFile(join(dir,'footage.mp4'),footage);
   for(let i=0;i<overlays.length;i++)await writeFile(join(dir,`overlay-${i}.png`),await sharp(overlays[i],{limitInputPixels:40000000}).resize(720,1280).png().toBuffer());
   const list=overlays.map((_,i)=>`file 'overlay-${i}.png'\nduration 6`).join('\n')+`\nfile 'overlay-${overlays.length-1}.png'\n`;
   await writeFile(join(dir,'overlays.txt'),list);
   if(narration)await writeFile(join(dir,'voice.audio'),narration);
   if(music)await writeFile(join(dir,'music.wav'),instrumentalBed(duration));
   const video='[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24[bg];[1:v]fps=24,format=rgba[ov];[bg][ov]overlay=shortest=1:format=auto,format=yuv420p[v]';
   const audio=music?'[2:a]loudnorm=I=-16:TP=-2:LRA=7,apad[voice];[3:a]volume=0.16[bed];[voice][bed]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[a]':'[2:a]apad[a]';
   await runFfmpeg(['-hide_banner','-loglevel','error','-y','-max_alloc','67108864','-stream_loop','-1','-f','mp4','-i',join(dir,'footage.mp4'),'-f','concat','-safe','0','-i',join(dir,'overlays.txt'),...(narration?['-i',join(dir,'voice.audio')]:['-f','lavfi','-i','anullsrc=channel_layout=mono:sample_rate=24000']),...(music?['-i',join(dir,'music.wav')]:[]),'-filter_complex_threads','1','-filter_complex',video+';'+audio,'-map','[v]','-map','[a]','-t',String(duration),'-c:v','libx264','-threads','1','-preset','veryfast','-crf','23','-c:a','aac','-ar','48000','-ac','2','-b:a','128k','-movflags','+faststart',join(dir,'output.mp4')]);
   await mkdir(resolve(destination,'..'),{recursive:true});
   for(let i=0;i<overlays.length;i++){
    const frame=join(dir,`scene-${i}.png`),target=this.scenePath(tenantId,id,i);
    await runFfmpeg(['-hide_banner','-loglevel','error','-y','-ss',String(i*6+1),'-i',join(dir,'output.mp4'),'-frames:v','1','-update','1',frame]);
    await writeFile(target+'.part',await readFile(frame));await rename(target+'.part',target);
   }
   await writeFile(destination+'.part',await readFile(join(dir,'output.mp4')));await rename(destination+'.part',destination);
   return {durationSeconds:duration,width:720,height:1280,visualVersion:3,narrated:!!narration,backgroundMusic:music};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 private scenePath(tenantId:string,id:string,index:number){if(!Number.isInteger(index)||index<0||index>6)throw new BadRequestException('Cena inválida.');return this.path(tenantId,id).replace(/\.mp4$/,`-scene-${index}.png`);}
 readScene(tenantId:string,id:string,index:number){return readFile(this.scenePath(tenantId,id,index)).catch(()=>{throw new ServiceUnavailableException('A cena ainda não está disponível.');});}
}
