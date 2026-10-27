import { Injectable, BadGatewayException, BadRequestException } from "@nestjs/common";
import { localServiceUrl } from './local-services';

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiProvider = { provider: "openrouter" | "openai" | "ollama"; model: string; apiKey: string; timeoutMs?: number; maxTokens?: number; freeOnly?:boolean };
export type AiResult = { text: string; model: string; requestedModel?:string; provider: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } };

@Injectable()
export class AiService {
  async generate(messages: AiMessage[], providers: AiProvider[], accept: (text: string) => boolean = () => true): Promise<AiResult> {
    if (!messages.length || !providers.length) throw new BadRequestException("Messages and providers required");
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (const p of providers.slice(0,3)) {
      if (!p.apiKey || !p.model) continue;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(p.timeoutMs ?? 30000, 1000), 120000));
      try {
        const endpoint = p.provider === 'ollama'?localServiceUrl('OLLAMA_BASE_URL','/v1/chat/completions'):p.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        const response = await fetch(endpoint, {
          method: "POST", headers: { ...(p.provider==='ollama'?{}:{authorization: `Bearer ${p.apiKey}`}), "content-type": "application/json" },
          body: JSON.stringify({ model: p.model, messages, max_tokens: Math.min(Math.max(p.maxTokens ?? 500, 1), 2000),...(p.provider==='openrouter'&&p.freeOnly?{provider:{max_price:{prompt:0,completion:0},data_collection:'deny'},plugins:[{id:'web',enabled:false}]}:{}) }), signal: controller.signal, redirect: 'error',
        });
        if (!response.ok) continue;
        const data = await response.json() as { model?:unknown; choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
        usage.promptTokens += data.usage?.prompt_tokens ?? 0;
        usage.completionTokens += data.usage?.completion_tokens ?? 0;
        usage.totalTokens += data.usage?.total_tokens ?? ((data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0));
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim() || !accept(text)) continue;
        const model=typeof data.model==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,159}$/.test(data.model)?data.model:p.model;
        return { text, provider: p.provider, model, requestedModel:p.model, usage };
      } catch {
        // Continue to the next configured provider without leaking credentials.
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new BadGatewayException("No configured AI provider returned a valid response");
  }
}

