import { Body, Controller, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { VoiceService } from './voice.service';
@Controller('assistant/voice')
@UseGuards(AuthGuard)
export class VoiceController {
 constructor(private readonly voice:VoiceService){}
 @Post('transcribe')
 @UseInterceptors(FileInterceptor('file',{limits:{fileSize:12*1024*1024,files:1,fields:1}}))
 transcribe(@Req() req:AuthenticatedRequest,@UploadedFile() file:any,@Body() body:{agentId?:string}){return this.voice.transcribe(req,file,body?.agentId);}
 @Post('speak')
 async speak(@Req() req:AuthenticatedRequest,@Body() body:{text?:string;agentId?:string},@Res() res:Response){const buffer=await this.voice.speak(req,body?.text||'',body?.agentId);res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','private, no-store');res.send(buffer);}
 @Post('speak-preview')
 async speakPreview(@Req() req:AuthenticatedRequest,@Body() body:{text?:string;agentId?:string},@Res() res:Response){const buffer=await this.voice.speak(req,body?.text||'',body?.agentId,true);res.setHeader('Content-Type','audio/mpeg');res.setHeader('Cache-Control','private, no-store');res.send(buffer);}
}
