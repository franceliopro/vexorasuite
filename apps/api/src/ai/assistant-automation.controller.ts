import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AssistantAutomationService } from './assistant-automation.service';
@Controller('assistant/automations')
@UseGuards(AuthGuard)
export class AssistantAutomationController {
 constructor(private readonly automation:AssistantAutomationService){}
 @Get() list(@Req() req:AuthenticatedRequest){return this.automation.list(req);}
 @Get(':id')
 async read(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){const data=await this.automation.read(req,id);return {id,details:data.details};}
 @Get(':id/slides/:index')
 async slide(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Param('index',ParseIntPipe) index:number,@Res() res:Response){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','private, no-store');res.send(await this.automation.preview(req,id,index));}
}
