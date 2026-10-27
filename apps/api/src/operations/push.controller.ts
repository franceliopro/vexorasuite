import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PushService } from './push.service';
@Controller('notifications/push')
@UseGuards(AuthGuard)
export class PushController{
 constructor(private readonly push:PushService){}
 @Get('key')async key(@Req()req:AuthenticatedRequest){return {publicKey:(await this.push.keys(req.user.tenantId)).publicKey}}
 @Post('subscribe')subscribe(@Req()req:AuthenticatedRequest,@Body()body:unknown){return this.push.subscribe(req,body)}
 @Delete('subscribe')unsubscribe(@Req()req:AuthenticatedRequest,@Body()body:{endpoint?:unknown}){return this.push.unsubscribe(req,body.endpoint)}
 @Post('test')test(@Req()req:AuthenticatedRequest,@Body()body:{endpoint?:unknown}){return this.push.test(req,body.endpoint)}
}
