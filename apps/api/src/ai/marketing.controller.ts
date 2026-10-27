import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { MarketingJobsService } from './marketing-jobs.service';
import { MarketingLibraryService } from './marketing-library.service';
@Controller('marketing')
@UseGuards(AuthGuard)
export class MarketingController {
 constructor(private readonly jobs:MarketingJobsService,private readonly library:MarketingLibraryService){}
 @Get('library') config(@Req() req:AuthenticatedRequest){return this.library.config(req);}
 @Post('library') save(@Req() req:AuthenticatedRequest,@Body() input:any){return this.library.save(req,input||{});}
 @Post('library/sync') sync(@Req() req:AuthenticatedRequest){return this.jobs.syncLibrary(req);}
 @Get('jobs') list(@Req() req:AuthenticatedRequest){return this.jobs.list(req);}
 @Post('jobs') create(@Req() req:AuthenticatedRequest,@Body() input:any){return this.jobs.enqueue(req,input,input?.requestKey);}
 @Get('jobs/:id') read(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){return this.jobs.read(req,id);}
 @Post('jobs/:id/cancel') cancel(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string){return this.jobs.cancel(req,id);}
 @Get('workflows') workflows(@Req() req:AuthenticatedRequest){return this.jobs.workflows(req);}
 @Post('workflows') workflow(@Req() req:AuthenticatedRequest,@Body() input:any){return this.jobs.saveWorkflow(req,input);}
 @Patch('workflows/:id') toggle(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Body() input:any){return this.jobs.toggle(req,id,input?.enabled);}
}
