/** Fixed provider origins: credentials and prompts never follow caller-supplied endpoints. */
export const llmProviders = ['ollama','openrouter','openai','gemini','anthropic','deepseek','qwen'] as const;
export type LlmProvider = typeof llmProviders[number];
export const remoteProviders = {
 openrouter:{base:'https://openrouter.ai/api/v1',models:'https://openrouter.ai/api/v1/models?sort=pricing-low-to-high'},
 openai:{base:'https://api.openai.com/v1',models:'https://api.openai.com/v1/models'},
 gemini:{base:'https://generativelanguage.googleapis.com/v1beta/openai',models:'https://generativelanguage.googleapis.com/v1beta/openai/models'},
 anthropic:{base:'https://api.anthropic.com/v1',models:'https://api.anthropic.com/v1/models?limit=100'},
 deepseek:{base:'https://api.deepseek.com',models:'https://api.deepseek.com/models'},
 qwen:{base:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',models:'https://dashscope-intl.aliyuncs.com/api/v1/models?providers=qwen&capabilities=TG&page_size=100'}
} as const;
export function providerHeaders(provider:string,key:string):Record<string,string>{
 return provider==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:{authorization:'Bearer '+key};
}
