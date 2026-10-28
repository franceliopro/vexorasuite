import { LlmProvider, remoteProviders, providerHeaders } from './llm-providers';
import { recordProviderLimit } from "./provider-usage";
import { Injectable, BadGatewayException, BadRequestException } from "@nestjs/common";
import { localServiceUrl } from './local-services';

export type AiMessage = { role: "system" | "user" | "assistant"; content: string | ({type:"text";text:string}|{type:"image_url";image_url:{url:string}})[] };
export type AiProvider = { provider: LlmProvider; model: string; apiKey: string; timeoutMs?: number; maxTokens?: number; freeOnly?:boolean };
export type AiResult = { text: string; model: string; requestedModel?:string; provider: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } };

@Injectable()
export class AiService {
  async generate(messages: AiMessage[], providers: AiProvider[], accept: (text: string) => boolean = () => true): Promise<AiResult> {
    if (!messages.length || !providers.length) throw new BadRequestException("Messages and providers required");
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let invalidContent=false;const failures:string[]=[];
    for (const p of providers.slice(0,3)) {
      if (!p.apiKey || !p.model) continue;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(p.timeoutMs ?? 30000, 1000), 120000));
      try {
        const endpoint = p.provider === 'ollama'?localServiceUrl('OLLAMA_BASE_URL','/v1/chat/completions'):remoteProviders[p.provider]?.base+(p.provider==='anthropic'?'/messages':'/chat/completions');
        const response = await fetch(endpoint, {
          method: "POST", headers: { ...(p.provider==='ollama'?{}:providerHeaders(p.provider,p.apiKey)), "content-type": "application/json" },
          body: JSON.stringify({ model: p.model, ...(p.provider==='anthropic'?{
 system:messages.filter(m=>m.role==='system').map(m=>typeof m.content==='string'?m.content:m.content.filter(c=>c.type==='text').map(c=>c.type==='text'?c.text:'').join('\n')).join('\n'),
 messages:messages.filter(m=>m.role!=='system').map(m=>({role:m.role,content:typeof m.content==='string'?m.content:m.content.map(c=>c.type==='text'?c:{type:'image',source:{type:'url',url:c.image_url.url}})}))
 }:{messages}), [p.provider==='openai'?'max_completion_tokens':'max_tokens']: Math.min(Math.max(p.maxTokens ?? 500, 1), 2000),...(p.provider==='openrouter'&&p.freeOnly?{provider:{max_price:{prompt:0,completion:0},data_collection:'deny'},plugins:[{id:'web',enabled:false}]}:{}) }), signal: controller.signal, redirect: 'error',
        });
        if (!response.ok){recordProviderLimit(p.apiKey,response.status);failures.push(`${p.provider}: HTTP ${response.status}`);continue;}
        const data = await response.json() as { model?:unknown; content?:Array<{type:string;text?:string}>; choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?:number; output_tokens?:number } };
        usage.promptTokens += data.usage?.prompt_tokens ?? data.usage?.input_tokens ?? 0;
        usage.completionTokens += data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0;
        usage.totalTokens += data.usage?.total_tokens ?? ((data.usage?.prompt_tokens ?? data.usage?.input_tokens ?? 0) + (data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0));
        const text = p.provider==='anthropic'?data.content?.filter(c=>c.type==='text').map(c=>c.text||'').join('\n'):data.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim() || !accept(text)){invalidContent=true;continue;}
        const model=typeof data.model==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,159}$/.test(data.model)?data.model:p.model;
        return { text, provider: p.provider, model, requestedModel:p.model, usage };
      } catch {
        // Continue to the next configured provider without leaking credentials.
        failures.push(`${p.provider}: indisponível ou tempo esgotado`);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new BadGatewayException(invalidContent?'A IA respondeu, mas o roteiro não veio no formato esperado. Tente novamente.':'Não foi possível obter resposta dos provedores de IA. '+failures.join('; '));
  }
}

