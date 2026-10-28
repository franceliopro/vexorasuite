import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const credentialProviders = ['openrouter', 'openai', 'gemini', 'anthropic', 'deepseek', 'qwen', 'brave'] as const;
export type CredentialProvider = typeof credentialProviders[number];
const environment = { openrouter: 'OPENROUTER_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', deepseek: 'DEEPSEEK_API_KEY', qwen: 'DASHSCOPE_API_KEY', brave: 'BRAVE_SEARCH_API_KEY' } as const;
const object = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
function encryptionKey() {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ServiceUnavailableException('A proteção das conexões de IA precisa ser configurada no servidor.');
  return createHash('sha256').update('vexora-ai-credentials-v1:').update(secret).digest();
}
export function encryptProviderKey(tenantId: string, provider: CredentialProvider, key: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(tenantId + ':' + provider));
  const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
/** Tenant overrides never fall through to a shared server key if decryption fails. */
export function providerApiKey(provider: string, integrations?: unknown, tenantId = ''): string | undefined {
  if (!(credentialProviders as readonly string[]).includes(provider)) return undefined;
  const selected = provider as CredentialProvider;
  const stored = object(object(integrations).aiProviderCredentials)[selected];
  if (stored === undefined) return process.env[environment[selected]]?.trim() || undefined;
  try {
    const [version, iv, tag, bytes, extra] = String(object(stored).encryptedKey || '').split('.');
    if (!tenantId || version !== 'v1' || !iv || !tag || !bytes || extra || Buffer.from(iv, 'base64url').length !== 12 || Buffer.from(tag, 'base64url').length !== 16) throw Error('Invalid credential');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(tenantId + ':' + selected));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(bytes, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new ServiceUnavailableException('Não foi possível abrir a chave de IA desta empresa. Cadastre-a novamente em Agentes de IA.');
  }
}
export function providerConnectionStatus(integrations: unknown, tenantId: string) {
  return credentialProviders.map(provider => {
    const stored = object(object(integrations).aiProviderCredentials)[provider];
    try {
      return { provider, configured: Boolean(providerApiKey(provider, integrations, tenantId)), source: stored !== undefined ? 'tenant' : process.env[environment[provider]]?.trim() ? 'server' : null, needsRepair: false };
    } catch {
      return { provider, configured: false, source: 'tenant', needsRepair: true };
    }
  });
}
