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
