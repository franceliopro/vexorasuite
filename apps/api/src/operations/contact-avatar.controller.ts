import { Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import sharp from 'sharp';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { WahaService } from './waha.service';
export function publicPhotoUrl(value:unknown){
 if(typeof value!=='string')return null;
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
  const domains=['whatsapp.net','fbcdn.net','fbsbx.com','cdninstagram.com','googleusercontent.com'];
  return domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.toString():null;
 }catch{return null;}
}
@Controller('contacts')
@UseGuards(AuthGuard)
export class ContactAvatarController {
 private cache=new Map<string,{expires:number;buffer:Buffer|null}>();
 constructor(private readonly prisma:PrismaService,private readonly waha:WahaService){}
 @Get(':id/avatar')
 async avatar(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Res() res:Response){
  const contact=await this.prisma.contact.findFirst({where:{id,tenantId:req.user.tenantId}});if(!contact)return res.status(404).end();
  const cacheKey=req.user.tenantId+':'+id;let cached=this.cache.get(cacheKey);
  if(!cached||cached.expires<Date.now()){
   let buffer:Buffer|null=null;const meta=contact.metadata&&typeof contact.metadata==='object'&&!Array.isArray(contact.metadata)?contact.metadata as Record<string,unknown>:{};
   try{
    const url=publicPhotoUrl(meta.avatarUrl||meta.profilePictureUrl||meta.photoUrl);
    if(url){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000)});if(r.ok&&Number(r.headers.get('content-length')||0)<=1024*1024){const reader=r.body?.getReader();if(reader){const chunks:Buffer[]=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024*1024)throw Error();chunks.push(Buffer.from(part.value));}buffer=Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}}}
    if(!buffer){const conversation=await this.prisma.conversation.findFirst({where:{tenantId:req.user.tenantId,contactId:id,channelConnection:{is:{tenantId:req.user.tenantId,provider:'WAHA',isActive:true}}},include:{channelConnection:true},orderBy:{updatedAt:'desc'}});if(conversation?.channelConnection&&contact.externalId)buffer=await this.waha.contactPhoto(conversation.channelConnection,contact.externalId);}
    if(buffer)buffer=await sharp(buffer,{limitInputPixels:16000000}).resize(96,96,{fit:'cover'}).webp({quality:80}).toBuffer();
   }catch{buffer=null;}
   cached={buffer,expires:Date.now()+5*60000};if(this.cache.size>=500)this.cache.delete(this.cache.keys().next().value!);this.cache.set(cacheKey,cached);
  }
  res.setHeader('Cache-Control','private, max-age=300');res.setHeader('X-Content-Type-Options','nosniff');
  return cached.buffer?res.type('image/webp').send(cached.buffer):res.status(404).end();
 }
}
