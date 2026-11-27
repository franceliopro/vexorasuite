import {MODULES,effectiveModules,routeModules,moduleSelection,patternModules} from './module-policy';
import {AuthGuard} from './auth.guard';
describe('company module policy',()=>{
 it('requires both individual and active department permission',()=>{expect(effectiveModules('AGENT',['INBOX','CRM','FINANCE'],[{modules:['INBOX','CRM']}])).toEqual(['INBOX','CRM']);expect(effectiveModules('AGENT',['CRM'],[{modules:['CRM'],isActive:false}])).toEqual([]);expect(effectiveModules('AGENT',['CRM'],[])).toEqual([])});
 it('preserves the administrative recovery path and rejects invented module keys',()=>{expect(effectiveModules('OWNER',[],[])).toEqual([...MODULES]);expect(()=>moduleSelection(['SUPER_ADMIN'])).toThrow();expect(moduleSelection(['CRM','CRM'])).toEqual(['CRM'])});
 it('maps direct CRM URLs to the same permission as the navigation',()=>{expect(routeModules('/api/contacts/123/stage','PATCH')).toEqual(['CRM']);expect(routeModules('/api/crm/pipelines','GET')).toEqual(['CRM']);expect(routeModules('/api/auth/me','GET')).toEqual([])});
  it('gates the site creator behind SITES, keeping the legacy image endpoint available to MARKETING',()=>{expect(routeModules('/api/sites','GET')).toEqual(['SITES']);expect(routeModules('/api/sites/123/document','POST')).toEqual(['SITES']);expect(routeModules('/api/sites/123/deploy','POST')).toEqual(['SITES']);expect(routeModules('/api/sites/123/blocks/456/ai-image','POST')).toEqual(['SITES','MARKETING']);});
  it('keeps public form submission anonymous but protects response reading with SITES',()=>{expect(routeModules('/api/public/sites/123/forms/bloco/submit','POST')).toEqual([]);expect(routeModules('/api/sites/123/forms/submissions','GET')).toEqual(['SITES']);});
  it('keeps the signed temporary preview link outside the SITES module gate',()=>{expect(routeModules('/api/public/sites/preview/token','GET')).toEqual([]);expect(routeModules('/api/sites/123/document/preview','POST')).toEqual(['SITES']);});
  it('keeps the public storefront anonymous and lets attendants read the share text',()=>{expect(routeModules('/api/public/storefront/vx_store_token','GET')).toEqual([]);expect(routeModules('/api/storefront/share','GET')).toEqual(['INBOX','SETTINGS']);expect(routeModules('/api/storefront/tokens','GET')).toEqual(['SETTINGS']);});
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

it('uses calendar permission for Google calendar actions in the inbox',()=>{expect(routeModules('/api/integrations/google/calendar/account/events','POST')).toEqual(['CALENDAR']);});

it('aplica CALENDAR à gestão escolar sem ignorar negação individual',()=>{
 expect(routeModules('/api/school/snapshot','GET')).toEqual(['CALENDAR']);
 expect(routeModules('/api/school/records','POST')).toEqual(['CALENDAR']);
 expect(effectiveModules('AGENT',['CALENDAR'],[{modules:['CALENDAR']}],[],['CALENDAR'])).toEqual([]);
 expect(effectiveModules('OWNER',[],[],[],['CALENDAR'])).not.toContain('CALENDAR');
});

it('mantém WORDPRESS apenas como chave de negação e EMAIL como módulo ativo',()=>{
 expect(MODULES).toContain('WORDPRESS');
 expect(MODULES).toContain('EMAIL');
 expect(routeModules('/api/mail/inboxes','GET')).toEqual(['EMAIL']);
 expect(effectiveModules('OWNER',[],[],[],['WORDPRESS','EMAIL'])).not.toContain('WORDPRESS');
 expect(effectiveModules('OWNER',[],[],[],['WORDPRESS','EMAIL'])).not.toContain('EMAIL');
});
