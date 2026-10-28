import { installedVoiceOptions, VoiceOption } from './voice-options';
import { providerApiKey } from './provider-credentials';
import { remoteProviders, llmProviders, providerHeaders } from './llm-providers';
import { localServiceUrl } from './local-services';
import { rememberModelPrices } from './model-prices';
export async function modelCatalog(integrations:unknown,tenantId:string){
 const voiceOptions:VoiceOption[]=[];
 const models:any[]=[],services:{provider:string;available:boolean;message?:string;partial?:boolean}[]=[];
 const targets=[...llmProviders,'local-stt','local-tts'];
 await Promise.all(targets.map(async provider=>{
  try{
   const local=provider==='ollama'||provider==='local-stt'||provider==='local-tts';
   const definition=remoteProviders[provider as keyof typeof remoteProviders];
   const key=local||provider==='openrouter'?'':providerApiKey(provider,integrations,tenantId);
   if(!local&&provider!=='openrouter'&&!key){services.push({provider,available:false,message:'Cadastre a chave deste provedor em Conexões de IA.'});return;}
   let url=provider==='ollama'?localServiceUrl('OLLAMA_BASE_URL','/api/tags'):provider.startsWith('local-')?localServiceUrl('LOCAL_VOICE_URL','/v1/models?task='+(provider==='local-stt'?'automatic-speech-recognition':'text-to-speech')):definition.models;
   const headers=key?providerHeaders(provider,key):{};
   const deadline=Date.now()+10000;
   for(let page=1;page<=10;page++){
    const remaining=deadline-Date.now();if(remaining<=0)throw Error('timeout');
    const response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(remaining)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json() as any;
    const items=provider==='ollama'?data.models:provider==='qwen'?data.output?.models:data.data;
    if(!Array.isArray(items))throw Error('Invalid catalog');
    if(provider==='openrouter')rememberModelPrices(items);
    for(const item of items.slice(0,1000)){
     const id=provider==='ollama'?item.name:provider==='qwen'?item.model:item.id;
     if(typeof id!=='string'||!id||id.length>180||models.some(m=>m.provider===provider&&m.id===id))continue;
     if(provider==='openai'){
      const kind=/^(whisper-1|gpt-transcribe(?:-|$)|gpt-4o(?:-mini)?-transcribe(?:-|$))/.test(id)&&!/diarize/.test(id)?'stt':/^(tts-1(?:-hd)?|gpt-4o-mini-tts)(?:-|$)/.test(id)?'tts':null;
      if(kind)models.push({provider:'openai-'+kind,id,name:id,installed:false,pricePerMillionInputUsd:null});
     }
     // Text-only editor: omit known non-chat OpenAI models, retain manual entry for custom IDs.
     if(provider==='openai'&&(!/^(gpt-|chatgpt-|o[1-9]|ft:)/.test(id)||/audio|realtime|transcribe|tts|image|search|codex/.test(id)))continue;
     if(item.lifecycle==='retired')continue;
     if(provider==='local-tts')voiceOptions.push(...installedVoiceOptions(id,item.voices));
     const size=Number(item.size||0);
     models.push({provider,id,name:String(item.display_name||item.name||id),installed:local,
      tier:provider==='ollama'?(size<=3e9?'Econômico':size<=6e9?'Equilíbrio':'Inteligente'):undefined,
      pricePerMillionInputUsd:item.pricing?.prompt!==undefined?Number(item.pricing.prompt)*1e6:null,
      pricePerMillionOutputUsd:item.pricing?.completion!==undefined?Number(item.pricing.completion)*1e6:null});
    }
    const more=provider==='anthropic'?data.has_more===true:provider==='qwen'?page*100<Number(data.output?.total):false;
    if(!more){services.push({provider,available:true});return;}
    if(page===10){services.push({provider,available:true,partial:true,message:'Catálogo parcial; informe o ID manualmente se necessário.'});return;}
    const next=new URL(definition.models);
    if(provider==='anthropic'){if(typeof data.last_id!=='string')throw Error('Invalid cursor');next.searchParams.set('after_id',data.last_id);}
    else next.searchParams.set('page_no',String(page+1));
    url=next.toString();
   }
  }catch{services.push({provider,available:false,message:'Não foi possível consultar o catálogo. Verifique a chave e a disponibilidade do serviço.'});}
 }));
 return {providers:llmProviders,voices:{stt:['local','openai','browser'],tts:['local','openai','browser']},models,voiceOptions,services,live:services.some(s=>s.available)};
}
