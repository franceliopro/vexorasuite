export type PresetAssignment={departmentId?:string|null;userId?:string|null;[key:string]:unknown};
/** Keep separate contexts: two finance teams must never share credentials or pipelines. */
export type EffectivePreset=PresetAssignment&{id:string;source:'DIRECT'|'DEPARTMENT';contextDepartmentId:string|null};
export function inheritedPresets(assignments:Record<string,PresetAssignment>, userId:string, departmentIds:string[]){
 const allowed=new Set(departmentIds);
 return Object.entries(assignments).flatMap<EffectivePreset>(([id,preset])=>{
 if(preset.userId===userId)return [{...preset,id,source:'DIRECT' as const,contextDepartmentId:null}];
 if(!preset.userId&&preset.departmentId&&allowed.has(preset.departmentId))return [{...preset,id,source:'DEPARTMENT' as const,contextDepartmentId:preset.departmentId}];
 return [];
 });
}


