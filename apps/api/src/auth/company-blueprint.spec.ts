import {randomUUID} from 'node:crypto';
import {provisionCompany} from './company-blueprint';
import {AuthService} from './auth.service';
describe('company onboarding and switching',()=>{
 it('prepares isolated departments and drafts without copying credentials',async()=>{
  const tx:any={department:{create:jest.fn(async({data})=>({id:randomUUID(),...data}))},departmentMember:{create:jest.fn()},crmPipeline:{create:jest.fn(async()=>({id:randomUUID()}))},tenant:{update:jest.fn()}};
  await provisionCompany(tx,{id:randomUUID()},randomUUID(),'music-school',randomUUID());
  expect(tx.department.create).toHaveBeenCalledTimes(4);
  expect(tx.departmentMember.create).toHaveBeenCalledTimes(4);
  const root=tx.tenant.update.mock.calls[0][0].data.integrations;
  expect(root.onboarding.segmentId).toBe('music-school');
  expect(Object.keys(root.businessFlows)).toHaveLength(4);
  expect(root.assistant.agents).toHaveLength(4);expect(root.assistant.enabled).toBe(false);
  expect(root.google).toBeUndefined();expect(root.asaas).toBeUndefined();
 });
 it('refuses switching to a company outside the users owner memberships',async()=>{
  const db:any={membership:{findFirst:jest.fn(async()=>null)}},jwt:any={signAsync:jest.fn()};
  await expect(new AuthService(db,jwt).companySession(randomUUID(),randomUUID())).rejects.toThrow('não está vinculada');
  expect(jwt.signAsync).not.toHaveBeenCalled();
 });
 it('rejects malformed tenant ids before a database query',async()=>{
  const db:any={membership:{findFirst:jest.fn()}};
  await expect(new AuthService(db,{} as any).companySession(randomUUID(),'other')).rejects.toThrow('empresa válida');
  expect(db.membership.findFirst).not.toHaveBeenCalled();
 });
 it('issues a token with the target tenant and a current verified owner role',async()=>{
  const id=randomUUID(),userId=randomUUID(),member={role:'OWNER',user:{id:userId,name:'Ana',email:'ana@example.test'},tenant:{id,name:'Escola',slug:'escola-123'}};
  const db:any={membership:{findFirst:jest.fn(async()=>member)}},jwt:any={signAsync:jest.fn(async()=> 'new-session')};
  const session=await new AuthService(db,jwt).companySession(userId,id);
  expect(session.tenant.id).toBe(id);
  expect(jwt.signAsync.mock.calls[0][0]).toEqual({sub:userId,tenantId:id,tenantSlug:'escola-123',role:'OWNER'});
 });
 it('lists only active companies owned by the current user',async()=>{
  const userId=randomUUID(),db:any={membership:{findMany:jest.fn(async()=>[])}};
  await new AuthService(db,{} as any).companies(userId);
  expect(db.membership.findMany.mock.calls[0][0].where).toEqual({userId,role:'OWNER',user:{isActive:true},tenant:{status:'ACTIVE'}});
 });
});
