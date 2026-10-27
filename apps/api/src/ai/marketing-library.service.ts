import { BadGatewayException, BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { mutateTenantSetting } from '../prisma/tenant-settings';
import { AuthenticatedRequest } from '../auth/auth.types';
import { GoogleAccessService } from '../operations/google-access.service';
import { CreativeReferencesService } from './creative-references.service';
const object=(v:any):Record<string,any>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const MIME=['image/png','image/jpeg','image/webp','video/mp4','application/pdf'];
export function folderId(value:unknown){
 if(typeof value!=='string')throw new BadRequestException('Informe a pasta do Drive.');
 let id=value.trim();
 if(id.startsWith('https://')){let u:URL;try{u=new URL(id)}catch{throw new BadRequestException('Link inválido.')}if(u.hostname!=='drive.google.com')throw new BadRequestException('Use uma pasta do Drive.');id=u.pathname.match(/\/folders\/([\w-]+)/)?.[1]||'';}
 if(!/^[\w-]{10,180}$/.test(id))throw new BadRequestException('ID de pasta inválido.');return id;
}
@Injectable()
export class MarketingLibraryService {
 constructor(private readonly prisma:PrismaService,private readonly google:GoogleAccessService,private readonly references:CreativeReferencesService){}
 async config(req:AuthenticatedRequest){this.references.authorize(req);const t=await this.prisma.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}});return object(object(t.integrations).marketing);}
 async save(req:AuthenticatedRequest,input:{accountId?:string;folderId?:string;accountEmail?:string;autoPublish?:boolean}){
  this.references.authorize(req);const id=folderId(input.folderId);
  if(!input.accountId||!isUUID(input.accountId)||typeof input.autoPublish!=='boolean')throw new BadRequestException('Selecione conta e preferência de publicação.');
  const account=await this.prisma.googleConnection.findFirst({where:{id:input.accountId,tenantId:req.user.tenantId}});
  this.google.assertScope(account,'drive');
  if(!account||!account.scopes.split(' ').some(s=>['https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive'].includes(s)))throw new ForbiddenException('Autorize a leitura da biblioteca de pastas do Drive.');
  if(input.accountEmail&&input.accountEmail.toLowerCase()!==account.email.toLowerCase())throw new BadRequestException('Esta conexão não corresponde ao e-mail da pasta.');
  const token=await this.google.token(req.user.tenantId,account.id,'drive');
  const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,trashed&supportsAllDrives=true',{headers:{authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new BadRequestException('Pasta não acessível nesta conta.');const folder=await response.json() as any;
  if(folder.trashed||folder.mimeType!=='application/vnd.google-apps.folder')throw new BadRequestException('Selecione uma pasta ativa.');
  return mutateTenantSetting(this.prisma,req.user.tenantId,'marketing',current=>{const c=object(current);return {...c,accountId:account.id,accountEmail:account.email,folderId:id,folderName:String(folder.name).slice(0,200),autoPublish:input.autoPublish!,...(c.folderId===id&&c.accountId===account.id?{}:{syncedAt:null,fileIds:[]})};});
 }
 async sync(req:AuthenticatedRequest,force=false){
  const config=await this.config(req);
  if(!config.accountId||!config.folderId)throw new BadRequestException('Configure a pasta de referências antes de criar conteúdo.');
  const token=await this.google.token(req.user.tenantId,config.accountId,'drive');
  if(!force&&config.syncedAt&&Date.now()-Date.parse(config.syncedAt)<15*60000&&!config.syncErrors?.length&&config.fileIds?.length)return {cached:true,files:config.fileIds.length};
  const ids:string[]=[],errors:{file:string;message:string}[]=[];let pageToken:string|undefined;
  for(let page=0;page<4;page++){
   const query=new URLSearchParams({q:"'"+folderId(config.folderId)+"' in parents and trashed = false",fields:'nextPageToken,files(id,name,mimeType,size)',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})});
   const response=await fetch('https://www.googleapis.com/drive/v3/files?'+query,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!response.ok)throw new BadGatewayException('Não foi possível ler a pasta.');const data=await response.json() as any;
   for(const file of data.files||[]){
    if(!MIME.includes(file.mimeType)||Number(file.size||0)>20*1024*1024)continue;
    ids.push(file.id);if(ids.length>100)throw new BadRequestException('Use até 100 referências suportadas na pasta.');
    try{const row=await this.references.import(req,{accountId:config.accountId,fileId:file.id});if(file.mimeType.startsWith('image/'))await this.references.analyze(req,row.id);}
    catch(error){errors.push({file:String(file.name).slice(0,200),message:error instanceof Error?error.message:'Falha ao importar'});}
   }
   pageToken=data.nextPageToken;if(!pageToken)break;
  }
  if(pageToken)throw new BadRequestException('Separe as referências em uma pasta menor.');
  const removed=(Array.isArray(config.fileIds)?config.fileIds:[]).filter((id:string)=>!ids.includes(id));
  if(removed.length)await this.prisma.creativeReference.updateMany({where:{tenantId:req.user.tenantId,accountId:config.accountId,fileId:{in:removed}},data:{enabled:false}});
  await mutateTenantSetting(this.prisma,req.user.tenantId,'marketing',current=>({...object(current),syncedAt:new Date().toISOString(),fileIds:ids,syncErrors:errors}));
  if(errors.length)throw new BadRequestException({message:'Algumas referências não puderam ser lidas. Corrija a biblioteca antes de publicar.',errors});
  if(!ids.length)throw new BadRequestException('A pasta não contém referências suportadas.');return {files:ids.length,usedAi:false};
 }
}
