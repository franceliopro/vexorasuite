import { Controller, Get, Param, ParseUUIDPipe, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ReportExportService, reportCsv, reportPdf } from './report-export.service';
@Controller('assistant/reports')
@UseGuards(AuthGuard)
export class ReportExportController {
 constructor(private readonly reports:ReportExportService){}
 @Get(':id/:format')
 async download(@Req() req:AuthenticatedRequest,@Param('id',ParseUUIDPipe) id:string,@Param('format') format:string,@Res() res:Response){
  if(!['csv','pdf'].includes(format))throw new BadRequestException('Use PDF ou CSV.');
  const report=await this.reports.read(req,id);
  const buffer=format==='pdf'?await reportPdf(report):reportCsv(report);
  res.setHeader('Content-Type',format==='pdf'?'application/pdf':'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="vexora-relatorio-${id}.${format}"`);
  res.setHeader('Cache-Control','private, no-store');res.send(buffer);
 }
}
