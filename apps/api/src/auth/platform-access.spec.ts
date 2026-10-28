import {AuthGuard} from './auth.guard';
describe('platform identity and temporary password gate',()=>{
 const prior=process.env.JWT_ACCESS_SECRET;beforeAll(()=>{process.env.JWT_ACCESS_SECRET='platform-test-secret-more-than-thirty-two-bytes'});afterAll(()=>{if(prior===undefined)delete process.env.JWT_ACCESS_SECRET;else process.env.JWT_ACCESS_SECRET=prior});
 function fixture(overrides:any={},version=0,path='/api/contacts'){
  const member={role:'OWNER',modules:[],deniedModules:[],user:{authVersion:0,isPlatformAdmin:false,mustChangePassword:false},tenant:{kind:'COMPANY',integrations:{}},...overrides};
  const db:any={membership:{findFirst:jest.fn().mockResolvedValue(member)},departmentMember:{findMany:jest.fn().mockResolvedValue([])}},jwt:any={verifyAsync:jest.fn().mockResolvedValue({sub:'user',tenantId:'tenant',tenantSlug:'company',role:'OWNER',isPlatformAdmin:true,sessionVersion:version})};
  const request:any={headers:{authorization:'Bearer token'},path,method:'GET'};
  return ()=>new AuthGuard(jwt,db).canActivate({switchToHttp:()=>({getRequest:()=>request})} as any);
 }
 it('does not trust a platform role forged in token claims',async()=>{await expect(fixture({tenant:{kind:'PLATFORM',integrations:{}}})()).rejects.toThrow('administração da Véxora');});
 it('rejects sessions issued before a password reset',async()=>{await expect(fixture({user:{authVersion:1,isPlatformAdmin:false,mustChangePassword:true}})()).rejects.toThrow('sessão foi encerrada');});
 it('requires a password change even for a company owner and for direct URLs',async()=>{await expect(fixture({user:{authVersion:0,isPlatformAdmin:false,mustChangePassword:true}})()).rejects.toThrow('senha temporária');await expect(fixture({user:{authVersion:0,isPlatformAdmin:false,mustChangePassword:true}},0,'/api/auth/me')()).resolves.toBe(true);});
 it('enforces a denied module on a company owner',async()=>{await expect(fixture({deniedModules:['WORDPRESS']},0,'/api/wordpress/sites')()).rejects.toThrow('não está habilitado');});
});
