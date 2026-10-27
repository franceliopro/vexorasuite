const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {PublicationFoldersService}=require('../dist/ai/publication-folders.service');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');assert(process.env.CI==='true'&&['localhost','127.0.0.1'].includes(url.hostname),'Use the isolated CI database');
 const prisma=new PrismaClient(),tenant=await prisma.tenant.create({data:{name:'Prepared concurrency',slug:'ci-ready-'+randomUUID()}}),user=await prisma.user.create({data:{email:randomUUID()+'@example.test',name:'Owner',passwordHash:'not-a-login'}});
 try{
  await prisma.membership.create({data:{tenantId:tenant.id,userId:user.id,role:'OWNER'}});
  const req={user:{tenantId:tenant.id,sub:user.id,role:'OWNER'}},channel=await prisma.channelConnection.create({data:{tenantId:tenant.id,provider:'ZERNIO',name:'CI Instagram',sessionName:'ci-'+randomUUID(),status:'CONNECTED',settings:{platform:'instagram',accountId:'ci-account'}}});
  let sends=0,moves=0,failMove=false;
  const zernio={async request(path){assert.equal(path,'/posts');sends++;return {post:{_id:'ci-post-'+sends,status:'published',platforms:[{accountId:'ci-account',status:'published'}]}}}};
  const media={async prepare(){return {type:'image'}},url(){return 'https://example.test/fixture.jpg'}};
  const drive={async download(){return {type:'image/jpeg',buffer:Buffer.from('fixture')}},async change(){moves++;if(failMove)throw Error('temporary move failure')},async list(){return {files:[]}}};
  const a=new PublicationFoldersService(prisma,drive,{},media,{},zernio),b=new PublicationFoldersService(prisma,drive,{},media,{},zernio);
  const create=extra=>prisma.preparedPublication.create({data:{tenantId:tenant.id,userId:user.id,name:'CI media',type:'image',caption:'Already reviewed caption',channelIds:[channel.id],...extra}});
  const first=await create({});await Promise.all([a.tick(),b.tick()]);assert.equal(sends,1);assert.equal((await prisma.preparedPublication.findUniqueOrThrow({where:{id:first.id}})).status,'PUBLISHED');
  const google=await prisma.googleConnection.create({data:{tenantId:tenant.id,googleAccountId:'ci-'+randomUUID(),email:user.email,scopes:'https://www.googleapis.com/auth/drive',accessTokenEncrypted:'not-a-token',expiresAt:new Date(Date.now()+3600000)}});
  const rule=await prisma.publicationFolder.create({data:{tenantId:tenant.id,userId:user.id,accountId:google.id,folderId:'ci-folder-id',publishedFolderId:'ci-published-id',mode:'READY',enabled:true,channelIds:[channel.id],nextPublishAt:new Date(Date.now()+3600000),nextScanAt:new Date(Date.now()+3600000)}});
  const moving=await create({ruleId:rule.id,accountId:google.id,fileId:'ci-file-move'});failMove=true;
  await a.tick();assert.equal(sends,2);assert.equal(moves,0);await b.tick();assert.equal(moves,1);assert.equal((await prisma.preparedPublication.findUniqueOrThrow({where:{id:moving.id}})).status,'MOVE_PENDING');
  failMove=false;await a.tick();assert.equal(sends,2);assert.equal(moves,2);assert.equal((await prisma.preparedPublication.findUniqueOrThrow({where:{id:moving.id}})).status,'PUBLISHED');
  let reached,release;const started=new Promise(r=>reached=r),blocked=new Promise(r=>release=r);
  drive.download=async()=>{reached();await blocked;return {type:'image/jpeg',buffer:Buffer.from('fixture')}};
  const paused=await create({ruleId:rule.id,accountId:google.id,fileId:'ci-file-pause'});const run=a.tick();await started;await b.toggle(req,rule.id,false);release();await run;
  assert.equal(sends,2);assert.equal((await prisma.preparedPublication.findUniqueOrThrow({where:{id:paused.id}})).status,'FAILED');
  console.log('PostgreSQL: two workers send once; confirmed publications move only afterwards; failed moves retry without reposting; concurrent pause blocks dispatch');
 }finally{await prisma.tenant.delete({where:{id:tenant.id}});await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
