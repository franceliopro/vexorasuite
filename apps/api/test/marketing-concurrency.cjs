const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {MarketingJobsService}=require('../dist/ai/marketing-jobs.service');
async function main(){
 const db=new URL(process.env.DATABASE_URL||'');assert(process.env.CI==='true'&&['localhost','127.0.0.1'].includes(db.hostname),'Use the isolated CI database');
 const prisma=new PrismaClient();const tenant=await prisma.tenant.create({data:{name:'Marketing concurrency',slug:'ci-'+randomUUID(),integrations:{assistant:{enabled:true}}}});
 const user=await prisma.user.create({data:{name:'CI owner',email:randomUUID()+'@example.test',passwordHash:'not-a-login-credential'}});
 try{
  await prisma.membership.create({data:{tenantId:tenant.id,userId:user.id,role:'OWNER'}});
  const req={user:{tenantId:tenant.id,sub:user.id,role:'OWNER'}};let executions=0;
  const automation={authorize(){},async createCarousel(){executions++;await new Promise(r=>setTimeout(r,50));return {automation:{id:randomUUID()},sources:[]};},async publish(){throw Error('No external publication allowed');}};
  const library={async config(){return {autoPublish:false}},async sync(){return {files:1}}};
  const a=new MarketingJobsService(prisma,automation,library,{},{}),b=new MarketingJobsService(prisma,automation,library,{},{});
  const key=randomUUID(),input={question:'Conteúdo de teste',format:'POST',publish:false};
  const [first,second]=await Promise.all([a.enqueue(req,input,key),b.enqueue(req,input,key)]);assert.equal(first.job.id,second.job.id);
  await Promise.all([a.tick(),b.tick()]);assert.equal(executions,1);assert.equal((await prisma.marketingJob.findUniqueOrThrow({where:{id:first.job.id}})).status,'COMPLETED');
  const workflow=await a.saveWorkflow(req,{...input,name:'CI workflow',everyDays:1,nextRunAt:new Date(Date.now()+3600000).toISOString()});
  await prisma.marketingWorkflow.update({where:{id:workflow.id},data:{nextRunAt:new Date(Date.now()-60000)}});
  await Promise.all([a.tick(),b.tick()]);assert.equal(await prisma.marketingJob.count({where:{tenantId:tenant.id,requestKey:{startsWith:'workflow:'+workflow.id}}}),1);assert.equal(executions,2);
  const next=await prisma.marketingWorkflow.findUniqueOrThrow({where:{id:workflow.id}});assert(next.nextRunAt>Date.now());
  const revoked=await a.enqueue(req,input,randomUUID());await prisma.membership.deleteMany({where:{tenantId:tenant.id,userId:user.id}});await a.tick();assert.equal((await prisma.marketingJob.findUniqueOrThrow({where:{id:revoked.job.id}})).status,'FAILED');assert.equal(executions,2);
  console.log('PostgreSQL: duplicate requests, two workers, recurring scheduling and revoked access passed');
 }finally{await prisma.tenant.delete({where:{id:tenant.id}});await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
