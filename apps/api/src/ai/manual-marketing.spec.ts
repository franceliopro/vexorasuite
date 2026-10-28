import {MarketingController} from './marketing.controller';
const req:any={user:{tenantId:'a',sub:'user',role:'OWNER'}};
function fixture(){
 const record:any={id:'audit',details:{status:'DRAFT',carousel:{title:'Título',caption:'Antes',slides:[]},sources:['source']}};
 const automation:any={read:jest.fn(async()=>record),authorize:jest.fn(),createCarousel:jest.fn(async()=>({automation:{id:'draft'}}))};
 const prisma:any={auditLog:{updateMany:jest.fn(async()=>({count:1}))}};
 return {record,automation,prisma,controller:new MarketingController({} as any,automation,prisma)};
}
it('generates only an explicit draft without publishing',async()=>{const x=fixture();await x.controller.draft(req,{question:'Tema',format:'POST',publish:false});expect(x.automation.createCarousel).toHaveBeenCalledWith(req,'Tema',{format:'POST',draftOnly:true,useBrandOnly:true});await expect(async()=>x.controller.draft(req,{question:'Tema',format:'VIDEO'})).rejects.toThrow();});
it('stores manual approval and editorial date, preserving sources with a concurrency condition',async()=>{const x=fixture();await x.controller.review(req,'draft',{caption:'Revisado',approved:true,plannedFor:'2026-11-01'});expect(x.prisma.auditLog.updateMany).toHaveBeenCalledWith({where:{id:'audit',tenantId:'a',details:{equals:x.record.details}},data:{details:expect.objectContaining({sources:['source'],status:'MANUAL_READY',manualReview:expect.objectContaining({approved:true,plannedFor:'2026-11-01',reviewedBy:'user'})})}});});
it('does not overwrite another reviewers changes',async()=>{const x=fixture();x.prisma.auditLog.updateMany.mockResolvedValue({count:0});await expect(x.controller.review(req,'draft',{caption:'Revisado',approved:false,plannedFor:''})).rejects.toThrow('outra janela');});
it('rejects impossible dates and edits to published history',async()=>{const x=fixture();await expect(x.controller.review(req,'draft',{caption:'Texto',approved:true,plannedFor:'2026-02-31'})).rejects.toThrow('inválida');x.record.details.status='PUBLISHED';await expect(x.controller.review(req,'draft',{caption:'Texto',approved:true,plannedFor:''})).rejects.toThrow('histórico');expect(x.prisma.auditLog.updateMany).not.toHaveBeenCalled();});
