import { BadGatewayException, BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAccessService } from '../operations/google-access.service';
import { AuthenticatedRequest } from '../auth/auth.types';
const FOLDER='application/vnd.google-apps.folder',MAX=20*1024*1024;
export function driveId(value:unknown,root=false){if(typeof value!=='string'||(!/^[\w-]{10,180}$/.test(value)&&!(root&&value==='root')))throw new BadRequestException('Identificador de arquivo/pasta inválido.');return value;}
export function driveName(value:unknown){if(typeof value!=='string'||!value.trim()||value.length>180||/[\r\n\x00]/.test(value))throw new BadRequestException('Use um nome de até 180 caracteres.');return value.trim();}
export function driveQuery(value:string){return value.replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
@Injectable()
export class DriveManagerService {
 constructor(private readonly prisma:PrismaService,private readonly google:GoogleAccessService){}
 private authorize(req:AuthenticatedRequest){if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Gerenciamento do Drive restrito à administração.');}
 private async request(req:AuthenticatedRequest,accountId:string,path:string,init:RequestInit={}){
  this.authorize(req);const token=await this.google.token(req.user.tenantId,accountId,'drive');
  const response=await fetch('https://www.googleapis.com/drive/v3/'+path,{...init,headers:{authorization:'Bearer '+token,...(init.body?{'content-type':'application/json'}:{}),...init.headers},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok){if([401,403,404].includes(response.status))throw new ForbiddenException('O Google não autorizou esta operação. Confira a conta, as permissões do arquivo e a autorização de gerenciamento.');throw new BadGatewayException('O Google Drive não confirmou a operação.');}return response;
 }
 async accounts(req:AuthenticatedRequest){this.authorize(req);const rows=await this.prisma.googleConnection.findMany({where:{tenantId:req.user.tenantId,NOT:{disabledServices:{has:'drive'}}},select:{id:true,email:true,scopes:true}});return rows.filter(a=>a.scopes.includes('https://www.googleapis.com/auth/drive')).map(a=>({id:a.id,email:a.email,canManage:a.scopes.split(' ').includes('https://www.googleapis.com/auth/drive'),limited:!a.scopes.split(' ').some(s=>['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive.readonly'].includes(s))}));}
 async list(req:AuthenticatedRequest,accountId:string,input:{parent?:string;q?:string;pageToken?:string;view?:string}){
  for(const key of ['parent','q','pageToken','view'] as const)if(input[key]!==undefined&&typeof input[key]!=='string')throw new BadRequestException('Consulta inválida.');
  const parent=driveId(input.parent||'root',true);if((input.q?.length||0)>120||(input.pageToken?.length||0)>2048||!['folder','shared','trash'].includes(input.view||'folder'))throw new BadRequestException('Consulta inválida.');
  const conditions=[input.view==='trash'?'trashed = true':'trashed = false'];
  if(input.view==='shared')conditions.push('sharedWithMe = true');else if(input.view!=='trash')conditions.push("'"+parent+"' in parents");
  if(input.q?.trim())conditions.push("name contains '"+driveQuery(input.q.trim())+"'");
  const query=new URLSearchParams({q:conditions.join(' and '),fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,size,modifiedTime,parents,webViewLink,capabilities(canEdit,canTrash,canDownload))',pageSize:'50',orderBy:'folder,name_natural',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(input.pageToken?{pageToken:input.pageToken}:{})});
  return (await this.request(req,accountId,'files?'+query)).json();
 }
 private async metadata(req:AuthenticatedRequest,accountId:string,id:string){return (await this.request(req,accountId,'files/'+driveId(id,true)+'?fields=id,name,mimeType,size,parents,trashed,capabilities(canEdit,canTrash,canDownload)&supportsAllDrives=true')).json() as Promise<any>;}
 private async audit(req:AuthenticatedRequest,action:string,file:any){await this.prisma.auditLog.create({data:{tenantId:req.user.tenantId,userId:req.user.sub,action,entityType:'drive_file',entityId:String(file.id),details:{name:String(file.name||'').slice(0,180)}}});}
 async folder(req:AuthenticatedRequest,accountId:string,input:{name?:string;parent?:string}){
  const parent=await this.metadata(req,accountId,driveId(input.parent||'root',true));if(parent.mimeType!==FOLDER||parent.trashed)throw new BadRequestException('Destino inválido.');
  const result=await (await this.request(req,accountId,'files?fields=id,name,mimeType&supportsAllDrives=true',{method:'POST',body:JSON.stringify({name:driveName(input.name),mimeType:FOLDER,parents:[parent.id]})})).json();await this.audit(req,'drive.folder.created',result);return result;
 }
 async change(req:AuthenticatedRequest,accountId:string,id:string,input:{name?:string;parent?:string;trashed?:boolean}){
  driveId(id);const file=await this.metadata(req,accountId,id),body:Record<string,unknown>={},query=new URLSearchParams({fields:'id,name,mimeType,parents,trashed',supportsAllDrives:'true'});
  if(input.name!==undefined)body.name=driveName(input.name);
  if(input.trashed!==undefined){if(typeof input.trashed!=='boolean')throw new BadRequestException('Estado inválido.');body.trashed=input.trashed;}
  if(input.parent!==undefined){driveId(input.parent,true);if(input.parent===id)throw new BadRequestException('Uma pasta não pode ser movida para ela mesma.');const target=await this.metadata(req,accountId,input.parent);if(target.mimeType!==FOLDER||target.trashed)throw new BadRequestException('Destino inválido.');query.set('addParents',target.id);if(file.parents?.length)query.set('removeParents',file.parents.join(','));}
  if(!Object.keys(body).length&&!input.parent)throw new BadRequestException('Selecione uma alteração.');
  const result=await (await this.request(req,accountId,'files/'+id+'?'+query,{method:'PATCH',body:JSON.stringify(body)})).json();await this.audit(req,input.trashed===true?'drive.file.trashed':input.trashed===false?'drive.file.restored':'drive.file.updated',result);return result;
 }
 async upload(req:AuthenticatedRequest,accountId:string,parentId:string,file?:{buffer:Buffer;size:number;originalname:string;mimetype:string}){
  this.authorize(req);if(!file||!file.buffer.length||file.size>MAX)throw new BadRequestException('Envie um arquivo de até 20 MB.');const parent=await this.metadata(req,accountId,driveId(parentId||'root',true));if(parent.mimeType!==FOLDER||parent.trashed)throw new BadRequestException('Destino inválido.');
  const token=await this.google.token(req.user.tenantId,accountId,'drive');const mime=/^[\w.+-]+\/[\w.+-]+$/.test(file.mimetype)?file.mimetype:'application/octet-stream';
  const initial=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType&supportsAllDrives=true',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(file.size)},body:JSON.stringify({name:driveName(file.originalname),parents:[parent.id]}),redirect:'error',signal:AbortSignal.timeout(15000)});
  const location=initial.headers.get('location');if(!initial.ok||!location)throw new BadGatewayException('Google não iniciou o envio.');const target=new URL(location);if(target.protocol!=='https:'||target.hostname!=='www.googleapis.com'||!target.pathname.startsWith('/upload/drive/v3/'))throw new BadGatewayException('Destino de envio inválido.');
  const uploaded=await fetch(target,{method:'PUT',headers:{authorization:'Bearer '+token,'content-type':mime,'content-length':String(file.size)},body:new Uint8Array(file.buffer),signal:AbortSignal.timeout(20000),redirect:'error'});if(!uploaded.ok)throw new BadGatewayException('Envio não confirmado. Confira a pasta antes de repetir.');const result=await uploaded.json();await this.audit(req,'drive.file.uploaded',result);return result;
 }
 async download(req:AuthenticatedRequest,accountId:string,id:string){
  const file=await this.metadata(req,accountId,driveId(id));if(file.mimeType===FOLDER||file.capabilities?.canDownload===false||Number(file.size||0)>MAX)throw new BadRequestException('Arquivo não disponível para download de até 20 MB.');
  const native=String(file.mimeType).startsWith('application/vnd.google-apps.');const type=native?'application/pdf':file.mimeType;const path='files/'+id+(native?'/export?mimeType=application%2Fpdf':'?alt=media&supportsAllDrives=true');const response=await this.request(req,accountId,path);const reader=response.body?.getReader();if(!reader)throw new BadGatewayException('Arquivo vazio.');const chunks:Buffer[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX)throw new BadRequestException('Arquivo acima de 20 MB.');chunks.push(Buffer.from(part.value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return {name:file.name+(native?'.pdf':''),type,buffer:Buffer.concat(chunks)};
 }
}
