import { modelCatalog } from './model-catalog';
import { VoiceService } from './voice.service';
jest.mock('./provider-credentials',()=>({providerApiKey:()=>undefined}));
describe('speech model catalogs and private previews',()=>{
 const env={...process.env};
 afterEach(()=>{process.env={...env};jest.restoreAllMocks();});
 it('separates installed STT from TTS and never invents local models',async()=>{
  process.env.LOCAL_VOICE_URL='http://speaches:8000';delete process.env.OLLAMA_BASE_URL;
  const fetcher=jest.spyOn(global,'fetch').mockImplementation(async url=>{
   const address=String(url);
   return new Response(JSON.stringify({data:address.includes('task=automatic-speech-recognition')?[{id:'installed-whisper'}]:address.includes('task=text-to-speech')?[{id:'installed-kokoro'}]:[]}));
  });
  const catalog=await modelCatalog({},'tenant');
  expect(catalog.models.filter(m=>m.provider==='local-stt').map(m=>m.id)).toEqual(['installed-whisper']);
  expect(catalog.models.filter(m=>m.provider==='local-tts').map(m=>m.id)).toEqual(['installed-kokoro']);
  expect(catalog.models.filter(m=>m.installed)).toHaveLength(2);
  expect(fetcher.mock.calls.filter(([url])=>String(url).includes('speaches:8000'))).toHaveLength(2);
 });
 function service(skills:string[]){
  process.env.LOCAL_VOICE_URL='http://speaches:8000';
  const tx:any={$queryRaw:jest.fn(),auditLog:{count:jest.fn().mockResolvedValue(0),create:jest.fn()}};
  const prisma:any={tenant:{findUniqueOrThrow:jest.fn().mockResolvedValue({integrations:{assistant:{enabled:false,dailyAiLimit:100,agents:[{id:'agent',enabled:false,allowedActions:skills,stt:{provider:'local',model:'installed-whisper'},tts:{provider:'local',model:'installed-kokoro'}}]}}})},$transaction:(fn:any)=>fn(tx)};
  return new VoiceService(prisma);
 }
 const req:any={user:{role:'OWNER',tenantId:'tenant',sub:'user'}};
 const file={buffer:Buffer.from('audio'),size:5,mimetype:'audio/mpeg',originalname:'test.mp3'};
 it('permits a private transcription preview of a disabled agent and preserves its model',async()=>{
  const selected=service(['voice.stt']);
  const fetcher=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({text:'Olá, teste de voz.'})));
  await expect(selected.transcribe(req,file,'agent')).rejects.toThrow('Assistente desabilitada');
  const result=await selected.transcribe(req,file,'agent',true);
  expect(result).toEqual({text:'Olá, teste de voz.',model:'installed-whisper'});
  const [url,init]=fetcher.mock.calls[0]!;
  expect(url).toBe('http://speaches:8000/v1/audio/transcriptions');
  expect((init?.body as FormData).get('model')).toBe('installed-whisper');
 });
 it('does not bypass the STT Skill in private preview',async()=>{
  const selected=service([]);const fetcher=jest.spyOn(global,'fetch');
  await expect(selected.transcribe(req,file,'agent',true)).rejects.toThrow('Skill');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('reports an uninstalled TTS model and rejects empty provider audio',async()=>{
  const selected=service(['voice.tts']);
  const fetcher=jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response('missing',{status:404})).mockResolvedValueOnce(new Response(new Uint8Array()));
  await expect(selected.speak(req,'teste','agent',true)).rejects.toThrow('não instalado');
  await expect(selected.speak(req,'teste','agent',true)).rejects.toThrow('áudio vazio');
  expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
