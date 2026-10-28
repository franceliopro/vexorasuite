import {assignedConversationScope,assignmentRecipient} from './conversation-visibility';
describe('human assignment visibility and notifications',()=>{
 it('keeps bot contexts out of every agent queue, including all-open',()=>{expect(assignedConversationScope('company','ana',['finance-link'])).toEqual({handlingMode:'HUMAN',OR:[{assigneeId:'ana'},{departmentId:{in:['finance-link']}},{participants:{some:{tenantId:'company',userId:'ana'}}}]});});
 it('does not notify bots, unassigned queues or another platform',()=>{
  expect(assignmentRecipient({handlingMode:'BOT',departmentId:'link'},'ana',['link'])).toBe(false);
  expect(assignmentRecipient({handlingMode:'HUMAN'},'ana',['link'])).toBe(false);
  expect(assignmentRecipient({handlingMode:'HUMAN',departmentId:'ceeb'},'ana',['link'])).toBe(false);
 });
 it('uses an individual destination before the department and respects notification preferences',()=>{
  const assigned={handlingMode:'HUMAN',departmentId:'link',assigneeId:'ana'};
  expect(assignmentRecipient(assigned,'bob',['link'])).toBe(false);
  expect(assignmentRecipient(assigned,'ana',['link'])).toBe(true);
  expect(assignmentRecipient(assigned,'ana',['link'],{users:false})).toBe(false);
  expect(assignmentRecipient({handlingMode:'HUMAN',departmentId:'link'},'ana',['link'])).toBe(true);
  expect(assignmentRecipient({handlingMode:'HUMAN',departmentId:'link'},'ana',['link'],{departments:false})).toBe(false);
 });
});
