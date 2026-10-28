import { AssistantAutomationService, parseCarousel, slideSvg } from './assistant-automation.service';
import { economicalProviders } from './economical-providers';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
const carousel={title:'Rastreamento de veículos',caption:'Confira as dicas.',slides:[{title:'Segurança e tranquilidade',body:'Conheça os recursos disponíveis na sua plataforma.'},{title:'Mantenha seu cadastro atualizado',body:'Seu telefone atualizado facilita o atendimento.'},{title:'Gostou do conteúdo?',body:'Curta, comente e compartilhe.'}]};
describe('research and marketing skills',()=>{
 it('validates structured model output',()=>{expect(parseCarousel(JSON.stringify(carousel))).toEqual(carousel);expect(parseCarousel('{"title":"fake"}')).toBeNull();expect(parseCarousel('not JSON')).toBeNull();});
 it('escapes hostile SVG content and renders PNG with no image model',async()=>{const svg=slideSvg({...carousel,slides:[{title:'<script>',body:'A & B'}]},0,'invalid');expect(svg).toContain('&lt;script&gt;');const buffer=await sharp(Buffer.from(slideSvg(carousel,0,'#5865da','Rastreabem'))).png().toBuffer();const meta=await sharp(buffer).metadata();expect(meta.width).toBe(1080);expect(meta.height).toBe(1350);if(process.env.VEXORA_QA_OUTPUT)writeFileSync(process.env.VEXORA_QA_OUTPUT+'/carousel-qa.png',buffer);});
 it('sorts explicitly configured models by cost tier',()=>{const before=process.env.OPENROUTER_API_KEY;process.env.OPENROUTER_API_KEY='test';try{expect(economicalProviders({llm:{provider:'openrouter',model:'large',tier:'Inteligente'},fallbackModels:[{provider:'openrouter',model:'small',tier:'Econômico'}]}).map(p=>p.model)).toEqual(['small','large']);}finally{if(before===undefined)delete process.env.OPENROUTER_API_KEY;else process.env.OPENROUTER_API_KEY=before;}});
 it('rejects unsigned media and non-admin publication',async()=>{const service=new AssistantAutomationService({} as any,{} as any,{} as any,{} as any);expect(()=>service.authorize({user:{role:'AGENT'}} as any)).toThrow();});
 it('fails clearly when no research connector is configured',async()=>{const before=process.env.BRAVE_SEARCH_API_KEY;delete process.env.BRAVE_SEARCH_API_KEY;try{const service=new AssistantAutomationService({} as any,{} as any,{} as any,{} as any);await expect(service.search('tema')).rejects.toThrow('BRAVE_SEARCH_API_KEY');}finally{if(before!==undefined)process.env.BRAVE_SEARCH_API_KEY=before;}});
});

