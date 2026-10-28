import {BadRequestException,Body,ConflictException,Controller,ForbiddenException,Get,NotFoundException,Post,Query,Req,Res,StreamableFile,UploadedFiles,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileFieldsInterceptor} from '@nestjs/platform-express';
import {Response} from 'express';
import sharp from 'sharp';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
export const PRESENTATION_MODES=['contain','cover','center','stretch','zoom','tile'];
type Upload={buffer:Buffer;mimetype:string};
export async function presentationImage(file:Upload|undefined){
 if(!file)return undefined;
 if(!['image/png','image/jpeg','image/webp'].includes(file.mimetype)||file.buffer.length>2*1024*1024)throw new BadRequestException('Use PNG, JPG ou WebP de até 2 MB.');
 try{
  const image=sharp(file.buffer,{limitInputPixels:40_000_000,animated:false}),metadata=await image.metadata();
  if(!['png','jpeg','webp'].includes(metadata.format||'')||(metadata.pages||1)>1)throw Error('Unsupported image');
  const bytes=await image.rotate().resize({width:2560,height:2560,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
  if(bytes.length>1536*1024)throw Error('Image too large');
  return Uint8Array.from(bytes);
 }catch{throw new BadRequestException('A imagem não pôde ser preparada. Use uma imagem estática PNG, JPG ou WebP menor.');}
}
@Controller('home-presentation') @UseGuards(AuthGuard)
export class HomePresentationController{
 constructor(private readonly prisma:PrismaService){}
 private canEdit(req:AuthenticatedRequest){return req.user.isPlatformAdmin===true||['OWNER','ADMIN'].includes(req.user.role)&&req.user.allowedModules?.includes('SETTINGS')===true;}
 private result(req:AuthenticatedRequest,row:any){
  const source=(device:string,present:boolean)=>present?'/api/backend/home-presentation/image?device='+device+'&context='+encodeURIComponent(req.user.tenantId)+'&v='+row.revision:null;
  return {revision:row?.revision||0,canEdit:this.canEdit(req),desktop:{image:source('desktop',!!row?.desktopImage),mode:row?.desktopMode||'center',color:row?.desktopColor||null},mobile:{image:source('mobile',!!row?.mobileImage),mode:row?.mobileMode||'center',color:row?.mobileColor||null}};
 }
 @Get() async read(@Req() req:AuthenticatedRequest){return this.result(req,await this.prisma.homePresentation.findUnique({where:{tenantId:req.user.tenantId}}));}
 @Get('image') async image(@Req() req:AuthenticatedRequest,@Query('device') device:string,@Query('context') context:string,@Res({passthrough:true}) response:Response){
  if(!['desktop','mobile'].includes(device)||context!==req.user.tenantId)throw new NotFoundException('Imagem não encontrada.');
  const row=await this.prisma.homePresentation.findUnique({where:{tenantId:req.user.tenantId}});
  const bytes=device==='desktop'?row?.desktopImage:row?.mobileImage;
  if(!bytes)throw new NotFoundException('Imagem não encontrada.');
  response.set({'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  return new StreamableFile(Buffer.from(bytes));
 }
 @Post() @UseInterceptors(FileFieldsInterceptor([{name:'desktop',maxCount:1},{name:'mobile',maxCount:1}],{limits:{fileSize:2*1024*1024,files:2,fields:7,parts:9,fieldSize:100,fieldNameSize:64}}))
 async save(@Req() req:AuthenticatedRequest,@Body() input:any,@UploadedFiles() files:{desktop?:Upload[];mobile?:Upload[]}={}){
  if(!this.canEdit(req))throw new ForbiddenException('Somente responsáveis pela configuração podem alterar esta apresentação.');
  if(typeof input?.desktopColor!=='string'||!/^#[0-9a-f]{6}$/i.test(input.desktopColor)||typeof input?.mobileColor!=='string'||!/^#[0-9a-f]{6}$/i.test(input.mobileColor)||!PRESENTATION_MODES.includes(input?.desktopMode)||!PRESENTATION_MODES.includes(input?.mobileMode)||!/^\d{1,9}$/.test(input?.revision||'')||!['true','false'].includes(input.desktopRemove)||!['true','false'].includes(input.mobileRemove))throw new BadRequestException('Selecione as opções de apresentação válidas.');
  if(files.desktop?.length&&input.desktopRemove==='true'||files.mobile?.length&&input.mobileRemove==='true')throw new BadRequestException('Escolha substituir ou excluir cada imagem.');
  const [desktop,mobile]=await Promise.all([presentationImage(files.desktop?.[0]),presentationImage(files.mobile?.[0])]);
  const row=await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
   const current=await tx.homePresentation.findUnique({where:{tenantId:req.user.tenantId}});
   if((current?.revision||0)!==Number(input.revision))throw new ConflictException('A apresentação foi alterada em outra janela. Reabra a edição para carregar a versão atual.');
   const changes={desktopColor:input.desktopColor.toUpperCase(),mobileColor:input.mobileColor.toUpperCase(),desktopMode:input.desktopMode,mobileMode:input.mobileMode,...(desktop?{desktopImage:desktop}:input.desktopRemove==='true'?{desktopImage:null}:{}),...(mobile?{mobileImage:mobile}:input.mobileRemove==='true'?{mobileImage:null}:{})};
   const row=await tx.homePresentation.upsert({where:{tenantId:req.user.tenantId},create:{tenantId:req.user.tenantId,...changes,revision:1},update:{...changes,revision:{increment:1}}});
   await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'home.presentation.updated',entityType:'tenant',entityId:req.user.tenantId,details:{desktopMode:input.desktopMode,mobileMode:input.mobileMode,desktopChanged:!!desktop||input.desktopRemove==='true',mobileChanged:!!mobile||input.mobileRemove==='true'}}});
   return row;
  });
  return this.result(req,row);
 }
}
