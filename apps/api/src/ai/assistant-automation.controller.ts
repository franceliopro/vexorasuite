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
 async slide(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Param('index',ParseIntPipe) index:number,@Res() res:Response){res.setHeader('Content-Type',index===-1?'video/mp4':'image/png');res.setHeader('Cache-Control','private, no-store');res.send(await this.automation.preview(req,id,index));}
 @Post(':id/publish')
 publish(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() body:{channelId?:string;scheduledFor?:string}){return this.automation.publish(req,id,body||{});}
}
/** Signed media capability for provider fetches. Never exposes an unauthenticated generic file endpoint. */
@Controller('assistant/automation-media')
export class AssistantAutomationMediaController {
 constructor(private readonly automation:AssistantAutomationService){}
 @Get(':tenantId/:id/:index')
 async media(@Param('tenantId',ParseUUIDPipe) tenantId:string,@Param('id',ParseUUIDPipe) id:string,@Param('index',ParseIntPipe) index:number,@Query('expires') expires:string,@Query('signature') signature:string,@Res() res:Response){const buffer=await this.automation.media(tenantId,id,index,Number(expires),signature||'');res.setHeader('Content-Type',index===-1?'video/mp4':'image/png');res.setHeader('Cache-Control','private, no-store');res.send(buffer);}
}
