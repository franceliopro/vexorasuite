import { Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CreativeReferencesService, ReferenceInput } from './creative-references.service';
class CreativeAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) { if (!['OWNER','ADMIN'].includes(context.switchToHttp().getRequest().user?.role)) throw new ForbiddenException('Biblioteca criativa restrita à administração.'); return true; }
}
@Controller('creative-references')
@UseGuards(AuthGuard, CreativeAdminGuard)
export class CreativeReferencesController {
  constructor(private readonly references: CreativeReferencesService) {}
  @Get() list(@Req() req: AuthenticatedRequest) { return this.references.list(req); }
  @Get('accounts') accounts(@Req() req: AuthenticatedRequest) { return this.references.accounts(req); }
  @Post('import') import(@Req() req: AuthenticatedRequest,@Body() body:ReferenceInput) { return this.references.import(req,body||{}); }
  @Post('upload')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:20*1024*1024,files:1,fields:4}}))
  upload(@Req() req:AuthenticatedRequest,@Body() body:ReferenceInput,@UploadedFile() file:{buffer:Buffer;size:number;mimetype:string;originalname:string}) { return this.references.upload(req,body||{},file); }
  @Delete(':id') remove(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){return this.references.remove(req,id);}
  @Post(':id/restore') restore(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){return this.references.restore(req,id);}
  @Patch(':id') update(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() body:ReferenceInput) { return this.references.update(req,id,body||{}); }
  @Post(':id/analyze') analyze(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string) { return this.references.analyze(req,id); }
  @Get(':id/content')
  async content(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Res() res:Response) {
    const {row,buffer}=await this.references.bytes(req,id);
    res.setHeader('Content-Type',row.mimeType);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`);res.send(buffer);
  }
}
