import { BadRequestException, Controller, Get, Post, Req, Res, UploadedFile, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import sharp from 'sharp';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAccessService } from './google-access.service';
import { mutateTenantSetting } from '../prisma/tenant-settings';
import { publicPhotoUrl } from './contact-avatar.controller';
@Controller('profile')
@UseGuards(AuthGuard)
export class UserProfileController {
 constructor(private readonly prisma:PrismaService,private readonly google:GoogleAccessService){}
 @Get() async profile(@Req() req:AuthenticatedRequest){const user=await this.prisma.user.findUniqueOrThrow({where:{id:req.user.sub},select:{name:true,email:true}});const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});const root=tenant.integrations as any;return {...(root?.userProfiles?.[req.user.sub]||{}),...user};}
 @Post() async saveProfile(@Req() req:AuthenticatedRequest,@Body() input:any){const name=typeof input.name==='string'?input.name.trim():'';if(name.length<2||name.length>160)throw new BadRequestException('Nome inválido.');for(const [key,max] of [['phone',30],['jobTitle',100],['bio',500]] as const)if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>max))throw new BadRequestException('Campo de perfil inválido.');await mutateTenantSetting(this.prisma,req.user.tenantId,'userProfiles',(raw:any)=>({...raw,[req.user.sub]:{phone:input.phone||'',jobTitle:input.jobTitle||'',bio:input.bio||''}}));await this.prisma.user.update({where:{id:req.user.sub},data:{name}});return {saved:true};}
 @Post('photo')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:2*1024*1024,files:1,fields:0}}))
 async upload(@Req() req:AuthenticatedRequest,@UploadedFile() file?:{buffer:Buffer}){
  if(!file?.buffer?.length)throw new BadRequestException('Envie uma imagem de até 2 MB.');
  let buffer:Buffer;try{buffer=await sharp(file.buffer,{limitInputPixels:16000000}).rotate().resize(160,160,{fit:'cover'}).webp({quality:85}).toBuffer();}catch{throw new BadRequestException('Imagem inválida.');}
  await this.prisma.user.update({where:{id:req.user.sub},data:{avatarUrl:'data:image/webp;base64,'+buffer.toString('base64'),avatarSource:'UPLOAD',avatarCheckedAt:new Date()}});return {updated:true};
 }
 @Post('google-photo')
 async sync(@Req() req:AuthenticatedRequest){
  const user=await this.prisma.user.findUniqueOrThrow({where:{id:req.user.sub}});
  const account=await this.prisma.googleConnection.findFirst({where:{tenantId:req.user.tenantId,email:user.email},orderBy:{updatedAt:'desc'}});
  if(!account)throw new BadRequestException('Conecte uma conta Google com o mesmo e-mail do seu usuário.');
  if(user.avatarSource==='GOOGLE'&&user.avatarCheckedAt&&user.avatarCheckedAt.getTime()>Date.now()-5*60000)return {updated:false};
  const service=account.scopes.includes('/drive')&&!account.disabledServices.includes('drive')?'drive':'calendar';
  const token=await this.google.token(req.user.tenantId,account.id,service);
  const response=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(8000)});
  const data=await response.json() as any;
  if(!response.ok||data.email?.toLowerCase()!==user.email.toLowerCase()||data.email_verified!==true||data.sub!==account.googleAccountId)throw new BadRequestException('O Google não confirmou a identidade desta conta.');
  const url=publicPhotoUrl(data.picture);if(!url)throw new BadRequestException('Foto não disponibilizada pelo Google. Reconecte para permitir acesso ao perfil.');
  // Store a small image, not an expiring third-party URL. Never follow redirects.
  const image=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(8000)});if(!image.ok)throw new BadRequestException('Foto indisponível.');
  const reader=image.body?.getReader();if(!reader)throw new BadRequestException('Foto vazia.');const chunks:Buffer[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2*1024*1024)throw new BadRequestException('Foto muito grande.');chunks.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const buffer=await sharp(Buffer.concat(chunks),{limitInputPixels:16000000}).resize(160,160,{fit:'cover'}).webp({quality:85}).toBuffer();
  await this.prisma.user.update({where:{id:user.id},data:{avatarUrl:'data:image/webp;base64,'+buffer.toString('base64'),avatarSource:'GOOGLE',avatarCheckedAt:new Date()}});return {updated:true};
 }
}
