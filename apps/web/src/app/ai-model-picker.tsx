"use client";
export const llmLabels:Record<string,string>={ollama:"Local · Ollama",openrouter:"OpenRouter",openai:"OpenAI",gemini:"Google Gemini",anthropic:"Claude · Anthropic",deepseek:"DeepSeek",qwen:"Qwen · Alibaba Cloud (Singapura)"};
export type CatalogModel={id:string;name:string;provider:string;tier?:string;installed?:boolean;pricePerMillionInputUsd?:number|null};
export function AiModelPicker({label,provider,value,models,onChange}:{label:string;provider:string;value:string;models:CatalogModel[];onChange:(value:string)=>void}){
 const options=models.filter(m=>m.provider===provider);
 const items:CatalogModel[]=provider==='openrouter'&&!options.some(m=>m.id==='openrouter/free')?[{id:'openrouter/free',name:'OpenRouter Free',provider},...options]:options;
 return <div className="ai-model-picker"><label>{label}<select value={items.some(m=>m.id===value)?value:""} onChange={e=>onChange(e.target.value)}>
 <option value="">{value?"Modelo informado manualmente":items.length?"Selecione um modelo":"Nenhum modelo retornado"}</option>
 {items.map(m=><option key={m.id} value={m.id}>{m.name}{m.installed||provider==='ollama'?' · instalado':''}{typeof m.pricePerMillionInputUsd==='number'?' · US$ '+Number(m.pricePerMillionInputUsd.toFixed(4))+'/1M entrada':''}</option>)}
 </select></label><details><summary>Informar ID do modelo</summary><label>ID do modelo<input value={value} onChange={e=>onChange(e.target.value)} placeholder="ID fornecido pelo provedor"/></label></details></div>;
}

export function AiVoiceModelPicker({label,kind,provider,value,models,onChange}:{label:string;kind:'stt'|'tts';provider:string;value:string;models:CatalogModel[];onChange:(value:string)=>void}){
 if(provider==='browser')return <label>{label}<select value="browser" onChange={()=>onChange('browser')}><option value="browser">Voz do navegador</option></select></label>;
 return <AiModelPicker label={label} provider={provider+'-'+kind} value={value} models={models} onChange={onChange}/>;
}

export type VoiceOption={id:string;model:string;name:string;language:string;gender:string};
export function TtsVoicePicker({provider,model,value,voices,onChange}:{provider:string;model:string;value:string;voices:VoiceOption[];onChange:(voice:string)=>void}){
 if(provider!=="local")return null;
 const rank=(language:string)=>language==="pt-br"?0:language.startsWith("pt")?1:language.startsWith("es")?2:language.startsWith("en")?3:4;
 const options=voices.filter(v=>v.model===model).sort((a,b)=>rank(a.language)-rank(b.language)||a.name.localeCompare(b.name));
 const language=(value:string)=>value==="pt-br"?"Português do Brasil":value.startsWith("pt")?"Português":value.startsWith("es")?"Espanhol":value==="en-us"?"Inglês americano":value==="en-gb"?"Inglês britânico":value.startsWith("en")?"Inglês":value;
 const name=(value:string)=>value.replace(/^[a-z]{2}_/,"").replace(/^speaches-ai\/piper-/,"").replace(/_/g," ");
 return <label>Voz<select value={value} onChange={e=>onChange(e.target.value)}><option value="">Padrão do modelo</option>{value&&!options.some(v=>v.id===value)&&<option value={value}>{value} · não retornada pelo catálogo</option>}{options.map(v=><option key={v.id} value={v.id}>{name(v.name)} · {language(v.language)}{v.gender==="female"?" · feminina":v.gender==="male"?" · masculina":""}</option>)}</select>{options.length===0&&<small>Atualize os modelos para consultar as vozes instaladas.</small>}</label>;
}
