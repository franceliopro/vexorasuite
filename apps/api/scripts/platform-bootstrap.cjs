// One-time deployment command. Existing verified owner and workspace IDs are mandatory.
const {PrismaClient}=require('@prisma/client');
async function main(){
 const email=process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase(),tenantId=process.env.PLATFORM_TENANT_ID;
 if(!email||!tenantId)throw Error('Configure PLATFORM_OWNER_EMAIL and PLATFORM_TENANT_ID explicitly.');
 const db=new PrismaClient();
 try{await db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73910482)`;
  const owner=await tx.membership.findFirst({where:{tenantId,role:'OWNER',user:{email,isActive:true},tenant:{status:'ACTIVE'}},select:{userId:true}});
  if(!owner)throw Error('The account must already own this active workspace.');
  const other=await tx.tenant.findFirst({where:{kind:'PLATFORM',id:{not:tenantId}},select:{id:true}});
  if(other)throw Error('A different platform workspace is already configured.');
  await tx.tenant.update({where:{id:tenantId},data:{kind:'PLATFORM',name:'Véxora Suite'}});
  await tx.user.update({where:{id:owner.userId},data:{isPlatformAdmin:true}});
  await tx.auditLog.create({data:{tenantId,userId:owner.userId,action:'platform.owner.bootstrapped',entityType:'tenant',entityId:tenantId}});
 });console.log('Platform workspace and owner configured.');}finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
