import {randomUUID} from 'node:crypto';
import {DepartmentResourcesService,effectiveResources} from './department-resources.service';
describe('department Google resources',()=>{
 it('keeps two finance contexts distinct and supports a direct calendar override',()=>{
  const root={departmentResources:{company:{drive:{folderId:'shared'}},'department:link':{drive:{folderId:'link'},calendar:{calendarId:'link-cal'}},'department:tracking':{drive:{folderId:'tracking'}},'user:ana:department:link':{calendar:{calendarId:'ana-link'}}}};
  expect(effectiveResources(root,'link','ana')).toMatchObject({drive:{folderId:'link',source:'department:link'},calendar:{calendarId:'ana-link',source:'user:ana:department:link'}});
  expect(effectiveResources(root,'tracking','ana').drive.folderId).toBe('tracking');
 });
 it('rejects foreign department before contacting Google',async()=>{
  const db:any={department:{findFirst:jest.fn(async()=>null)}},google:any={token:jest.fn()};
  await expect(new DepartmentResourcesService(db,google).configure({user:{role:'OWNER',tenantId:randomUUID()}} as any,{departmentId:randomUUID(),driveAccountId:randomUUID()})).rejects.toThrow('não encontrado');
  expect(google.token).not.toHaveBeenCalled();
 });
 it('does not expose a departments resources to an unrelated attendant',async()=>{
  const db:any={department:{findFirst:jest.fn(async()=>({name:'Financeiro'}))},departmentMember:{findFirst:jest.fn(async()=>null)}};
  await expect(new DepartmentResourcesService(db,{} as any).context({user:{role:'AGENT',tenantId:randomUUID(),sub:randomUUID()}} as any,{departmentId:randomUUID()})).rejects.toThrow();
 });
 it('reuses reserved file ids after an ambiguous external create without duplicating folders',async()=>{
  const tenantId=randomUUID(),departmentId=randomUUID(),accountId=randomUUID(),req:any={user:{role:'OWNER',tenantId,sub:randomUUID()}};
  let integrations:any={preserved:{yes:true}};
  const tx:any={$queryRaw:jest.fn(),department:{findFirst:jest.fn(async()=>({id:departmentId,name:'Financeiro Link'}))},tenant:{findUniqueOrThrow:jest.fn(async()=>({integrations})),update:jest.fn(async({data})=>{integrations=data.integrations})},auditLog:{create:jest.fn()}};
  const db:any={...tx,$transaction:(fn:any)=>fn(tx)};
  const files=new Map<string,any>(),ids=Array.from({length:5},(_,i)=>'reserved_folder_'+i);
  let fail=true,generated=0;
  const original=global.fetch;
  const mock=jest.fn(async(url:any,init:any={})=>{
   const u=new URL(String(url));
   if(u.pathname.endsWith('/generateIds')){generated++;return new Response(JSON.stringify({ids}));}
   if(init.method==='POST'){const body=JSON.parse(init.body);files.set(body.id,body);if(fail){fail=false;throw Error('Timeout after remote creation');}return new Response(JSON.stringify(body));}
   const id=u.pathname.split('/').pop()!;
   if(id==='root')return new Response(JSON.stringify({id:'root',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}));
   return files.has(id)?new Response(JSON.stringify(files.get(id))):new Response('{}',{status:404});
  });
  global.fetch=mock as any;
  try{
   const service=new DepartmentResourcesService(db,{token:jest.fn(async()=> 'private-token')} as any),input={departmentId,driveAccountId:accountId,parentFolderId:'root'};
   await expect(service.configure(req,input)).rejects.toThrow('Timeout');
   const configured=await service.configure(req,input);
   expect(files.size).toBe(5);expect(generated).toBe(1);
   expect(configured.drive.folderId).toBe(ids[0]);
   expect(Object.keys(configured.drive.folders)).toEqual(['Referências','Novidades','Prontas','Publicadas']);
   expect(integrations.preserved.yes).toBe(true);
   expect(JSON.stringify(integrations)).not.toContain('private-token');
  }finally{global.fetch=original}
 });
});
