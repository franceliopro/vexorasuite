import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { DriveManagerService } from './drive-manager.service';
@Controller('drive-manager')
@UseGuards(AuthGuard)
export class DriveManagerController {
 constructor(private readonly drive:DriveManagerService){}
 @Get('accounts') accounts(@Req() req:AuthenticatedRequest){return this.drive.accounts(req);}
 @Get(':accountId/files') list(@Req() req:AuthenticatedRequest,@Param('accountId',ParseUUIDPipe) accountId:string,@Query() query:any){return this.drive.list(req,accountId,query);}
 @Post(':accountId/folders') folder(@Req() req:AuthenticatedRequest,@Param('accountId',ParseUUIDPipe) accountId:string,@Body() input:any){return this.drive.folder(req,accountId,input||{});}
 @Patch(':accountId/files/:id') change(@Req() req:AuthenticatedRequest,@Param('accountId',ParseUUIDPipe) accountId:string,@Param('id') id:string,@Body() input:any){return this.drive.change(req,accountId,id,input||{});}
 @Post(':accountId/upload')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:20*1024*1024,files:1,fields:1}}))
 upload(@Req() req:AuthenticatedRequest,@Param('accountId',ParseUUIDPipe) accountId:string,@Body() input:any,@UploadedFile() file:any){return this.drive.upload(req,accountId,input?.parent||'root',file);}
 @Get(':accountId/files/:id/download')
 async download(@Req() req:AuthenticatedRequest,@Param('accountId',ParseUUIDPipe) accountId:string,@Param('id') id:string,@Res() res:Response){const file=await this.drive.download(req,accountId,id);res.setHeader('Content-Type',file.type);res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.name));res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');res.send(file.buffer);}
}
