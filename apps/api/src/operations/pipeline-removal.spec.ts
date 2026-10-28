import {ContactsController} from './contacts.controller';
const tenantId='tenant',pipelineId='12345678-1234-4234-8234-123456789abc';
const req:any={user:{tenantId,sub:'admin',role:'ADMIN'}};
function fixture(current=pipelineId){
 const metadata={notes:'keep',asaas:{customerId:'cus_1'},crmStage:'proposal'};
 const tx:any={ $queryRaw:jest.fn(),contact:{findFirst:jest.fn(async()=>({id:'contact',tenantId,pipelineId:current,metadata})),update:jest.fn(async(v)=>({id:'contact',...v.data}))}};
 const prisma:any={crmPipeline:{findFirst:jest.fn(async()=>({id:pipelineId}))},$transaction:async(fn)=>fn(tx)};
 const events:any={publish:jest.fn()};
 return {tx,events,controller:new ContactsController(prisma,events,{} as any)};
}
it('detaches only the contact and preserves financial metadata and notes',async()=>{
 const f=fixture();await f.controller.removeFromPipeline(req,'contact',{pipelineId});
 expect(f.tx.contact.update).toHaveBeenCalledWith({where:{id:'contact'},data:{pipelineId:null,metadata:expect.objectContaining({notes:'keep',asaas:{customerId:'cus_1'},crmStage:'proposal',crmRemoved:expect.objectContaining({pipelineId,removedBy:'admin'})})}});
 expect(f.tx.contact.findFirst).toHaveBeenCalledWith({where:{id:'contact',tenantId}});
 expect(f.events.publish).toHaveBeenCalled();
});
it('rejects stale pipeline selection without writing',async()=>{
 const f=fixture('other');await expect(f.controller.removeFromPipeline(req,'contact',{pipelineId})).rejects.toThrow('mudou de pipeline');
 expect(f.tx.contact.update).not.toHaveBeenCalled();
});
