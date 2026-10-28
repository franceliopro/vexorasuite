import {MODULES,effectiveModules,routeModules,moduleSelection,patternModules} from './module-policy';
import {AuthGuard} from './auth.guard';
describe('company module policy',()=>{
 it('requires both individual and active department permission',()=>{expect(effectiveModules('AGENT',['INBOX','CRM','FINANCE'],[{modules:['INBOX','CRM']}])).toEqual(['INBOX','CRM']);expect(effectiveModules('AGENT',['CRM'],[{modules:['CRM'],isActive:false}])).toEqual([]);expect(effectiveModules('AGENT',['CRM'],[])).toEqual([])});
 it('preserves the administrative recovery path and rejects invented module keys',()=>{expect(effectiveModules('OWNER',[],[])).toEqual([...MODULES]);expect(()=>moduleSelection(['SUPER_ADMIN'])).toThrow();expect(moduleSelection(['CRM','CRM'])).toEqual(['CRM'])});
 it('maps direct CRM URLs to the same permission as the navigation',()=>{expect(routeModules('/api/contacts/123/stage','PATCH')).toEqual(['CRM']);expect(routeModules('/api/crm/pipelines','GET')).toEqual(['CRM']);expect(routeModules('/api/auth/me','GET')).toEqual([])});
 it('rejects direct requests even when the old token contains an administrative role',async()=>{const prior=process.env.JWT_ACCESS_SECRET;process.env.JWT_ACCESS_SECRET='test-value-that-has-more-than-thirty-two-bytes';const prisma:any={membership:{findFirst:jest.fn().mockResolvedValue({role:'AGENT',modules:['CRM']})},departmentMember:{findMany:jest.fn().mockResolvedValue([{department:{id:'department',modules:['INBOX'],isActive:true}}])}};const jwt:any={verifyAsync:jest.fn().mockResolvedValue({sub:'user',tenantId:'company',tenantSlug:'company',role:'OWNER'})},req:any={headers:{authorization:'Bearer test'},path:'/api/crm/pipelines',method:'GET'},context:any={switchToHttp:()=>({getRequest:()=>req})};try{await expect(new AuthGuard(jwt,prisma).canActivate(context)).rejects.toThrow('não está habilitado');}finally{if(prior===undefined)delete process.env.JWT_ACCESS_SECRET;else process.env.JWT_ACCESS_SECRET=prior;}});
});

describe('modules inherited from department patterns',()=>{
 it('inherits only current department patterns and filters against department capabilities',()=>{
 const root={businessPresets:{link:{departmentId:'link',modules:['FINANCE','CRM']},tracking:{departmentId:'tracking',modules:['MARKETING']},direct:{userId:'ana',modules:['TASKS','SETTINGS']}}};
 const inherited=patternModules(root,'ana',['link']);
 expect(inherited).toEqual(['FINANCE','CRM','TASKS','SETTINGS']);
 expect(effectiveModules('AGENT',['INBOX'],[{modules:['INBOX','FINANCE','CRM','TASKS']}],inherited)).toEqual(['INBOX','FINANCE','CRM','TASKS']);
 expect(patternModules(root,'bob',[])).toEqual([]);
 });
});


describe('explicit module denial',()=>{
 it('takes priority over department and personal patterns, including administrative company roles',()=>{
  expect(effectiveModules('AGENT',['CRM'],[{modules:['CRM','WORDPRESS']}],['WORDPRESS'],['WORDPRESS'])).toEqual(['CRM']);
  expect(effectiveModules('OWNER',[],[],[],['WORDPRESS'])).not.toContain('WORDPRESS');
  expect(routeModules('/api/wordpress/sites','GET')).toEqual(['WORDPRESS']);
 });
});
