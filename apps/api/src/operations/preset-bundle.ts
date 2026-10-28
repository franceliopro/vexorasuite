import {BadRequestException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
export async function materializePresetBundle(tx:any,context:{tenantId:string;actorId:string},root:any,id:string,assignment:any,previous:any={},activateWorkflow?:boolean){
 const assistant=root.assistant&&typeof root.assistant==='object'?root.assistant:{name:'Véxora',wakeWord:'Olá Véxora',enabled:false,dailyAiLimit:100};
 const agents=Array.isArray(assistant.agents)?[...assistant.agents]:[];
 let agent=agents.find((a:any)=>a.id===previous.agentId);
 if(!agent){
  if(agents.length>=30)throw new BadRequestException('O limite de 30 agentes foi atingido. Remova um agente antes de carregar outro padrão.');
  agent={id:randomUUID(),name:('Assistente '+assignment.name).slice(0,80),role:assignment.preset,tier:'Econômico',enabled:false,instructions:assignment.agentInstructions,profile:{tone:'Natural e objetivo',channels:[]},behavior:{rules:'Confirme dados antes de agir e encaminhe dúvidas à equipe responsável.',prohibitions:'Não inventar consultas, valores ou operações.'},allowedActions:[],bindings:{mode:'specialist',specialists:[],flows:[id],pipelines:assignment.pipelineId?[assignment.pipelineId]:[],externalSystems:[],modules:assignment.modules},...(assistant.llm?{llm:assistant.llm}:{})};
  agents.push(agent);
 }
 let workflow=previous.workflowId?await tx.internalWorkflow.findFirst({where:{id:previous.workflowId,tenantId:context.tenantId}}):null;
 if(!workflow)workflow=await tx.internalWorkflow.create({data:{tenantId:context.tenantId,userId:context.actorId,name:('Acompanhamento · '+assignment.name).slice(0,120),enabled:activateWorkflow===true,trigger:'INBOX',timezone:'America/Sao_Paulo',nextRunAt:new Date(),repeatDays:0,filters:{departmentId:assignment.departmentId||null,assigneeId:assignment.userId||null,stopOnReply:true},steps:[{type:'TASK',text:'Revisar solicitação de '+assignment.name+' e registrar o próximo passo.',minutes:0}]}});
 else if(activateWorkflow!==undefined)workflow=await tx.internalWorkflow.update({where:{id:workflow.id},data:{enabled:activateWorkflow}});
 root.assistant={...assistant,agents};
 return {...previous,...assignment,bundleVersion:2,version:1,agentId:agent.id,workflowId:workflow.id};
}
