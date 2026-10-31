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
  return mutateTenantSetting(this.prisma,req.user.tenantId,'marketing',current=>{const c=object(current);return {...c,accountId:account.id,accountEmail:account.email,folderId:id,folderName:String(folder.name).slice(0,200),autoPublish:input.autoPublish!,...(c.folderId===id&&c.accountId===account.id?{}:{syncedAt:null,fileIds:[],fileVersions:{}})};});
 }
 async sync(req:AuthenticatedRequest,force=false){
  const config=await this.config(req);
  if(!config.accountId||!config.folderId)throw new BadRequestException('Configure a pasta de referências antes de criar conteúdo.');
  const token=await this.google.token(req.user.tenantId,config.accountId,'drive');
  if(!force&&config.syncedAt&&Date.now()-Date.parse(config.syncedAt)<15*60000&&!config.syncErrors?.length&&config.fileIds?.length)return {cached:true,files:config.fileIds.length};
  const ids:string[]=[],errors:{file:string;message:string}[]=[],versions:Record<string,string>={};let pageToken:string|undefined,updated=0,reused=0;
  for(let page=0;page<4;page++){
   const query=new URLSearchParams({q:"'"+folderId(config.folderId)+"' in parents and trashed = false",fields:'nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum)',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})});
   const response=await fetch('https://www.googleapis.com/drive/v3/files?'+query,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!response.ok)throw new BadGatewayException('Não foi possível ler a pasta.');const data=await response.json() as any;
   for(const file of data.files||[]){
    if(!MIME.includes(file.mimeType)||Number(file.size||0)>20*1024*1024)continue;
    ids.push(file.id);if(ids.length>100)throw new BadRequestException('Use até 100 referências suportadas na pasta.');
    try{
     const version=JSON.stringify([file.modifiedTime||'',file.md5Checksum||'',file.size||'',file.mimeType,file.name]);
     const prior=await this.prisma.creativeReference.findUnique({where:{tenantId_accountId_fileId:{tenantId:req.user.tenantId,accountId:config.accountId,fileId:file.id}},select:{id:true}});
     if(prior&&object(config.fileVersions)[file.id]===version){versions[file.id]=version;reused++;continue;}
     const row=await this.references.import(req,{accountId:config.accountId,fileId:file.id});if(file.mimeType.startsWith('image/'))await this.references.analyze(req,row.id);
     versions[file.id]=version;updated++;
    }
    catch(error){errors.push({file:String(file.name).slice(0,200),message:error instanceof Error?error.message:'Falha ao importar'});}
   }
   pageToken=data.nextPageToken;if(!pageToken)break;
  }
  if(pageToken)throw new BadRequestException('Separe as referências em uma pasta menor.');
  const removed=(Array.isArray(config.fileIds)?config.fileIds:[]).filter((id:string)=>!ids.includes(id));
  await this.prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM tenants WHERE id=${req.user.tenantId}::uuid FOR UPDATE`;
   const tenant=await tx.tenant.findUniqueOrThrow({where:{id:req.user.tenantId},select:{integrations:true}}),root=object(tenant.integrations),current=object(root.marketing);
   // A slow scan of an old folder must never replace the newly selected library.
   if(current.folderId!==config.folderId||current.accountId!==config.accountId)throw new BadRequestException('A pasta de referências mudou durante a sincronização. Sincronize a pasta atual novamente.');
   const account=await tx.googleConnection.findFirst({where:{id:config.accountId,tenantId:req.user.tenantId}});this.google.assertScope(account,'drive');
   if(removed.length)await tx.creativeReference.updateMany({where:{tenantId:req.user.tenantId,accountId:config.accountId,fileId:{in:removed}},data:{enabled:false}});
   await tx.tenant.update({where:{id:req.user.tenantId},data:{integrations:{...root,marketing:{...current,syncedAt:new Date().toISOString(),fileIds:ids,fileVersions:versions,syncErrors:errors}}}});
  });
  if(errors.length)throw new BadRequestException({message:'Algumas referências não puderam ser lidas. Corrija a biblioteca antes de publicar.',errors});
  if(!ids.length)throw new BadRequestException('A pasta não contém referências suportadas.');return {files:ids.length,updated,reused,usedAi:false};
 }
 async automation(req:AuthenticatedRequest){
  this.references.authorize(req);
  const marketing=await this.config(req);
  const automation=object(marketing.automation);
  return {enabled:automation.enabled===true,mode:automation.mode==='ASSISTED'?'ASSISTED':'RULES_ONLY',cadence:['ON_NEW_FILE','DAILY','WEEKLY'].includes(String(automation.cadence))?automation.cadence:'ON_NEW_FILE',networks:Array.isArray(automation.networks)?automation.networks.filter((v:any)=>typeof v==='string').slice(0,8):[],publishMode:automation.publishMode==='READY_FOR_REVIEW'?'READY_FOR_REVIEW':'DRAFT_ONLY',captionTemplate:typeof automation.captionTemplate==='string'?automation.captionTemplate.slice(0,500):'',folderName:typeof marketing.folderName==='string'?marketing.folderName:'',accountEmail:typeof marketing.accountEmail==='string'?marketing.accountEmail:'' ,canAutoPublish:false};
 }
 async saveAutomation(req:AuthenticatedRequest,input:any){
  this.references.authorize(req);
  const marketing=await this.config(req);
  if(!marketing.accountId||!marketing.folderId)throw new BadRequestException('Configure primeiro a pasta do Google Drive.');
  const mode=input?.mode==='ASSISTED'?'ASSISTED':'RULES_ONLY';
  const cadence=['ON_NEW_FILE','DAILY','WEEKLY'].includes(String(input?.cadence))?String(input.cadence):'ON_NEW_FILE';
  const publishMode=input?.publishMode==='READY_FOR_REVIEW'?'READY_FOR_REVIEW':'DRAFT_ONLY';
  const networks=Array.isArray(input?.networks)?input.networks.filter((v:any)=>['instagram','facebook','linkedin','google-business','tiktok'].includes(v)).slice(0,8):[];
  if(!networks.length)throw new BadRequestException('Escolha pelo menos uma rede de destino.');
  const captionTemplate=typeof input?.captionTemplate==='string'?input.captionTemplate.trim().slice(0,500):'';
  return mutateTenantSetting(this.prisma,req.user.tenantId,'marketing',current=>{
   const value=object(current);
   return {...value,automation:{enabled:input?.enabled!==false,mode,cadence,networks,publishMode,captionTemplate,updatedAt:new Date().toISOString()}};
  });
 }
}
