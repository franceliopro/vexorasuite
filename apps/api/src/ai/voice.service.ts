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
 private async selection(req:AuthenticatedRequest,kind:'stt'|'tts',agentId?:string){
  if(!['OWNER','ADMIN','MANAGER'].includes(req.user.role))throw new ForbiddenException('Permissão de voz insuficiente.');
  const tenant=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});
  const assistant=object(object(tenant.integrations).assistant);if(!assistant.enabled)throw new ForbiddenException('Assistente desabilitada.');
  const agent=agentId?(Array.isArray(assistant.agents)?assistant.agents.find((a:any)=>a.id===agentId&&a.enabled):null):null;
  if(agentId&&(!agent||!agent.allowedActions?.includes('voice.'+kind)))throw new ForbiddenException('Agente sem esta Skill de voz.');
  const selected=object(agent?.[kind]||assistant[kind]);
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
 async transcribe(req:AuthenticatedRequest,file?:{buffer:Buffer;mimetype:string;size:number;originalname:string},agentId?:string){
  const types:Record<string,string>={'audio/webm':'webm','video/webm':'webm','audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/mp4':'m4a','video/mp4':'mp4'};
  if(!file||!file.buffer.length||file.size>12*1024*1024||!types[file.mimetype])throw new BadRequestException('Envie áudio MP3, M4A, WAV ou WebM com até 12 MB.');
  const selected=await this.selection(req,'stt',agentId);const form=new FormData();form.set('file',new Blob([new Uint8Array(file.buffer)],{type:file.mimetype}),'voice.'+types[file.mimetype]);form.set('model',selected.model);
  const response=await fetch(selected.base+'transcriptions',{method:'POST',headers:selected.apiKey?{authorization:'Bearer '+selected.apiKey}:{},body:form,signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok)throw new BadGatewayException('A transcrição não foi confirmada pelo provedor.');const data=await response.json() as any;
  if(typeof data.text!=='string'||!data.text.trim())throw new BadGatewayException('O áudio não retornou texto.');return {text:data.text.trim().slice(0,4000),model:selected.model};
 }
 async speak(req:AuthenticatedRequest,text:string,agentId?:string){
  if(typeof text!=='string'||!text.trim()||text.length>1500)throw new BadRequestException('Use até 1500 caracteres para a resposta por voz.');
  const selected=await this.selection(req,'tts',agentId);
  const response=await fetch(selected.base+'speech',{method:'POST',headers:{...(selected.apiKey?{authorization:'Bearer '+selected.apiKey}:{}),'content-type':'application/json'},body:JSON.stringify({model:selected.model,voice:selected.voice,input:text,response_format:'mp3'}),signal:AbortSignal.timeout(60000),redirect:'error'});
  if(!response.ok)throw new BadGatewayException('A síntese de voz não foi confirmada pelo provedor.');return Buffer.from(await response.arrayBuffer());
 }
}
