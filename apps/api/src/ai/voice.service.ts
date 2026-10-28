import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { dailyAiLimit, reserveAiExecution } from './ai-budget';
import { providerApiKey } from './provider-credentials';
import { localServiceUrl } from './local-services';
const object=(v:any):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
@Injectable()
export class VoiceService {
 constructor(private readonly prisma:PrismaService){}
 private async selection(req:AuthenticatedRequest,kind:'stt'|'tts',agentId?:string,preview=false){
  if(!['OWNER','ADMIN','MANAGER'].includes(req.user.role))throw new ForbiddenException('Permissão de voz insuficiente.');
  const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
  const assistant=object(object(tenant.integrations).assistant);if(!assistant.enabled&&!preview)throw new ForbiddenException('Assistente desabilitada.');
  const agent=agentId?(Array.isArray(assistant.agents)?assistant.agents.find((a:any)=>a.id===agentId&&(a.enabled||preview)):null):null;
  if(agentId&&(!agent||!agent.allowedActions?.includes('voice.'+kind)))throw new ForbiddenException('Agente sem esta Skill de voz.');
  let selected=object(agent?.[kind]||assistant[kind]);
  if((!selected.provider||selected.provider==='browser')&&process.env.LOCAL_VOICE_URL)selected={provider:'local',model:kind==='stt'?(process.env.LOCAL_STT_MODEL||'Systran/faster-whisper-small'):(process.env.LOCAL_TTS_MODEL||'speaches-ai/Kokoro-82M-v1.0-ONNX')};
  if(!['openai','local'].includes(selected.provider)||typeof selected.model!=='string'||!selected.model||selected.endpoint)throw new BadRequestException('Selecione voz local ou OpenAI e um modelo válido. A voz do navegador é executada pela interface.');
  const policy=object(object(tenant.integrations).aiCostPolicy);
  if(selected.provider==='openai'&&policy.freeFirst&&!policy.allowPaidFallback)throw new BadRequestException('A política gratuita está ativa. Use voz do navegador/local ou autorize provedores pagos.');
  const local=selected.provider==='local';
  const base=local?localServiceUrl('LOCAL_VOICE_URL','/v1/audio/'): 'https://api.openai.com/v1/audio/';
  const apiKey=local?undefined:providerApiKey('openai',tenant.integrations,req.user.tenantId);
  if(!local&&!apiKey)throw new ServiceUnavailableException('Cadastre a chave OpenAI em Agentes de IA para habilitar a voz.');
  await this.prisma.$transaction(tx=>reserveAiExecution(tx,req.user.tenantId,dailyAiLimit(assistant.dailyAiLimit),'voice.'+kind,req.user.sub));
  return {model:selected.model,voice:typeof selected.voice==='string'?selected.voice:local?(process.env.LOCAL_TTS_VOICE||'pf_dora'):'coral',apiKey,base};
 }
 async transcribe(req:AuthenticatedRequest,file?:{buffer:Buffer;mimetype:string;size:number;originalname:string},agentId?:string,preview=false){
  const types:Record<string,string>={'audio/ogg':'ogg','audio/opus':'opus','audio/webm':'webm','video/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','video/mp4':'mp4'};
  if(file)file={...file,mimetype:file.mimetype.split(';')[0]!.trim()};
  if(!file||!file.buffer.length||file.size>12*1024*1024||!types[file.mimetype])throw new BadRequestException('Envie áudio MP3, M4A, WAV ou WebM com até 12 MB.');
  const selected=await this.selection(req,'stt',agentId,preview);const form=new FormData();form.set('file',new Blob([new Uint8Array(file.buffer)],{type:file.mimetype}),'voice.'+types[file.mimetype]);form.set('model',selected.model);
  const response=await fetch(selected.base+'transcriptions',{method:'POST',headers:selected.apiKey?{authorization:'Bearer '+selected.apiKey}:{},body:form,signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok)throw new BadGatewayException(response.status===404?'Modelo de transcrição não instalado. Atualize a lista de STT e selecione um modelo disponível.':'A transcrição não foi confirmada pelo provedor.');const data=await response.json() as any;
  if(typeof data.text!=='string'||!data.text.trim())throw new BadGatewayException('O áudio não retornou texto.');return {text:data.text.trim().slice(0,4000),model:selected.model};
 }
 async speak(req:AuthenticatedRequest,text:string,agentId?:string,preview=false){
  if(typeof text!=='string'||!text.trim()||text.length>1500)throw new BadRequestException('Use até 1500 caracteres para a resposta por voz.');
  const selected=await this.selection(req,'tts',agentId,preview);
  const response=await fetch(selected.base+'speech',{method:'POST',headers:{...(selected.apiKey?{authorization:'Bearer '+selected.apiKey}:{}),'content-type':'application/json'},body:JSON.stringify({model:selected.model,voice:selected.voice,input:text,response_format:'mp3'}),signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok)throw new BadGatewayException(response.status===404?'Modelo de voz não instalado. Atualize a lista de TTS e selecione um modelo disponível.':'A síntese de voz não foi confirmada pelo provedor.');const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length)throw new BadGatewayException('O provedor retornou áudio vazio.');return buffer;
 }
 private async companyRequest(tenantId:string):Promise<AuthenticatedRequest>{const owner=await this.prisma.membership.findFirst({where:{tenantId,role:{in:['OWNER','ADMIN']},user:{isActive:true}},select:{userId:true,role:true,tenant:{select:{slug:true}}}});if(!owner)throw new ForbiddenException('Empresa sem administração ativa.');return {user:{tenantId,sub:owner.userId,tenantSlug:owner.tenant.slug,role:owner.role}} as AuthenticatedRequest;}
 async transcribeCustomer(tenantId:string,buffer:Buffer,mimetype:string){return this.transcribe(await this.companyRequest(tenantId),{buffer,size:buffer.length,mimetype,originalname:'voice.ogg'});}
 async speakCustomer(tenantId:string,text:string){return this.speak(await this.companyRequest(tenantId),text);}

}
