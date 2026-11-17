const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {compare}=require("bcryptjs");
const {PrismaClient}=require("@prisma/client");
const {TeamController}=require("../dist/operations/team.controller");
async function main(){
 const url=new URL(process.env.DATABASE_URL||"");
 assert(process.env.CI==="true"&&["localhost","127.0.0.1"].includes(url.hostname),"Use isolated CI database only");
 const prisma=new PrismaClient();
 const tenant=await prisma.tenant.create({data:{name:"Team CI",slug:"team-"+randomUUID(),entitlements:{modules:["CRM"]}}});
 const admin=await prisma.user.create({data:{name:"Admin",email:randomUUID()+"@example.test",passwordHash:"ci-only"}});
 let user;
 const messages=[];
 const mail={configured:true,send:async message=>{messages.push(message);return {delivered:true};}};
 const req={user:{tenantId:tenant.id,tenantSlug:tenant.slug,sub:admin.id,role:"OWNER",allowedModules:["CRM","CALENDAR"]}};
 const controller=new TeamController(prisma,{publish(){}},mail);
 try{
  await prisma.membership.create({data:{tenantId:tenant.id,userId:admin.id,role:"OWNER"}});
  const department=await prisma.department.create({data:{tenantId:tenant.id,name:"Equipe",key:"EQUIPE",modules:["CRM","CALENDAR"]}});
  user=await controller.create(req,{name:"João da Silva",knownBy:"Joca",email:randomUUID()+"@example.test",departmentIds:[department.id],modules:["CRM","CALENDAR"]});
  assert.equal(user.passwordEmail,"accepted");
  assert.equal(messages[0].to,user.email);
  assert(messages[0].text.includes("Olá, Joca!"));
  assert(messages[0].text.includes(tenant.slug));
  assert(messages[0].text.includes(user.temporaryPassword));
  const row=(await controller.list(req)).find(item=>item.id===user.id);
  assert.deepEqual(row.effectiveAccessModules,["CRM"]);
  assert.equal(row.canResetPassword,true);
  const reset=await controller.resetPassword(req,user.id);
  assert.equal(reset.passwordEmail,"accepted");
  assert.equal(messages[1].to,user.email);
  assert(messages[1].text.includes("Olá, Joca!"));
  assert(messages[1].text.includes(reset.temporaryPassword));
  const credential=await prisma.user.findUniqueOrThrow({where:{id:user.id}});
  assert.equal(credential.mustChangePassword,true);
  assert(await compare(reset.temporaryPassword,credential.passwordHash));
  assert(!await compare(user.temporaryPassword,credential.passwordHash));
  mail.configured=false;
  assert.equal((await controller.resetPassword(req,user.id)).passwordEmail,"unavailable");
  assert.equal(messages.length,2);
  mail.configured=true;
  mail.send=async()=>{throw Error("SMTP unavailable");};
  assert.equal((await controller.resetPassword(req,user.id)).passwordEmail,"failed");
  console.log("Team temporary passwords and effective module access OK.");
 }finally{
  await prisma.tenant.delete({where:{id:tenant.id}});
  await prisma.user.deleteMany({where:{id:{in:[admin.id,...(user?[user.id]:[])]}}});
  await prisma.$disconnect();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
