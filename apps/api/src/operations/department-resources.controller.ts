import {Body,Controller,Get,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {DepartmentResourcesService} from './department-resources.service';
@Controller('department-resources') @UseGuards(AuthGuard)
export class DepartmentResourcesController{
 constructor(private readonly resources:DepartmentResourcesService){}
 @Get() list(@Req() req:AuthenticatedRequest){return this.resources.list(req);}
 @Get('context') context(@Req() req:AuthenticatedRequest,@Query() query:any){return this.resources.context(req,query);}
 @Post() configure(@Req() req:AuthenticatedRequest,@Body() body:any){return this.resources.configure(req,body||{});}
}
