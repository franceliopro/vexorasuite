import {selectMessageAutomation} from './runtime-scope';
import {publicationKey,selectPublication,scopedPresetInstructions} from './runtime-scope';

describe('runtime scope',()=>{
 const flow:any={name:'Flow'};
 const p=(revision:string,active=true,source:'ui'|undefined='ui')=>({revision,active,source,flow});
 const root={intelligencePublished:p('default'),intelligencePublications:{'department:link':p('link'),'department:tracking':p('tracking'),'user:ana:department:link':p('ana-link')}};
 it('ignores legacy publications without an explicit UI source',()=>{
   expect(selectPublication({intelligencePublished:{revision:'legacy',active:true,flow}},{})).toBeNull();
 });
 it('selects the attendants direct configuration only in the selected department',()=>{
 expect(selectPublication(root,{departmentId:'link',userId:'ana'})?.publication.revision).toBe('ana-link');
 expect(selectPublication(root,{departmentId:'tracking',userId:'ana'})?.publication.revision).toBe('tracking');
 });
 it('inherits the departments publication without copying it to each attendant',()=>{
 expect(selectPublication(root,{departmentId:'link',userId:'other'})?.publication.revision).toBe('link');
 });
 it('keeps an explicit departmental pause from falling back to company automation',()=>{
 const paused={...root,intelligencePublications:{...root.intelligencePublications,'department:link':p('paused',false)}};
 expect(selectPublication(paused,{departmentId:'link'})?.publication.active).toBe(false);
 });
 it('does not use an unscoped personal flow inside another department',()=>{
 const personal={...root,intelligencePublications:{'user:ana':p('personal')}};
 expect(selectPublication(personal,{departmentId:'tracking',userId:'ana'})?.publication.revision).toBe('default');
 expect(publicationKey({userId:'ana',departmentId:'link'})).toBe('user:ana:department:link');
 });
 it('includes only this departments instructions and matching direct specialization',()=>{
 const context={businessPresets:{a:{departmentId:'link',agentInstructions:'Link only'},b:{departmentId:'tracking',agentInstructions:'Tracking only'},c:{userId:'ana',preset:'FINANCE',agentInstructions:'Ana finance'},d:{userId:'ana',preset:'SUPPORT',agentInstructions:'Ana support'},e:{userId:'bob',agentInstructions:'Bob'}}};
 expect(scopedPresetInstructions(context,{departmentId:'link',userId:'ana'},'FINANCE')).toBe('Link only\nAna finance');
 });
});

describe('named message automations',()=>{
 const root={intelligencePublications:{
  'automation:welcome':{active:true,source:'ui',revision:'welcome',flow:{channelIds:['whatsapp'],triggers:[{kind:'first_message'}]}},
  'automation:offer':{active:true,source:'ui',revision:'offer',flow:{channelIds:['instagram'],triggers:[{kind:'keyword',keyword:'Eu quero'}]}},
  'automation:default':{active:true,source:'ui',revision:'default',flow:{channelIds:['instagram'],triggers:[{kind:'message'}]}},
 }};
 it('routes first WhatsApp messages and Instagram words to different active flows',()=>{
  expect(selectMessageAutomation(root,{},{channelId:'whatsapp',text:'Olá',firstMessage:true})?.key).toBe('automation:welcome');
  expect(selectMessageAutomation(root,{},{channelId:'instagram',text:'EU QUERO',firstMessage:true})?.key).toBe('automation:offer');
  expect(selectMessageAutomation(root,{},{channelId:'whatsapp',text:'Eu quero',firstMessage:false})).toBeNull();
 });
 it('continues the same published automation when awaiting a reply',()=>{
  expect(selectMessageAutomation(root,{},{channelId:'instagram',text:'azul',firstMessage:false,previousKey:'automation:offer',previousRevision:'offer'})?.key).toBe('automation:offer');
  expect(selectMessageAutomation(root,{},{channelId:'instagram',text:'azul',firstMessage:false})?.key).toBe('automation:default');
 });
});
