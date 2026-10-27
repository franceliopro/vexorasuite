import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
export function localServiceUrl(name:'OLLAMA_BASE_URL'|'LOCAL_VOICE_URL'|'SEARXNG_URL',path:string){
 const value=process.env[name];if(!value)throw new ServiceUnavailableException('O serviço local solicitado ainda não foi configurado no servidor.');
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw Error();return new URL(path,url.origin).toString();}catch{throw new ServiceUnavailableException('O endereço do serviço local precisa ser uma origem HTTP ou HTTPS válida.');}
}
export async function searxngSearch(query:string){
 const response=await fetch(localServiceUrl('SEARXNG_URL','/search'),{method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({q:query,format:'json',language:'pt-BR',categories:'general',safesearch:'1'}),redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new BadGatewayException('A pesquisa local está indisponível ou limitada. Confira o serviço SearXNG e o formato JSON.');
 const reader=response.body?.getReader();if(!reader)throw new BadGatewayException('A pesquisa local retornou uma resposta vazia.');
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>512*1024)throw new BadGatewayException('A resposta de pesquisa excedeu o limite.');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 let data:any;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new BadGatewayException('O serviço de pesquisa precisa devolver JSON válido.');}
 if(!Array.isArray(data.results))throw new BadGatewayException('O serviço de pesquisa retornou um formato inválido.');
 return data.results.flatMap((result:any)=>{try{const url=new URL(result.url);if(url.protocol!=='https:'||url.username||url.password)return [];return [{url:url.toString(),title:String(result.title||'Fonte').slice(0,160),description:String(result.content||'').replace(/<[^>]*>/g,'').slice(0,600)}];}catch{return [];}}).slice(0,5) as {url:string;title:string;description:string}[];
}
export function aiRuntimeStatus(root:any){const policy=root?.aiCostPolicy||{};return {costPolicy:{freeFirst:policy.freeFirst===true,allowPaidFallback:policy.allowPaidFallback===true,customerSearch:policy.customerSearch===true},research:{provider:process.env.SEARXNG_URL?'searxng':'brave',localConfigured:Boolean(process.env.SEARXNG_URL)},local:{llmConfigured:Boolean(process.env.OLLAMA_BASE_URL),voiceConfigured:Boolean(process.env.LOCAL_VOICE_URL)}};}
