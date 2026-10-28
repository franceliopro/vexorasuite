const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
async function main(){
 const base=new URL(process.env.DATABASE_URL||'');
 assert(process.env.CI==='true'&&['localhost','127.0.0.1'].includes(base.hostname),'Isolated CI database only');
 const schema='retirement_'+randomUUID().replaceAll('-','');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vexora-upgrade-'));
 const url=new URL(base);url.searchParams.set('schema',schema);
 const admin=new PrismaClient(),db=new PrismaClient({datasourceUrl:url.toString()});
 const migration='20261028030000_retire_marketing_campaigns';
 const deploy=()=>{const result=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',path.join(root,'schema.prisma')],{env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8'});assert.equal(result.status,0,result.stderr||'Migration failed');};
 try{
  await fs.copyFile('prisma/schema.prisma',path.join(root,'schema.prisma'));
  await fs.mkdir(path.join(root,'migrations'));
  for(const entry of await fs.readdir('prisma/migrations',{withFileTypes:true})){
   if(entry.name===migration)continue;
   await fs.cp(path.join('prisma/migrations',entry.name),path.join(root,'migrations',entry.name),{recursive:true});
  }
  deploy();
  const tenant=await db.tenant.create({data:{name:'Keep company',slug:'cleanup-'+randomUUID(),integrations:{brandSettings:{primaryColor:'#123456'},marketing:{autoPublish:true}}}});
  const user=await db.user.create({data:{name:'Keep user',email:randomUUID()+'@example.test',passwordHash:'fixture'}});
  const contact=await db.contact.create({data:{tenantId:tenant.id,name:'Keep contact',metadata:{notes:'keep',asaas:{customerId:'cus_fixture'}}}});
  const conversation=await db.conversation.create({data:{tenantId:tenant.id,contactId:contact.id}});
  const message=await db.message.create({data:{tenantId:tenant.id,conversationId:conversation.id,direction:'INBOUND',content:'Keep conversation',status:'RECEIVED'}});
  const reference=await db.creativeReference.create({data:{tenantId:tenant.id,fileId:'keep-reference',name:'Keep source',mimeType:'image/png'}});
  await db.auditLog.create({data:{tenantId:tenant.id,action:'assistant.carousel',entityType:'automation',entityId:randomUUID(),details:{status:'DRAFT'}}});
  await db.auditLog.create({data:{tenantId:tenant.id,action:'security.keep',entityType:'tenant'}});
  await db.$executeRawUnsafe('INSERT INTO marketing_jobs (id,tenant_id,user_id,request_key,status,payload,run_at,created_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::jsonb,NOW(),NOW())',randomUUID(),tenant.id,user.id,randomUUID(),'QUEUED','{}');
  await fs.cp(path.join('prisma/migrations',migration),path.join(root,'migrations',migration),{recursive:true});
  deploy();
  assert.equal(await db.contact.count({where:{id:contact.id}}),1);
  assert.equal(await db.message.count({where:{id:message.id}}),1);
  assert.equal(await db.creativeReference.count({where:{id:reference.id}}),1);
  assert.deepEqual((await db.contact.findUniqueOrThrow({where:{id:contact.id}})).metadata,{notes:'keep',asaas:{customerId:'cus_fixture'}});
  assert.deepEqual((await db.tenant.findUniqueOrThrow({where:{id:tenant.id}})).integrations,{brandSettings:{primaryColor:'#123456'}});
  assert.equal(await db.auditLog.count({where:{action:'assistant.carousel'}}),0);
  assert.equal(await db.auditLog.count({where:{action:'security.keep'}}),1);
  const missing=await db.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name IN ('marketing_jobs','mail_accounts','prepared_publications')",schema);
  assert.equal(missing.length,0);
  console.log('Retirement upgrade preserves contacts, conversations, financial metadata, references and branding; removes retired tables and generated histories.');
 }finally{
  await db.$disconnect();
  await admin.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
  await admin.$disconnect();
  await fs.rm(root,{recursive:true,force:true});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
