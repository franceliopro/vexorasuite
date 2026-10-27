import {MarketingLibraryService} from './marketing-library.service';
const req:any={user:{tenantId:'tenant-a',role:'OWNER'}},accountId='11111111-1111-4111-8111-111111111111';
function setup(){
 const tenant:any={integrations:{crm:{keep:true},marketing:{accountId,folderId:'folderaaaaa1',fileIds:[],autoPublish:true}}};
 const db:any={tenant:{findUniqueOrThrow:jest.fn(async()=>tenant),update:jest.fn(async({data})=>{tenant.integrations=data.integrations})},googleConnection:{findFirst:jest.fn().mockResolvedValue({scopes:'https://www.googleapis.com/auth/drive',disabledServices:[]})},creativeReference:{findUnique:jest.fn().mockResolvedValue({id:'reference'}),updateMany:jest.fn() },$queryRaw:jest.fn()};db.$transaction=jest.fn(async fn=>fn(db));
 const references:any={authorize:jest.fn(),import:jest.fn().mockResolvedValue({id:'reference'}),analyze:jest.fn()};const google:any={token:jest.fn().mockResolvedValue('test-token'),assertScope:jest.fn()};
 const file={id:'imageaaaaa1',name:'Brand.png',mimeType:'image/png',size:'100',modifiedTime:'2026-10-27T00:00:00Z',md5Checksum:'version-one'};
 const fetch=jest.spyOn(global,'fetch').mockImplementation(async()=>new Response(JSON.stringify({files:[file]})));
 return {tenant,db,references,google,file,fetch,service:new MarketingLibraryService(db,google,references)};
}
describe('incremental marketing library synchronization',()=>{
 afterEach(()=>jest.restoreAllMocks());
 it('scans changed metadata but avoids downloading and analyzing an unchanged image twice',async()=>{const x=setup();expect(await x.service.sync(req,true)).toMatchObject({files:1,updated:1,reused:0});expect(await x.service.sync(req,true)).toMatchObject({files:1,updated:0,reused:1});expect(x.references.import).toHaveBeenCalledTimes(1);expect(x.references.analyze).toHaveBeenCalledTimes(1);x.file.md5Checksum='version-two';expect(await x.service.sync(req,true)).toMatchObject({updated:1});expect(x.references.analyze).toHaveBeenCalledTimes(2);expect(x.tenant.integrations.crm.keep).toBe(true)});
 it('does not overwrite a different folder selected while an old scan was running',async()=>{const x=setup();x.tenant.integrations.marketing.fileIds=['removedaaaa1'];x.references.import.mockImplementation(async()=>{x.tenant.integrations.marketing={...x.tenant.integrations.marketing,folderId:'folderbbbbb2',fileIds:['currentaaaa1']};return {id:'reference'}});await expect(x.service.sync(req,true)).rejects.toThrow('mudou durante');expect(x.tenant.integrations.marketing.fileIds).toEqual(['currentaaaa1']);expect(x.db.creativeReference.updateMany).not.toHaveBeenCalled();expect(x.db.tenant.update).not.toHaveBeenCalled()});
 it('preserves a publication preference changed during synchronization',async()=>{const x=setup();x.references.analyze.mockImplementation(async()=>{x.tenant.integrations.marketing={...x.tenant.integrations.marketing,autoPublish:false}});await x.service.sync(req,true);expect(x.tenant.integrations.marketing.autoPublish).toBe(false)});
 it('does not mark failed image analysis as an up-to-date reference',async()=>{const x=setup();x.references.analyze.mockRejectedValue(new Error('Unreadable image'));await expect(x.service.sync(req,true)).rejects.toThrow('referências');expect(x.tenant.integrations.marketing.fileVersions.imageaaaaa1).toBeUndefined();expect(x.tenant.integrations.marketing.syncErrors).toHaveLength(1)});
});
