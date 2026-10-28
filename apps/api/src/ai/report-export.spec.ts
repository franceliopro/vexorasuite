import { ExportReport, reportCsv, reportPdf, reportPeriod, ReportExportService } from './report-export.service';
import { writeFileSync } from 'node:fs';
const report:ExportReport={title:'Desempenho do atendimento',from:'2026-10-01',to:'2026-10-27',source:'Inteligência Operacional',basis:'Dados de demonstração para validar o exportador; responsável atual.',summary:'120 atendimentos; 90 finalizados; 30 abertos.',headers:['Atendente','Total','Abertos','Pendentes','Finalizados'],rows:[['Ana',70,15,0,55],['João',50,15,0,35]],chart:[{label:'Ana',value:70},{label:'João',value:50}],unit:'Atendimentos'};
describe('zero-token reports',()=>{
 it('uses São Paulo local dates at UTC boundary',()=>expect(reportPeriod('hoje',new Date('2026-10-27T01:00:00Z'))).toEqual({from:'2026-10-26',to:'2026-10-26'}));
 it('handles prior month and leap day',()=>expect(reportPeriod('mês passado',new Date('2024-03-10T12:00:00Z'))).toEqual({from:'2024-02-01',to:'2024-02-29'}));
 it('rejects invalid or ambiguous dates',()=>{expect(()=>reportPeriod('2026-02-30 a 2026-03-01')).toThrow();expect(()=>reportPeriod('dia 02/10')).toThrow();});
 it('escapes CSV formulas and quotes',()=>{const output=reportCsv({...report,rows:[['=CMD("x")',1,0,0,1]]}).toString();expect(output).toContain("'=CMD");expect(output).toContain('""x""');expect(output.startsWith('\ufeff')).toBe(true);});
 it('creates a readable PDF with vector chart',async()=>{const pdf=await reportPdf(report);expect(pdf.subarray(0,5).toString()).toBe('%PDF-');expect(pdf.length).toBeGreaterThan(1000);if(process.env.VEXORA_QA_OUTPUT)writeFileSync(process.env.VEXORA_QA_OUTPUT+'/report-qa.pdf',pdf);});
 it('denies agent access and scopes exports to tenant',async()=>{const prisma:any={auditLog:{findFirst:jest.fn().mockResolvedValue(null)}};const service=new ReportExportService(prisma,{} as any,{} as any,{} as any);expect(()=>service.authorize({user:{role:'AGENT'}} as any)).toThrow();await expect(service.read({user:{role:'OWNER',tenantId:'tenant'}} as any,'id')).rejects.toThrow();expect(prisma.auditLog.findFirst.mock.calls[0][0].where.tenantId).toBe('tenant');});
});
