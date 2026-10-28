import {randomUUID} from 'node:crypto';
import {DEPARTMENT_PRESETS,SEGMENTS,templateFlow} from '../operations/business-templates';
import {pipelineStages} from '../operations/departments.controller';

export async function provisionCompany(tx:any,tenant:any,ownerId:string,segmentId:string,requestId:string){
 const segment=SEGMENTS.find(s=>s.id===segmentId)!;
 const presets:Record<string,any>={},flows:Record<string,any>={},agents:any[]=[];
 for(const key of Object.keys(DEPARTMENT_PRESETS) as (keyof typeof DEPARTMENT_PRESETS)[]){
  const preset=DEPARTMENT_PRESETS[key];
  const department=await tx.department.create({data:{tenantId:tenant.id,key,name:preset.name,modules:preset.modules,routingCategory:preset.category,isActive:true}});
  await tx.departmentMember.create({data:{tenantId:tenant.id,departmentId:department.id,userId:ownerId}});
  const pipeline=await tx.crmPipeline.create({data:{tenantId:tenant.id,departmentId:department.id,name:'CRM · '+department.name,template:key,stages:pipelineStages(key),enabled:true}});
  const id='department:'+department.id+':'+key,agentId=randomUUID();
  const flow=templateFlow(segmentId,key);flow.name='Fluxo '+department.name;
  presets[id]={version:1,departmentId:department.id,departmentKey:key,preset:key,segment:segment.name,modules:preset.modules,agentId,pipelineId:pipeline.id,agentInstructions:segment.guidance};
  flows[id]={version:1,draft:flow};
  agents.push({id:agentId,name:'Assistente '+department.name,role:preset.name,tier:'ECONOMY',enabled:false,instructions:segment.guidance,profile:{tone:'Natural e objetivo',channels:[]},behavior:{rules:'Confirme dados antes de agir. Encaminhe dúvidas à equipe.',prohibitions:'Não inventar consultas ou operações.'},allowedActions:[],bindings:{mode:'SPECIALIST',specialists:[],flows:[id],pipelines:[pipeline.id],externalSystems:[],modules:preset.modules}});
 }
 await tx.tenant.update({where:{id:tenant.id},data:{integrations:{onboarding:{requestId,segmentId,version:1},businessPresets:presets,businessFlows:flows,assistant:{name:'Véxora',wakeWord:'Olá Véxora',enabled:false,agents,dailyAiLimit:100}}}});
}
