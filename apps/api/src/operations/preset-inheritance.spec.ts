import {inheritedPresets} from './preset-inheritance';
describe('preset inheritance',()=>{
 const assignments={link:{departmentId:'link',preset:'FINANCE',pipeline:'link-pipeline'},tracking:{departmentId:'tracking',preset:'FINANCE',pipeline:'tracking-pipeline'},foreign:{departmentId:'foreign'},personal:{userId:'alice',preset:'SUPPORT'},other:{userId:'bob'}};
 it('inherits two finance departments without merging their contexts',()=>{
 const result=inheritedPresets(assignments,'alice',['link','tracking']);
 expect(result.map(p=>p.id)).toEqual(['link','tracking','personal']);
 expect(result.filter(p=>p.source==='DEPARTMENT').map(p=>p.contextDepartmentId)).toEqual(['link','tracking']);
 expect(result.find(p=>p.id==='personal')?.source).toBe('DIRECT');
 });
 it('stops inheriting a department after membership removal',()=>{
 expect(inheritedPresets(assignments,'alice',['link']).map(p=>p.id)).toEqual(['link','personal']);
 });
 it('does not inherit unassigned departments or another users patterns',()=>{
 expect(inheritedPresets(assignments,'carol',[])).toEqual([]);
 });
});
