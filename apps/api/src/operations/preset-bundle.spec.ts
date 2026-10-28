import {materializePresetBundle} from './preset-bundle';
describe('department bundles',()=>{
 it('creates a disabled AI template and scoped internal workflow without replacing existing agents',async()=>{
  const root:any={assistant:{enabled:true,name:'Véxora',agents:[{id:'existing',name:'Custom'}]}};
  const tx:any={internalWorkflow:{create:jest.fn(async({data})=>({id:'workflow',...data}))}};
  const bundle=await materializePresetBundle(tx,{tenantId:'tenant',actorId:'owner'},root,'assignment',{name:'Financeiro Link',preset:'FINANCE',departmentId:'link',userId:null,modules:['INBOX','CRM','FINANCE'],pipelineId:'pipeline',agentInstructions:'Confirme os dados.'},{},true);
  expect(root.assistant.enabled).toBe(true);expect(root.assistant.agents[0].id).toBe('existing');
  expect(root.assistant.agents[1]).toMatchObject({enabled:false,tier:'Econômico',bindings:{mode:'specialist',pipelines:['pipeline']}});
  expect(tx.internalWorkflow.create.mock.calls[0][0].data).toMatchObject({enabled:true,filters:{departmentId:'link',assigneeId:null},steps:[{type:'TASK'}]});
  expect(bundle.bundleVersion).toBe(2);
 });
 it('preserves an edited agent and workflow when reloading a pattern',async()=>{
  const root:any={assistant:{agents:[{id:'agent',name:'Personalizado',enabled:true}]}},workflow={id:'workflow',enabled:true};
  const tx:any={internalWorkflow:{findFirst:jest.fn(async()=>workflow),create:jest.fn(),update:jest.fn()}};
  await materializePresetBundle(tx,{tenantId:'tenant',actorId:'owner'},root,'assignment',{name:'Financeiro',modules:[]},{agentId:'agent',workflowId:'workflow'});
  expect(root.assistant.agents[0].name).toBe('Personalizado');expect(root.assistant.agents[0].enabled).toBe(true);
  expect(tx.internalWorkflow.create).not.toHaveBeenCalled();expect(tx.internalWorkflow.update).not.toHaveBeenCalled();
 });
});
