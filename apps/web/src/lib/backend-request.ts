export class RequestBodyTooLarge extends Error {}
export function trustedRequestOrigin(request:Request,publicUrl?:string){
 if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 const origin=request.headers.get('origin');if(!origin)return true;
 const url=new URL(request.url);const allowed=new Set([url.origin]);
 if(publicUrl){try{allowed.add(new URL(publicUrl).origin)}catch{}}
 const host=(request.headers.get('x-forwarded-host')||request.headers.get('host')||'').split(',')[0]!.trim();
 const protocol=(request.headers.get('x-forwarded-proto')||url.protocol.replace(':','')).split(',')[0]!.trim();
 if(/^[a-z\d.:[\]-]+$/i.test(host)&&['http','https'].includes(protocol))allowed.add(protocol+'://'+host);
 return allowed.has(origin);
}
export async function limitedRequestBody(request:Request,maxBytes=22*1024*1024):Promise<ArrayBuffer>{
 if(Number(request.headers.get('content-length')||0)>maxBytes)throw new RequestBodyTooLarge();
 const reader=request.body?.getReader();if(!reader)return new ArrayBuffer(0);const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>maxBytes)throw new RequestBodyTooLarge();chunks.push(item.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result.buffer;
}
