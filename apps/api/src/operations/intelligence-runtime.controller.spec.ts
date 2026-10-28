import { IntelligenceRuntimeController } from './intelligence-runtime.controller';
const req:any={user:{tenantId:'tenant',role:'OWNER',sub:'owner'}};
describe('flow publication',()=>{
 it('denies non-admin publication',async()=>{const c=new IntelligenceRuntimeController({} as any);await expect(c.publish({user:{role:'AGENT'}} as any)).rejects.toThrow();});
 it('validates executable snapshot before activation',async()=>{const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:{chatbotDraft:{name:'Draft',welcome:'',channelIds:['channel'],triggers:[{kind:'message'}],steps:[{id:'start',title:'HTTP',message:'',kind:'api',options:[]}]}}})}};const c=new IntelligenceRuntimeController({$transaction:(fn:any)=>fn(tx)} as any);await expect(c.publish(req)).rejects.toThrow();});
 it('refuses binding to foreign channels',async()=>{const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:{chatbotDraft:{name:'Draft',welcome:'',channelIds:['foreign'],triggers:[{kind:'message'}],steps:[{id:'start',title:'Hello',message:'Olá',options:[]}]}}})},channelConnection:{findMany:jest.fn().mockResolvedValue([])}};const c=new IntelligenceRuntimeController({$transaction:(fn:any)=>fn(tx)} as any);await expect(c.publish(req)).rejects.toThrow();expect(tx.channelConnection.findMany.mock.calls[0][0].where.tenantId).toBe('tenant');});
});

describe('scoped publication',()=>{
 const departmentId='12345678-1234-4234-8234-123456789abc',userId='22345678-1234-4234-8234-123456789abc';
 function fixture(){
 let root:any={chatbotDraft:{name:'Financeiro Link',welcome:'Olá',channelIds:['channel'],triggers:[{kind:'message'}],steps:[{id:'menu',title:'Menu',message:'Escolha',options:[]}]},intelligencePublished:{revision:'default',active:true},intelligencePublications:{'department:other':{revision:'other',active:true}}};
 const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn(async()=>({integrations:root})),update:jest.fn(async({data}:any)=>{root=data.integrations})},department:{findFirst:jest.fn(async()=>({id:departmentId}))},membership:{findFirst:jest.fn(async()=>({id:'member'}))},departmentMember:{findFirst:jest.fn(async()=>({id:'link'}))},channelConnection:{findMany:jest.fn(async()=>[{id:'channel'}])},auditLog:{create:jest.fn()}};
 return {tx,root:()=>root,c:new IntelligenceRuntimeController({$transaction:(fn:any)=>fn(tx)} as any)};
 }
 it('publishes and pauses one department without replacing other contexts',async()=>{
 const f=fixture();await f.c.publish(req,{departmentId});
 expect(f.root().intelligencePublished.revision).toBe('default');
 expect(f.root().intelligencePublications['department:other'].revision).toBe('other');
 expect(f.root().intelligencePublications['department:'+departmentId].active).toBe(true);
 await f.c.stop(req,{departmentId});
 expect(f.root().intelligencePublications['department:'+departmentId].active).toBe(false);
 expect(f.root().intelligencePublications['department:other'].active).toBe(true);
 });
 it('publishes a direct attendant specialization within one department',async()=>{
 const f=fixture();await f.c.publish(req,{departmentId,userId});
 expect(f.root().intelligencePublications['user:'+userId+':department:'+departmentId].scope).toEqual({departmentId,userId});
 });
 it('rejects a department outside the company before writing',async()=>{
 const f=fixture();f.tx.department.findFirst.mockResolvedValue(null);
 await expect(f.c.publish(req,{departmentId})).rejects.toThrow('Departamento não disponível');
 expect(f.tx.tenant.update).not.toHaveBeenCalled();
 });
 it('rejects an attendant who does not belong to the department',async()=>{
 const f=fixture();f.tx.departmentMember.findFirst.mockResolvedValue(null);
 await expect(f.c.publish(req,{departmentId,userId})).rejects.toThrow('não pertence');
 expect(f.tx.tenant.update).not.toHaveBeenCalled();
 });
});
