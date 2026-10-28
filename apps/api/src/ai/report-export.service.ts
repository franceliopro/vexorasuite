import { AsaasService } from "../operations/asaas.service";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { ReportsController } from '../operations/reports.controller';
import { FinanceController } from '../operations/finance.controller';
import { normalize } from './flow-runtime';
export type ExportReport = { title:string; from:string; to:string; source:string; basis:string; summary:string; headers:string[]; rows:(string|number)[][]; chart:{label:string;value:number}[]; unit:string };
const DAY=86400000;
export function reportPeriod(question:string,now=new Date()) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const q=normalize(question), date=new Date(today+'T12:00:00Z');
 const iso=(d:Date)=>d.toISOString().slice(0,10);
 const dates=q.match(/\d{4}-\d{2}-\d{2}/g);
 let from:string,to=today;
 if(dates||brazilianDates){if((dates&&brazilianDates)||((dates||brazilianDates)!.length!==2))throw new BadRequestException('Informe duas datas no formato DD/MM/AAAA.');const selected=dates||brazilianDates!;const normalized=dates?selected:selected.map(value=>{const parsed=parseBrazilianDate(value);if(!parsed)throw new BadRequestException('Data inválida. Use DD/MM/AAAA.');return parsed;});[from,to]=normalized as [string,string];}
 else if(/hoje/.test(q))from=today;
 else if(/ontem/.test(q)){from=iso(new Date(date.getTime()-DAY));to=from;}
 else if(/mes passado|ultimo mes/.test(q)){from=iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-1,1,12)));to=iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),0,12)));}
 else if(/este mes|nesse mes|neste mes|mes atual/.test(q))from=today.slice(0,7)+'-01';
 else if(/ultimos? (7|30|90) dias|semana/.test(q)){const days=/90/.test(q)?90:/30/.test(q)?30:7;from=iso(new Date(date.getTime()-(days-1)*DAY));}
 else if(/\d{1,2}\/\d{1,2}|\d+ dias|\b(ano|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(q))throw new BadRequestException('Para esse período, informe as datas inicial e final em DD/MM/AAAA.');
 else from=iso(new Date(date.getTime()-29*DAY));
 for(const value of [from,to]){const d=new Date(value+'T00:00:00Z');if(Number.isNaN(d.getTime())||iso(d)!==value)throw new BadRequestException('Data inválida.');}
 if(from>to||Date.parse(to)-Date.parse(from)>365*DAY)throw new BadRequestException('Selecione um período de até 366 dias.');
 return {from,to};
}
export function reportCsv(report:ExportReport):Buffer {
 const cell=(v:string|number)=>'"'+(typeof v==='string'&&/^[\s]*[=+@-]/.test(v)?"'"+v:String(v)).replace(/"/g,'""')+'"';
 const rows:(string|number)[][]=[[report.title],[`Período: ${formatDateBR(report.from)} a ${formatDateBR(report.to)}`],[`Fonte: ${report.source}`],[report.basis],[report.summary],[],report.headers,...report.rows];
 return Buffer.from('\ufeff'+rows.map(row=>row.map(cell).join(';')).join('\r\n'),'utf8');
}
export async function reportPdf(report:ExportReport):Promise<Buffer> {
 const doc=new PDFDocument({size:'A4',margin:44,info:{Title:report.title,Author:'Véxora Intelligence Engine'}});
 const chunks:Buffer[]=[];
 const result=new Promise<Buffer>((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const page=()=>{doc.addPage();doc.font('Helvetica').fontSize(9).fillColor('#516174').text(report.title);doc.moveDown();};
 doc.font('Helvetica-Bold').fontSize(10).fillColor('#5573d8').text('VÉXORA INTELLIGENCE ENGINE');
 doc.moveDown().fontSize(24).fillColor('#191D28').text(report.title);
 doc.font('Helvetica').fontSize(10).fillColor('#516174').text(`${report.from} a ${report.to} · ${report.source}`);
 doc.moveDown().fontSize(12).fillColor('#191D28').text(report.summary,{lineGap:4});
 doc.moveDown().fontSize(9).fillColor('#516174').text(report.basis,{lineGap:3});
 doc.moveDown();
 const chart=report.chart.slice(0,12);const max=Math.max(1,...chart.map(x=>x.value));
 doc.font('Helvetica-Bold').fontSize(12).fillColor('#191D28').text(`Comparativo · ${report.unit}`);doc.moveDown(.6);
 for(const item of chart){if(doc.y>710)page();const y=doc.y;doc.font('Helvetica').fontSize(9).fillColor('#191D28').text(item.label,44,y,{width:160,height:24,ellipsis:true});doc.rect(210,y+2,180*item.value/max,9).fill('#5573d8');doc.fillColor('#191D28').text(item.value.toLocaleString('pt-BR',{maximumFractionDigits:2}),400,y,{width:110,align:'right'});doc.y=y+29;}
 doc.moveDown();
 const widths=report.headers.map((_,i)=>i===0?180:(507-180)/(report.headers.length-1));
 const tableHeader=()=>{let x=44;const y=doc.y;doc.rect(44,y,507,26).fill('#eef1fa');report.headers.forEach((h,i)=>{doc.fillColor('#191D28').font('Helvetica-Bold').fontSize(8).text(h,x+5,y+8,{width:widths[i]!-10,height:15});x+=widths[i]!;});doc.y=y+31;};
 if(doc.y>680)page();tableHeader();
 for(const row of report.rows){if(doc.y>735){page();tableHeader();}let x=44;const y=doc.y;row.forEach((v,i)=>{doc.font('Helvetica').fontSize(8).fillColor('#191D28').text(typeof v==='number'?v.toLocaleString('pt-BR',{maximumFractionDigits:2}):v,x+5,y,{width:widths[i]!-10,height:24,ellipsis:true});x+=widths[i]!;});doc.y=y+30;}
 doc.end();return result;
}
@Injectable()
export class ReportExportService {
 constructor(private readonly prisma:PrismaService,private readonly reports:ReportsController,private readonly finance:FinanceController,private readonly asaas:AsaasService){}
 authorize(req:AuthenticatedRequest){if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Relatórios gerenciais são restritos à administração.');}
 async create(req:AuthenticatedRequest,question:string){
  this.authorize(req);const period=reportPeriod(question);const q=normalize(question);let report:ExportReport;
  if(/financeir|faturamento|receita|pagamento|cobranca/.test(q)){
   const configured=await this.asaas.publicSettings(req.user.tenantId);
   const live=/asaas|carteira completa/.test(q)||(!/local|registrados/.test(q)&&configured.enabled&&configured.configured);
   const data=live?await this.finance.executive(req,'1',period.from,period.to):await this.finance.dashboard(req,'1',period.from,period.to);
   const d=data as any;const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
   report={title:'Relatório financeiro',...period,source:d.source+' · '+(Array.isArray(d.environment)?d.environment.join(', '):d.environment),basis:(d.caveat||'Cobranças Asaas selecionadas pelo vencimento. Situações refletem a consulta atual.')+(d.partial?' Resultado parcial: limite de registros atingido.':''),summary:`${d.totals.count} cobranças. Total: ${money(d.totals.billed)}. Recebido: ${money(d.totals.paid)}. Em aberto: ${money(d.totals.open)}.`,headers:['Período','Total (R$)','Recebido (R$)','Aberto (R$)'],rows:d.series.map((s:any)=>[formatMonthBR(s.month),s.billed,s.paid,s.open]),chart:d.series.map((s:any)=>({label:formatMonthBR(s.month),value:s.paid})),unit:'Recebido (R$)'};
  }else{
   const data=await this.reports.service(req,period.from,period.to,'180');
   report={title:'Desempenho do atendimento',...period,source:'Inteligência Operacional',basis:data.basis+' Atribuição por responsável atual; não mede tempo efetivo de trabalho nem qualidade individual. Limite de 10 mil conversas por período.',summary:`${data.summary.total} atendimentos; ${data.summary.resolved+data.summary.closed} finalizados; ${data.summary.open} abertos; ${data.summary.pending} pendentes.`,headers:['Atendente','Total','Abertos','Pendentes','Finalizados'],rows:data.byAgent.map(a=>[a.name,a.total,a.open,a.pending,a.finished]),chart:data.byAgent.map(a=>({label:a.name,value:a.total})),unit:'Atendimentos'};
  }
  const id=randomUUID();
  await this.prisma.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'assistant.report.created',entityType:'report',entityId:id,details:{report,usedAi:false,tokensUsed:0} as unknown as Prisma.InputJsonValue}});
  return {answer:report.summary+` Período: ${formatDateBR(period.from)} a ${formatDateBR(period.to)}. `+report.basis,source:report.source,usedAi:false,tokensUsed:0,attachments:[{name:report.title+'.pdf',url:`/api/backend/assistant/reports/${id}/pdf`},{name:report.title+'.csv',url:`/api/backend/assistant/reports/${id}/csv`}]};
 }
 async read(req:AuthenticatedRequest,id:string){this.authorize(req);const record=await this.prisma.auditLog.findFirst({where:{tenantId:req.user.tenantId,entityId:id,action:'assistant.report.created'},select:{details:true}});if(!record)throw new NotFoundException('Relatório não encontrado nesta empresa.');return (record.details as any).report as ExportReport;}
}
