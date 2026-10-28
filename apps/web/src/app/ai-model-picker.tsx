"use client";
export const llmLabels:Record<string,string>={ollama:"Local · Ollama",openrouter:"OpenRouter",openai:"OpenAI",gemini:"Google Gemini",anthropic:"Claude · Anthropic",deepseek:"DeepSeek",qwen:"Qwen · Alibaba Cloud (Singapura)"};
export type CatalogModel={id:string;name:string;provider:string;tier?:string;pricePerMillionInputUsd?:number|null};
export function AiModelPicker({label,provider,value,models,onChange}:{label:string;provider:string;value:string;models:CatalogModel[];onChange:(value:string)=>void}){
 const options=models.filter(m=>m.provider===provider);
 const items=provider==='openrouter'&&!options.some(m=>m.id==='openrouter/free')?[{id:'openrouter/free',name:'OpenRouter Free',provider},...options]:options;
 return <div className="ai-model-picker"><label>{label}<select value={items.some(m=>m.id===value)?value:""} onChange={e=>onChange(e.target.value)}>
 <option value="">{value?"Modelo informado manualmente":items.length?"Selecione um modelo":"Nenhum modelo retornado"}</option>
 {items.map(m=><option key={m.id} value={m.id}>{m.name}{provider==='ollama'?' · instalado':''}{typeof m.pricePerMillionInputUsd==='number'?' · US$ '+Number(m.pricePerMillionInputUsd.toFixed(4))+'/1M entrada':''}</option>)}
 </select></label><details><summary>Informar ID do modelo</summary><label>ID do modelo<input value={value} onChange={e=>onChange(e.target.value)} placeholder="ID fornecido pelo provedor"/></label></details></div>;
}
