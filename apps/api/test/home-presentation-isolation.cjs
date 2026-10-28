const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const sharp=require('sharp');
const {HomePresentationController}=require('../dist/operations/home-presentation.controller');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');
 assert(process.env.CI==='true'&&['localhost','127.0.0.1'].includes(url.hostname),'Use isolated CI database only');
 const db=new PrismaClient(),a=randomUUID(),b=randomUUID(),userId=randomUUID();
 try{
  await db.user.create({data:{id:userId,email:randomUUID()+'@example.test',name:'Presentation owner',passwordHash:'not-a-login'}});
  await db.tenant.createMany({data:[{id:a,name:'Company A',slug:'a-'+a,integrations:{keep:'unchanged'}},{id:b,name:'Company B',slug:'b-'+b}]});
  await db.membership.createMany({data:[{tenantId:a,userId,role:'OWNER'},{tenantId:b,userId,role:'OWNER'}]});
  const controller=new HomePresentationController(db),request=id=>({user:{tenantId:id,sub:userId,role:'OWNER',allowedModules:['SETTINGS']}});
  const input={revision:'0',desktopColor:'#F7F8FC',mobileColor:'#10131B',desktopMode:'cover',mobileMode:'contain',desktopRemove:'false',mobileRemove:'false'};
  const buffer=await sharp({create:{width:20,height:10,channels:3,background:'#6258df'}}).png().toBuffer();
  const saved=await controller.save(request(a),input,{desktop:[{mimetype:'image/png',buffer}]});
  assert(saved.desktop.image.includes('context='+a));assert.equal(saved.mobile.image,null);
  assert.equal((await controller.read(request(b))).desktop.image,null);
  await assert.rejects(()=>controller.image(request(b),'desktop',a,{}),{name:'NotFoundException'});
  await assert.rejects(()=>controller.save({user:{...request(a).user,allowedModules:[]}},input,{}),{name:'ForbiddenException'});
  const results=await Promise.allSettled([controller.save(request(a),{...input,revision:'1',desktopMode:'tile'},{}),controller.save(request(a),{...input,revision:'1',desktopMode:'stretch'},{})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.name==='ConflictException').length,1);
  const row=await db.homePresentation.findUniqueOrThrow({where:{tenantId:a}});
  assert.equal(row.revision,2);assert.equal((await sharp(row.desktopImage).metadata()).format,'webp');
  assert.deepEqual((await db.tenant.findUniqueOrThrow({where:{id:a}})).integrations,{keep:'unchanged'});
  await controller.save(request(a),{...input,revision:'2',desktopRemove:'true'},{});
  assert.equal((await controller.read(request(a))).desktop.image,null);
  console.log('Presentation image isolation, sanitized storage, atomic revisions and deletion OK');
 }finally{await db.tenant.deleteMany({where:{id:{in:[a,b]}}});await db.user.deleteMany({where:{id:userId}});await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
