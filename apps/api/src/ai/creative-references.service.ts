import { isUUID } from "class-validator";
import { BadGatewayException, BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/auth.types';
import { GoogleAccessService } from '../operations/google-access.service';
const MIME = ['image/png','image/jpeg','image/webp','image/gif','image/bmp','image/tiff','image/heic','video/mp4','video/webm','video/quicktime','video/x-m4v','video/avi','video/x-msvideo','video/x-matroska','video/3gpp','audio/mpeg','audio/ogg','audio/wav','audio/mp4','audio/webm','audio/opus','audio/amr','audio/3gpp','application/pdf','application/rtf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet','application/vnd.oasis.opendocument.presentation','application/zip','application/x-7z-compressed','application/vnd.rar','application/x-rar-compressed','text/plain','text/csv'];
const MAX_BYTES = 20 * 1024 * 1024;
export type ReferenceInput = { accountId?: string; fileId?: string; purpose?: string; instructions?: string; enabled?: boolean };
export function driveFileId(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('Informe o ID ou link do arquivo no Drive.');
  let id = value.trim();
  if (id.startsWith('https://')) {
    let url:URL;try{url=new URL(id)}catch{throw new BadRequestException("Link do Drive inválido.")}
    if (url.hostname !== 'drive.google.com') throw new BadRequestException('Use um arquivo do Google Drive.');
    id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id') || '';
  }
  if (!/^[\w-]{10,180}$/.test(id)) throw new BadRequestException('ID de arquivo do Drive inválido.');
  return id;
}
export function referenceFields(input: ReferenceInput) {
  if (input.purpose !== undefined && !['ALL','ART','CAROUSEL','VIDEO','BRANDING'].includes(input.purpose)) throw new BadRequestException('Finalidade inválida.');
  if (input.instructions !== undefined && (typeof input.instructions !== 'string' || input.instructions.length > 2000)) throw new BadRequestException('Use até 2 mil caracteres nas orientações.');
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') throw new BadRequestException('Estado inválido.');
  return { purpose: input.purpose || 'ALL', instructions: input.instructions?.trim() || '', enabled: input.enabled ?? true };
}
@Injectable()
export class CreativeReferencesService {
  constructor(private readonly prisma: PrismaService, private readonly google: GoogleAccessService) {}
  authorize(req: AuthenticatedRequest) { if (!['OWNER','ADMIN'].includes(req.user.role)) throw new ForbiddenException('Biblioteca criativa restrita à administração.'); }
  async accounts(req: AuthenticatedRequest) {
    this.authorize(req);
    const rows = await this.prisma.googleConnection.findMany({ where: { tenantId: req.user.tenantId, NOT: { disabledServices: { has: 'drive' } } }, select: { id: true, email: true, scopes: true } });
    return rows.filter(row => row.scopes.split(' ').some(s => ['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive'].includes(s))).map(({id,email})=>({id,email}));
  }
  async list(req: AuthenticatedRequest) {
    this.authorize(req);
    return this.prisma.creativeReference.findMany({ where: { tenantId: req.user.tenantId,deletedAt:null }, select: { id:true,name:true,mimeType:true,purpose:true,instructions:true,palette:true,enabled:true,accountId:true,updatedAt:true,account:{select:{email:true,disabledServices:true}} }, orderBy: { createdAt:'desc' }, take: 100 });
  }
  private async metadata(req: AuthenticatedRequest, accountId: string, id: string) {
    const token = await this.google.token(req.user.tenantId,accountId,'drive');
    const params = new URLSearchParams({ fields:'id,name,mimeType,size,trashed,capabilities(canDownload)',supportsAllDrives:'true' });
    const response = await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?'+params,{ headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(12000),redirect:'error' });
    if (!response.ok) throw new BadRequestException('Arquivo não acessível por esta conexão. Com drive.file, importe um arquivo criado/autorizado para a Véxora ou envie-o pela biblioteca.');
    const file = await response.json() as {id:string;name:string;mimeType:string;size?:string;trashed?:boolean;capabilities?:{canDownload?:boolean}};
    if (file.trashed || !MIME.includes(file.mimeType) || Number(file.size||0)>MAX_BYTES || file.capabilities?.canDownload === false) throw new BadRequestException('Use PNG, JPEG, WebP, MP4 ou PDF com até 20 MB e permissão de leitura.');
    return file;
  }
  async import(req: AuthenticatedRequest, input: ReferenceInput) {
    this.authorize(req);const fields=referenceFields(input);
    if (!input.accountId || !isUUID(input.accountId)) throw new BadRequestException('Selecione uma conta Drive desta empresa.');
    const id=driveFileId(input.fileId),file=await this.metadata(req,input.accountId,id);
    const count=await this.prisma.creativeReference.count({where:{tenantId:req.user.tenantId,deletedAt:null}});
    const existing=await this.prisma.creativeReference.findUnique({where:{tenantId_accountId_fileId:{tenantId:req.user.tenantId,accountId:input.accountId,fileId:id}}});
    if(!existing&&count>=100)throw new BadRequestException('A biblioteca aceita até 100 referências por empresa.');
    // Existing references are retained on reimport; only explicit fields are changed.
    return this.prisma.creativeReference.upsert({where:{tenantId_accountId_fileId:{tenantId:req.user.tenantId,accountId:input.accountId,fileId:id}},create:{tenantId:req.user.tenantId,accountId:input.accountId,fileId:id,name:file.name.slice(0,200),mimeType:file.mimeType,...fields},update:{name:file.name.slice(0,200),mimeType:file.mimeType,deletedAt:null,...(input.purpose!==undefined?{purpose:fields.purpose}:{}),...(input.instructions!==undefined?{instructions:fields.instructions}:{}),...(input.enabled!==undefined?{enabled:fields.enabled}:{})}});
  }
  async upload(req: AuthenticatedRequest,input: ReferenceInput,file?:{buffer:Buffer;size:number;mimetype:string;originalname:string}) {
    this.authorize(req);referenceFields(input);
    if(!file||!file.buffer.length||file.size>MAX_BYTES||!MIME.includes(file.mimetype))throw new BadRequestException('Envie uma referência suportada com até 20 MB.');
    if(!input.accountId||!isUUID(input.accountId))throw new BadRequestException('Selecione uma conta Drive.');
    const token=await this.google.token(req.user.tenantId,input.accountId,'drive');
    if(file.mimetype.startsWith('image/')){try{const meta=await sharp(file.buffer,{limitInputPixels:40000000}).metadata();const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'};if(meta.format!==formats[file.mimetype]||(meta.width||0)*(meta.height||0)>40000000)throw new Error();}catch{throw new BadRequestException('Imagem inválida ou com resolução excessiva.');}}
    // Resumable upload supports video references without expanding OAuth scope or making files public.
    const initial=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','X-Upload-Content-Type':file.mimetype,'X-Upload-Content-Length':String(file.size)},body:JSON.stringify({name:file.originalname.replace(/[\r\n<>]/g,'').slice(0,180),mimeType:file.mimetype,appProperties:{vexoraTenant:req.user.tenantId,purpose:'creative-reference'}}),signal:AbortSignal.timeout(12000),redirect:'error'});
    const location=initial.headers.get('location');
    if(!initial.ok||!location)throw new BadGatewayException('Google Drive não iniciou o envio.');
    const target=new URL(location);if(target.protocol!=='https:'||target.hostname!=='www.googleapis.com'||!target.pathname.startsWith('/upload/drive/v3/'))throw new BadGatewayException('Destino de upload Google inválido.');
    const uploaded=await fetch(target,{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':file.mimetype,'content-length':String(file.size)},body:new Uint8Array(file.buffer),signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!uploaded.ok)throw new BadGatewayException('O envio ao Drive não foi confirmado.');
    const result=await uploaded.json() as {id?:string};if(!result.id)throw new BadGatewayException('Google não informou o arquivo enviado.');
    return this.import(req,{...input,fileId:result.id});
  }
  private async owned(req: AuthenticatedRequest,id:string,requireAccount=true){this.authorize(req);const row=await this.prisma.creativeReference.findFirst({where:{id,tenantId:req.user.tenantId}});if(!row)throw new NotFoundException('Referência não encontrada nesta empresa.');if(requireAccount&&!row.accountId)throw new BadRequestException('A conta Drive desta referência foi desconectada. Importe novamente pela nova conexão.');return row;}
  async remove(req:AuthenticatedRequest,id:string){const row=await this.owned(req,id,false);return this.prisma.$transaction(async tx=>{await tx.creativeReference.update({where:{id:row.id},data:{enabled:false,deletedAt:new Date()}});await tx.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action:'creative.reference.removed',entityType:'creative_reference',entityId:row.id,details:{name:row.name}}});return {removed:true};});}
  async restore(req:AuthenticatedRequest,id:string){const row=await this.owned(req,id,false);return this.prisma.creativeReference.update({where:{id:row.id},data:{deletedAt:null,enabled:false}});}
  async update(req: AuthenticatedRequest,id:string,input:ReferenceInput){const row=await this.owned(req,id,false);referenceFields(input);return this.prisma.creativeReference.update({where:{id:row.id},data:{...(input.purpose!==undefined?{purpose:input.purpose}:{}),...(input.instructions!==undefined?{instructions:input.instructions.trim()}:{}),...(input.enabled!==undefined?{enabled:input.enabled}:{})}});}
  async bytes(req:AuthenticatedRequest,id:string){
    const row=await this.owned(req,id);await this.metadata(req,row.accountId!,row.fileId);
    const token=await this.google.token(req.user.tenantId,row.accountId!,'drive');
    const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(row.fileId)+'?alt=media',{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok||Number(response.headers.get('content-length')||0)>MAX_BYTES)throw new BadGatewayException('Drive não disponibilizou a referência.');
    const reader=response.body?.getReader();if(!reader)throw new BadGatewayException('Referência vazia.');
    const chunks:Buffer[]=[];let size=0;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BYTES)throw new BadRequestException('Referência acima do limite de 20 MB.');chunks.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    return {row,buffer:Buffer.concat(chunks)};
  }
  async analyze(req:AuthenticatedRequest,id:string){
    const {row,buffer}=await this.bytes(req,id);if(!row.mimeType.startsWith('image/'))throw new BadRequestException('A extração automática de paleta aceita imagens. Para PDF/vídeo use as orientações da referência.');
    let colors:string[];
    try{const {data,info}=await sharp(buffer,{limitInputPixels:40000000}).resize(48,48,{fit:'inside'}).removeAlpha().raw().toBuffer({resolveWithObject:true});const counts=new Map<string,number>();for(let i=0;i<data.length;i+=info.channels){const rgb=[data[i]!,data[i+1]!,data[i+2]!].map(v=>Math.min(255,Math.round(v/32)*32));if(Math.max(...rgb)-Math.min(...rgb)<22)continue;const color='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');counts.set(color,(counts.get(color)||0)+1);}colors=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c])=>c);}catch{throw new BadRequestException('Não foi possível analisar esta imagem.');}
    await this.prisma.creativeReference.update({where:{id:row.id},data:{palette:colors}});
    return {palette:colors,usedAi:false,tokensUsed:0};
  }
  async brief(req:AuthenticatedRequest,purpose:'ART'|'CAROUSEL'|'VIDEO',scope?:{accountId:string;fileIds:string[]}){
    this.authorize(req);
    const rows=await this.prisma.creativeReference.findMany({where:{tenantId:req.user.tenantId,enabled:true,purpose:{in:['ALL',purpose]},...(scope?{accountId:scope.accountId,fileId:{in:scope.fileIds}}:{accountId:{not:null}}),account:{is:{tenantId:req.user.tenantId,NOT:{disabledServices:{has:'drive'}}}}},orderBy:{updatedAt:'desc'},take:purpose==='VIDEO'?100:8,select:{id:true,name:true,mimeType:true,instructions:true,palette:true,purpose:true}});
    return rows.map(r=>({id:r.id,name:r.name,mimeType:r.mimeType,instructions:r.instructions,purpose:r.purpose,palette:Array.isArray(r.palette)?r.palette.filter((c):c is string=>typeof c==='string'&&/^#[\da-f]{6}$/i.test(c)):[]}));
  }
}
