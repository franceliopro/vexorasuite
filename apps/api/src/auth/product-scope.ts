import {ForbiddenException} from '@nestjs/common';
/** Fixed release scope; stored legacy configuration cannot re-enable retired actions. */
export function assertProductRoute(path:string,method:string){
 const p=path.replace(/^\/api\//,'').replace(/^\//,'').split('?')[0]||'';
 const write=!['GET','HEAD','OPTIONS'].includes(method.toUpperCase());
 if(/^wordpress(?:\/|$)|^communications\/gateways(?:\/|$)/.test(p)
 ||write&&(/^mail(?:\/|$)/.test(p)||/^marketing\/(?:jobs|workflows|prepared)(?:\/|$)/.test(p)&&!p.endsWith('/cancel')
 ||/^assistant\/automations\/[^/]+\/publish$/.test(p)))
 throw new ForbiddenException('Este recurso foi retirado do escopo atual. Prepare e revise o conteúdo manualmente.');
}
export function assertSocialRequest(path:string,method:string){
 const p=path.split('?')[0]||'';
 if(method!=='GET'&&/^\/(?:posts|ads|advertising|campaigns)(?:\/|$)/i.test(p))
 throw new ForbiddenException('Publicação automática e anúncios estão desativados nesta versão.');
}
export function assertDraftInput(value:any){
 if(!value||typeof value.question!=='string'||!value.question.trim()||value.question.length>2000||!['POST','CAROUSEL'].includes(value.format)
 ||value.publish===true||value.scheduledFor||value.narrate===true)
 throw new ForbiddenException('Crie uma arte ou carrossel para revisão manual. Vídeos e publicação automática foram retirados.');
}
