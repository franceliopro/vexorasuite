import {WorkflowsService} from './workflows.service';
describe('workflow department context at execution time',()=>{
 function fixture(filters:any,conversation:any){
 const rule:any={id:'rule',tenantId:'tenant',userId:'admin',enabled:true,filters,steps:[{type:'TASK',text:'Retornar ao cliente',minutes:0}]};
 const db:any={internalWorkflow:{findUniqueOrThrow:jest.fn(async()=>rule)},membership:{findFirst:jest.fn(async()=>({id:'member'}))},department:{findFirst:jest.fn(async()=>({id:'link'}))},departmentMember:{findFirst:jest.fn(async()=>({id:'link-member'}))},conversation:{findFirst:jest.fn(async()=>({id:'conversation',status:'OPEN',...conversation}))},workflowRun:{update:jest.fn()},$transaction:jest.fn(),message:{findFirst:jest.fn(async()=>null)}};
 return {db,service:new WorkflowsService(db,{} as any),run:{id:'run',workflowId:'rule',conversationId:'conversation',position:0,createdAt:new Date()}};
 }
 it('cancels a pending sequence after transfer to another department',async()=>{
 const x=fixture({departmentId:'link'},{departmentId:'tracking'});
 await (x.service as any).execute(x.run);
 expect(x.db.workflowRun.update).toHaveBeenCalledWith({where:{id:'run'},data:{status:'CANCELLED'}});
 expect(x.db.$transaction).not.toHaveBeenCalled();
 });
 it('cancels a direct attendant sequence after reassignment',async()=>{
 const x=fixture({departmentId:'link',assigneeId:'ana'},{departmentId:'link',assigneeId:'bob'});
 await (x.service as any).execute(x.run);
 expect(x.db.workflowRun.update).toHaveBeenCalledWith({where:{id:'run'},data:{status:'CANCELLED'}});
 expect(x.db.$transaction).not.toHaveBeenCalled();
 });
 it('cancels a sequence after department membership removal',async()=>{
 const x=fixture({departmentId:'link',assigneeId:'ana'},{departmentId:'link',assigneeId:'ana'});
 x.db.departmentMember.findFirst.mockResolvedValue(null);
 await (x.service as any).execute(x.run);
 expect(x.db.workflowRun.update).toHaveBeenCalledWith({where:{id:'run'},data:{status:'CANCELLED'}});
 });
});
