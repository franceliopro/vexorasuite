const assert = require("node:assert/strict");
const {randomUUID} = require("node:crypto");
const {PrismaClient} = require("@prisma/client");
const {DepartmentsController} = require("../dist/operations/departments.controller");

async function run() {
  const url = new URL(process.env.DATABASE_URL || "");
  assert(process.env.CI === "true" && ["localhost","127.0.0.1"].includes(url.hostname), "Use isolated CI database only");
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.create({data:{name:"Department CI",slug:"department-"+randomUUID()}});
  const actor = await prisma.user.create({data:{name:"Admin",email:randomUUID()+"@example.test",passwordHash:"ci-only"}});
  try {
    await prisma.membership.create({data:{tenantId:tenant.id,userId:actor.id,role:"OWNER"}});
    const request={user:{tenantId:tenant.id,sub:actor.id,role:"OWNER"}};
    const controller=new DepartmentsController(prisma,{publish(){}});
    const department=await prisma.department.create({data:{
      tenantId:tenant.id,name:"Financeiro A",key:"FINANCE_A",modules:["INBOX","CRM"],routingPlatform:"A",routingCategory:"FINANCE",
    }});
    await prisma.departmentMember.create({data:{tenantId:tenant.id,departmentId:department.id,userId:actor.id}});
    const stages=[{id:"custom",name:"Aguardando conferência"}];
    await prisma.crmPipeline.create({data:{tenantId:tenant.id,departmentId:department.id,name:"Financeiro",template:"FINANCE",stages}});
    await prisma.internalWorkflow.create({data:{tenantId:tenant.id,userId:actor.id,name:"Retorno",enabled:true,nextRunAt:new Date(),filters:{departmentId:department.id},steps:[{type:"TASK",text:"Retornar"}]}});
    await prisma.calendarAssignment.create({data:{tenantId:tenant.id,accountId:randomUUID(),calendarId:"agenda-a",departmentId:department.id}});
    const copy=await controller.duplicate(request,department.id,{name:"Financeiro B",routingPlatform:"B"});
    assert.equal(copy.name,"Financeiro B");
    assert.equal(copy.routingCategory,"FINANCE");
    assert.equal(copy.routingPlatform,"B");
    assert.equal((await prisma.department.findUniqueOrThrow({where:{id:department.id}})).routingPlatform,"A");
    assert.deepEqual((await prisma.crmPipeline.findUniqueOrThrow({where:{departmentId:copy.id}})).stages,stages);
    assert.equal(await prisma.departmentMember.count({where:{departmentId:copy.id}}),0);
    assert.equal(await prisma.calendarAssignment.count({where:{departmentId:copy.id}}),0);
    const workflow=await prisma.internalWorkflow.findFirstOrThrow({where:{tenantId:tenant.id,filters:{path:["departmentId"],equals:copy.id}}});
    assert.equal(workflow.enabled,false);
    const same=await controller.duplicate(request,department.id,{});
    assert.equal(same.routingPlatform,"A");
    assert.equal(await prisma.departmentMember.count({where:{departmentId:same.id}}),1);
    assert.equal(await prisma.calendarAssignment.count({where:{departmentId:same.id}}),1);
    console.log("Department duplication supports an independent platform, and preserves the legacy same-platform copy.");
  } finally {
    await prisma.tenant.delete({where:{id:tenant.id}});
    await prisma.user.delete({where:{id:actor.id}});
    await prisma.$disconnect();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
