import {assertProductRoute,assertSocialRequest,assertDraftInput} from './product-scope';
import {ZernioService} from '../operations/zernio.service';
import {AiModule} from '../ai/ai.module';
import {CommunicationsModule} from '../communications/communications.module';
describe('focused product release',()=>{
 afterEach(()=>jest.restoreAllMocks());
 it.each(['/api/wordpress/pages','/api/communications/gateways/sms','/api/mail/campaigns/123/send','/api/marketing/jobs','/api/marketing/prepared/upload','/api/assistant/automations/123/publish'])('blocks retired writes %s',path=>expect(()=>assertProductRoute(path,'POST')).toThrow());
 it.each(['/api/conversations/123/messages','/api/marketing/drafts','/api/marketing/drafts/123/review','/api/workflows','/api/creative-references/upload'])('preserves core actions %s',path=>expect(()=>assertProductRoute(path,'POST')).not.toThrow());
 it('allows historical reads and draft approval without enabling publishing',()=>{expect(()=>assertProductRoute('/api/assistant/automations/123','GET')).not.toThrow();expect(()=>assertDraftInput({question:'Tema',format:'POST',publish:false})).not.toThrow();expect(()=>assertDraftInput({question:'Tema',format:'VIDEO'})).toThrow();});
 it('blocks social sends before credentials or external requests, retaining inbox messaging',async()=>{
  const fetch=jest.spyOn(global,'fetch');
  await expect(new ZernioService().request('/posts',{method:'POST'})).rejects.toThrow('desativados');
  expect(fetch).not.toHaveBeenCalled();
  expect(()=>assertSocialRequest('/messages','POST')).not.toThrow();
 });
 it('does not instantiate retired polling workers or SMS/mail controllers',()=>{
  const names=(module:any,key:string)=>(Reflect.getMetadata(key,module)||[]).map((v:any)=>v.name);
  expect(names(AiModule,'providers')).not.toEqual(expect.arrayContaining(['MarketingJobsService','PublicationFoldersService','VideoRenderService']));
  expect(names(CommunicationsModule,'providers')).not.toContain('MailService');
  expect(names(CommunicationsModule,'controllers')).not.toEqual(expect.arrayContaining(['GatewaysController','MailController']));
 });
});
