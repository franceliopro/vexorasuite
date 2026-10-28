/** A bot context is not a human assignment, even when it already has a department. */
export function assignedConversationScope(tenantId:string,userId:string,departmentIds:string[]){
 return {handlingMode:'HUMAN' as const,OR:[{assigneeId:userId},{departmentId:{in:departmentIds}},{participants:{some:{tenantId,userId}}}]};
}
export function assignmentRecipient(conversation:{handlingMode?:string;assigneeId?:string|null;departmentId?:string|null},userId:string,departmentIds:string[],settings:{users?:boolean;departments?:boolean}={}){
 if(conversation.handlingMode!=='HUMAN')return false;
 if(conversation.assigneeId)return settings.users!==false&&conversation.assigneeId===userId;
 return settings.departments!==false&&!!conversation.departmentId&&departmentIds.includes(conversation.departmentId);
}
