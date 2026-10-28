import {BadRequestException,Body,Controller,Get,Patch,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {Prisma} from '@prisma/client';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {assertDraftInput} from '../auth/product-scope';
import {MarketingLibraryService} from './marketing-library.service';
import {AssistantAutomationService} from './assistant-automation.service';
@Controller('marketing')
@UseGuards(AuthGuard)
export class MarketingController{
 constructor(private readonly library:MarketingLibraryService,private readonly automation:AssistantAutomationService,private readonly prisma:PrismaService){}
 @Get('library') config(@Req() req:AuthenticatedRequest){return this.library.config(req);}
 @Post('library') save(@Req() req:AuthenticatedRequest,@Body() input:any){
  if(input?.autoPublish===true)throw new BadRequestException('A publicação automática foi retirada.');
  return this.library.save(req,{...input,autoPublish:false});
 }
 @Post('library/sync') async sync(@Req() req:AuthenticatedRequest){await this.library.sync(req,true);return {answer:'Referências sincronizadas.'};}
 @Patch('drafts/:id/review') async review(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){
  if(typeof input?.caption!=='string'||!input.caption.trim()||input.caption.length>2000||typeof input.approved!=='boolean'||typeof input.plannedFor!=='string'||input.plannedFor!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.plannedFor)||!Number.isFinite(Date.parse(input.plannedFor))||new Date(input.plannedFor).toISOString().slice(0,10)!==input.plannedFor))throw new BadRequestException('Revisão inválida.');
  const record=await this.automation.read(req,id);const details=record.details as Prisma.JsonObject;
  if(!['DRAFT','MANUAL_READY'].includes(String(details.status)))throw new BadRequestException('Este conteúdo faz parte do histórico e não pode ser alterado.');
  const updated=await this.prisma.auditLog.updateMany({where:{id:record.id,tenantId:req.user.tenantId,details:{equals:record.details!}},data:{details:{...details,status:input.approved?'MANUAL_READY':'DRAFT',carousel:{...(details.carousel as Prisma.JsonObject),caption:input.caption.trim()},manualReview:{approved:input.approved,plannedFor:input.plannedFor,reviewedBy:req.user.sub,reviewedAt:new Date().toISOString()}}}});
  if(!updated.count)throw new BadRequestException('O conteúdo mudou em outra janela. Reabra para revisar.');
  return {saved:true};
 }
 @Post('drafts') draft(@Req() req:AuthenticatedRequest,@Body() input:any){
  this.automation.authorize(req);assertDraftInput(input);
  return this.automation.createCarousel(req,input.question,{format:input.format,draftOnly:true,useBrandOnly:input.useBrandOnly!==false});
 }
}
