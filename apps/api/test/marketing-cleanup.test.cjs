const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {cleanup}=require('../scripts/cleanup-retired-marketing.cjs');
test('only deletes known generated marketing media, once, without following symlinks',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vexora-cleanup-'));
 try{
  const tenant=path.join(root,'11111111-1111-4111-8111-111111111111');await fs.mkdir(tenant);
  const generated='22222222-2222-4222-8222-222222222222.mp4';
  for(const file of [generated,'22222222-2222-4222-8222-222222222222-scene-0.png','prepared-22222222-2222-4222-8222-222222222222.preview.jpg','reference.jpg','customer-audio.ogg'])await fs.writeFile(path.join(tenant,file),'fixture');
  const outside=path.join(root,'outside.mp4');await fs.writeFile(outside,'keep');
  await fs.symlink(outside,path.join(tenant,'33333333-3333-4333-8333-333333333333.mp4'));
  assert.equal((await cleanup(root)).removed,3);
  assert.equal(await fs.readFile(path.join(tenant,'reference.jpg'),'utf8'),'fixture');
  assert.equal(await fs.readFile(outside,'utf8'),'keep');
  assert.equal((await cleanup(root)).alreadyDone,true);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
