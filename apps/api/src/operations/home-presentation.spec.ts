import sharp from 'sharp';
import {HomePresentationController,presentationImage} from './home-presentation.controller';
describe('private company presentation',()=>{
 const req:any={user:{tenantId:'company-a',sub:'owner',role:'OWNER',allowedModules:['SETTINGS']}};
 const input={revision:'0',desktopColor:'#F7F8FC',mobileColor:'#10131B',desktopMode:'cover',mobileMode:'contain',desktopRemove:'false',mobileRemove:'false'};
 it('rejects an image from another context before reading the database',async()=>{
  const db:any={homePresentation:{findUnique:jest.fn()}};
  await expect(new HomePresentationController(db).image(req,'desktop','company-b',{} as any)).rejects.toThrow('não encontrada');
  expect(db.homePresentation.findUnique).not.toHaveBeenCalled();
 });
 it('blocks a company owner whose settings module was denied before any write',async()=>{
  const db:any={$transaction:jest.fn()};
  await expect(new HomePresentationController(db).save({user:{...req.user,allowedModules:[]}} as any,input,{})).rejects.toThrow('configuração');
  expect(db.$transaction).not.toHaveBeenCalled();
 });
 it('rejects SVG, malformed image data and oversized files',async()=>{
  await expect(presentationImage({mimetype:'image/svg+xml',buffer:Buffer.from('<svg/>')})).rejects.toThrow();
  await expect(presentationImage({mimetype:'image/png',buffer:Buffer.from('invalid')})).rejects.toThrow();
  await expect(presentationImage({mimetype:'image/png',buffer:Buffer.alloc(2*1024*1024+1)})).rejects.toThrow();
 });
 it('decodes and reencodes an uploaded image as WebP',async()=>{
  const buffer=await sharp({create:{width:16,height:12,channels:4,background:'#6258df'}}).png().toBuffer();
  const bytes=await presentationImage({mimetype:'image/png',buffer});
  expect((await sharp(bytes).metadata()).format).toBe('webp');
 });
 it('refuses an outdated revision without overwriting current images',async()=>{
  const tx:any={$queryRaw:jest.fn(),homePresentation:{findUnique:jest.fn().mockResolvedValue({revision:2}),upsert:jest.fn()}},db:any={$transaction:(fn:any)=>fn(tx)};
  await expect(new HomePresentationController(db).save(req,input,{})).rejects.toThrow('outra janela');
  expect(tx.homePresentation.upsert).not.toHaveBeenCalled();
 });
 it('updates only the requested picture while preserving the other device in an atomic save',async()=>{
  const tx:any={$queryRaw:jest.fn(),homePresentation:{findUnique:jest.fn().mockResolvedValue(null),upsert:jest.fn().mockResolvedValue({revision:1,desktopMode:'cover',mobileMode:'contain',mobileImage:Buffer.from('existing')})},auditLog:{create:jest.fn()}},db:any={$transaction:(fn:any)=>fn(tx)};
  const result=await new HomePresentationController(db).save(req,{...input,desktopRemove:'true'},{});
  const args=tx.homePresentation.upsert.mock.calls[0][0];
  expect(args.where).toEqual({tenantId:'company-a'});expect(args.update.desktopImage).toBeNull();expect(args.update).not.toHaveProperty('mobileImage');
  expect(result.mobile.image).toContain('context=company-a');
 });
});
