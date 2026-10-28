const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {AuthService}=require('../dist/auth/auth.service');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');
 assert(process.env.CI==='true'&&['localhost','127.0.0.1'].includes(url.hostname),'Use isolated CI database only');
 const db=new PrismaClient(),userId=randomUUID(),sourceId=randomUUID();
 try{
  await db.user.create({data:{id:userId,email:randomUUID()+'@example.test',name:'CI owner',passwordHash:'not-a-login'}});
  await db.tenant.create({data:{id:sourceId,name:'Source CI',slug:'source-'+sourceId}});
  await db.membership.create({data:{userId,tenantId:sourceId,role:'OWNER'}});
  const service=new AuthService(db,{signAsync:async()=> 'ci-token'}),requestId=randomUUID();
  const input={name:'Escola de música CI',segmentId:'music-school',requestId};
  const results=await Promise.all([service.createCompany(userId,sourceId,input),service.createCompany(userId,sourceId,input)]);
  const targetId=results[0].tenant.id;assert.equal(results[1].tenant.id,targetId);
  assert.notEqual(targetId,sourceId);assert.equal(await db.department.count({where:{tenantId:targetId}}),4);
  assert.equal(await db.crmPipeline.count({where:{tenantId:targetId}}),4);
  assert.equal(await db.internalWorkflow.count({where:{tenantId:targetId}}),4);
  assert.equal(await db.department.count({where:{tenantId:sourceId}}),0);
  const tenant=await db.tenant.findUniqueOrThrow({where:{id:targetId}});
  assert.equal(tenant.integrations.onboarding.segmentId,'music-school');assert.equal(tenant.integrations.assistant.agents.length,4);
  await assert.rejects(()=>service.companySession(userId,randomUUID()));
  console.log('Company creation, concurrent idempotency and isolation OK');
 }finally{
  const rows=await db.membership.findMany({where:{userId},select:{tenantId:true}});
  await db.tenant.deleteMany({where:{id:{in:rows.map(r=>r.tenantId)}}});
  await db.user.deleteMany({where:{id:userId}});await db.$disconnect();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1});
