import {BadRequestException,Body,Controller,ForbiddenException,Get,Post,Req,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
import {mutateTenantSetting} from '../prisma/tenant-settings';
@Controller('notification-settings') @UseGuards(AuthGuard)
export class NotificationSettingsController{
 constructor(private readonly prisma:PrismaService){}
 private admin(req:AuthenticatedRequest){if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Somente administradores configuram as notificações.');}
 @Get() async read(@Req() req:AuthenticatedRequest){this.admin(req);const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}}),root=tenant.integrations as Record<string,any>,settings=root.notificationRouting||{};return {users:settings.users!==false,departments:settings.departments!==false,botNotifications:false};}
 @Post() async save(@Req() req:AuthenticatedRequest,@Body() body:any){this.admin(req);if(typeof body?.users!=='boolean'||typeof body?.departments!=='boolean')throw new BadRequestException('Selecione as notificações por usuário e departamento.');await mutateTenantSetting(this.prisma,req.user.tenantId,'notificationRouting',()=>({users:body.users,departments:body.departments}));return {saved:true};}
}
