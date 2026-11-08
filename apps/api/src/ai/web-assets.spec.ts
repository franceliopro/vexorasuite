import {MarketingController} from './marketing.controller';
const req:any={user:{tenantId:'tenant-a',sub:'user-1',role:'OWNER'}};
function fixture(){
 const rows:any[]=[];
 const automation:any={authorize:jest.fn()};
 const prisma:any={auditLog:{
  findMany:jest.fn(async({where}:any)=>rows.filter(row=>row.tenantId===where.tenantId)),
  findFirst:jest.fn(async({where}:any)=>rows.find(row=>row.id===where.id&&row.tenantId===where.tenantId)||null),
  create:jest.fn(async({data}:any)=>{const row={...data,createdAt:new Date(),id:data.entityId};rows.push(row);return row;}),
  update:jest.fn(async({where,data}:any)=>{const row=rows.find(item=>item.id===where.id);if(row)row.details=data.details;return row;}),
  delete:jest.fn(async({where}:any)=>{const index=rows.findIndex(item=>item.id===where.id);if(index>=0)rows.splice(index,1);return {};}),
 }};
 return {rows,automation,prisma,controller:new MarketingController({} as any,automation,prisma)};
}
it('creates a form asset only with at least one labelled field',async()=>{
 const x=fixture();
 await expect(x.controller.createWebAsset(req,{kind:'FORM',title:'Contato'})).rejects.toThrow('campo');
 const created=await x.controller.createWebAsset(req,{kind:'FORM',title:'Contato',slug:'Contato Comercial',fields:[{label:'Nome',type:'text',required:true},{label:'',type:'email'}]});
 expect(created).toMatchObject({kind:'FORM',title:'Contato',slug:'contato-comercial',status:'DRAFT'});
 expect(created.fields).toHaveLength(1);
 expect(created.fields[0]).toMatchObject({label:'Nome',type:'text',required:true});
 expect(x.prisma.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({tenantId:'tenant-a',action:'marketing.web-asset',entityType:'form'})});
});
it('lists only the current tenant assets and filters by kind',async()=>{
 const x=fixture();
 await x.controller.createWebAsset(req,{kind:'SITE',title:'Institucional'});
 await x.controller.createWebAsset(req,{kind:'LANDING',title:'Campanha'});
 x.rows.push({id:'other',tenantId:'tenant-b',action:'marketing.web-asset',details:{kind:'SITE',title:'Outra empresa'},createdAt:new Date()});
 const all=await x.controller.listWebAssets(req);
 expect(all.map(asset=>asset.title)).toEqual(expect.arrayContaining(['Institucional','Campanha']));
 expect(all.map(asset=>asset.title)).not.toContain('Outra empresa');
 const landings=await x.controller.listWebAssets(req,'landing');
 expect(landings).toHaveLength(1);
 expect(landings[0]).toMatchObject({kind:'LANDING',title:'Campanha'});
});
it('updates and deletes only assets owned by the tenant',async()=>{
 const x=fixture();
 const created=await x.controller.createWebAsset(req,{kind:'LANDING',title:'Oferta'});
 const updated=await x.controller.updateWebAsset(req,created.id,{title:'Oferta de novembro',status:'READY'});
 expect(updated).toMatchObject({title:'Oferta de novembro',slug:'oferta',status:'READY'});
 await expect(x.controller.updateWebAsset({user:{tenantId:'tenant-b',sub:'user-2'}} as any,created.id,{title:'Invasão'})).rejects.toThrow('não encontrado');
 await expect(x.controller.deleteWebAsset({user:{tenantId:'tenant-b',sub:'user-2'}} as any,created.id)).rejects.toThrow('não encontrado');
 await x.controller.deleteWebAsset(req,created.id);
 expect(await x.controller.listWebAssets(req)).toHaveLength(0);
});
