import {ChatbotDraftController,validDraft} from './chatbot-draft.controller';
describe('chatbot draft persistence',()=>{
 it('accepts blocks dragged left and above the origin and rejects invalid coordinates',()=>{
  const draft={name:'Meu chatbot',welcome:'',steps:[{id:'start',title:'Enviar mensagem',message:'Olá',options:[],position:{x:-350.25,y:-120}}]};
  expect(validDraft(draft)).toBe(true);
  draft.steps[0]!.position.x=Number.NEGATIVE_INFINITY;
  expect(validDraft(draft)).toBe(false);
  draft.steps[0]!.position.x=-(Number.MAX_SAFE_INTEGER+1);
  expect(validDraft(draft)).toBe(false);
 });
 it('saves and reloads an intentionally empty flow while preserving other integrations',async()=>{let integrations:any={google:{connected:true},chatbotDraft:{steps:[{id:'old'}]}};const tx:any={$queryRaw:jest.fn(),tenant:{findUniqueOrThrow:jest.fn(async()=>({integrations})),update:jest.fn(async args=>{integrations=args.data.integrations})}};const db:any={...tx,$transaction:(fn:any)=>fn(tx)};const controller=new ChatbotDraftController(db),request:any={user:{tenantId:'tenant',role:'OWNER'}};const draft={name:'Meu chatbot',welcome:'Olá',steps:[],channelIds:[],triggers:[{kind:'message'}]};expect(await controller.save(request,{draft})).toEqual(expect.objectContaining({saved:true}));expect((await controller.read(request)).draft).toEqual(draft);expect(integrations.google.connected).toBe(true)});
 it('does not accept a disconnected tenant role saving drafts',async()=>{const db:any={$transaction:jest.fn()};await expect(new ChatbotDraftController(db).save({user:{role:'AGENT'}} as any,{draft:{}})).rejects.toThrow();expect(db.$transaction).not.toHaveBeenCalled()});
});
