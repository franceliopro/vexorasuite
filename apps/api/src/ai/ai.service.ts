import { Injectable, BadGatewayException, BadRequestException } from "@nestjs/common";

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiProvider = { provider: "openrouter" | "openai"; model: string; apiKey: string; timeoutMs?: number };
export type AiResult = { text: string; model: string; provider: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } };

@Injectable()
export class AiService {
  async generate(messages: AiMessage[], providers: AiProvider[]): Promise<AiResult> {
    if (!messages.length || !providers.length) throw new BadRequestException("Messages and providers required");
    for (const p of providers) {
      if (!p.apiKey || !p.model) continue;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(p.timeoutMs ?? 30000, 1000), 120000));
      try {
        const endpoint = p.provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        const response = await fetch(endpoint, {
          method: "POST", headers: { authorization: `Bearer ${p.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ model: p.model, messages }), signal: controller.signal,
        });
        if (!response.ok) continue;
        const data = await response.json() as { choices?: Array<{ message?: { content?: unknown } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) continue;
        return { text, provider: p.provider, model: p.model, usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0, totalTokens: data.usage?.total_tokens ?? 0 } };
      } catch {
        // Continue to the next configured provider without leaking credentials.
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new BadGatewayException("No configured AI provider returned a valid response");
  }
}
