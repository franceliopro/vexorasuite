import {BusinessTemplatesController} from './business-templates.controller';
import {SEGMENTS,segmentAgentPrompt,templateFlow} from './business-templates';
import {validateRuntimeFlow} from '../ai/flow-runtime';
describe('department presets',()=>{
 const req:any={user:{tenantId:'a',role:'OWNER',sub:'owner'}};
 const departmentId='12345678-1234-4234-8234-123456789abc';
 function fixture(target:any={id:departmentId,key:'FINANCEIRO_LINK',name:'Financeiro Link',modules:['EMAIL'],isActive:true}){
 let integrations:any={google:{connected:true},chatbotDraft:{name:'Preservar'}};
 const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn(async()=>({integrations})),update:jest.fn(async(v:any)=>{integrations=v.data.integrations})},department:{findFirst:jest.fn(async()=>target),create:jest.fn(),update:jest.fn(async(v:any)=>({...target,...v.data}))},crmPipeline:{findUnique:jest.fn(async()=>null),create:jest.fn()},internalWorkflow:{findFirst:jest.fn(async()=>null),create:jest.fn(async()=>({id:'workflow'})),update:jest.fn()},auditLog:{create:jest.fn()}};
 const db:any={$transaction:(fn:any)=>fn(tx)};
 return {tx,controller:new BusinessTemplatesController(db),root:()=>integrations};
 }
 it('applies to the selected tenant department and preserves existing configuration',async()=>{
 const f=fixture();await f.controller.apply(req,{segmentId:'vehicle-tracking',department:'FINANCE',departmentId});
 expect(f.tx.department.findFirst).toHaveBeenCalledWith({where:{id:departmentId,tenantId:'a',isActive:true}});
 expect(f.tx.department.create).not.toHaveBeenCalled();
 expect(f.tx.department.update.mock.calls[0][0].data.modules).toEqual(expect.arrayContaining(['EMAIL','FINANCE','CRM']));
 const root=f.root();expect(root.google.connected).toBe(true);expect(root.chatbotDraft.name).toBe('Preservar');
 const flow:any=Object.values(root.businessFlows)[0];expect(flow.draft.name).toBe('Fluxo Financeiro Link');
 expect(flow.draft.steps.some((s:any)=>s.config?.includes('FINANCEIRO_LINK'))).toBe(true);
 await f.controller.apply(req,{segmentId:'vehicle-tracking',department:'FINANCE',departmentId});
 expect(f.tx.auditLog.create).toHaveBeenCalledTimes(1);
 });
 it('rejects missing or inaccessible department without creating a fallback',async()=>{
 const f=fixture(null);
 await expect(f.controller.apply(req,{segmentId:'vehicle-tracking',department:'FINANCE',departmentId})).rejects.toThrow('Departamento não encontrado');
 expect(f.tx.department.create).not.toHaveBeenCalled();expect(f.tx.tenant.update).not.toHaveBeenCalled();
 });
 it('stores a direct attendant preset independently from inherited departments',async()=>{
 const f=fixture();const userId='22345678-1234-4234-8234-123456789abc';
 f.tx.membership={findFirst:jest.fn(async()=>({id:'membership',modules:['INBOX'],user:{name:'Ana'}})),update:jest.fn()};
 await f.controller.apply(req,{segmentId:'vehicle-tracking',department:'FINANCE',userId});
 expect(f.tx.membership.findFirst).toHaveBeenCalledWith({where:{tenantId:'a',userId,user:{isActive:true}},include:{user:{select:{name:true}}}});
 expect(f.tx.department.create).not.toHaveBeenCalled();
 expect(f.root().businessPresets['user:'+userId+':FINANCE'].userId).toBe(userId);
 expect(f.root().google.connected).toBe(true);
 });
 it('rejects non-admin configuration',async()=>{
 const f=fixture();await expect(f.controller.apply({user:{role:'AGENT'}} as any,{})).rejects.toThrow('administradores');
 expect(f.tx.$queryRaw).not.toHaveBeenCalled();
 });
 it('provides a complete, scoped prompt for each business segment',()=>{
  expect(SEGMENTS.length).toBeGreaterThanOrEqual(25);
  const aesthetics=segmentAgentPrompt('aesthetics','SUPPORT');
  expect(aesthetics).toContain('Clínica de estética');
  expect(aesthetics).toContain('Suporte');
  expect(aesthetics).toContain('Use somente preços');
  expect(segmentAgentPrompt('restaurant','SALES')).toContain('Restaurante');
 });
 it.each(SEGMENTS.map(s=>[s.id]))('generates an executable draft for %s after channel selection',(id)=>{
 const flow=templateFlow(id);flow.channelIds=['channel'];
 expect(validateRuntimeFlow(flow)).toEqual([]);
 expect(JSON.stringify(flow)).not.toMatch(/Rastreabem|Ceeb Vision/);
 });
});

