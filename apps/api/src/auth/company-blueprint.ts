import {randomUUID} from 'node:crypto';
import {DEPARTMENT_PRESETS,SEGMENTS,templateFlow} from '../operations/business-templates';
import {pipelineStages} from '../operations/departments.controller';

export async function provisionCompany(tx:any,tenant:any,ownerId:string,segmentId:string,requestId:string,platforms:string[]=[]){
 const segment=SEGMENTS.find(s=>s.id===segmentId)!;
 const presets:Record<string,any>={},flows:Record<string,any>={},agents:any[]=[];
 const entries:{presetKey:keyof typeof DEPARTMENT_PRESETS;key:string;name:string;platform?:string}[]=platforms.length?[
  ...platforms.flatMap((name,index)=>(['FINANCE','SUPPORT'] as const).map(presetKey=>({presetKey,key:presetKey+'_P'+(index+1),name:DEPARTMENT_PRESETS[presetKey].name+' · '+name,platform:name}))),
  {presetKey:'SALES',key:'SALES',name:'Comercial'},{presetKey:'GENERAL',key:'ADMINISTRATION',name:'Administrativo'}
 ]:(Object.keys(DEPARTMENT_PRESETS) as (keyof typeof DEPARTMENT_PRESETS)[]).map(key=>({presetKey:key,key,name:DEPARTMENT_PRESETS[key].name}));
 for(const entry of entries){
  const {presetKey:key}=entry,preset=DEPARTMENT_PRESETS[key];
  const department=await tx.department.create({data:{tenantId:tenant.id,key:entry.key,name:entry.name,modules:preset.modules,routingCategory:preset.category,routingPlatform:entry.platform||null,isActive:true}});
  await tx.departmentMember.create({data:{tenantId:tenant.id,departmentId:department.id,userId:ownerId}});
  const pipeline=await tx.crmPipeline.create({data:{tenantId:tenant.id,departmentId:department.id,name:'CRM · '+department.name,template:key,stages:pipelineStages(key),enabled:true}});
  const workflow=await tx.internalWorkflow.create({data:{tenantId:tenant.id,userId:ownerId,name:'Acompanhamento · '+department.name,enabled:false,trigger:'INBOX',timezone:'America/Sao_Paulo',nextRunAt:new Date(),repeatDays:0,filters:{departmentId:department.id,stopOnReply:true},steps:[{type:'TASK',text:'Revisar solicitação de '+department.name+' e registrar o próximo passo.',minutes:0}]}});
  const id='department:'+department.id+':'+key,agentId=randomUUID();
  const flow=templateFlow(segmentId,key);flow.name='Fluxo '+department.name;
  for(const step of flow.steps)if(step.action==='human.handoff')step.config=JSON.stringify({targetMode:'DEPARTMENT',departmentKey:department.key});
  presets[id]={version:1,bundleVersion:2,workflowId:workflow.id,departmentId:department.id,departmentKey:key,preset:key,segment:segment.name,modules:preset.modules,agentId,pipelineId:pipeline.id,agentInstructions:segment.guidance};
  flows[id]={version:1,draft:flow};
  agents.push({id:agentId,name:'Assistente '+department.name,role:preset.name,tier:'Econômico',enabled:false,instructions:segment.guidance,profile:{tone:'Natural e objetivo',channels:[]},behavior:{rules:'Confirme dados antes de agir. Encaminhe dúvidas à equipe.',prohibitions:'Não inventar consultas ou operações.'},allowedActions:[],bindings:{mode:'specialist',specialists:[],flows:[id],pipelines:[pipeline.id],externalSystems:[],modules:preset.modules}});
 }
 await tx.tenant.update({where:{id:tenant.id},data:{integrations:{onboarding:{requestId,segmentId,platforms,version:2},businessPresets:presets,businessFlows:flows,assistant:{name:'Véxora',wakeWord:'Olá Véxora',enabled:false,agents,dailyAiLimit:100}}}});
}
