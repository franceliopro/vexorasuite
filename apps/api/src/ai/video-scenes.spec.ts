import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { composeVideoScene, researchTopic, selectVideoReferences, videoOverlay } from './video-scenes';
import { AssistantAutomationService } from './assistant-automation.service';

describe('video composition and research context',()=>{
 it('keeps the topic when a format appears later in the request',()=>{
  expect(researchTopic('Rastreamento de frotas: explique como acompanhar veículos. Crie um vídeo curto vertical em português.')).toBe('Rastreamento de frotas');
  expect(researchTopic('Crie um vídeo curto vertical sobre rastreamento de frotas. Use referências.')).toBe('rastreamento de frotas');
  expect(researchTopic('Postura profissional: crie um post sobre isso')).toBe('Postura profissional');
 });
 it('selects matching images and excludes unrelated artwork and PDFs',()=>{
  const refs=[{id:'birthday',name:'dia do cliente.jpg',instructions:'',mimeType:'image/jpeg'},{id:'fleet',name:'rastreamento-de-frotas.jpg',instructions:'',mimeType:'image/jpeg'},{id:'pdf',name:'rastreamento.pdf',instructions:'',mimeType:'application/pdf'}];
  expect(selectVideoReferences(refs,'Rastreamento de frotas').map(r=>r.id)).toEqual(['fleet']);
  expect(selectVideoReferences(refs,'assunto diferente').map(r=>r.id)).toEqual(['birthday','fleet']);
 });
 it('composes the actual reference pixels into a vertical frame',async()=>{
  const photo=await sharp({create:{width:400,height:400,channels:3,background:'#e42a36'}}).png().toBuffer();
  const scene={title:'Sua frota em movimento',body:'Entenda como acompanhar veículos e organizar sua operação.'};
  const buffer=await composeVideoScene(scene,0,5,'#5865da','Véxora Suite',photo);
  const meta=await sharp(buffer).metadata();expect(meta.width).toBe(720);expect(meta.height).toBe(1280);
  const pixel=await sharp(buffer).extract({left:360,top:400,width:1,height:1}).removeAlpha().raw().toBuffer();expect([...pixel]).toEqual([228,42,54]);
  if(process.env.VEXORA_QA_OUTPUT)writeFileSync(process.env.VEXORA_QA_OUTPUT+'/video-scene-qa.png',buffer);
 });
 it('escapes injected text and keeps video-specific footer',()=>{
  const svg=videoOverlay({title:'<script>',body:'A & B'},4,5,'javascript:bad','<empresa>',false);
  expect(svg).toContain('&lt;script&gt;');expect(svg).not.toContain('<script>');expect(svg).toContain('VAMOS CONVERSAR?');expect(svg).not.toContain('DESLIZE');expect(svg).not.toContain('javascript:bad');
 });
 it('does not render disabled references or references outside the recorded briefing',async()=>{
  const req:any={user:{role:'OWNER',tenantId:'tenant'}};
  const data:any={format:'VIDEO',sceneReferenceIds:['ref'],referenceIds:['ref'],carousel:{slides:[]}};
  const prisma:any={auditLog:{findFirst:jest.fn().mockResolvedValue({details:data})}};
  const references:any={bytes:jest.fn().mockResolvedValue({row:{enabled:false,purpose:'VIDEO',mimeType:'image/png'},buffer:Buffer.alloc(0)})};
  const service=new AssistantAutomationService(prisma,{} as any,{} as any,references);
  await expect(service.videoScenes(req,'id')).rejects.toThrow('desativada');
  references.bytes.mockClear();data.referenceIds=[];
  await expect(service.videoScenes(req,'id')).rejects.toThrow('fora do briefing');expect(references.bytes).not.toHaveBeenCalled();
 });
 it('serves the saved scene for new videos without re-downloading Drive',async()=>{
  const prisma:any={auditLog:{findFirst:jest.fn().mockResolvedValue({details:{video:{visualVersion:2}}})}};
  const video:any={readScene:jest.fn().mockResolvedValue(Buffer.from('saved-frame'))};
  const references:any={bytes:jest.fn()};const service=new AssistantAutomationService(prisma,{} as any,{} as any,references,video);
  expect((await service.preview({user:{role:'OWNER',tenantId:'tenant'}} as any,'id',2)).toString()).toBe('saved-frame');
  expect(video.readScene).toHaveBeenCalledWith('tenant','id',2);expect(references.bytes).not.toHaveBeenCalled();
 });
});
