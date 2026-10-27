import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isUUID } from 'class-validator';
import sharp from 'sharp';

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
   await runFfmpeg(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',join(dir,'scenes.txt'),...(narration?['-i',join(dir,'voice.mp3')]:['-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100']),'-t',String(slides.length*6),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af','apad','-c:a','aac','-b:a','96k','-movflags','+faststart',join(dir,'output.mp4')]);
   const destination=this.path(tenantId,id);await mkdir(resolve(destination,'..'),{recursive:true});
   // Copy then rename within the persistent filesystem, so providers never read a partial file.
   for(let i=0;i<slides.length;i++){const scene=this.scenePath(tenantId,id,i);await writeFile(scene+'.part',await readFile(join(dir,'slide-'+i+'.png')));await rename(scene+'.part',scene);}
   await writeFile(destination+'.part',await readFile(join(dir,'output.mp4')));await rename(destination+'.part',destination);
   return {durationSeconds:slides.length*6,width:720,height:1280,visualVersion:2};
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 read(tenantId:string,id:string){return readFile(this.path(tenantId,id)).catch(()=>{throw new ServiceUnavailableException('O vídeo ainda não está disponível.');});}
 private scenePath(tenantId:string,id:string,index:number){if(!Number.isInteger(index)||index<0||index>6)throw new BadRequestException('Cena inválida.');return this.path(tenantId,id).replace(/\.mp4$/,`-scene-${index}.png`);}
 readScene(tenantId:string,id:string,index:number){return readFile(this.scenePath(tenantId,id,index)).catch(()=>{throw new ServiceUnavailableException('A cena ainda não está disponível.');});}
}
