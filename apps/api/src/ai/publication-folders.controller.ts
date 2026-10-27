import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PublicationFoldersService } from './publication-folders.service';
@Controller('marketing/prepared')
@UseGuards(AuthGuard)
export class PublicationFoldersController {
 constructor(private readonly service:PublicationFoldersService){}
 @Get() list(@Req() req:AuthenticatedRequest){return this.service.list(req);}
 @Post('folders') save(@Req() req:AuthenticatedRequest,@Body() input:any){return this.service.save(req,input||{});}
 @Patch('folders/:id') toggle(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){return this.service.toggle(req,id,input?.enabled);}
 @Post('upload')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:20*1024*1024,files:1,fields:3}}))
 upload(@Req() req:AuthenticatedRequest,@Body() input:any,@UploadedFile() file:any){return this.service.upload(req,input||{},file);}
 @Post(':id/retry') retry(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){return this.service.retry(req,id);}
 @Get(':id/content')
 async content(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Query('preview') preview:string,@Res() res:Response){const file=await this.service.content(req,id,preview==='true');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.type(file.type).send(file.buffer);}
}
@Controller('marketing-media')
export class PreparedMediaController {
 constructor(private readonly service:PublicationFoldersService){}
 @Get(':tenantId/:id')
 async content(@Param('tenantId',ParseUUIDPipe) tenantId:string,@Param('id',ParseUUIDPipe) id:string,@Query('expires') expires:string,@Query('signature') signature:string,@Res() res:Response){
  const file=await this.service.publicContent(tenantId,id,Number(expires),signature||'');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.type(file.type).send(file.buffer);
 }
}
